---
stage: Tenant Scale
group: Cells Infrastructure
info: Any user with at least the Maintainer role can merge updates to this content. For details, see https://docs.gitlab.com/development/development_processes/#development-guidelines-review.
title: GitLab Cells Development Guidelines
---

For background of GitLab Cells, refer to the [design document](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/).

## Available Cells / Organization schemas

Below are available schemas related to Cells and Organizations:

| Schema | Description |
| ------ | ----------- |
| `gitlab_main_cell`| Use for all tables in the `main:` database that are for an Organization. For example, `projects` and `groups` |
| `gitlab_main_clusterwide_setting` | All tables in the `main:` database related to Cluster settings. For example, `application_settings`. |
| `gitlab_main_clusterwide` | All tables in the `main:` database where all rows, or a subset of rows needs to be present across the cluster, in the [Cells](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/) architecture. For example, `users`. For the [Cells 1.0 architecture](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/iterations/cells-1.0/), there are no real clusterwide tables as each cell will have its own database. In effect, these tables will still be stored locally in each cell. |
| `gitlab_main_cell_local` | For tables in the `main:` database that are related to features that is distinct for each cell. For example, `zoekt_nodes`, or `shards`. These cell-local tables should not have any foreign key references from/to organization tables. |
| `gitlab_ci` | Use for all tables in the `ci:` database that are for an Organization. For example, `ci_pipelines` and `ci_builds` |
| `gitlab_ci_cell_local` | For tables in the `ci:` database that are related to features that is distinct for each cell. For example, `instance_type_ci_runners`, or `ci_cost_settings`. These cell-local tables should not have any foreign key references from/to organization tables. |
| `gitlab_main_user` | Schema for all User-related tables, ex. users, etc. Most user functionality is organizational level (e.g. commenting on an issue), but some functionality (e.g. login) is cluster-wide. |

## Choose either the `gitlab_main_cell` or `gitlab_main_clusterwide` schema

Depending on the use case, your feature may be [organization-level, or clusterwide](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/#how-do-i-decide-whether-to-move-my-feature-to-the-cluster-cell-or-organization-level) and hence the tables used for the feature should also use the appropriate schema.

When you choose the appropriate [schema](#available-cells--organization-schemas) for tables, consider the following guidelines as part of the [Cells](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/) architecture:

- Default to `gitlab_main_cell`: We expect most tables to be assigned to the `gitlab_main_cell` schema by default. Choose this schema if the data in the table is related to `projects` or `namespaces`.
- Consult with the Tenant Scale group: If you believe that the `gitlab_main_clusterwide` schema is more suitable for a table, seek approval from the Tenant Scale group. This is crucial because it has scaling implications and may require reconsideration of the schema choice.

When proposing new tables with `gitlab_main_clusterwide` schema, be aware of the following:

- Do not use cluster-wide database tables to store [static data](#static-data).
- Must be able to be synchronized independently to other / all cells.
- Should only have a tiny amount of rows. Larger tables with many rows are not suitable to be cluster-wide tables.
- Must not have references to / from other tables that will cause data issues when synchronized to other cells.

We may also ask teams to update tables from `gitlab_main_clusterwide` to `gitlab_main_cell` as required, which also might require adding sharding keys to these tables.

To understand how existing tables are classified, you can use [this dashboard](https://manojmj.gitlab.io/tenant-scale-schema-progress/).

After a schema has been assigned, the merge request pipeline might fail due to one or more of the following reasons, which can be rectified by following the linked guidelines:

- [Cross-database joins](../database/multiple_databases.md#suggestions-for-removing-cross-database-joins)
- [Cross-database transactions](../database/multiple_databases.md#fixing-cross-database-transactions)
- [Cross-database foreign keys](../database/multiple_databases.md#foreign-keys-that-cross-databases)

## Defining a sharding key for all organizational tables

All tables with the following `gitlab_schema` are considered organization level:

- `gitlab_main_cell`
- `gitlab_ci`
- `gitlab_sec`
- `gitlab_main_user`

All newly created organization-level tables are required to have a `sharding_key`
defined in the corresponding `db/docs/` file for that table.

The purpose of the sharding key is documented in the
[Organization isolation blueprint](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/organization/isolation/),
but in short this column is used to provide a standard way of determining which
Organization owns a particular row in the database. The column will be used in
the future to enforce constraints on data not cross Organization boundaries. It
will also be used in the future to provide a uniform way to migrate data
between Cells.

The actual name of the foreign key can be anything but it must reference a row
in `projects` or `groups`. The chosen `sharding_key` column must be non-nullable.

Setting multiple `sharding_key`, with nullable columns are also allowed, provided that
the table has a check constraint that correctly ensures at least one of the keys must be non-nullable for a row in the table.
See [`NOT NULL` constraints for multiple columns](../database/not_null_constraints.md#not-null-constraints-for-multiple-columns)
for instructions on creating these constraints.

The following are examples of valid sharding keys:

- The table entries belong to a project only:

  ```yaml
  sharding_key:
    project_id: projects
  ```

- The table entries belong to a project and the foreign key is `target_project_id`:

  ```yaml
  sharding_key:
    target_project_id: projects
  ```

- The table entries belong to a namespace/group only:

  ```yaml
  sharding_key:
    namespace_id: namespaces
  ```

- The table entries belong to a namespace/group only and the foreign key is `group_id`:

  ```yaml
  sharding_key:
    group_id: namespaces
  ```

- The table entries belong to a namespace or a project:

  ```yaml
  sharding_key:
    project_id: projects
    namespace_id: namespaces
  ```

- (Only for `gitlab_main_user`) The table entries belong to a user only:

  ```yaml
  sharding_key:
    user_id: user
  ```

### The sharding key must be immutable

The choice of a `sharding_key` should always be immutable. This is because the
sharding key column will be used as an index for the planned
[Org Mover](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/migration/),
and also the
[enforcement of isolation](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/organization/isolation/)
of Organization data.
Any mutation of the `sharding_key` could result in in-consistent data being read.

Therefore, if your feature requires a user experience which allows data to be
moved between projects or groups/namespaces, then you may need to redesign the
move feature to create new rows.
An example of this can be seen in the
[move an issue feature](../../user/project/issues/managing_issues.md#move-an-issue).
This feature does not actually change the `project_id` column for an existing
`issues` row but instead creates a new `issues` row and creates a link in the
database from the original `issues` row.
If there is a particularly challenging
existing feature that needs to allow moving data you will need to reach out to
the Tenant Scale team early on to discuss options for how to manage the
sharding key.

### Using `namespace_id` as sharding key

The `namespaces` table has rows that can refer to a `Group`, a `ProjectNamespace`,
or a `UserNamespace`. The `UserNamespace` type is also known as a personal namespace.

Using a `namespace_id` as a sharding key is a good option, except when `namespace_id`
refers to a `UserNamespace`. Because a user does not necessarily have a related
`namespace` record, this sharding key can be `NULL`. A sharding key should not
have `NULL` values.

### Using the same sharding key for projects and namespaces

Developers may also choose to use `namespace_id` only for tables that can
belong to a project where the feature used by the table is being developed
following the
[Consolidating Groups and Projects blueprint](https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/consolidating_groups_and_projects/).
In that case the `namespace_id` would need to be the ID of the
`ProjectNamespace` and not the group that the namespace belongs to.

### Using `organization_id` as sharding key

Usually, `project_id` or `namespace_id` are the most common sharding keys.
However, there are cases where a table does not belong to a project or a namespace.

In such cases, `organization_id` is an option for the sharding key, provided the below guidelines are followed:

- The `sharding_key` column still needs to be [immutable](#the-sharding-key-must-be-immutable).
- Only add `organization_id` for root level models (for example, `namespaces`), and not leaf-level models (for example, `issues`).
- Ensure such tables do not contain data related to groups, or projects (or records that belong to groups / projects).
  Instead, use `project_id`, or `namespace_id`.
- Tables with lots of rows are not good candidates because we would need to re-write every row if we move the entity to a different organization which can be expensive.
- When there are other tables referencing this table, the application should continue to work if the referencing table records are moved to a different organization.

If you believe that the `organization_id` is the best option for the sharding key, seek approval from the Tenant Scale group.
This is crucial because it has implications for data migration and may require reconsideration of the choice of sharding key.

As an example, see [this issue](https://gitlab.com/gitlab-org/gitlab/-/issues/462758), which added `organization_id` as a sharding key to an existing table.

For more information about development with organizations, see [Organization](../organization)

### Define a `desired_sharding_key` to automatically backfill a `sharding_key`

We need to backfill a `sharding_key` to hundreds of tables that do not have one.
This process will involve creating a merge request like
<https://gitlab.com/gitlab-org/gitlab/-/merge_requests/136800> to add the new
column, backfill the data from a related table in the database, and then create
subsequent merge requests to add indexes, foreign keys and not-null
constraints.

In order to minimize the amount of repetitive effort for developers we've
introduced a concise declarative way to describe how to backfill the
`sharding_key` for this specific table. This content will later be used in
automation to create all the necessary merge requests.

An example of the `desired_sharding_key` was added in
<https://gitlab.com/gitlab-org/gitlab/-/merge_requests/139336> and it looks like:

```yaml
--- # db/docs/security_findings.yml
table_name: security_findings
classes:
- Security::Finding

# ...

desired_sharding_key:
  project_id:
    references: projects
    backfill_via:
      parent:
        foreign_key: scanner_id
        table: vulnerability_scanners
        table_primary_key: id # Optional. Defaults to 'id'
        sharding_key: project_id
        belongs_to: scanner
```

To understand best how this YAML data will be used you can map it onto
the merge request we created manually in GraphQL
<https://gitlab.com/gitlab-org/gitlab/-/merge_requests/136800>. The idea
will be to automatically create this. The content of the YAML specifies
the parent table and its `sharding_key` to backfill from in the batched
background migration. It also specifies a `belongs_to` relation which
will be added to the model to automatically populate the `sharding_key` in
the `before_save`.

#### Define a `desired_sharding_key` when the parent table also has one

By default, a `desired_sharding_key` configuration will validate that the chosen `sharding_key`
exists on the parent table. However, if the parent table also has a `desired_sharding_key` configuration
and is itself waiting to be backfilled, you need to include the `awaiting_backfill_on_parent` field.
For example:

```yaml
desired_sharding_key:
  project_id:
    references: projects
    backfill_via:
      parent:
        foreign_key: package_file_id
        table: packages_package_files
        table_primary_key: id # Optional. Defaults to 'id'
        sharding_key: project_id
        belongs_to: package_file
    awaiting_backfill_on_parent: true
```

There are likely edge cases where this `desired_sharding_key` structure is not
suitable for backfilling a `sharding_key`. In such cases the team owning the
table will need to create the necessary merge requests to add the
`sharding_key` manually.

### Exempting certain tables from having sharding keys

Certain tables can be exempted from having sharding keys by adding

```yaml
exempt_from_sharding: true
```

to the table's database dictionary file. This can be used for:

- JiHu specific tables, since they do not have any data on the .com database. [!145905](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/145905)
- tables that are marked to be dropped soon, like `operations_feature_flag_scopes`. [!147541](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/147541)

When tables are exempted from sharding key requirements, they also do not show up in our
[progress dashboard](https://cells-progress-tracker-gitlab-org-tenant-scale-g-f4ad96bf01d25f.gitlab.io/sharding_keys).

Exempted tables must not have foreign key, or loose foreign key references, as
this may cause the target cell's database to have foreign key violations when data is
moved.
See [#471182](https://gitlab.com/gitlab-org/gitlab/-/issues/471182) for examples and possible solutions.

## Ensure sharding key presence on application level

When you define your sharding key you must make sure it's filled on application level.
Every `ApplicationRecord` model includes a helper `populate_sharding_key`, which
provides a convenient way of defining sharding key logic,
and also a corresponding matcher to test your sharding key logic. For example:

```ruby
# in model.rb
populate_sharding_key :project_id, source: :merge_request, field: :target_project_id

# in model_spec.rb
it { is_expected.to populate_sharding_key(:project_id).from(:merge_request, :target_project_id) }
```

See more [helper examples](https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/models/concerns/populates_sharding_key.rb)
and [RSpec matcher examples](https://gitlab.com/gitlab-org/gitlab/-/blob/master/spec/support/matchers/populate_sharding_key_matcher.rb).

## Static data

Problem: A clusterwide database table is used to store static data.
But, the primary key of the table is used as a global reference.
This primary key is not globally consistent which creates problems.

Example: The `plans` table on a given Cell has the following data:

```shell
 id |             name             |              title
----+------------------------------+----------------------------------
  1 | default                      | Default
  2 | bronze                       | Bronze
  3 | silver                       | Silver
  5 | gold                         | Gold
  7 | ultimate_trial               | Ultimate Trial
  8 | premium_trial                | Premium Trial
  9 | opensource                   | Opensource
  4 | premium                      | Premium
  6 | ultimate                     | Ultimate
 10 | ultimate_trial_paid_customer | Ultimate Trial for Paid Customer
(10 rows)
```

On another cell, the `plans` table has differing ids for the same `name`:

```shell
 id |             name             |            title
----+------------------------------+------------------------------
  1 | default                      | Default
  2 | bronze                       | Bronze
  3 | silver                       | Silver
  4 | premium                      | Premium
  5 | gold                         | Gold
  6 | ultimate                     | Ultimate
  7 | ultimate_trial               | Ultimate Trial
  8 | ultimate_trial_paid_customer | Ultimate Trial Paid Customer
  9 | premium_trial                | Premium Trial
 10 | opensource                   | Opensource
 ```

This `plans.id` column is then used as a reference in the `hosted_plan_id`
column of `gitlab_subscriptions` table.

Solution: Use globally unique references, not a database sequence.
If possible, hard-code static data in application code, instead of using the
database.

In this case, the `plans` table can be dropped, and replaced with a fixed model:

```ruby
class Plan
  include ActiveModel::Model
  include ActiveModel::Attributes
  include ActiveRecord::FixedItemsModel::Model

  ITEMS = [
    {:id=>1, :name=>"default", :title=>"Default"},
    {:id=>2, :name=>"bronze", :title=>"Bronze"},
    {:id=>3, :name=>"silver", :title=>"Silver"},
    {:id=>4, :name=>"premium", :title=>"Premium"},
    {:id=>5, :name=>"gold", :title=>"Gold"},
    {:id=>6, :name=>"ultimate", :title=>"Ultimate"},
    {:id=>7, :name=>"ultimate_trial", :title=>"Ultimate Trial"},
    {:id=>8, :name=>"ultimate_trial_paid_customer", :title=>"Ultimate Trial Paid Customer"},
    {:id=>9, :name=>"premium_trial", :title=>"Premium Trial"},
    {:id=>10, :name=>"opensource", :title=>"Opensource"}
  ]

  attribute :id, :integer
  attribute :name, :string
  attribute :title, :string
end
```

The `hosted_plan_id` column will also be updated to refer to the fixed model's
`id` value.

Examples of hard-coding static data include:

- [VisibilityLevel](https://gitlab.com/gitlab-org/gitlab/-/blob/5ae43dface737373c50798ccd909174bcdd9b664/lib/gitlab/visibility_level.rb#L25-27)
- [Static defaults for work item statuses](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/178180)
