# frozen_string_literal: true

module Gitlab
  module BackgroundOperation
    class UsersDeleteUnconfirmedSecondaryEmails < BaseOperationWorker
      operation_name :delete_all
      feature_category :user_management
      cursor :id

      scope_to ->(relation) { relation.where('created_at < ? AND confirmed_at IS NULL', created_cut_off) } # rubocop:disable CodeReuse/ActiveRecord -- Specific use-case
      reset_cursor!

      def perform
        each_sub_batch do |sub_batch|
          sub_batch.delete_all
        end
      end

      private

      def created_cut_off
        ApplicationSetting::USERS_UNCONFIRMED_SECONDARY_EMAILS_DELETE_AFTER_DAYS.days.ago
      end
    end
  end
end
