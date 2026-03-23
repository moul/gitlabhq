# frozen_string_literal: true

module API
  module Helpers
    module WorkItems
      module ShowParams
        extend Grape::API::Helpers

        params :work_items_show_params do
          optional :fields, type: String,
            desc: ["Comma-separated list of base fields to include.",
              "Defaults to #{::API::WorkItems::DEFAULT_FIELDS.join(', ')}."].join(" ")
          optional :features, type: String,
            desc: [
              'Comma-separated list of feature payloads to include.',
              'No feature payloads are returned unless specified.',
              "Supported values: #{::API::WorkItems::FEATURE_SUPPORTED_VALUES.join(', ')}."
            ].join(' ')
        end
      end
    end
  end
end
