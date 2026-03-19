# frozen_string_literal: true

module Cells
  class ClaimsVerificationWorker
    include ApplicationWorker

    deduplicate :until_executed
    sidekiq_options retry: 3
    data_consistency :sticky
    feature_category :cell
    urgency :throttled
    idempotent!

    def perform(model_name)
      model = model_name.safe_constantize
      return unless model.present? && model < ActiveRecord::Base
      return unless enabled?(model)

      result = Cells::Claims::VerificationService.new(model).execute

      log_hash_metadata_on_done(
        message: 'Records verification completed',
        feature_category: :cell,
        model: model_name,
        created: result[:created],
        destroyed: result[:destroyed]
      )
    rescue StandardError => e
      Gitlab::ErrorTracking.track_exception(e, feature_category: :cell)
      raise
    end

    private

    def enabled?(model)
      Feature.enabled?("cells_claims_verification_worker_#{Gitlab::Utils.param_key(model)}", # rubocop:disable Gitlab/FeatureFlagKeyDynamic -- Need to check against model names dynamically
        :instance)
    end
  end
end
