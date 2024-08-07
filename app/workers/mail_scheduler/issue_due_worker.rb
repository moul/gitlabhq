# frozen_string_literal: true

module MailScheduler
  class IssueDueWorker # rubocop:disable Scalability/IdempotentWorker
    include ApplicationWorker

    data_consistency :always

    sidekiq_options retry: 3
    include MailSchedulerQueue

    feature_category :team_planning

    # rubocop: disable CodeReuse/ActiveRecord
    def perform(project_id)
      Issue
        .with_issue_type(:issue)
        .opened
        .due_tomorrow
        .in_projects(project_id)
        .preload(:project)
        .find_each do |issue|
          notification_service.issue_due(issue)
        end
    end
    # rubocop: enable CodeReuse/ActiveRecord
  end
end
