# frozen_string_literal: true

module Organizations
  class OrganizationDetail < ApplicationRecord
    include CacheMarkdownField
    # WithUploads must be included before Avatarable so that AfterCommitQueue's
    # _run_after_commit_queue callback is registered before CarrierWave's
    # remove_avatar! callback. Rails executes after_commit callbacks in reverse
    # registration order (LIFO), so this ensures remove_avatar! (which deletes
    # the Upload record) runs before _run_after_commit_queue (which deletes
    # the remote file). Reversing this order causes destroy_upload to see
    # file.exists? == false and skip Upload record cleanup.
    include WithUploads
    include Avatarable

    cache_markdown_field :description, pipeline: :description

    belongs_to :organization, inverse_of: :organization_detail

    validates :organization, presence: true
    validates :description, length: { maximum: 1024 }

    def uploads_sharding_key
      { organization_id: organization_id }
    end
  end
end
