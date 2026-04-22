# frozen_string_literal: true

class TruncateSbomOccurrenceRefs < Gitlab::Database::Migration[2.3]
  disable_ddl_transaction!
  milestone '19.0'

  def up
    truncate_tables!('sbom_occurrence_refs')
  end

  def down
    # no-op
  end
end
