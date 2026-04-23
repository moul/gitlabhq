# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Gitlab::BackgroundMigration::BatchingStrategies::BackfillMergeRequestDiffCommitsToPartitionedBatchingStrategy, feature_category: :code_review_workflow do
  let(:strategy) { described_class.new(connection: ApplicationRecord.connection) }
  let(:diff_commits) { table(:merge_request_diff_commits) }

  let!(:row4) { diff_commits.create!(merge_request_diff_id: 3, relative_order: 0) }
  let!(:row3) { diff_commits.create!(merge_request_diff_id: 2, relative_order: 0) }
  let!(:row2) { diff_commits.create!(merge_request_diff_id: 1, relative_order: 1) }
  let!(:row1) { diff_commits.create!(merge_request_diff_id: 1, relative_order: 0) }

  let(:job_class) do
    Class.new(Gitlab::BackgroundMigration::BatchedMigrationJob) do
      cursor :merge_request_diff_id, :relative_order
    end
  end

  it { expect(described_class).to be < Gitlab::BackgroundMigration::BatchingStrategies::PrimaryKeyBatchingStrategy }

  context 'when iterating the underlying table directly' do
    it 'returns the correct composite cursor bounds for the first batch' do
      bounds = strategy.next_batch(
        :merge_request_diff_commits, :merge_request_diff_id,
        batch_min_value: [0, 0], batch_size: 2, job_arguments: [], job_class: job_class
      )

      expect(bounds).to eq([[1, 0], [1, 1]])
    end

    it 'returns nil when no rows exist at or after the cursor' do
      bounds = strategy.next_batch(
        :merge_request_diff_commits, :merge_request_diff_id,
        batch_min_value: [999, 0], batch_size: 2, job_arguments: [], job_class: job_class
      )

      expect(bounds).to be_nil
    end
  end

  context 'when iterating a view' do
    let(:view_name) { 'merge_request_diff_commits_views_1' }

    before do
      ApplicationRecord.connection.execute(<<~SQL)
        CREATE OR REPLACE VIEW #{view_name} AS
        SELECT merge_request_diff_id, relative_order
        FROM merge_request_diff_commits
        WHERE merge_request_diff_id >= 1 AND merge_request_diff_id < 3
      SQL
    end

    after do
      ApplicationRecord.connection.execute("DROP VIEW IF EXISTS #{view_name}")
    end

    it 'returns the correct composite cursor bounds without raising a cursor mismatch error' do
      bounds = strategy.next_batch(
        view_name, :merge_request_diff_id,
        batch_min_value: [0, 0], batch_size: 2, job_arguments: [], job_class: job_class
      )

      expect(bounds).to eq([[1, 0], [1, 1]])
    end

    it 'respects the view filter and does not return rows outside the view range' do
      bounds = strategy.next_batch(
        view_name, :merge_request_diff_id,
        batch_min_value: [0, 0], batch_size: 10, job_arguments: [], job_class: job_class
      )

      # row4 (diff_id=3) is outside the view range, only rows for diff_id 1 and 2 are visible
      expect(bounds).to eq([[1, 0], [2, 0]])
    end

    it 'returns nil when the cursor is past all rows in the view' do
      bounds = strategy.next_batch(
        view_name, :merge_request_diff_id,
        batch_min_value: [3, 0], batch_size: 2, job_arguments: [], job_class: job_class
      )

      expect(bounds).to be_nil
    end
  end

  context 'when job class does not use a cursor' do
    let(:non_cursor_job_class) { Class.new(Gitlab::BackgroundMigration::BatchedMigrationJob) }

    it 'delegates to the parent PrimaryKeyBatchingStrategy' do
      expect(Gitlab::Pagination::Keyset::Iterator).not_to receive(:new)

      bounds = strategy.next_batch(
        :merge_request_diff_commits, :merge_request_diff_id,
        batch_min_value: 1, batch_size: 2, job_arguments: [], job_class: non_cursor_job_class
      )

      expect(bounds).to eq([1, 1])
    end
  end
end
