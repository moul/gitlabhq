# frozen_string_literal: true

module Admin
  module Registrations
    class GroupsController < Admin::ApplicationController
      skip_before_action :set_confirm_warning
      before_action :verify_available!

      layout 'minimal'

      feature_category :onboarding

      def new; end

      private

      def verify_available!
        render_404 unless Feature.enabled?(:self_managed_welcome_onboarding, :instance)
      end
    end
  end
end

Admin::Registrations::GroupsController.prepend_mod_with('Admin::Registrations::GroupsController')
