# frozen_string_literal: true

class RemoveFkNamespacesFileTemplateProjectId < Gitlab::Database::Migration[2.3]
  milestone '19.0'

  disable_ddl_transaction!

  def up
    with_lock_retries do
      remove_foreign_key_if_exists :namespaces, :projects,
        column: :file_template_project_id, name: 'fk_319256d87a'
    end
  end

  def down
    add_concurrent_foreign_key :namespaces, :projects,
      column: :file_template_project_id, on_delete: :nullify, name: 'fk_319256d87a'
  end
end
