# frozen_string_literal: true

module Organizations
  module Stateful
    extend ActiveSupport::Concern

    included do
      include ::Gitlab::TenantContainerLifecycle::Stateful::TransitionContext
      include ::Gitlab::TenantContainerLifecycle::Stateful::TransitionCallbacks
      include ::Gitlab::TenantContainerLifecycle::Stateful::TransitionLogging
      include ::Gitlab::TenantContainerLifecycle::Stateful::TransitionValidation

      attribute :state, :integer, limit: 2, default: 0

      enum :state, {
        active: 0,
        deletion_scheduled: 1,
        deletion_in_progress: 2
      }, instance_methods: false

      state_machine :state, initial: :active do
        before_transition :update_state_metadata
        before_transition on: :schedule_deletion, do: :ensure_transition_user
        before_transition on: :schedule_deletion, do: :set_deletion_schedule_data
        before_transition on: :cancel_deletion, do: :clear_deletion_schedule_data
        # We don't call :set_deletion_schedule_data on :reschedule_deletion
        # as it would change the actual deletion date/time.
        before_transition on: :reschedule_deletion, do: :set_deletion_error_data

        event :schedule_deletion do
          transition active: :deletion_scheduled
        end

        event :start_deletion do
          transition deletion_scheduled: :deletion_in_progress
        end

        event :cancel_deletion do
          transition %i[deletion_scheduled deletion_in_progress] => :active
        end

        event :reschedule_deletion do
          transition deletion_in_progress: :deletion_scheduled
        end

        after_transition :log_transition
        after_failure    :update_state_metadata_on_failure
        after_failure    :log_transition_failure
      end

      private

      def stateful_detail
        organization_detail
      end

      def stateful_log_metadata
        { message: 'Organization state transition', organization_id: id }
      end
    end
  end
end
