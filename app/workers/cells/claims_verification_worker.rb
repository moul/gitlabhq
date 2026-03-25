# frozen_string_literal: true

module Cells
  class ClaimsVerificationWorker
    include ApplicationWorker
    include ExclusiveLeaseGuard

    sidekiq_options retry: 3
    data_consistency :sticky
    feature_category :cell
    urgency :throttled
    loggable_arguments 0
    idempotent!

    LEASE_TIMEOUT = 10.minutes
    MAX_RUNTIME = 4.minutes + 30.seconds
    REDIS_LAST_PROCESSED_ID_TTL = 3.days

    def perform(model_name)
      @model_name = model_name

      model = model_name.safe_constantize
      return unless model.present? && model < ActiveRecord::Base
      return unless enabled?(model)

      result = nil

      try_obtain_lease do
        start_id = last_processed_id
        result = Cells::Claims::VerificationService.new(
          model, timeout: MAX_RUNTIME, start_id: start_id
        ) { |batch_last_id| save_last_processed_id(batch_last_id) }.execute

        save_last_processed_id(0) unless result[:over_time]

        log_hash_metadata_on_done(
          message: 'Records verification completed',
          feature_category: :cell,
          model: model_name,
          created: result[:created],
          destroyed: result[:destroyed],
          over_time: result[:over_time],
          start_id: start_id,
          last_id: result[:last_id]
        )
      end

      self.class.perform_async(model_name) if result&.dig(:over_time)
    rescue StandardError => e
      Gitlab::ErrorTracking.track_exception(e, feature_category: :cell)
      raise
    end

    private

    def lease_key
      "#{self.class.name.underscore}:#{@model_name}"
    end

    def lease_timeout
      LEASE_TIMEOUT
    end

    def last_processed_id
      Gitlab::Redis::SharedState.with { |redis| redis.get(redis_key).to_i }
    end

    def save_last_processed_id(id)
      Gitlab::Redis::SharedState.with { |redis| redis.set(redis_key, id, ex: REDIS_LAST_PROCESSED_ID_TTL) }
    end

    def redis_key
      "cells:claims:verification_service:last_processed_id:#{@model_name}"
    end

    def enabled?(model)
      Feature.enabled?("cells_claims_verification_worker_#{Gitlab::Utils.param_key(model)}", # rubocop:disable Gitlab/FeatureFlagKeyDynamic -- Need to check against model names dynamically
        :instance)
    end
  end
end
