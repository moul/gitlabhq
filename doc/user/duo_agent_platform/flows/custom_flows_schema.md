---
stage: AI-powered
group: Workflow Catalog
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
title: Custom flow YAML schema
---

{{< details >}}

- Tier: [Free](../../../subscriptions/gitlab_credits.md#for-the-free-tier-on-gitlabcom), Premium, Ultimate
- Offering: GitLab.com, GitLab Self-Managed, GitLab Dedicated
- Status: Beta

{{< /details >}}

You can use the [flow registry v1 specification](https://gitlab.com/gitlab-org/modelops/applied-ml/code-suggestions/ai-assist/-/blob/main/docs/flow_registry/v1.md) syntax to create a custom flow. 

However, certain fields and features in this specification are intentionally restricted to ensure custom flows work consistently within GitLab.

When you use this specification to create a custom flow, you must comply with the following restrictions.

## Environment

The `environment` field only supports the `ambient` value in custom flows.

The `chat` and `chat-partial` values are not supported.

## Prompts

The `model` field inside a `prompts` entry is not supported.

The model is determined by the model provider configured in your group or instance settings.

## AgentComponent

The `response_schema_id` and `response_schema_version` fields are not supported.

## OneOffComponent

The `ui_role_as` field is not supported.

## Prompt parameters

The `stop` field is not supported inside a `params` entry.

## Top-level fields

The optional `name`, `description`, and `product_group` fields from the v1 specification
are not supported. Custom flows reject these fields.
