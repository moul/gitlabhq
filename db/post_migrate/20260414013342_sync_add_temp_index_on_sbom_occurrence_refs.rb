# frozen_string_literal: true

class SyncAddTempIndexOnSbomOccurrenceRefs < Gitlab::Database::Migration[2.3]
  disable_ddl_transaction!

  milestone '19.0'
  INDEX_NAME = 'tmp_idx_sbom_occurrence_refs_on_project_id_id'

  # rubocop:disable Migration/PreventIndexCreation -- https://gitlab.com/gitlab-org/database-team/team-tasks/-/work_items/608
  # This index was asynchronously created in
  # db/post_migrate/20260414003015_add_tmp_idx_on_project_id_id_to_sbom_occurrence_refs.rb
  def up
    add_concurrent_index :sbom_occurrence_refs, [:project_id, :id], name: INDEX_NAME
  end
  # rubocop:enable Migration/PreventIndexCreation

  def down
    remove_concurrent_index_by_name :sbom_occurrence_refs, INDEX_NAME
  end
end
