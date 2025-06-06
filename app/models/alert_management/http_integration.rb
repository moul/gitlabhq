# frozen_string_literal: true

module AlertManagement
  class HttpIntegration < ApplicationRecord
    include ::Gitlab::Routing
    include Gitlab::EncryptedAttribute

    LEGACY_IDENTIFIERS = %w[legacy legacy-prometheus].freeze

    belongs_to :project, inverse_of: :alert_management_http_integrations

    attr_encrypted :token,
      mode: :per_attribute_iv,
      key: :db_key_base_32,
      algorithm: 'aes-256-gcm'

    attribute :endpoint_identifier, default: -> { SecureRandom.hex(8) }

    validates :project, presence: true
    validates :active, inclusion: { in: [true, false] }
    validates :token, presence: true, format: { with: /\A\h{32}\z/ }
    validates :name, presence: true, length: { maximum: 255 }
    validates :type_identifier, presence: true
    validates :endpoint_identifier, presence: true, length: { maximum: 255 }, format: { with: /\A[A-Za-z0-9-]+\z/ }
    validates :endpoint_identifier, uniqueness: { scope: [:project_id] }
    validates :payload_attribute_mapping, json_schema: { filename: 'http_integration_payload_attribute_mapping' }

    before_validation :prevent_token_assignment
    before_validation :prevent_endpoint_identifier_assignment
    before_validation :ensure_token
    before_validation :ensure_payload_example_not_nil

    scope :for_endpoint_identifier, ->(endpoint_identifier) { where(endpoint_identifier: endpoint_identifier) }
    scope :for_type, ->(type) { where(type_identifier: type) }
    scope :for_project, ->(project_ids) { where(project: project_ids) }
    scope :active, -> { where(active: true) }
    scope :ordered_by_type_and_id, -> { order(:type_identifier, :id) }

    enum :type_identifier, {
      http: 0,
      prometheus: 1
    }

    def url
      case endpoint_identifier
      when 'legacy'
        project_alerts_notify_url(project, format: :json)
      when 'legacy-prometheus'
        notify_project_prometheus_alerts_url(project, format: :json)
      else
        project_alert_http_integration_url(project, name_slug, endpoint_identifier, format: :json)
      end
    end

    def legacy?
      LEGACY_IDENTIFIERS.include?(endpoint_identifier)
    end

    private

    def self.generate_token
      SecureRandom.hex
    end

    def name_slug
      (name && Gitlab::Utils.slugify(name)) || "#{type_identifier}-endpoint"
    end

    # Blank token assignment triggers token reset
    def prevent_token_assignment
      if token.present? && token_changed?
        self.token = nil
        self.encrypted_token = encrypted_token_was
        self.encrypted_token_iv = encrypted_token_iv_was
      end
    end

    def ensure_token
      self.token = self.class.generate_token if token.blank?
    end

    def prevent_endpoint_identifier_assignment
      if endpoint_identifier_changed? && endpoint_identifier_was.present?
        self.endpoint_identifier = endpoint_identifier_was
      end
    end

    def ensure_payload_example_not_nil
      self.payload_example ||= {}
    end
  end
end
