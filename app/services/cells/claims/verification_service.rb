# frozen_string_literal: true

module Cells
  module Claims
    class VerificationService
      PaginationError = Class.new(RuntimeError)

      LIMIT = 1000
      GRPC_QUERY_TIMEOUT_IN_SECONDS = 5
      REDIS_LAST_PROCESSED_ID_TTL = 1.hour

      attr_reader :model

      def initialize(model)
        @claim_service = Gitlab::TopologyServiceClient::ClaimService.instance
        @model = model
        @created_count = 0
        @destroyed_count = 0
      end

      def execute
        unless claimable_model?
          Gitlab::AppLogger.warn(
            class: self.class.name,
            message: "#{model.name} model is not claimable, skipping verification",
            feature_category: :cell
          )
          return { created: 0, destroyed: 0 }
        end

        reconcile_claims

        {
          created: @created_count,
          destroyed: @destroyed_count
        }
      end

      private

      attr_reader :claim_service

      def claimable_model?
        Cells::Claimable.models_with_claims.include?(model)
      end

      def reconcile_claims
        start_id = last_processed_id

        loop do
          local_records = find_local_records(start_id)
          break if local_records.empty?

          last_id = local_records.last.read_attribute(model.primary_key)
          ts_records = list_ts_records(model, start_id, last_id)

          created, destroyed, committed = process_batch(local_records, ts_records)

          save_last_processed_id(last_id) if committed
          Gitlab::AppLogger.info(
            class: self.class.name,
            message: "Cells::Claims::VerificationService batch processed",
            table_name: model.table_name,
            batch_first_id: start_id,
            batch_last_id: last_id,
            created: created,
            destroyed: destroyed,
            cell_id: claim_service.cell_id,
            feature_category: :cell
          )

          start_id = last_id
        end

        save_last_processed_id(0)
      end

      def find_local_records(start_id)
        pk = model.primary_key
        model.where("#{pk} > ?", start_id).order(pk).limit(LIMIT) # rubocop:disable CodeReuse/ActiveRecord -- dynamic model
      end

      def list_ts_records(model, start_id, end_id)
        records = []
        previous_cursor = nil
        current_start_id_bytes = Cells::Serialization.to_bytes(start_id)
        end_id_bytes = Cells::Serialization.to_bytes(end_id)

        loop do
          response = claim_service.list_records(
            source_type: model.cells_claims_source_type,
            bucket_types: model.cells_claims_attributes.values.pluck(:type), # rubocop:disable Database/AvoidUsingPluckWithoutLimit,CodeReuse/ActiveRecord -- not an ActiveRecord relation
            source_id_gt: current_start_id_bytes,
            source_id_lte: end_id_bytes,
            deadline: grpc_deadline
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

      def process_batch(local_records, ts_records)
        local_records_by_id = local_records.index_by do |r|
          Cells::Serialization.to_bytes(r.read_attribute(model.primary_key))
        end
        ts_records_by_id = ts_records.index_by { |r| r.metadata.source.rails_primary_key_id }

        creates, destroys = compute_changes(local_records_by_id, ts_records_by_id)
        committed = commit_changes(creates:, destroys:)

        if committed
          @created_count += creates.size
          @destroyed_count += destroys.size
        end

        [creates.size, destroys.size, committed]
      end

      def compute_changes(local_records_by_id, ts_records_map)
        creates = []
        destroys = []

        local_records_by_id.each do |id, local_record|
          ts_record = ts_records_map.delete(id)

          if ts_record.nil?
            # exists in local but missing in TS
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
        return true if creates.empty? && destroys.empty?

        response = claim_service.begin_update(
          create_records: Cells::TransactionRecord.sanitize_records_for_grpc(creates),
          destroy_records: Cells::TransactionRecord.sanitize_records_for_grpc(destroys)
        )

        claim_service.commit_update(response.lease_uuid.value)
        true
      rescue GRPC::BadStatus => e
        Gitlab::ErrorTracking.log_exception(e)
        false
      end

      def metadata_from_ts_record(record)
        meta = record.metadata
        {
          bucket: { type: meta.bucket.type, value: meta.bucket.value },
          subject: { type: meta.subject.type, id: meta.subject.id },
          source: { type: meta.source.type, rails_primary_key_id: meta.source.rails_primary_key_id }
        }
      end

      def last_processed_id
        Gitlab::Redis::SharedState.with { |redis| redis.get(redis_key).to_i }
      end

      def save_last_processed_id(id)
        Gitlab::Redis::SharedState.with { |redis| redis.set(redis_key, id, ex: REDIS_LAST_PROCESSED_ID_TTL) }
      end

      def redis_key
        "cells:claims:verification_service:last_processed_id:#{model.table_name}"
      end

      def grpc_deadline
        GRPC::Core::TimeConsts.from_relative_time(GRPC_QUERY_TIMEOUT_IN_SECONDS)
      end
    end
  end
end
