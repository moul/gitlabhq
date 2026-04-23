# frozen_string_literal: true

module Gitlab
  module BackgroundMigration
    module BatchingStrategies
      # Batching strategy for BackfillMergeRequestDiffCommitsToPartitioned.
      #
      # On GitLab.com the migration targets SQL views (merge_request_diff_commits_views_N)
      # instead of the underlying table. Views have no primary key constraint, so the default
      # PrimaryKeyBatchingStrategy cannot infer the correct keyset order via SimpleOrderBuilder
      # (which falls back to the model's inherited "id" primary key and appends it as a
      # tie-breaker, producing a keyset order that mismatches the composite cursor).
      #
      # This strategy builds the keyset order explicitly from the declared cursor columns,
      # bypassing SimpleOrderBuilder's PK inference entirely.
      class BackfillMergeRequestDiffCommitsToPartitionedBatchingStrategy < PrimaryKeyBatchingStrategy
        def next_batch(table_name, column_name, batch_min_value:, batch_size:, job_arguments:, job_class: nil)
          return super unless job_class.cursor?

          base_class = Gitlab::Database.application_record_for_connection(connection)
          model_class = define_batchable_model(table_name, connection: connection, base_class: base_class)
          cursor_columns = job_class.cursor_columns
          next_batch_bounds = nil

          keyset_order = Gitlab::Pagination::Keyset::Order.build(
            cursor_columns.map do |col|
              Gitlab::Pagination::Keyset::ColumnOrderDefinition.new(
                attribute_name: col.to_s,
                order_expression: model_class.arel_table[col].asc,
                nullable: :not_nullable
              )
            end
          )

          # rubocop:disable Lint/UnreachableLoop -- we need to use each_batch to pull one batch out
          Gitlab::Pagination::Keyset::Iterator.new(
            scope: model_class.select(cursor_columns).order(keyset_order),
            cursor: cursor_columns.zip(batch_min_value).to_h
          ).each_batch(of: batch_size, load_batch: false) do |batch|
            break unless batch.first && batch.last

            next_batch_bounds = [batch.first.values_at(cursor_columns), batch.last.values_at(cursor_columns)]
            break
          end
          # rubocop:enable Lint/UnreachableLoop

          next_batch_bounds
        end
      end
    end
  end
end
