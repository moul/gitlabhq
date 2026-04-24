# frozen_string_literal: true

module Admin
  module Registrations
    class GroupsController < Admin::ApplicationController
      skip_before_action :set_confirm_warning
      before_action :verify_available!

      layout 'minimal'

      feature_category :onboarding

      urgency :low, [:create]

      def new
        @group = Group.new
        @project = Project.new
        @project_templates = Gitlab::ProjectTemplate.all
        @template_name = ''
      end

      def create
        result = Onboarding::SelfManaged::StandardNamespaceCreateService
          .new(current_user, group_params: group_params, project_params: project_params)
          .execute

        if result.success?
          redirect_to project_path(result.payload[:project])
        else
          @group = result.payload[:group]
          @project = result.payload[:project]
          @project_templates = Gitlab::ProjectTemplate.all
          @template_name = permitted_template_name
          flash.now[:alert] = result.message
          render :new, status: :unprocessable_entity
        end
      end

      private

      def verify_available!
        render_404 unless Feature.enabled?(:self_managed_welcome_onboarding, :instance)
      end

      def group_params
        params.require(:group).permit(:name, :path).merge(
          organization_id: Current.organization.id,
          visibility_level: Gitlab::VisibilityLevel::PRIVATE
        )
      end

      def project_params
        params.require(:project).permit(:name, :path).merge(
          organization_id: Current.organization.id,
          visibility_level: Gitlab::VisibilityLevel::PRIVATE,
          template_name: permitted_template_name
        )
      end

      def permitted_template_name
        name = params.require(:project).permit(:project_template_name)[:project_template_name].presence
        name if valid_template_names.include?(name)
      end

      def valid_template_names
        Gitlab::ProjectTemplate.all.map(&:name).to_set
      end
    end
  end
end

Admin::Registrations::GroupsController.prepend_mod_with('Admin::Registrations::GroupsController')
