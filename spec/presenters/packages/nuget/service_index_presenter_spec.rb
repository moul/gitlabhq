# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ::Packages::Nuget::ServiceIndexPresenter do
  let_it_be(:project) { create(:project) }
  let_it_be(:group) { create(:group) }

  let(:presenter) { described_class.new(target) }

  describe '#version' do
    subject { presenter.version }

    context 'for a group' do
      let(:target) { group }

      it { is_expected.to eq '3.0.0' }
    end

    context 'for a project' do
      let(:target) { project }

      it { is_expected.to eq '3.0.0' }
    end
  end

  describe '#resources' do
    subject { presenter.resources }

    shared_examples 'returning valid resources' do |resources_count: 9, include_publish_service: true|
      it 'has valid resources' do
        expect(subject.size).to eq resources_count
        subject.each do |resource|
          %i[@id @type comment].each do |field|
            expect(resource).to have_key(field)
            expect(resource[field]).to be_a(String)
          end
        end
      end

      it "does #{'not ' unless include_publish_service}return the publish resource", :aggregate_failures do
        services_types = subject.map { |res| res[:@type] }

        publish_service_versions = [
          described_class::SERVICE_VERSIONS[:publish],
          described_class::SERVICE_VERSIONS[:symbol]
        ].flatten

        publish_service_versions.each do |publish_service_version|
          if include_publish_service
            expect(services_types).to include(publish_service_version)
          else
            expect(services_types).not_to include(publish_service_version)
          end
        end
      end

      it 'includes the download service URL' do
        download_resource = subject.find { |res| res[:@type] == 'PackageBaseAddress/3.0.0' }

        expect(download_resource).to be_present
        expect(download_resource[:@id]).to include('/packages/nuget/download')
        expect(download_resource[:comment]).to eq('Get package content (.nupkg).')
      end
    end

    context 'for a group' do
      let(:target) { group }

      # at the group level we don't have the publish and symbol services
      it_behaves_like 'returning valid resources', resources_count: 7, include_publish_service: false
    end

    context 'for a project' do
      let(:target) { project }

      it_behaves_like 'returning valid resources'

      context 'with an unknown service type' do
        let(:target) { project }

        it 'raises an error for unknown service types' do
          allow(presenter).to receive(:available_services).and_return(%i[unknown])

          expect { presenter.resources }.to raise_error(ArgumentError, /unknown service type/)
        end
      end
    end

    context 'with nil target' do
      let(:target) { nil }

      it { is_expected.to eq([]) }
    end
  end
end
