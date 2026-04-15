# frozen_string_literal: true

module Ci
  class ProjectMetric < Ci::ApplicationRecord
    belongs_to :project
  end
end
