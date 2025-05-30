# frozen_string_literal: true

require 'spec_helper'

RSpec.describe DeploymentMetrics do
  describe '#has_metrics?' do
    subject { described_class.new(deployment.project, deployment).has_metrics? }

    context 'when deployment is failed' do
      let(:deployment) { create(:deployment, :failed) }

      it { is_expected.to be_falsy }
    end

    context 'when deployment is nil' do
      let_it_be(:project) { create(:project) }

      subject { described_class.new(project, nil).has_metrics? }

      it { is_expected.to be_falsy }
    end

    context 'when deployment is success' do
      let(:deployment) { create(:deployment, :success) }

      context 'without a monitoring integration' do
        it { is_expected.to be_falsy }
      end

      context 'with a Prometheus integration' do
        let(:prometheus_integration) { instance_double(::Integrations::Prometheus, can_query?: true, configured?: true) }

        before do
          allow(deployment.project).to receive(:find_or_initialize_integration).with('prometheus').and_return prometheus_integration
        end

        it { is_expected.to be_falsy }
      end

      context 'with a Prometheus integration that cannot query' do
        let(:prometheus_integration) { instance_double(::Integrations::Prometheus, configured?: true, can_query?: false) }

        before do
          allow(deployment.project).to receive(:find_or_initialize_integration).with('prometheus').and_return prometheus_integration
        end

        it { is_expected.to be_falsy }
      end

      context 'with a Prometheus integration that is not configured' do
        let(:prometheus_integration) { instance_double(::Integrations::Prometheus, configured?: false, can_query?: false) }

        before do
          allow(deployment.project).to receive(:find_or_initialize_integration).with('prometheus').and_return prometheus_integration
        end

        it { is_expected.to be_falsy }
      end

      context 'with a cluster Prometheus' do
        let(:deployment) { create(:deployment, :success, :on_cluster) }
        let!(:prometheus) { create(:clusters_integrations_prometheus, cluster: deployment.cluster) }

        before do
          expect(deployment.cluster.integration_prometheus).to receive(:configured?).and_return(true)
        end

        it { is_expected.to be_truthy }
      end
    end
  end

  describe '#metrics' do
    let(:deployment) { create(:deployment, :success) }
    let(:prometheus_adapter) { instance_double(::Integrations::Prometheus, can_query?: true, configured?: true) }
    let(:deployment_metrics) { described_class.new(deployment.project, deployment) }

    subject { deployment_metrics.metrics }

    context 'metrics are disabled' do
      it { is_expected.to eq({}) }
    end

    context 'metrics are enabled' do
      let(:simple_metrics) do
        {
          success: true,
          metrics: {},
          last_update: 42
        }
      end

      before do
        allow(deployment_metrics).to receive(:prometheus_adapter).and_return(prometheus_adapter)
        expect(prometheus_adapter).to receive(:query).with(:deployment, deployment).and_return(simple_metrics)
      end

      it { is_expected.to eq(simple_metrics.merge({ deployment_time: deployment.finished_at.to_i })) }
    end
  end

  describe '#additional_metrics' do
    let(:project) { create(:project, :repository) }
    let(:deployment) { create(:deployment, :succeed, project: project) }
    let(:deployment_metrics) { described_class.new(deployment.project, deployment) }

    subject { deployment_metrics.additional_metrics }

    context 'metrics are disabled' do
      it { is_expected.to eq({}) }
    end

    context 'metrics are enabled' do
      let(:simple_metrics) do
        {
          success: true,
          metrics: {},
          last_update: 42
        }
      end

      let(:prometheus_adapter) { instance_double(::Integrations::Prometheus, can_query?: true, configured?: true) }

      before do
        allow(deployment_metrics).to receive(:prometheus_adapter).and_return(prometheus_adapter)
        expect(prometheus_adapter).to receive(:query).with(:additional_metrics_deployment, deployment).and_return(simple_metrics)
      end

      it { is_expected.to eq(simple_metrics.merge({ deployment_time: deployment.finished_at.to_i })) }
    end
  end
end
