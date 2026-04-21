# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Import::Offline::ObjectKeyBuilder, feature_category: :importers do
  let(:configuration) { build(:import_offline_configuration) }

  subject(:builder) { described_class.new(configuration) }

  describe '#download_object_key' do
    let(:entity_source_full_path) { 'group/subgroup/project' }
    let(:entity_prefix) { 'group_123' }
    let(:batch_number) { nil }

    before do
      configuration.entity_prefix_mapping = { entity_source_full_path => entity_prefix }
    end

    context 'when batch_number is not present' do
      it 'returns a non-batched object key' do
        download_object_key = builder.download_object_key(
          relation: 'issues', entity_source_full_path: entity_source_full_path, extension: '.ndjson.gz'
        )

        expect(download_object_key).to eq("#{configuration.export_prefix}/#{entity_prefix}/issues.ndjson.gz")
      end
    end

    context 'when batch number is present' do
      it 'returns a batched object key' do
        download_object_key = builder.download_object_key(
          relation: 'issues', entity_source_full_path: entity_source_full_path, extension: '.ndjson.gz', batch_number: 1
        )

        expect(download_object_key).to eq("#{configuration.export_prefix}/#{entity_prefix}/issues/batch_1.ndjson.gz")
      end
    end

    context 'when no entity prefix exists for the full path' do
      it 'raises an error' do
        expect do
          builder.download_object_key(relation: 'issues', entity_source_full_path: 'not_found', extension: '.ndjson.gz')
        end.to raise_error(described_class::ObjectKeyError)
      end
    end
  end
end
