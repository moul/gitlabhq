# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ActiveContext::Concerns::MigrationWorker do
  let(:worker) { Test::Workers::MockMigrationWorker.new }
  let(:connection) { double }
  let(:migrations_scope) { double }
  let(:migration_record_class) { double }
  let(:dictionary_instance) { instance_double(ActiveContext::Migration::Dictionary) }
  let(:migration_versions) { %w[20240101010101] }
  let(:migration_class) do
    Class.new(ActiveContext::Migration::V1_0) do
      def migrate!; end

      def skip?
        false
      end
    end
  end

  let(:migration_instance) { instance_double(migration_class) }

  before do
    stub_const('Ai::ActiveContext::Migration', migration_record_class)
    allow(ActiveContext).to receive_messages(adapter: double(connection: connection), indexing?: true)
    allow(ActiveContext::Config).to receive(:logger).and_return(Logger.new(nil))
    allow(connection).to receive(:migrations).and_return(migrations_scope)
    allow(migrations_scope).to receive_messages(
      failed: double(any?: false),
      skipped: [],
      current: nil
    )
    allow(migrations_scope).to receive(:pluck).with(:version).and_return([])
    allow(ActiveContext::Migration::Dictionary).to receive(:instance).and_return(dictionary_instance)
    allow(dictionary_instance).to receive(:migrations).with(versions_only: true).and_return(migration_versions)
  end

  describe '#perform' do
    context 'when preflight checks fail' do
      context 'when indexing is disabled' do
        before do
          allow(ActiveContext).to receive(:indexing?).and_return(false)
        end

        it 'returns false and does not process migrations' do
          expect(worker).not_to receive(:execute_current_migration)

          expect(worker.perform).to be false
        end
      end

      context 'when adapter is not configured' do
        before do
          allow(ActiveContext).to receive_messages(adapter: nil, indexing?: false)
        end

        it 'returns false and does not process migrations' do
          expect(worker).not_to receive(:execute_current_migration)

          expect(worker.perform).to be false
        end
      end
    end

    context 'when there are failed migrations' do
      before do
        allow(migrations_scope).to receive(:failed).and_return(double(any?: true))
      end

      it 'does not execute the current migration' do
        expect(worker).not_to receive(:execute_current_migration)

        worker.perform
      end
    end

    context 'with valid configuration' do
      before do
        allow(migration_record_class).to receive(:create!)
        allow(migrations_scope).to receive(:pluck).with(:version).and_return(migration_versions)
        allow(migrations_scope).to receive(:where).and_return(double(delete_all: 0))
        allow(dictionary_instance).to receive(:find_by_version).with('20240101010101').and_return(migration_class)
        allow(migration_class).to receive(:new).and_return(migration_instance)
        allow(migration_instance).to receive(:skip?).and_return(false)
        allow(migration_instance).to receive(:migrate!)
      end

      it 'creates missing migration records' do
        allow(migrations_scope).to receive(:pluck).with(:version).and_return([])

        migration_record = double(version: '20240101010101', skipped?: false, in_progress?: false)
        allow(migrations_scope).to receive(:current).and_return(migration_record)
        allow(migration_record).to receive(:mark_as_started!)
        allow(migration_record).to receive(:mark_as_completed!)

        expect(migration_record_class).to receive(:create!)
          .with(connection: connection, version: '20240101010101')

        worker.perform
      end

      context 'when there are orphaned migration records' do
        let(:orphaned_versions) { %w[20230101010101] }
        let(:delete_scope) { double }

        before do
          allow(dictionary_instance).to receive(:migrations).with(versions_only: true).and_return([])
          allow(migrations_scope).to receive(:pluck).with(:version).and_return(orphaned_versions)
          allow(migrations_scope).to receive(:where).with(version: orphaned_versions).and_return(delete_scope)
        end

        it 'deletes orphaned migration records' do
          expect(delete_scope).to receive(:delete_all)

          worker.perform
        end
      end

      context 'when there is a pending migration record' do
        let(:migration_record) do
          double(version: '20240101010101', skipped?: false, in_progress?: false)
        end

        before do
          allow(migrations_scope).to receive(:current).and_return(migration_record)
          allow(migration_record).to receive(:mark_as_started!)
          allow(migration_record).to receive(:mark_as_completed!)
        end

        it 'marks the migration as completed' do
          expect(migration_record).to receive(:mark_as_started!)
          expect(migration_record).to receive(:mark_as_completed!)

          worker.perform
        end

        context 'when the migration fails' do
          let(:error) { StandardError.new('Something went wrong') }

          before do
            allow(migration_instance).to receive(:migrate!).and_raise(error)
            allow(migration_record).to receive(:decrease_retries!)
            allow(migration_record).to receive(:retries_left).and_return(2)
          end

          it 'calls decrease_retries! on the migration record' do
            expect(migration_record).to receive(:decrease_retries!).with(error)

            worker.perform
          end
        end

        context 'when the migration should be skipped' do
          before do
            allow(migration_instance).to receive(:skip?).and_return(true)
            allow(migration_record).to receive(:skipped!)
          end

          it 'marks the migration as skipped' do
            expect(migration_record).to receive(:skipped!)

            worker.perform
          end

          it 'does not execute the migration' do
            worker.perform

            expect(migration_instance).not_to have_received(:migrate!)
          end
        end

        context 'when the migration is already in progress' do
          let(:migration_record) do
            double(version: '20240101010101', skipped?: false, in_progress?: true)
          end

          before do
            allow(migration_record).to receive(:mark_as_completed!)
          end

          it 'does not call mark_as_started!' do
            expect(migration_record).not_to receive(:mark_as_started!)

            worker.perform
          end
        end
      end

      context 'when there are skipped migrations to re-evaluate' do
        let(:skipped_migration_record) do
          double(version: '20240101010101', skipped?: true)
        end

        before do
          allow(migrations_scope).to receive(:skipped).and_return([skipped_migration_record])
        end

        context 'when the skip condition is no longer met' do
          before do
            allow(migration_instance).to receive(:skip?).and_return(false)
            allow(skipped_migration_record).to receive(:pending!)
          end

          it 're-evaluates and marks the migration as pending' do
            expect(migration_class).to receive(:new).and_return(migration_instance)
            expect(skipped_migration_record).to receive(:pending!)

            worker.perform
          end
        end

        context 'when the skip condition is still met' do
          before do
            allow(migration_instance).to receive(:skip?).and_return(true)
          end

          it 'does not change the migration status' do
            expect(migration_class).to receive(:new).and_return(migration_instance)
            expect(skipped_migration_record).not_to receive(:pending!)

            worker.perform
          end
        end
      end

      context 'when there are no pending migrations' do
        it 'returns true' do
          expect(worker.perform).to be true
        end
      end
    end
  end
end
