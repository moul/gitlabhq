# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Cells::Claims::VerificationService, :clean_gitlab_redis_shared_state, feature_category: :cell do
  let(:mock_claim_service) { instance_double(::Gitlab::TopologyServiceClient::ClaimService) }
  let(:lease_uuid) { SecureRandom.uuid }
  let(:fake_deadline) { 'fake-deadline' }
  let(:timeout) { 1.minute }
  let(:service) { described_class.new(User, timeout: timeout) }
  let(:begin_update_response) do
    Gitlab::Cells::TopologyService::Claims::V1::BeginUpdateResponse.new(
      lease_uuid: Gitlab::Cells::TopologyService::Types::V1::UUID.new(value: lease_uuid)
    )
  end

  before do
    stub_config_cell(enabled: true)
    allow(Gitlab::TopologyServiceClient::ClaimService).to receive(:instance).and_return(mock_claim_service)
    allow(mock_claim_service).to receive(:cell_id).and_return(1)
    allow(GRPC::Core::TimeConsts).to receive(:from_relative_time).and_return(fake_deadline)
  end

  describe '#execute' do
    context 'when model is not claimable' do
      let(:non_claimable_model) do
        Class.new(ApplicationRecord) do
          self.table_name = 'foobar'
          def self.name = 'FooBar'
        end
      end

      let(:service) { described_class.new(non_claimable_model, timeout: timeout) }

      it 'returns zero creates and destroys' do
        expect(service.execute).to include(created: 0, destroyed: 0, over_time: false)
      end

      it 'logs a warning' do
        expect(Gitlab::AppLogger).to receive(:warn).with(
          hash_including(message: /FooBar model is not claimable/)
        )

        service.execute
      end
    end

    context 'when there are no local records' do
      before do
        stub_list_records([])
      end

      it 'returns zero creates and destroys' do
        expect(service.execute).to include(created: 0, destroyed: 0, over_time: false)
      end

      it 'does not call begin_update' do
        expect(mock_claim_service).not_to receive(:begin_update)
        service.execute
      end
    end

    context 'when a local record is missing from the Topology Service' do
      let!(:user) { create(:user) }
      let(:expected_records) { user.cells_claims_metadata.map { |m| m.except(:record) } }

      before do
        stub_list_records([])
        stub_commit
      end

      it 'creates the missing record in the Topology Service' do
        expect(mock_claim_service).to receive(:begin_update).with(
          hash_including(create_records: match_array(expected_records), destroy_records: [])
        ).and_return(begin_update_response)

        service.execute
      end

      it 'commits the update' do
        expect(mock_claim_service).to receive(:commit_update).with(lease_uuid, deadline: fake_deadline)
        service.execute
      end

      it 'returns the correct create count' do
        result = service.execute
        expect(result[:created]).to eq(1 * User.cells_claims_attributes.size)
        expect(result[:destroyed]).to eq(0)
      end

      it 'returns last_id' do
        result = service.execute
        expect(result[:last_id]).to eq(user.id)
      end

      it 'logs batch progress with first and last IDs' do
        expect(Gitlab::AppLogger).to receive(:info).with(
          hash_including(
            message: "Cells::Claims::VerificationService batch processed",
            batch_first_id: 0,
            batch_last_id: user.id,
            created: User.cells_claims_attributes.size,
            destroyed: 0,
            over_time: false
          )
        )

        service.execute
      end
    end

    context 'when a Topology Service record is missing from local' do
      let(:user) { create(:user) }
      let(:orphaned_ts_record) { build_ts_record(user.id + 9999) }

      before do
        stub_list_records([orphaned_ts_record])
        stub_commit
      end

      it 'destroys the orphaned Topology Service record' do
        expect(mock_claim_service).to receive(:begin_update).with(
          hash_including(destroy_records: be_present)
        ).and_return(begin_update_response)

        service.execute
      end

      it 'returns the correct destroy count' do
        result = service.execute
        expect(result[:destroyed]).to eq(1)
      end
    end

    context 'when local and Topology Service records are in sync' do
      let(:user) { create(:user) }
      let(:ts_record) { build_ts_record(user.id) }

      before do
        stub_list_records([ts_record])
      end

      it 'does not call begin_update' do
        expect(mock_claim_service).not_to receive(:begin_update)
        service.execute
      end

      it 'returns zero creates and destroys' do
        expect(service.execute).to include(created: 0, destroyed: 0, over_time: false)
      end
    end

    context 'when list_records response is truncated' do
      let!(:user) { create(:user) }
      let(:ts_record) { build_ts_record(user.id) }

      it 'recursively fetches until not truncated' do
        truncated_response = Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
          records: [ts_record],
          truncated: true
        )
        final_response = Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
          records: [],
          truncated: false
        )

        expect(mock_claim_service).to receive(:list_records).ordered.and_return(truncated_response)
        expect(mock_claim_service).to receive(:list_records).ordered.and_return(final_response)

        service.execute
      end

      context 'when the pagination cursor does not advance' do
        it 'raises an infinite loop error on the second iteration' do
          first_response = Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
            records: [ts_record],
            truncated: true
          )
          stale_response = Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
            records: [ts_record],
            truncated: true
          )

          expect(mock_claim_service).to receive(:list_records).ordered.and_return(first_response)
          expect(mock_claim_service).to receive(:list_records).ordered.and_return(stale_response)

          expect { service.execute }.to raise_error(
            Cells::Claims::VerificationService::PaginationError,
            /Pagination cursor did not advance/
          )
        end
      end
    end

    context 'when processing multiple batches' do
      let!(:users) { create_list(:user, 3) }

      before do
        stub_const("#{described_class}::LIMIT", 2)
        stub_list_records([])
        stub_commit
      end

      it 'processes all records across batches' do
        result = service.execute
        expect(result[:created]).to eq(3 * User.cells_claims_attributes.size)
      end

      it 'returns the last_id of the final batch' do
        result = service.execute
        expect(result[:last_id]).to eq(users.last.id)
      end
    end

    context 'when start_id is provided' do
      let!(:old_user) { create(:user) }
      let!(:new_user) { create(:user) }
      let(:expected_records) { new_user.cells_claims_metadata.map { |m| m.except(:record) } }
      let(:service) { described_class.new(User, timeout: timeout, start_id: old_user.id) }

      before do
        stub_list_records([])
        stub_commit
      end

      it 'resumes from the given start_id' do
        expect(mock_claim_service).to receive(:begin_update).once.with(
          hash_including(create_records: match_array(expected_records))
        ).and_return(begin_update_response)

        service.execute
      end
    end

    context 'when runtime limit is exceeded' do
      let!(:users) { create_list(:user, 3) }
      let(:runtime_limiter) { instance_double(Gitlab::Metrics::RuntimeLimiter) }

      before do
        stub_const("#{described_class}::LIMIT", 2)
        stub_list_records([])
        stub_commit
        allow(Gitlab::Metrics::RuntimeLimiter).to receive(:new).and_return(runtime_limiter)
        # First batch completes, over_time? returns true after processing
        allow(runtime_limiter).to receive_messages(over_time?: true, was_over_time?: true)
      end

      it 'stops processing after the runtime limit is reached' do
        result = service.execute

        # Only first batch (2 users) processed, third user skipped
        expect(result[:created]).to eq(2 * User.cells_claims_attributes.size)
        expect(result[:over_time]).to be(true)
      end

      it 'returns last_id for the caller to save' do
        result = service.execute

        expect(result[:last_id]).to eq(users[1].id)
      end
    end

    context 'when a non-retriable GRPC error occurs during commit' do
      let!(:user) { create(:user) }

      before do
        stub_list_records([])
        allow(mock_claim_service).to receive(:begin_update).and_raise(GRPC::AlreadyExists.new)
      end

      it 'raises the error to stop processing' do
        expect { service.execute }.to raise_error(GRPC::AlreadyExists)
      end
    end

    context 'when a retriable GRPC error occurs during commit_update' do
      let!(:user) { create(:user) }

      before do
        stub_list_records([])
        allow(mock_claim_service).to receive(:begin_update).and_return(begin_update_response)
      end

      it 'retries on GRPC::DeadlineExceeded and succeeds' do
        call_count = 0
        allow(mock_claim_service).to receive(:commit_update) do |_uuid, **_args|
          call_count += 1
          raise GRPC::DeadlineExceeded, 'context deadline exceeded' if call_count == 1
        end

        result = service.execute
        expect(result[:created]).to eq(User.cells_claims_attributes.size)
      end

      it 'retries on GRPC::Unavailable and succeeds' do
        call_count = 0
        allow(mock_claim_service).to receive(:commit_update) do |_uuid, **_args|
          call_count += 1
          raise GRPC::Unavailable, 'transport closing' if call_count == 1
        end

        result = service.execute
        expect(result[:created]).to eq(User.cells_claims_attributes.size)
      end

      it 'raises after exhausting retries' do
        stub_const("#{described_class}::GRPC_RETRIES", 2)

        allow(mock_claim_service).to receive(:commit_update)
          .and_raise(GRPC::DeadlineExceeded.new('context deadline exceeded'))

        expect { service.execute }.to raise_error(GRPC::DeadlineExceeded)
      end
    end

    context 'when a retriable GRPC error occurs during list_ts_records' do
      let!(:users) { create_list(:user, 3) }

      before do
        stub_const("#{described_class}::LIMIT", 2)
        stub_commit
      end

      it 'retries on GRPC::DeadlineExceeded and succeeds' do
        call_count = 0
        allow(mock_claim_service).to receive(:list_records) do
          call_count += 1
          raise GRPC::DeadlineExceeded, 'context deadline exceeded' if call_count == 1

          Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
            records: [],
            truncated: false
          )
        end

        result = service.execute
        expect(result[:created]).to eq(3 * User.cells_claims_attributes.size)
      end

      it 'retries on GRPC::Unavailable and succeeds' do
        call_count = 0
        allow(mock_claim_service).to receive(:list_records) do
          call_count += 1
          raise GRPC::Unavailable, 'transport closing' if call_count == 1

          Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
            records: [],
            truncated: false
          )
        end

        result = service.execute
        expect(result[:created]).to eq(3 * User.cells_claims_attributes.size)
      end

      it 'raises after exhausting retries to stop processing' do
        stub_const("#{described_class}::GRPC_RETRIES", 2)

        allow(mock_claim_service).to receive(:list_records)
          .and_raise(GRPC::DeadlineExceeded.new('context deadline exceeded'))

        expect { service.execute }.to raise_error(GRPC::DeadlineExceeded)
      end
    end

    context 'when a non-retriable GRPC error occurs during list_ts_records' do
      let!(:user) { create(:user) }

      before do
        allow(mock_claim_service).to receive(:list_records)
          .and_raise(GRPC::PermissionDenied.new('forbidden'))
      end

      it 'raises the error without retrying to stop processing' do
        expect { service.execute }.to raise_error(GRPC::PermissionDenied)
      end
    end

    context 'when cells_claims_metadata filters out non-claimable entries' do
      let!(:user) { create(:user) }

      before do
        stub_list_records([])
        stub_commit
        allow_any_instance_of(User).to receive(:cells_claims_metadata).and_return([ # rubocop:disable RSpec/AnyInstanceOf -- need to stub on DB-loaded instances
          { bucket: { type: :user_ids, value: user.id.to_s }, subject: { type: :user, id: 1 },
            source: { type: :rails_table_users, rails_primary_key_id: Cells::Serialization.to_bytes(user.id) } }
        ])
      end

      it 'creates only the entries returned by cells_claims_metadata' do
        expect(mock_claim_service).to receive(:begin_update).with(
          hash_including(create_records: satisfy { |records| records.size == 1 })
        ).and_return(begin_update_response)

        service.execute
      end
    end

    context 'when cells_claims_metadata returns empty for all attributes' do
      let!(:user) { create(:user) }

      before do
        stub_list_records([])
        allow_any_instance_of(User).to receive(:cells_claims_metadata).and_return([]) # rubocop:disable RSpec/AnyInstanceOf -- need to stub on DB-loaded instances
      end

      it 'does not call begin_update when no creates exist' do
        expect(mock_claim_service).not_to receive(:begin_update)
        service.execute
      end
    end

    context 'when model defines cells_claims_scope' do
      let!(:user) { create(:user) }

      it 'uses cells_claims_scope for querying local records' do
        stub_list_records([])
        stub_commit

        expect(User).to receive(:cells_claims_scope).at_least(:once).and_call_original

        service.execute
      end

      context 'when cells_claims_scope filters out records' do
        let!(:included_user) { create(:user) }
        let!(:excluded_user) { create(:user) }
        let(:custom_scope) { User.where(id: included_user.id) }

        before do
          allow(User).to receive(:cells_claims_scope).and_return(custom_scope)
          stub_list_records([])
          stub_commit
        end

        it 'only processes records within the scope' do
          result = service.execute

          expect(result[:created]).to eq(User.cells_claims_attributes.size)
          expect(result[:last_id]).to eq(included_user.id)
        end
      end
    end

    context 'when on_batch_processed callback is provided' do
      let!(:users) { create_list(:user, 3) }
      let(:batch_ids) { [] }
      let(:service) do
        described_class.new(User, timeout: timeout) { |id| batch_ids << id }
      end

      before do
        stub_const("#{described_class}::LIMIT", 2)
        stub_list_records([])
        stub_commit
      end

      it 'invokes the callback after each batch' do
        service.execute
        expect(batch_ids).to eq([users[1].id, users.last.id])
      end
    end

    context 'when TS has many more records than Rails (sparse local, dense TS)' do
      let!(:user) { create(:user) }

      before do
        stub_const("#{described_class}::MAX_RECORDS_PER_CHUNK", 2)
        stub_commit

        # TS returns many orphaned records for the same ID range
        orphaned_records = (1..5).map { |i| build_ts_record(user.id + i) }
        stub_list_records(orphaned_records)
      end

      it 'splits destroys across multiple chunks respecting MAX_RECORDS_PER_CHUNK' do
        max_per_chunk = 2

        expect(mock_claim_service).to receive(:begin_update).at_least(:twice) do |args|
          total = args[:create_records].size + args[:destroy_records].size
          expect(total).to be <= max_per_chunk
          begin_update_response
        end
        expect(mock_claim_service).to receive(:commit_update).at_least(:twice)

        result = service.execute
        expect(result[:destroyed]).to eq(5)
      end
    end

    context 'when records exceed the gRPC message size limit' do
      let!(:users) { create_list(:user, 3) }
      let(:large_value) { 'x' * 2.megabytes }

      before do
        stub_const("#{described_class}::MAX_GRPC_MESSAGE_BYTES", 3.megabytes)
        stub_list_records([])
        stub_commit
        allow_any_instance_of(User).to receive(:cells_claims_metadata).and_return([ # rubocop:disable RSpec/AnyInstanceOf -- need to stub on DB-loaded instances
          { bucket: { type: :user_ids, value: large_value }, subject: { type: :user, id: 1 },
            source: { type: :rails_table_users, rails_primary_key_id: Cells::Serialization.to_bytes(1) } }
        ])
      end

      it 'splits records across multiple begin_update calls' do
        expect(mock_claim_service).to receive(:begin_update).at_least(:twice).and_return(begin_update_response)
        expect(mock_claim_service).to receive(:commit_update).at_least(:twice)

        service.execute
      end

      it 'returns the correct total create count across all chunks' do
        result = service.execute
        expect(result[:created]).to eq(3)
      end
    end
  end

  describe '#chunk_records' do
    subject(:chunks) { service.send(:chunk_records, creates, destroys) }

    let(:small_record) { { bucket: { type: :user_ids, value: 'x' * 100 }, subject: { type: :user, id: 1 } } }
    let(:large_record) { { bucket: { type: :user_ids, value: 'x' * 2.megabytes }, subject: { type: :user, id: 2 } } }

    before do
      stub_const("#{described_class}::MAX_GRPC_MESSAGE_BYTES", 3.megabytes)
    end

    context 'when both creates and destroys are empty' do
      let(:creates) { [] }
      let(:destroys) { [] }

      it 'returns an empty array' do
        expect(chunks).to eq([])
      end
    end

    context 'when all records fit within the limit' do
      let(:creates) { [small_record, small_record] }
      let(:destroys) { [small_record] }

      it 'returns a single chunk' do
        expect(chunks.length).to eq(1)
        expect(chunks[0]).to eq([[small_record, small_record], [small_record]])
      end
    end

    context 'when creates exceed the limit' do
      let(:creates) { [large_record, large_record] }
      let(:destroys) { [] }

      it 'splits into multiple chunks' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[large_record], []])
        expect(chunks[1]).to eq([[large_record], []])
      end
    end

    context 'when destroys exceed the limit' do
      let(:creates) { [] }
      let(:destroys) { [large_record, large_record] }

      it 'splits into multiple chunks' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[], [large_record]])
        expect(chunks[1]).to eq([[], [large_record]])
      end
    end

    context 'when combined creates and destroys exceed the limit' do
      let(:creates) { [large_record] }
      let(:destroys) { [large_record] }

      it 'splits across creates and destroys' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[large_record], []])
        expect(chunks[1]).to eq([[], [large_record]])
      end
    end

    context 'when a single record exceeds the limit' do
      let(:oversized) { { bucket: { type: :user_ids, value: 'x' * 5.megabytes }, subject: { type: :user, id: 3 } } }
      let(:creates) { [oversized] }
      let(:destroys) { [] }

      it 'keeps the record in its own chunk' do
        expect(chunks.length).to eq(1)
        expect(chunks[0]).to eq([[oversized], []])
      end
    end

    context 'when small records follow a large record' do
      let(:creates) { [large_record, large_record, small_record] }
      let(:destroys) { [] }

      it 'groups small records with the next large record' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[large_record], []])
        expect(chunks[1]).to eq([[large_record, small_record], []])
      end
    end

    context 'when record count exceeds MAX_RECORDS_PER_CHUNK' do
      before do
        stub_const("#{described_class}::MAX_RECORDS_PER_CHUNK", 2)
      end

      let(:creates) { [small_record, small_record, small_record] }
      let(:destroys) { [] }

      it 'splits into multiple chunks based on record count' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[small_record, small_record], []])
        expect(chunks[1]).to eq([[small_record], []])
      end
    end

    context 'when record count exceeds MAX_RECORDS_PER_CHUNK across creates and destroys' do
      before do
        stub_const("#{described_class}::MAX_RECORDS_PER_CHUNK", 2)
      end

      let(:creates) { [small_record] }
      let(:destroys) { [small_record, small_record, small_record] }

      it 'splits across both creates and destroys respecting the record cap' do
        expect(chunks.length).to eq(2)
        expect(chunks[0]).to eq([[small_record], [small_record]])
        expect(chunks[1]).to eq([[], [small_record, small_record]])
      end
    end
  end

  def build_ts_record(user_id)
    Gitlab::Cells::TopologyService::Claims::V1::Record.new(
      metadata: Gitlab::Cells::TopologyService::Claims::V1::Metadata.new(
        bucket: Gitlab::Cells::TopologyService::Claims::V1::Bucket.new(
          type: Gitlab::Cells::TopologyService::Claims::V1::Bucket::Type::USER_IDS,
          value: user_id.to_s
        ),
        subject: Gitlab::Cells::TopologyService::Claims::V1::Subject.new(
          type: Gitlab::Cells::TopologyService::Claims::V1::Subject::Type::USER,
          id: user_id
        ),
        source: Gitlab::Cells::TopologyService::Claims::V1::Source.new(
          type: Gitlab::Cells::TopologyService::Claims::V1::Source::Type::RAILS_TABLE_USERS,
          rails_primary_key_id: Cells::Serialization.to_bytes(user_id)
        )
      )
    )
  end

  def stub_list_records(records, truncated: false)
    response = Gitlab::Cells::TopologyService::Claims::V1::ListRecordsResponse.new(
      records: records,
      truncated: truncated
    )
    allow(mock_claim_service).to receive(:list_records).and_return(response)
  end

  def stub_commit(begin_update_response: self.begin_update_response)
    allow(mock_claim_service).to receive(:begin_update).and_return(begin_update_response)
    allow(mock_claim_service).to receive(:commit_update)
  end
end
