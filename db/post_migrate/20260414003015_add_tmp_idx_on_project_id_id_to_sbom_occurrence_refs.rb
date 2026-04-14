# frozen_string_literal: true

class AddTmpIdxOnProjectIdIdToSbomOccurrenceRefs < Gitlab::Database::Migration[2.3]
  milestone '19.0'

  INDEX_NAME = 'tmp_idx_sbom_occurrence_refs_on_project_id_id'

  # rubocop:disable Migration/PreventIndexCreation -- https://gitlab.com/gitlab-org/database-team/team-tasks/-/work_items/608
  def up
    prepare_async_index :sbom_occurrence_refs, [:project_id, :id], name: INDEX_NAME
  end
  # rubocop:enable Migration/PreventIndexCreation

  def down
    unprepare_async_index_by_name :sbom_occurrence_refs, INDEX_NAME
  end
end
