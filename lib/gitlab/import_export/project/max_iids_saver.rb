# frozen_string_literal: true

module Gitlab
  module ImportExport
    module Project
      class MaxIidsSaver
        include DurationMeasuring

        RESOURCE_QUERIES = {
          issues: ->(project) { project.issues.maximum(:iid) },
          merge_requests: ->(project) { project.merge_requests.maximum(:iid) },
          project_milestones: ->(project) { project.milestones.maximum(:iid) },
          ci_pipelines: ->(project) { project.ci_pipelines.maximum(:iid) },
          design_management_designs: ->(project) { project.designs.maximum(:iid) }
        }.freeze

        def self.resource_queries
          RESOURCE_QUERIES
        end

        def initialize(project:, shared:)
          @project = project
          @shared = shared
        end

        def save
          with_duration_measuring do
            json_writer = Gitlab::ImportExport::Json::NdjsonWriter.new(@shared.export_path)
            json_writer.write_attributes('max_iids', compute_max_iids)
            true
          end
        rescue StandardError => e
          @shared.error(e)
          false
        end

        private

        def compute_max_iids
          self.class.resource_queries.each_with_object({}) do |(resource, query), result|
            max = query.call(@project)
            result[resource.to_s] = max if max
          end
        end
      end
    end
  end
end
