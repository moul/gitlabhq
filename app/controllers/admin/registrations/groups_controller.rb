# frozen_string_literal: true

module Admin
  module Registrations
    class GroupsController < Admin::ApplicationController
      skip_before_action :set_confirm_warning
      before_action :verify_available!
      before_action :authorize_create_group!

      layout 'minimal'

      feature_category :onboarding

      def new; end

      private

      def verify_available!
        render_404 unless Feature.enabled?(:self_managed_welcome_onboarding, :instance)
      end

      def authorize_create_group!
        access_denied! unless current_user.can_admin_all_resources?
      end
    end
  end
end

Admin::Registrations::GroupsController.prepend_mod_with('Admin::Registrations::GroupsController')
