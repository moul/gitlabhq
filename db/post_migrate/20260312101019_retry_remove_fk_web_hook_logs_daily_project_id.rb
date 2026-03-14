# frozen_string_literal: true

class RetryRemoveFkWebHookLogsDailyProjectId < Gitlab::Database::Migration[2.3]
  include Gitlab::Database::PartitioningMigrationHelpers

  milestone '18.10'
  disable_ddl_transaction!

  TABLE_NAME = :web_hook_logs_daily
  FK_NAME = :fk_rails_edecc679a2

  def up
    Gitlab::Database::PostgresPartitionedTable.each_partition(TABLE_NAME) do |partition|
      with_lock_retries do
        remove_foreign_key_if_exists(partition.identifier, :projects, name: FK_NAME, reverse_lock_order: true)
      end
    end
  end

  def down
    add_concurrent_partitioned_foreign_key(
      TABLE_NAME,
      :projects,
      column: :project_id,
      on_delete: :cascade,
      validate: false,
      reverse_lock_order: true
    )
  end
end
