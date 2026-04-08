# frozen_string_literal: true

module Test
  module Workers
    class MockMigrationWorker
      include ::ActiveContext::Concerns::MigrationWorker

      def self.name
        'Test::Workers::MockMigrationWorker'
      end

      def in_lock(_key, **_opts)
        yield
      end

      def structured_payload(message:, **)
        message
      end
    end
  end
end
