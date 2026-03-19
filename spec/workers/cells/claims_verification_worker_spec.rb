# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Cells::ClaimsVerificationWorker, feature_category: :cell do
  let(:worker) { described_class.new }
  let(:mock_service) { instance_double(Cells::Claims::VerificationService) }

  before do
    stub_config_cell(enabled: true)
  end

  it_behaves_like 'an idempotent worker' do
    let(:job_args) { ["User"] }
  end

  describe '#perform' do
    let(:model_name) { 'User' }

    context 'when feature flag is disabled for the model' do
      before do
        stub_feature_flags(cells_claims_verification_worker_user: false)
      end

      it 'does not execute the verification service' do
        expect(Cells::Claims::VerificationService).not_to receive(:new)

        worker.perform(model_name)
      end
    end

    context 'when model_name is namespaced' do
      let(:model_name) { 'Foo::Bar' }
      let(:model) do
        Class.new(ApplicationRecord) do
          self.table_name = 'foobar'
          def self.name = 'Foo::Bar'
        end
      end

      before do
        stub_feature_flag_definition("cells_claims_verification_worker_foo_bar")
        stub_const('Foo::Bar', model)
      end

      it 'uses underscored and de-namespaced flag name' do
        expect(Feature).to receive(:enabled?)
          .with("cells_claims_verification_worker_foo_bar", :instance)
          .and_return(false)

        worker.perform(model_name)
      end
    end

    context 'when model_name cannot be constantized' do
      let(:model_name) { 'NonExistentModel' }

      before do
        stub_feature_flag_definition("cells_claims_verification_worker_non_existent_model")
      end

      it 'does not execute the verification service' do
        expect(Cells::Claims::VerificationService).not_to receive(:new)

        worker.perform(model_name)
      end
    end

    context 'when model_name constantizes to a non-ActiveRecord class' do
      let(:model_name) { 'String' }

      before do
        stub_feature_flag_definition("cells_claims_verification_worker_string")
      end

      it 'does not execute the verification service' do
        expect(Cells::Claims::VerificationService).not_to receive(:new)

        worker.perform(model_name)
      end
    end

    context 'when model is valid' do
      before do
        allow(Cells::Claims::VerificationService).to receive(:new).with(User).and_return(mock_service)
        allow(mock_service).to receive(:execute).and_return({
          created: 3,
          destroyed: 1
        })
      end

      it 'executes the verification service' do
        expect(mock_service).to receive(:execute)

        worker.perform(model_name)
      end

      it 'logs the verification result' do
        expect(worker).to receive(:log_hash_metadata_on_done).with(
          message: 'Records verification completed',
          feature_category: :cell,
          model: "User",
          created: 3,
          destroyed: 1
        )

        worker.perform(model_name)
      end
    end

    context 'when the service raises a StandardError' do
      let(:error) { StandardError.new('something went wrong') }

      before do
        allow(Cells::Claims::VerificationService).to receive(:new).with(User).and_return(mock_service)
        allow(mock_service).to receive(:execute).and_raise(error)
      end

      it 'tracks the exception' do
        expect(Gitlab::ErrorTracking).to receive(:track_exception)
          .with(error, feature_category: :cell)

        expect { worker.perform(model_name) }.to raise_error(StandardError)
      end

      it 're-raises the error for Sidekiq retry' do
        allow(Gitlab::ErrorTracking).to receive(:track_exception)

        expect { worker.perform(model_name) }.to raise_error(StandardError, 'something went wrong')
      end
    end
  end
end
