# frozen_string_literal: true

# File Download Service orchestrates remote file download into tmp directory according to configuration context.
module BulkImports
  class FileDownloadService
    # @param context [BulkImports::Context] Context object containing connection credentials
    # @param relation [String] Relation type being downloaded.
    # @param tmpdir [String] Temp directory to store downloaded file to. Must be located under `Dir.tmpdir`.
    # @param filename [String] Name of the file to download.
    def self.for_context(context:, relation:, tmpdir:, filename:)
      # TODO: Check if bulk_import from context is offline, then initialize with an object storage download strategy
      #   implementation in https://gitlab.com/gitlab-org/gitlab/-/merge_requests/229577
      file_download_strategy = Import::BulkImports::HttpFileDownloadStrategy.new(
        context: context,
        relative_url: context.entity.relation_download_url_path(relation, context.extra[:batch_number])
      )

      new(tmpdir: tmpdir, filename: filename, file_download_strategy: file_download_strategy)
    end

    def initialize(tmpdir:, filename:, file_download_strategy:)
      @tmpdir = tmpdir
      @filename = filename
      @file_download_strategy = file_download_strategy
    end

    def execute
      validate_tmpdir
      file_download_strategy.validate!

      file_download_strategy.download_file(filepath)

      filepath
    end

    private

    attr_reader :file_download_strategy, :tmpdir, :filename

    def validate_tmpdir
      Gitlab::PathTraversal.check_allowed_absolute_path!(tmpdir, [Dir.tmpdir])
    end

    def filepath
      @filepath ||= File.join(tmpdir, filename)
    end
  end
end
