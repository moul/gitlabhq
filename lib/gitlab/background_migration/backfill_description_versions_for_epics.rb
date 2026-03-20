# frozen_string_literal: true

module Gitlab
  module BackgroundMigration
    class BackfillDescriptionVersionsForEpics < BatchedMigrationJob
      cursor :id

      operation_name :backfill_description_versions_for_epics
      feature_category :portfolio_management

      def perform
        each_sub_batch do |sub_batch|
          backfill_issue_id(sub_batch)
        end
      end

      private

      def backfill_issue_id(sub_batch)
        connection.execute(<<~SQL)
          UPDATE description_versions
          SET issue_id = epics.issue_id,
              epic_id = NULL
          FROM epics
          WHERE epics.id = description_versions.epic_id
            AND epics.issue_id IS NOT NULL
            AND epics.id IN (#{sub_batch.select(:id).to_sql})
        SQL
      end
    end
  end
end
