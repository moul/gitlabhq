# frozen_string_literal: true

require 'spec_helper'

RSpec.describe WebHooks::LogExecutionWorker, feature_category: :webhooks do
  it_behaves_like 'worker with data consistency', described_class, data_consistency: :delayed

  describe 'concurrency limit' do
    context 'when web_hooks_log_execution_worker_concurrency_limit is enabled' do
      it 'enforces a concurrency limit' do
        expect(described_class.get_concurrency_limit).to eq(500)
      end
    end

    context 'when web_hooks_log_execution_worker_concurrency_limit is disabled' do
      before do
        stub_feature_flags(web_hooks_log_execution_worker_concurrency_limit: false)
      end

      it 'uses default limit from max percentage' do
        expect(described_class.get_concurrency_limit).not_to eq(500)
      end
    end
  end
end
