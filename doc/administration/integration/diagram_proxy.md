---
stage: Plan
group: Knowledge
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
gitlab_dedicated: yes
title: Diagram Proxy
---

{{< details >}}

- Tier: Free, Premium, Ultimate
- Offering: GitLab Self-Managed, GitLab Dedicated

{{< /details >}}

Use the diagram proxy in GitLab to reduce the exposure of your users to external diagram services, and to remove diagram information from URLs seen by users' browsers.

## Enable diagram proxy in GitLab

You need to enable the diagram proxy for the [Kroki](kroki.md) and [PlantUML](plantuml.md) integrations from Settings under **Admin** area.
To do that, sign in with an administrator account and follow these steps:

1. In the upper-right corner, select **Admin**.
1. Go to **Settings** > **General**.
1. Expand the **Kroki** or **PlantUML** section.
1. Select **Proxy Kroki diagrams through GitLab** or **Proxy PlantUML diagrams through GitLab** checkbox.

You can enable the diagram proxy for either or both of Kroki and PlantUML.

## Diagram proxy

When you enable the diagram proxy for an integration, instead of the user's browser making the request to the diagram server, GitLab does it on their behalf.
Additionally, the URL fetched by the user's browser doesn't contain the diagram information, and can only be requested once.
