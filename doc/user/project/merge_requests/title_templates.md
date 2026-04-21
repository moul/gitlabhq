---
stage: Create
group: Code Review
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
description: Use merge request title templates to set a default title format for new merge requests in your project.
title: Merge request title templates
---

{{< details >}}

- Tier: Free, Premium, Ultimate
- Offering: GitLab.com, GitLab Self-Managed
- Status: Beta

{{< /details >}}

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/228442) in GitLab 18.11 [with a feature flag](../../../administration/feature_flags/_index.md) named `mr_default_title_template`. Disabled by default. This feature is in [beta](../../../policy/development_stages_support.md#beta).

{{< /history >}}

> [!flag]
> The availability of this feature is controlled by a feature flag.
> For more information, see the history.
> This feature is available for testing, but not ready for production use.

Merge request title templates define the default title for new merge requests in a project.
Use templates to standardize merge request naming conventions across your team.

Templates support variables that expand to values like the source branch name or
the first commit message.
Users can edit the title before creating the merge request.

## Configure a merge request title template

Prerequisites:

- You must have at least the Maintainer role for the project.

To configure a merge request title template:

1. In the left sidebar, select **Search or go to** and find your project.
1. Select **Settings** > **Merge requests**.
1. Scroll to **Merge request title template**.
1. Enter a template using static text and [supported variables](#supported-variables).
   The template is limited to 100 characters.
1. Select **Save changes**.

To remove the template and restore the default behavior, clear the template field and
select **Save changes**.

## Supported variables

Title templates support the following variables:

| Variable               | Description                                                                                                    | Output example |
|------------------------|----------------------------------------------------------------------------------------------------------------|----------------|
| `%{source_branch}`     | The name of the source branch.                                                                                 | `my-feature-branch` |
| `%{target_branch}`     | The name of the target branch.                                                                                 | `main`         |
| `%{title_from_branch}` | The source branch name converted to a human-readable format. Hyphens and underscores are replaced with spaces. | `My feature branch` |
| `%{first_commit_title}` | The subject (first line) of the first commit in the merge request.                                            | `Update README.md` |

## Template examples

| Template                                   | Result |
|--------------------------------------------|--------|
| `%{source_branch}`                         | `my-feature-branch` |
| `%{title_from_branch}`                     | `My feature branch` |
| `%{first_commit_title}`                    | `Update README.md` |
| `Draft: %{title_from_branch}`              | `Draft: My feature branch` |
| `[%{source_branch}] %{first_commit_title}` | `[my-feature-branch] Update README.md` |

## Title template assignment

When you create a merge request, GitLab assigns the title in this order:

1. If you provide a title, GitLab uses it.
1. If a title template is configured, GitLab uses the expanded template.
1. If no template is set, GitLab derives the title from the first commit message or the source branch name.

## Related topics

- [Commit message templates](commit_templates.md)
- [Create a merge request](creating_merge_requests.md)
