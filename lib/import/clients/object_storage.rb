# frozen_string_literal: true

module Import
  module Clients
    class ObjectStorage
      include Gitlab::Utils::StrongMemoize

      DownloadError = Class.new(StandardError)
      UploadError = Class.new(StandardError)
      ConnectionError = Class.new(StandardError)

      MULTIPART_THRESHOLD = 100.megabytes
      PREFIX_SEPARATOR = '/'

      FOG_PROVIDER_MAP = {
        aws: 'AWS',
        s3_compatible: 'AWS'
      }.with_indifferent_access.freeze

      def initialize(provider:, bucket:, credentials:)
        @provider = provider
        @bucket = bucket
        @credentials = credentials
      end

      def request_url(object_key)
        storage.request_url(bucket_name: bucket, object_name: object_key)
      end

      def test_connection!
        status = storage.head_bucket(bucket).status

        return if status == 200

        raise ConnectionError, format(
          s_('OfflineTransfer|Object storage request responded with status %{status}'), status: status
        )
      end

      def store_file(object_key, local_path)
        check_for_path_traversal!(local_path)
        validate_file_exists!(local_path)

        directory = storage.directories.new(key: bucket)

        File.open(local_path, 'rb') do |file|
          directory.files.create(
            key: object_key,
            body: file,
            multipart_chunk_size: MULTIPART_THRESHOLD
          )
        end

        true
      rescue Fog::Errors::Error, Excon::Error => e
        track_and_raise_upload_exception(e, object_key, local_path: local_path)
      end

      def stream(object_key)
        directory = storage.directories.new(key: bucket)

        file = directory.files.get(object_key) do |chunk, remaining, total|
          yield chunk, remaining, total
        end

        raise DownloadError, "Object not found" unless file
      rescue Fog::Errors::Error, Excon::Error => e
        track_and_raise_download_exception(e, object_key)
      end

      private

      attr_reader :provider, :credentials, :bucket

      def validate_file_exists!(local_path)
        return if File.exist?(local_path)

        raise UploadError, "File not found: #{local_path}"
      end

      def storage
        ::Fog::Storage.new(
          provider: FOG_PROVIDER_MAP[provider],
          **credentials
        )
      end
      strong_memoize_attr :storage

      def check_for_path_traversal!(local_path)
        Gitlab::PathTraversal.check_path_traversal!(local_path)
      end

      def track_and_raise_upload_exception(exception, object_key, extra = {})
        track_exception(exception, object_key, extra)

        raise UploadError, 'Object storage upload failed'
      end

      def track_and_raise_download_exception(exception, object_key, extra = {})
        track_exception(exception, object_key, extra)

        raise DownloadError, 'Object storage download failed'
      end

      def track_exception(exception, object_key, extra = {})
        log_params = {
          provider: provider,
          bucket: bucket,
          object_key: object_key
        }.merge(extra)

        Gitlab::ErrorTracking.track_exception(exception, **log_params)
      end
    end
  end
end
