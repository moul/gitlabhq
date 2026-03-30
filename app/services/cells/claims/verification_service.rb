# frozen_string_literal: true

module Cells
  module Claims
    class VerificationService
      PaginationError = Class.new(RuntimeError)

      LIMIT = 1000
      GRPC_QUERY_TIMEOUT_IN_SECONDS = 10
      GRPC_RETRIES = 3
      GRPC_RETRY_BASE_INTERVAL = 0.5
      GRPC_RETRIABLE_ERRORS = [GRPC::DeadlineExceeded, GRPC::Unavailable].freeze
      MAX_GRPC_MESSAGE_BYTES = 10.megabytes
      # Estimated per-record protobuf overhead (subject, source, bucket type, varint framing).
      # The bucket value size is measured separately; this covers the remaining fixed-size fields.
      GRPC_PER_RECORD_OVERHEAD_BYTES = 200

      attr_reader :model

      # @param on_batch_processed [Proc] optional callback invoked with the last processed ID after each
      #   successful batch. The worker uses this to persist progress to Redis mid-loop, so that if a later
      #   batch fails the Sidekiq retry resumes from the last successful batch rather than restarting from
      #   the beginning of the run.
      def initialize(model, timeout:, start_id: 0, &on_batch_processed)
        @claim_service = Gitlab::TopologyServiceClient::ClaimService.instance
        @model = model
        @created_count = 0
        @destroyed_count = 0
        @runtime_limiter = Gitlab::Metrics::RuntimeLimiter.new(timeout)
        @start_id = start_id
        @on_batch_processed = on_batch_processed
      end

      def execute
        unless claimable_model?
          Gitlab::AppLogger.warn(
            class: self.class.name,
            message: "#{model.name} model is not claimable, skipping verification",
            feature_category: :cell
          )
          return { created: 0, destroyed: 0, over_time: false, last_id: nil }
        end

        reconcile_claims

        {
          created: @created_count,
          destroyed: @destroyed_count,
          over_time: runtime_limiter.was_over_time?,
          last_id: @scan_last_id
        }
      end

      private

      attr_reader :claim_service, :runtime_limiter

      def claimable_model?
        Cells::Claimable.models_with_claims.include?(model)
      end

      def reconcile_claims
        start_id = @start_id

        loop do
          local_records = find_local_records(start_id)
          break if local_records.empty?

          last_id = local_records.last.read_attribute(model.primary_key)
          ts_records = list_ts_records(model, start_id, last_id)
          created, destroyed, chunk_count = process_batch(local_records, ts_records)

          @scan_last_id = last_id
          @on_batch_processed&.call(@scan_last_id)

          over_time = runtime_limiter.over_time?
          Gitlab::AppLogger.info(
            class: self.class.name,
            message: "Cells::Claims::VerificationService batch processed",
            table_name: model.table_name,
            batch_first_id: start_id,
            batch_last_id: last_id,
            created: created,
            destroyed: destroyed,
            chunk_count: chunk_count,
            over_time: over_time,
            cell_id: claim_service.cell_id,
            feature_category: :cell
          )
          break if over_time

          start_id = last_id
        end
      end

      def find_local_records(start_id)
        pk = model.primary_key
        model.cells_claims_scope.where("#{pk} > ?", start_id).order(pk).limit(LIMIT) # rubocop:disable CodeReuse/ActiveRecord -- dynamic model
      end

      def list_ts_records(model, start_id, end_id)
        records = []
        previous_cursor = nil
        current_start_id_bytes = Cells::Serialization.to_bytes(start_id)
        end_id_bytes = Cells::Serialization.to_bytes(end_id)

        loop do
          response = fetch_ts_records_page(
            model, current_start_id_bytes, end_id_bytes
          )

          records.concat(response.records.to_a)
          break unless response.truncated

          last_id = response.records.last.metadata.source.rails_primary_key_id

          if last_id == previous_cursor
            raise PaginationError, "Pagination cursor did not advance — infinite loop detected in list_ts_records"
          end

          previous_cursor = last_id
          current_start_id_bytes = last_id
        end

        records
      end

      def fetch_ts_records_page(model, start_id_bytes, end_id_bytes)
        Retriable.retriable(on: GRPC_RETRIABLE_ERRORS, tries: GRPC_RETRIES, base_interval: GRPC_RETRY_BASE_INTERVAL) do
          claim_service.list_records(
            source_type: model.cells_claims_source_type,
            bucket_types: model.cells_claims_attributes.values.pluck(:type), # rubocop:disable Database/AvoidUsingPluckWithoutLimit,CodeReuse/ActiveRecord -- not an ActiveRecord relation
            source_id_gt: start_id_bytes,
            source_id_lte: end_id_bytes,
            deadline: grpc_deadline
          )
        end
      end

      def process_batch(local_records, ts_records)
        local_records_by_id = local_records.index_by do |r|
          Cells::Serialization.to_bytes(r.read_attribute(model.primary_key))
        end
        ts_records_by_id = ts_records.index_by { |r| r.metadata.source.rails_primary_key_id }

        creates, destroys = compute_changes(local_records_by_id, ts_records_by_id)
        chunk_count = commit_changes(creates:, destroys:)

        @created_count += creates.size
        @destroyed_count += destroys.size

        [creates.size, destroys.size, chunk_count]
      end

      def compute_changes(local_records_by_id, ts_records_map)
        creates = []
        destroys = []

        local_records_by_id.each do |id, local_record|
          ts_record = ts_records_map.delete(id)

          if ts_record.nil?
            creates.concat(local_record.cells_claims_metadata)
          else
            # exists in both
            create, destroy = diff_record(local_record, ts_record)
            creates.push(*create)
            destroys.push(*destroy)
          end
        end

        ts_records_map.each_value do |ts_record|
          # exists in TS but missing in local, delete them
          destroys << metadata_from_ts_record(ts_record)
        end

        [creates, destroys]
      end

      def diff_record(_local_record, _ts_record)
        # TODO: noop for now, will be implemented in later MR
        # as part of https://gitlab.com/gitlab-com/gl-infra/tenant-scale/cells-infrastructure/team/-/work_items/468
        [nil, nil]
      end

      def commit_changes(creates: [], destroys: [])
        return 0 if creates.empty? && destroys.empty?

        chunks = chunk_records_by_size(creates, destroys)

        chunks.each do |create_chunk, destroy_chunk|
          response = claim_service.begin_update(
            create_records: Cells::TransactionRecord.sanitize_records_for_grpc(create_chunk),
            destroy_records: Cells::TransactionRecord.sanitize_records_for_grpc(destroy_chunk),
            deadline: grpc_deadline
          )

          Retriable.retriable(
            on: GRPC_RETRIABLE_ERRORS, tries: GRPC_RETRIES, base_interval: GRPC_RETRY_BASE_INTERVAL
          ) do
            claim_service.commit_update(response.lease_uuid.value, deadline: grpc_deadline)
          end
        end

        chunks.size
      end

      # Splits create and destroy records into chunks that fit within MAX_GRPC_MESSAGE_BYTES.
      # Records are processed in order (creates first, then destroys) and packed greedily:
      #   chunk_records_by_size([c1, c2], [d1]) => [[[c1, c2], [d1]]]          (single chunk)
      #   chunk_records_by_size([big1, big2], []) => [[[big1], []], [[big2], []]] (split)
      def chunk_records_by_size(creates, destroys)
        tagged = creates.map { |r| [:create, r] } + destroys.map { |r| [:destroy, r] }
        chunks = []
        current = { create: [], destroy: [] }
        current_size = 0

        tagged.each do |type, record|
          record_size = estimate_record_size(record)

          if current_size + record_size > MAX_GRPC_MESSAGE_BYTES && current.values.any?(&:present?)
            chunks << [current[:create], current[:destroy]]
            current = { create: [], destroy: [] }
            current_size = 0
          end

          current[type] << record
          current_size += record_size
        end

        chunks << [current[:create], current[:destroy]] if current.values.any?(&:present?)
        chunks
      end

      def estimate_record_size(record)
        bucket_value_size = record.dig(:bucket, :value).to_s.bytesize
        bucket_value_size + GRPC_PER_RECORD_OVERHEAD_BYTES
      end

      def metadata_from_ts_record(record)
        meta = record.metadata
        {
          bucket: { type: meta.bucket.type, value: meta.bucket.value },
          subject: { type: meta.subject.type, id: meta.subject.id },
          source: { type: meta.source.type, rails_primary_key_id: meta.source.rails_primary_key_id }
        }
      end

      def grpc_deadline
        GRPC::Core::TimeConsts.from_relative_time(GRPC_QUERY_TIMEOUT_IN_SECONDS)
      end
    end
  end
end
