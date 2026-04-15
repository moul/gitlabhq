# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Tasks::Gitlab::Permissions::Assignable::ValidateTask, :silence_stdout, feature_category: :permissions do
  let(:task) { described_class.new }

  describe '#run', :unlimited_max_formatted_output_length do
    let(:permission_name) { 'modify_wiki' }
    let(:raw_permissions) { %w[update_wiki] }
    let(:permission_source_file) do
      'config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml'
    end

    let(:permission_definition) do
      {
        name: permission_name,
        description: 'Modify a wiki',
        permissions: raw_permissions,
        boundaries: ['project']
      }
    end

    let(:permission) do
      Authz::PermissionGroups::Assignable.new(permission_definition, Rails.root.join(permission_source_file).to_s)
    end

    subject(:run) { task.run }

    before do
      # Stub assignable permission definitions
      allow(Authz::PermissionGroups::Assignable).to receive_messages(get: nil,
        all: { permission.name.to_sym => permission })
      allow(Authz::PermissionGroups::Assignable).to receive(:get).with(permission_name.to_sym).and_return(permission)

      # Stub existence of raw permissions - used to validate permissions field
      # values matches defined raw permissions
      allow(Authz::Permission).to receive(:defined?).with(anything).and_return(false)
      allow(Authz::Permission).to receive(:defined?).with('update_wiki').and_return(true)

      # Stubs to make .metadata.yml file validation pass
      allow(Authz::PermissionGroups::Resource).to receive(:get).and_return(
        instance_double(Authz::PermissionGroups::Resource, definition: {})
      )
      allow(Authz::PermissionGroups::Category).to receive(:get).and_return(nil)
      allow(JSONSchemer).to receive(:schema).and_call_original
      allow(JSONSchemer).to receive(:schema)
        .with(Rails.root.join("#{described_class::PERMISSION_DIR}/resource_metadata_schema.json"))
        .and_return(instance_double(JSONSchemer::Schema, validate: []))
    end

    context 'when all permissions are valid' do
      it 'completes successfully' do
        expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
      end
    end

    context 'when permission is deprecated' do
      let(:permission_name) { 'manage_user_widget' }
      let(:permission_source_file) do
        'config/authz/permission_groups/assignable_permissions/wiki_category/user_widget/manage.yml'
      end

      let(:permission_definition) do
        {
          name: permission_name,
          description: 'Manage user widgets',
          permissions: %w[update_wiki],
          boundaries: ['user'],
          deprecated: true
        }
      end

      it 'skips boundary and action validations' do
        expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
      end
    end

    context 'when resource name starts with a boundary prefix' do
      let(:permission_name) { 'read_user_ssh_key' }
      let(:permission_source_file) do
        'config/authz/permission_groups/assignable_permissions/system_access/user_ssh_key/read.yml'
      end

      let(:permission_definition) do
        {
          name: permission_name,
          description: 'Grants the ability to read user SSH keys',
          permissions: %w[read_user_ssh_key],
          boundaries: ['user']
        }
      end

      before do
        allow(Authz::Permission).to receive(:defined?).with('read_user_ssh_key').and_return(true)
      end

      it 'returns an error' do
        expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
          #######################################################################
          #
          #  The following assignable permissions encode a resource boundary in their name.
          #  The permission name should not include the boundary (project, group, user) as a prefix.
          #  Learn more: https://docs.gitlab.com/development/permissions/conventions/#avoiding-resource-boundaries-in-permission-names
          #
          #    - read_user_ssh_key: Resource should not start with boundary 'user'. (config/authz/permission_groups/assignable_permissions/system_access/user_ssh_key/read.yml)
          #
          #######################################################################
        OUTPUT
      end
    end

    context 'when schema is invalid' do
      context 'with missing and invalid keys' do
        let(:permission_definition) do
          {
            name: permission_name,
            key: 'not allowed'
          }
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following permissions failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#create-the-assignable-permission-file
            #
            #    - modify_wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml)
            #        - property '/key' is invalid: error_type=schema
            #        - root is missing required keys: description, permissions, boundaries
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'with invalid permissions' do
        let(:permission_definition) { super().merge(permissions: %w[unknown]) }

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following permissions failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#create-the-assignable-permission-file
            #
            #    - modify_wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml)
            #        - property '/permissions/0' does not match format: known_permissions
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'with invalid boundaries' do
        let(:permission_definition) { super().merge(boundaries: %w[unknown]) }

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following permissions failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#create-the-assignable-permission-file
            #
            #    - modify_wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml)
            #        - property '/boundaries/0' is not one of: ["instance", "group", "project", "user"]
            #
            #######################################################################
          OUTPUT
        end
      end
    end

    context 'when there are duplicate permission names' do
      before do
        # This assumes that there are more at least two YML files in
        # config/authz/permission_groups/assignable_permissions/
        allow(YAML).to receive(:safe_load).and_return({ 'name' => 'duplicated_permission_name' })
      end

      it 'returns an error' do
        expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
          #######################################################################
          #
          #  The following permissions have duplicate names.
          #  Assignable permissions must have unique names.
          #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#important-constraints
          #
          #    - duplicated_permission_name
          #
          #######################################################################
        OUTPUT
      end

      context 'when the duplicate name matches a known permission' do
        before do
          allow(YAML).to receive(:safe_load).and_return({ 'name' => permission_name })
        end

        it 'includes the source path in the error' do
          expect { run }.to raise_error(SystemExit).and output(
            %r{- modify_wiki \(config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify\.yml\)}
          ).to_stdout
        end
      end
    end

    context 'when raw permissions are used in multiple assignable permissions' do
      let(:zebra_source_file) do
        'config/authz/permission_groups/assignable_permissions/wiki_category/zebra/modify.yml'
      end

      let(:apple_source_file) do
        'config/authz/permission_groups/assignable_permissions/wiki_category/apple/modify.yml'
      end

      let(:zebra_assignable) do
        Authz::PermissionGroups::Assignable.new(
          {
            name: 'modify_zebra',
            description: 'Zebra assignable',
            permissions: %w[beta_permission alpha_permission unique_one],
            boundaries: ['project']
          },
          Rails.root.join(zebra_source_file).to_s
        )
      end

      let(:apple_assignable) do
        Authz::PermissionGroups::Assignable.new(
          {
            name: 'modify_apple',
            description: 'Apple assignable',
            permissions: %w[beta_permission alpha_permission unique_two],
            boundaries: ['project']
          },
          Rails.root.join(apple_source_file).to_s
        )
      end

      before do
        allow(Authz::PermissionGroups::Assignable).to receive(:all).and_return(
          { modify_zebra: zebra_assignable, modify_apple: apple_assignable }
        )
        allow(Authz::Permission).to receive(:defined?).with(anything).and_return(true)
      end

      it 'returns an error with sorted raw permissions and sorted assignable names' do
        expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
          #######################################################################
          #
          #  The following raw permissions are used in multiple assignable permissions.
          #  Each raw permission should only belong to one assignable permission.
          #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#important-constraints
          #
          #    - alpha_permission: found in modify_apple (config/authz/permission_groups/assignable_permissions/wiki_category/apple/modify.yml), modify_zebra (config/authz/permission_groups/assignable_permissions/wiki_category/zebra/modify.yml)
          #    - beta_permission: found in modify_apple (config/authz/permission_groups/assignable_permissions/wiki_category/apple/modify.yml), modify_zebra (config/authz/permission_groups/assignable_permissions/wiki_category/zebra/modify.yml)
          #
          #######################################################################
        OUTPUT
      end

      context 'when one of the duplicates is deprecated' do
        let(:apple_assignable) do
          Authz::PermissionGroups::Assignable.new(
            {
              name: 'modify_apple',
              description: 'Apple assignable',
              permissions: %w[beta_permission alpha_permission unique_two],
              boundaries: ['project'],
              deprecated: true
            },
            Rails.root.join(apple_source_file).to_s
          )
        end

        it 'does not flag the shared raw permissions as duplicates' do
          expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
        end
      end
    end

    context 'when file path does not match /<category>/<resource>/<action>.yml' do
      let(:permission_name) { 'update_weekee' }
      let(:raw_permissions) { %w[update_wiki] }
      let(:permission_source_file) { 'config/authz/permission_groups/assignable_permissions/weekee/update.yml' }

      it 'returns an error' do
        expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
          #######################################################################
          #
          #  The following permission definitions do not exist at the expected path.
          #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#understanding-the-directory-structure
          #
          #    - update_weekee in config/authz/permission_groups/assignable_permissions/weekee/update.yml
          #      Expected path: config/authz/permission_groups/assignable_permissions/<category>/weekee/update.yml
          #
          #######################################################################
        OUTPUT
      end
    end

    context 'when permission name does not match path-derived name' do
      let(:permission_name) { 'modify_old_wiki' }
      let(:permission_source_file) do
        'config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml'
      end

      it 'returns an error' do
        expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
          #######################################################################
          #
          #  The following permission names do not match their file path.
          #  The permission name must equal '<action>_<resource>' derived from the path.
          #  Learn more: https://docs.gitlab.com/development/permissions/conventions/#naming-permissions
          #
          #    - modify_old_wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml)
          #      Path must match 'config/authz/permission_groups/assignable_permissions/<category>/<resource>/<action>.yml' based on <resource> and <action> values from 'modify_old_wiki' ('<action>_<resource>')
          #
          #######################################################################
        OUTPUT
      end
    end

    context 'when permission name matches path-derived name' do
      let(:permission_name) { 'modify_wiki' }
      let(:permission_source_file) do
        'config/authz/permission_groups/assignable_permissions/wiki_category/wiki/modify.yml'
      end

      it 'completes successfully' do
        expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
      end
    end

    describe 'permission resource validation' do
      let(:category) { 'wiki_category' }
      let(:resource) { 'wiki' }
      let(:permission_source_file) do
        "config/authz/permission_groups/assignable_permissions/#{category}/#{resource}/modify.yml"
      end

      context 'when resource metadata for the permission is not in the correct schema' do
        let(:resource_definition) do
          definition = { invalid_key: 'not allowed' }
          Authz::PermissionGroups::Resource.new(definition, 'source_file')
        end

        before do
          allow(Authz::PermissionGroups::Resource).to receive(:get)
            .with("#{category}/#{resource}")
            .and_return(resource_definition)
          allow(JSONSchemer).to receive(:schema)
            .with(Rails.root.join("#{described_class::PERMISSION_DIR}/resource_metadata_schema.json"))
            .and_call_original
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following assignable permission resource metadata file failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#when-do-you-need-metadata-files
            #
            #    - wiki_category/wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/.metadata.yml)
            #        - property '/invalid_key' is invalid: error_type=schema
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'when resource description does not include <actions> interpolation' do
        let(:resource_definition) do
          definition = { description: 'A description without actions interpolation.' }
          Authz::PermissionGroups::Resource.new(definition, 'source_file')
        end

        before do
          allow(Authz::PermissionGroups::Resource).to receive(:get)
            .with("#{category}/#{resource}")
            .and_return(resource_definition)
          allow(JSONSchemer).to receive(:schema)
            .with(Rails.root.join("#{described_class::PERMISSION_DIR}/resource_metadata_schema.json"))
            .and_call_original
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following assignable permission resource metadata file failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#when-do-you-need-metadata-files
            #
            #    - wiki_category/wiki (config/authz/permission_groups/assignable_permissions/wiki_category/wiki/.metadata.yml)
            #        - property '/description' does not match pattern: <actions>
            #
            #######################################################################
          OUTPUT
        end
      end
    end

    describe 'permission category validation' do
      let(:category) { 'wiki_category' }
      let(:resource) { 'wiki' }
      let(:permission_source_file) do
        "config/authz/permission_groups/assignable_permissions/#{category}/#{resource}/modify.yml"
      end

      context 'when category metadata exists and is not in the correct schema' do
        let(:category_definition) do
          definition = { invalid_key: 'not allowed' }
          Authz::PermissionGroups::Category.new(definition, 'source_file')
        end

        before do
          allow(Authz::PermissionGroups::Category).to receive(:get)
            .with(category)
            .and_return(category_definition)
          allow(JSONSchemer).to receive(:schema)
            .with(Rails.root.join("#{described_class::PERMISSION_DIR}/category_metadata_schema.json"))
            .and_call_original
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following assignable permission category metadata file failed schema validation.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#understanding-the-directory-structure
            #
            #    - wiki_category (config/authz/permission_groups/assignable_permissions/wiki_category/.metadata.yml)
            #        - property '/invalid_key' is invalid: error_type=schema
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'when category metadata exists and is valid' do
        let(:category_definition) do
          definition = { name: 'Wiki' }
          Authz::PermissionGroups::Category.new(definition, 'source_file')
        end

        before do
          allow(Authz::PermissionGroups::Category).to receive(:get)
            .with(category)
            .and_return(category_definition)
          allow(JSONSchemer).to receive(:schema)
            .with(Rails.root.join("#{described_class::PERMISSION_DIR}/category_metadata_schema.json"))
            .and_call_original
        end

        it 'completes successfully' do
          expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
        end
      end
    end

    describe 'empty resource directory validation' do
      context 'when a resource directory contains only .metadata.yml' do
        before do
          allow(Dir).to receive(:glob).and_call_original
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/*/*/')
            .and_return(['config/authz/permission_groups/assignable_permissions/some_category/empty_resource/'])
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/some_category/empty_resource/*.yml')
            .and_return([
              'config/authz/permission_groups/assignable_permissions/some_category/empty_resource/.metadata.yml'
            ])
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following resource directories contain only a .metadata.yml file with no permission definitions.
            #  Either add permission definitions or remove the directory.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#understanding-the-directory-structure
            #
            #    - config/authz/permission_groups/assignable_permissions/some_category/empty_resource/
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'when a resource directory contains .metadata.yml and permission files' do
        before do
          allow(Dir).to receive(:glob).and_call_original
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/*/*/')
            .and_return(['config/authz/permission_groups/assignable_permissions/some_category/valid_resource/'])
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/some_category/valid_resource/*.yml')
            .and_return([
              'config/authz/permission_groups/assignable_permissions/some_category/valid_resource/.metadata.yml',
              'config/authz/permission_groups/assignable_permissions/some_category/valid_resource/read.yml'
            ])
        end

        it 'completes successfully' do
          expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
        end
      end
    end

    describe 'empty category directory validation' do
      context 'when a category directory contains only .metadata.yml with no resource subdirectories' do
        before do
          allow(Dir).to receive(:glob).and_call_original
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/*/')
            .and_return(['config/authz/permission_groups/assignable_permissions/empty_category/'])
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/empty_category/*/')
            .and_return([])
          allow(File).to receive(:exist?).and_call_original
          allow(File).to receive(:exist?)
            .with('config/authz/permission_groups/assignable_permissions/empty_category/.metadata.yml')
            .and_return(true)
        end

        it 'returns an error' do
          expect { run }.to raise_error(SystemExit).and output(<<~OUTPUT).to_stdout
            #######################################################################
            #
            #  The following category directories contain only a .metadata.yml file with no resource subdirectories.
            #  Either add resource subdirectories or remove the directory.
            #  Learn more: https://docs.gitlab.com/development/permissions/granular_access/assignable_permissions/#understanding-the-directory-structure
            #
            #    - config/authz/permission_groups/assignable_permissions/empty_category/
            #
            #######################################################################
          OUTPUT
        end
      end

      context 'when a category directory contains .metadata.yml and resource subdirectories' do
        before do
          allow(Dir).to receive(:glob).and_call_original
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/*/')
            .and_return(['config/authz/permission_groups/assignable_permissions/valid_category/'])
          allow(Dir).to receive(:glob)
            .with('config/authz/permission_groups/assignable_permissions/valid_category/*/')
            .and_return(['config/authz/permission_groups/assignable_permissions/valid_category/some_resource/'])
          allow(File).to receive(:exist?).and_call_original
          allow(File).to receive(:exist?)
            .with('config/authz/permission_groups/assignable_permissions/valid_category/.metadata.yml')
            .and_return(true)
          allow(File).to receive(:directory?).and_call_original
          allow(File).to receive(:directory?)
            .with('config/authz/permission_groups/assignable_permissions/valid_category/some_resource/')
            .and_return(true)
        end

        it 'completes successfully' do
          expect { run }.to output(/Assignable permission definitions are up-to-date/).to_stdout
        end
      end
    end
  end
end
