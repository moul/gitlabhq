# frozen_string_literal: true

class UpdateDefaultPackageMetadataPurlTypesPub < Gitlab::Database::Migration[2.2]
  milestone '18.0'

  disable_ddl_transaction!

  PARTIALLY_ENABLED_SYNC = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].freeze
  FULLY_ENABLED_SYNC     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17].freeze

  def change
    change_column_default :application_settings, :package_metadata_purl_types,
      from: PARTIALLY_ENABLED_SYNC, to: FULLY_ENABLED_SYNC
  end
end
