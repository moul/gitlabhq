# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) do
    db_name = "gitlab_data_isolation_test"

    # Load from `gitlab-rails/config/database.yml`
    # Inject a `gitlab_data_isolation_test` database
    config_path = File.expand_path('../../../../config/database.yml', __dir__)
    db_config = YAML.load_file(config_path)['test']['main']
    ActiveRecord::Base.establish_connection(db_config.merge(database: "postgres"))
    begin
      ActiveRecord::Base.connection.drop_database(db_name)
    rescue StandardError
      nil
    end
    begin
      ActiveRecord::Base.connection.create_database(db_name)
    rescue StandardError
      nil
    end
    ActiveRecord::Base.establish_connection(db_config.merge(database: db_name))

    ActiveRecord::Schema.define do
      create_table :projects do |t|
        t.string :name
        t.integer :organization_id
      end

      create_table :issues do |t|
        t.string :title
        t.integer :project_id
        t.integer :namespace_id
      end

      create_table :snippets do |t|
        t.string :content
        t.integer :project_id
        t.integer :organization_id
      end

      create_table :organizations do |t|
        t.string :name
        t.string :status
      end

      create_table :features do |t|
        t.string :key
      end

      create_table :user_details do |t|
        t.string :bio
        t.integer :user_id
      end
    end
  end
end
