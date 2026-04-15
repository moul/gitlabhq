# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Ci::ProjectMetric, feature_category: :pipeline_composition do
  describe 'associations' do
    it { is_expected.to belong_to(:project) }
  end

  describe 'factory' do
    it 'creates a valid record' do
      expect(build(:ci_project_metric)).to be_valid
    end

    it 'creates a valid record with first_pipeline_succeeded trait' do
      metric = build(:ci_project_metric, :with_first_pipeline_succeeded)

      expect(metric).to be_valid
      expect(metric.first_pipeline_succeeded_at).to be_present
    end
  end
end
