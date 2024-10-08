# frozen_string_literal: true

class QueueRerunEpicDatesToWorkItemDatesSourcesSync < Gitlab::Database::Migration[2.2]
  milestone '17.4'
  restrict_gitlab_migration gitlab_schema: :gitlab_main

  MIGRATION = "RerunEpicDatesToWorkItemDatesSourcesSync"
  DELAY_INTERVAL = 2.minutes
  BATCH_SIZE = 500
  SUB_BATCH_SIZE = 10

  def up
    queue_batched_background_migration(
      MIGRATION,
      :epics,
      :id,
      job_interval: DELAY_INTERVAL,
      batch_size: BATCH_SIZE,
      sub_batch_size: SUB_BATCH_SIZE
    )
  end

  def down
    delete_batched_background_migration(MIGRATION, :epics, :id, [])
  end
end
