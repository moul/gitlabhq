# frozen_string_literal: true

module Namespaces
  class TemplateSetting < ApplicationRecord
    self.table_name = 'namespace_template_settings'
    self.primary_key = :namespace_id

    belongs_to :namespace

    validates :namespace, presence: true
  end
end
