# frozen_string_literal: true

class CreatePartitionedMergeRequestDiffCommits < Gitlab::Database::Migration[2.3]
  include Gitlab::Database::PartitioningMigrationHelpers

  milestone '18.10'

  disable_ddl_transaction!

  SOURCE_TABLE_NAME = 'merge_request_diff_commits'
  PARTITION_SIZE = 2_000_000
  INDEX_NAME = 'index_partitioned_mrdc_on_merge_request_commits_metadata_id'

  def up
    unless table_exists?(partitioned_table_name)
      create_table partitioned_table_name,
        options: 'PARTITION BY RANGE(project_id)',
        primary_key: [:merge_request_diff_id, :relative_order, :project_id] do |t|
        t.bigint :merge_request_commits_metadata_id, null: false
        t.bigint :merge_request_diff_id, null: false
        t.references :project, null: false
        t.integer :relative_order, null: false
        t.index :merge_request_commits_metadata_id, name: INDEX_NAME
      end
    end

    create_partitions
    create_partition_trigger
  end

  def down
    drop_trigger(SOURCE_TABLE_NAME, trigger_name_insert, if_exists: true)
    drop_trigger(SOURCE_TABLE_NAME, trigger_name_delete, if_exists: true)
    drop_function(insert_function_name, if_exists: true)
    drop_function(delete_function_name, if_exists: true)
    drop_partitioned_table_for(SOURCE_TABLE_NAME)
  end

  private

  def create_partitions
    min_id = Project.connection
                    .select_value("select min_value from pg_sequences where sequencename = 'projects_id_seq'") || 1

    max_id = Gitlab::Database::QueryAnalyzers::RestrictAllowedSchemas.with_suppressed do
      Gitlab::Database::QueryAnalyzers::GitlabSchemasValidateConnection.with_suppressed do
        define_batchable_model('projects', connection: connection).maximum(:id) || min_id
      end
    end

    create_int_range_partitions(partitioned_table_name, PARTITION_SIZE, min_id, max_id)
  end

  def create_partition_trigger
    # Function for INSERT
    create_trigger_function(insert_function_name, replace: false) do
      <<~SQL
        INSERT INTO #{partitioned_table_name}
          (merge_request_commits_metadata_id, project_id, merge_request_diff_id, relative_order)
        SELECT
          new_table.merge_request_commits_metadata_id,
          new_table.project_id,
          new_table.merge_request_diff_id,
          new_table.relative_order
        FROM new_table
        WHERE new_table.merge_request_commits_metadata_id IS NOT NULL
          AND new_table.project_id IS NOT NULL;

        RETURN NULL;
      SQL
    end

    # Function for DELETE
    create_trigger_function(delete_function_name, replace: false) do
      <<~SQL
        DELETE FROM #{partitioned_table_name}
        WHERE (merge_request_diff_id, relative_order, project_id) IN (
          SELECT
            old_table.merge_request_diff_id,
            old_table.relative_order,
            old_table.project_id
          FROM old_table
          WHERE old_table.project_id IS NOT NULL
        );

        RETURN NULL;
      SQL
    end

    # Create INSERT trigger
    execute(<<~SQL.squish)
      CREATE TRIGGER #{trigger_name_insert}
      AFTER INSERT ON #{SOURCE_TABLE_NAME}
      REFERENCING NEW TABLE AS new_table
      FOR EACH STATEMENT
      EXECUTE FUNCTION #{insert_function_name}();
    SQL

    # Create DELETE trigger
    execute(<<~SQL.squish)
      CREATE TRIGGER #{trigger_name_delete}
      AFTER DELETE ON #{SOURCE_TABLE_NAME}
      REFERENCING OLD TABLE AS old_table
      FOR EACH STATEMENT
      EXECUTE FUNCTION #{delete_function_name}();
    SQL
  end

  def partitioned_table_name
    @_partitioned_table_name ||= tmp_table_name(SOURCE_TABLE_NAME)
  end

  def insert_function_name
    @_insert_function_name ||= "#{make_sync_function_name(SOURCE_TABLE_NAME)}_insert"
  end

  def delete_function_name
    @_delete_function_name ||= "#{make_sync_function_name(SOURCE_TABLE_NAME)}_delete"
  end

  def trigger_name_insert
    @_trigger_name_insert ||= "#{make_sync_trigger_name(SOURCE_TABLE_NAME)}_insert"
  end

  def trigger_name_delete
    @_trigger_name_delete ||= "#{make_sync_trigger_name(SOURCE_TABLE_NAME)}_delete"
  end
end
