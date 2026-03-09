# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ::API::Helpers::Packages::Nuget, feature_category: :package_registry do
  let(:package) { instance_double(::Packages::Nuget::Package, version: '1.0.0', normalized_nuget_version: '1.0') }
  let(:params) { { package_filename: 'MyPackage.1.0.0', package_version: '1.0.0', format: 'nupkg' } }

  let(:helper) do
    klass = Struct.new(:params) do
      include ::API::Helpers::Packages::Nuget
    end
    klass.new(params)
  end

  describe '#format_filename' do
    subject(:filename) { helper.format_filename(package) }

    context 'when package version matches exactly' do
      let(:params) { { package_filename: 'MyPackage.1.0.0', package_version: '1.0.0', format: 'nupkg' } }

      it 'returns the filename with format appended' do
        expect(filename).to eq('MyPackage.1.0.0.nupkg')
      end
    end

    context 'when normalized version matches' do
      let(:params) { { package_filename: 'MyPackage.1.0', package_version: '1.0', format: 'nupkg' } }

      it 'returns the filename with version substituted' do
        expect(filename).to eq('MyPackage.1.0.0.nupkg')
      end
    end

    context 'when neither version matches' do
      let(:params) { { package_filename: 'MyPackage.2.0.0', package_version: '2.0.0', format: 'nupkg' } }

      it 'returns nil' do
        expect(filename).to be_nil
      end
    end

    context 'with snupkg format' do
      let(:params) { { package_filename: 'MyPackage.1.0.0', package_version: '1.0.0', format: 'snupkg' } }

      it 'returns the filename with snupkg format' do
        expect(filename).to eq('MyPackage.1.0.0.snupkg')
      end
    end
  end
end
