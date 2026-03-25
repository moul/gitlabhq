# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Gitlab::Import::IidPreallocator, feature_category: :importers do
  let_it_be(:group) { create(:group) }
  let_it_be(:project) { create(:project, group: group) }

  let(:max_iids) { {} }

  subject(:preallocator) { described_class.new(project, max_iids) }

  describe '.trackable_resources' do
    it 'includes all expected CE resource types' do
      expect(described_class.trackable_resources.keys).to include(
        :issues,
        :merge_requests,
        :project_milestones,
        :group_milestones,
        :ci_pipelines,
        :design_management_designs
      )
    end
  end

  describe '.from_file' do
    let(:export_path) { Dir.mktmpdir('iid_preallocator_spec') }

    after do
      FileUtils.rm_rf(export_path)
    end

    context 'when max_iids.json exists' do
      before do
        File.write(
          File.join(export_path, 'max_iids.json'),
          { issues: 42, merge_requests: 17 }.to_json
        )
      end

      it 'pre-allocates IIDs from the file' do
        expect(Issue).to receive(:track_namespace_iid!).with(project.project_namespace, 42)
        expect(MergeRequest).to receive(:track_target_project_iid!).with(project, 17)

        described_class.from_file(project, File.join(export_path, 'max_iids.json'))
      end
    end

    context 'when max_iids.json does not exist' do
      it 'does nothing' do
        expect(Issue).not_to receive(:track_namespace_iid!)

        described_class.from_file(project, File.join(export_path, 'max_iids.json'))
      end
    end

    context 'when max_iids.json contains invalid JSON' do
      before do
        File.write(File.join(export_path, 'max_iids.json'), 'not valid json')
      end

      it 'does not preallocate and logs a warning' do
        expect(Issue).not_to receive(:track_namespace_iid!)
        expect(::Import::Framework::Logger).to receive(:warn).with(
          hash_including(message: 'IidPreallocator: skipping preallocation, invalid content in max_iids file')
        )

        described_class.from_file(project, File.join(export_path, 'max_iids.json'))
      end
    end

    context 'when max_iids.json contains non-integer IID values' do
      before do
        File.write(
          File.join(export_path, 'max_iids.json'),
          { issues: 'foo', merge_requests: 17, ci_pipelines: -1,
            milestones: nil, design_management_designs: 1.5 }.to_json
        )
      end

      it 'preallocates only the valid entries and logs a warning' do
        expect(Issue).not_to receive(:track_namespace_iid!)
        expect(Ci::Pipeline).not_to receive(:track_project_iid!)
        expect(Milestone).not_to receive(:track_project_iid!)
        expect(DesignManagement::Design).not_to receive(:track_project_iid!)
        expect(MergeRequest).to receive(:track_target_project_iid!).with(project, 17)
        expect(::Import::Framework::Logger).to receive(:warn).with(
          hash_including(message: 'IidPreallocator: ignoring invalid IID entries in max_iids file')
        )

        described_class.from_file(project, File.join(export_path, 'max_iids.json'))
      end
    end

    context 'when max_iids.json contains non-Hash JSON' do
      before do
        File.write(File.join(export_path, 'max_iids.json'), '[1, 2, 3]')
      end

      it 'does not preallocate and logs a warning' do
        expect(Issue).not_to receive(:track_namespace_iid!)
        expect(::Import::Framework::Logger).to receive(:warn).with(
          hash_including(message: 'IidPreallocator: skipping preallocation, invalid content in max_iids file')
        )

        described_class.from_file(project, File.join(export_path, 'max_iids.json'))
      end
    end

    context 'when reading the file raises an error' do
      let(:max_iids_path) { File.join(export_path, 'max_iids.json') }

      before do
        FileUtils.touch(max_iids_path)
      end

      it 'does not preallocate and logs a warning' do
        allow(File).to receive(:read).and_call_original
        allow(File).to receive(:read).with(max_iids_path).and_raise(Errno::EACCES, 'permission denied')

        expect(Issue).not_to receive(:track_namespace_iid!)
        expect(::Import::Framework::Logger).to receive(:warn).with(
          hash_including(message: 'IidPreallocator: skipping preallocation, failed to read max_iids file')
        )

        described_class.from_file(project, max_iids_path)
      end
    end
  end

  describe '#execute' do
    context 'with issues' do
      let(:max_iids) { { issues: 42 } }

      it 'calls track_namespace_iid! on Issue with the project namespace' do
        expect(Issue).to receive(:track_namespace_iid!).with(project.project_namespace, 42)

        preallocator.execute
      end
    end

    context 'with merge_requests' do
      let(:max_iids) { { merge_requests: 17 } }

      it 'calls track_target_project_iid! on MergeRequest with the project' do
        expect(MergeRequest).to receive(:track_target_project_iid!).with(project, 17)

        preallocator.execute
      end
    end

    context 'with project_milestones' do
      let(:max_iids) { { project_milestones: 5 } }

      it 'calls track_project_iid! on Milestone with the project' do
        expect(Milestone).to receive(:track_project_iid!).with(project, 5)

        preallocator.execute
      end
    end

    context 'with group_milestones' do
      let(:max_iids) { { group_milestones: 3 } }

      it 'calls track_group_iid! on Milestone with the group' do
        expect(Milestone).to receive(:track_group_iid!).with(group, 3)

        preallocator.execute
      end

      context 'when the project has no group (personal namespace)' do
        let_it_be(:personal_project) { create(:project, :in_user_namespace) }

        subject(:preallocator) { described_class.new(personal_project, max_iids) }

        it 'skips group_milestones without error' do
          expect(Milestone).not_to receive(:track_group_iid!)

          preallocator.execute
        end
      end
    end

    context 'with ci_pipelines' do
      let(:max_iids) { { ci_pipelines: 891 } }

      it 'calls track_project_iid! on Ci::Pipeline with the project' do
        expect(Ci::Pipeline).to receive(:track_project_iid!).with(project, 891)

        preallocator.execute
      end
    end

    context 'with design_management_designs' do
      let(:max_iids) { { design_management_designs: 10 } }

      it 'calls track_project_iid! on DesignManagement::Design with the project' do
        expect(DesignManagement::Design).to receive(:track_project_iid!).with(project, 10)

        preallocator.execute
      end
    end

    # API-based importers (GitHub, Bitbucket Cloud, Bitbucket Server) fetch the max IID
    # from the source API at the start of the import (first stage), one API call per
    # resource type, then pass the full hash to IidPreallocator in a single call.
    context 'when called from an API-based importer' do
      let(:max_iids) { { issues: 142, merge_requests: 37 } }

      it 'pre-allocates all resource types discovered from the source API' do
        expect(Issue).to receive(:track_namespace_iid!).with(project.project_namespace, 142)
        expect(MergeRequest).to receive(:track_target_project_iid!).with(project, 37)

        preallocator.execute
      end
    end

    # NDJSON-based importers (File Import/Export, Direct Transfer) read all max IIDs
    # from a max_iids.ndjson file written at export time, and pass the full hash at once.
    context 'when called from an NDJSON-based importer' do
      let(:max_iids) do
        {
          issues: 142,
          merge_requests: 37,
          project_milestones: 5,
          ci_pipelines: 891,
          design_management_designs: 10
        }
      end

      it 'pre-allocates all resource types from the export archive' do
        expect(Issue).to receive(:track_namespace_iid!).with(project.project_namespace, 142)
        expect(MergeRequest).to receive(:track_target_project_iid!).with(project, 37)
        expect(Milestone).to receive(:track_project_iid!).with(project, 5)
        expect(Ci::Pipeline).to receive(:track_project_iid!).with(project, 891)
        expect(DesignManagement::Design).to receive(:track_project_iid!).with(project, 10)

        preallocator.execute
      end
    end

    context 'when a resource type is not in max_iids' do
      let(:max_iids) { { issues: 42 } }

      it 'skips resource types with no max IID' do
        expect(MergeRequest).not_to receive(:track_target_project_iid!)
        expect(Milestone).not_to receive(:track_project_iid!)

        preallocator.execute
      end
    end

    context 'when max_iids is empty' do
      let(:max_iids) { {} }

      it 'does nothing' do
        expect(Issue).not_to receive(:track_namespace_iid!)

        preallocator.execute
      end
    end

    context 'when max_iids contains an unknown resource type' do
      let(:max_iids) { { unknown_resource: 99 } }

      it 'ignores unknown resource types without error' do
        expect { preallocator.execute }.not_to raise_error
      end
    end
  end
end
