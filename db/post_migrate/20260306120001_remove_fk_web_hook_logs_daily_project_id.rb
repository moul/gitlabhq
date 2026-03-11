# frozen_string_literal: true

class RemoveFkWebHookLogsDailyProjectId < Gitlab::Database::Migration[2.3]
  include Gitlab::Database::PartitioningMigrationHelpers

  milestone '18.10'
  disable_ddl_transaction!

  def up
    remove_partitioned_foreign_key :web_hook_logs_daily, column: :project_id, reverse_lock_order: true
  end

  def down
    add_concurrent_partitioned_foreign_key(
      :web_hook_logs_daily,
      :projects,
      column: :project_id,
      on_delete: :cascade,
      validate: false,
      reverse_lock_order: true
    )
  end
end
