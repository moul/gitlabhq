# frozen_string_literal: true

module Gitlab
  module Organizations
    class Isolation
      ISOLATED_TABLES = %w[organizations].freeze

      # rubocop:disable Gitlab/AvoidCurrentOrganization -- We check if Current.organization is assigned so it is safe
      def self.enabled?
        return false unless Feature.enabled?(:data_isolation, Feature.current_request)
        return false unless ::Current.organization_assigned
        return false unless ::Current.organization&.isolated?

        true
      end
      # rubocop:enable Gitlab/AvoidCurrentOrganization
    end
  end
end
