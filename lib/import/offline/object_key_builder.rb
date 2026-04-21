# frozen_string_literal: true

# This class standardizes object key generation for offline exports and imports. All built keys have the formats
#   - For non-batched relations: "#{export_prefix}/#{entity_prefix}/#{relation}.#{extension}"
#   - For batched relations: "#{export_prefix}/#{entity_prefix}/#{relation}/batch_#{batch_number}.#{extension}"
#   - For metadata.json: "#{export_prefix}/metadata.json"
# `export_prefix` is the top-level prefix for all files that are a part of the same offline export
# Some examples:
#   - `2026-04-16_19-39-00_export_dJtnb3CV/group_1/self.json` - `self` relation (JSON format)
#   - `2026-04-16_19-39-00_export_dJtnb3CV/group_1/milestones.ndjson` - tree relation, single file
#   - `2026-04-16_19-39-00_export_dJtnb3CV/project_1/issues/batch_1.ndjson` - tree relation, batched
#   - `2026-04-16_19-39-00_export_dJtnb3CV/project_1/repository.tar.gz` - archive relation, single file
#   - `2026-04-16_19-39-00_export_dJtnb3CV/project_1/uploads/batch_1.tar.gz` - archive relation, batched
module Import
  module Offline
    class ObjectKeyBuilder
      ObjectKeyError = Class.new(StandardError)

      def initialize(configuration)
        @configuration = configuration
      end

      def download_object_key(relation:, extension:, entity_source_full_path:, batch_number: nil)
        entity_prefix = configuration.entity_prefix_for_path(entity_source_full_path)

        raise ObjectKeyError, "Entity prefix missing for #{entity_source_full_path}" if entity_prefix.blank?

        object_key(relation, extension, entity_prefix, batch_number: batch_number)
      end

      private

      attr_reader :configuration

      def object_key(relation, extension, entity_prefix, batch_number: nil)
        filename_parts = []
        filename_parts << configuration.export_prefix
        filename_parts << entity_prefix

        if batch_number.present?
          filename_parts << relation
          filename_parts << "batch_#{batch_number}#{extension}"
        else
          filename_parts << "#{relation}#{extension}"
        end

        filename_parts.join(::Import::Clients::ObjectStorage::PREFIX_SEPARATOR)
      end
    end
  end
end
