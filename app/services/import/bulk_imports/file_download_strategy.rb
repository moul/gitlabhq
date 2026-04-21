# frozen_string_literal: true

module Import
  module BulkImports
    class FileDownloadStrategy
      ServiceError = Class.new(StandardError)

      DEFAULT_ALLOWED_CONTENT_TYPES = %w[application/gzip application/octet-stream].freeze

      def download_file(filepath)
        Gitlab::PathTraversal.check_path_traversal!(filepath)

        perform_download(filepath)

        validate_symlink(filepath)
      end

      def validate!
        raise Gitlab::AbstractMethodError
      end

      def log_and_raise_error(message)
        log_params = { message: message }
        log_params.merge!(log_error_params)
        logger.warn(log_params)

        raise ServiceError, message
      end

      private

      def perform_download(_filepath)
        raise Gitlab::AbstractMethodError
      end

      def file_size_limit
        raise Gitlab::AbstractMethodError
      end

      def validate_symlink(filepath)
        return unless Gitlab::Utils::FileInfo.linked?(filepath)

        File.delete(filepath)
        log_and_raise_error('Invalid downloaded file')
      end

      def validate_size!(size)
        return unless file_size_limit > 0 && size.to_i > file_size_limit

        log_and_raise_error(format(
          "File size %{size} exceeds limit of %{limit}",
          size: ActiveSupport::NumberHelper.number_to_human_size(size),
          limit: ActiveSupport::NumberHelper.number_to_human_size(file_size_limit)
        ))
      end

      def validate_url!(url)
        ::Gitlab::HTTP_V2::UrlBlocker.validate!(
          url,
          allow_localhost: allow_local_requests?,
          allow_local_network: allow_local_requests?,
          schemes: %w[http https],
          deny_all_requests_except_allowed: ::Gitlab::CurrentSettings.deny_all_requests_except_allowed?,
          outbound_local_requests_allowlist: ::Gitlab::CurrentSettings.outbound_local_requests_whitelist) # rubocop:disable Naming/InclusiveLanguage -- existing setting
      end

      def allow_local_requests?
        ::Gitlab::CurrentSettings.allow_local_requests_from_web_hooks_and_services?
      end

      def log_error_params
        {}
      end

      def logger
        @logger ||= ::BulkImports::Logger.build
      end
    end
  end
end
