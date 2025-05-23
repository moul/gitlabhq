# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ClickHouse::Models::Ci::FinishedPipelinesHourly, feature_category: :fleet_visibility do
  it_behaves_like 'a ci_finished_pipelines aggregation model', :ci_finished_pipelines_hourly

  describe '.time_window_valid?', :freeze_time do
    subject(:time_window_valid?) { described_class.time_window_valid?(from_time, to_time) }

    context 'with time window of one week and one hour' do
      let(:from_time) { (1.hour - 1.second).before(1.week.ago) }
      let(:to_time) { Time.current }

      it { is_expected.to eq true }
    end

    context 'with time window of one week and 1 hour' do
      let(:from_time) { 1.hour.before(1.week.ago) }
      let(:to_time) { Time.current }

      it { is_expected.to eq false }
    end
  end

  describe '.validate_time_window', :freeze_time do
    subject(:validate_time_window) { described_class.validate_time_window(from_time, to_time) }

    context 'with time window of less than one week and one hour' do
      let(:from_time) { (1.hour - 1.second).before(1.week.ago) }
      let(:to_time) { Time.current }

      it { is_expected.to be_nil }
    end

    context 'with time window of one week and 1 hour' do
      let(:from_time) { 1.hour.before(1.week.ago) }
      let(:to_time) { Time.current }

      it { is_expected.to eq("Maximum of 169 hours can be requested") }
    end
  end
end
