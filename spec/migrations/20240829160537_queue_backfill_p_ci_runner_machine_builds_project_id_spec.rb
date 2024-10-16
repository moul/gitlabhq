# frozen_string_literal: true

require 'spec_helper'
require_migration!

RSpec.describe QueueBackfillPCiRunnerMachineBuildsProjectId, migration: :gitlab_ci, feature_category: :fleet_visibility do
  let!(:batched_migration) { described_class::MIGRATION }
  let(:expected_job_args) { %i[project_id p_ci_builds project_id build_id partition_id] }

  it 'does not schedule a new batched migration' do
    reversible_migration do |migration|
      migration.before -> {
        expect(batched_migration).not_to have_scheduled_batched_migration
      }

      migration.after -> {
        expect(batched_migration).not_to have_scheduled_batched_migration
      }
    end
  end

  context 'when executed on .com' do
    before do
      allow(Gitlab).to receive(:com_except_jh?).and_return(true)
    end

    it 'does not schedule a new batched migration' do
      reversible_migration do |migration|
        migration.before -> {
          expect(batched_migration).not_to have_scheduled_batched_migration
        }

        migration.after -> {
          expect(batched_migration).not_to have_scheduled_batched_migration
        }
      end
    end
  end
end
