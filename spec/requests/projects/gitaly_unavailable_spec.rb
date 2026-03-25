# frozen_string_literal: true

require 'spec_helper'

RSpec.describe 'Gitaly unavailable graceful degradation', feature_category: :source_code_management do
  let_it_be(:project) { create(:project, :public, :repository) }
  let_it_be(:user) { create(:user) }

  before_all do
    project.add_maintainer(user)
  end

  before do
    sign_in(user)
    stub_feature_flags(graceful_gitaly_degradation: true)
  end

  describe 'Projects::BlobController' do
    describe '#show' do
      let(:make_request) do
        get project_blob_path(project, 'master/README.md')
      end

      let(:allow_gitaly_to_raise_error) do
        allow_next_instance_of(Repository) do |repository|
          allow(repository).to receive(:blob_at).and_raise(Gitlab::Git::CommandError, 'Gitaly unavailable')
        end
      end

      it_behaves_like 'handles Gitaly errors for request specs'

      context 'with JSON format' do
        let(:make_request) do
          get project_blob_path(project, 'master/README.md', format: :json)
        end

        it_behaves_like 'handles Gitaly errors for json format'
      end
    end

    describe '#new' do
      let(:make_request) do
        get project_new_blob_path(project, 'master')
      end

      let(:allow_gitaly_to_raise_error) do
        allow_next_instance_of(Repository) do |repository|
          allow(repository).to receive(:commit).and_raise(Gitlab::Git::CommandError, 'Gitaly unavailable')
        end
      end

      it_behaves_like 'handles Gitaly errors for request specs'
    end

    describe '#edit' do
      let(:make_request) do
        get namespace_project_edit_blob_path(
          namespace_id: project.namespace,
          project_id: project,
          id: 'master/README.md'
        )
      end

      let(:allow_gitaly_to_raise_error) do
        allow_next_instance_of(Repository) do |repository|
          allow(repository).to receive(:blob_at).and_raise(Gitlab::Git::CommandError, 'Gitaly unavailable')
        end
      end

      it_behaves_like 'handles Gitaly errors for request specs'
    end

    describe '#diff' do
      let(:make_request) do
        get namespace_project_blob_diff_path(
          namespace_id: project.namespace,
          project_id: project,
          id: 'master/CHANGELOG',
          since: 1,
          to: 5,
          offset: 10
        )
      end

      let(:allow_gitaly_to_raise_error) do
        allow_next_instance_of(Repository) do |repository|
          allow(repository).to receive(:blob_at).and_raise(Gitlab::Git::CommandError, 'Gitaly unavailable')
        end
      end

      it_behaves_like 'handles Gitaly errors for request specs'
    end

    describe '#preview' do
      let(:make_request) do
        post namespace_project_preview_blob_path(
          namespace_id: project.namespace,
          project_id: project,
          id: 'master/README.md'
        ), params: { content: 'test' }
      end

      let(:allow_gitaly_to_raise_error) do
        allow_next_instance_of(Repository) do |repository|
          allow(repository).to receive(:blob_at).and_raise(Gitlab::Git::CommandError, 'Gitaly unavailable')
        end
      end

      it_behaves_like 'handles Gitaly errors for request specs'
    end
  end
end
