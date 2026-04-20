---
stage: AI-powered
group: Agent Foundations
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
title: Troubleshooting the Agent Platform in your IDE
---

If you are working with the GitLab Duo Agent Platform in your IDE,
you might encounter the following issues.

## General guidance

Start by ensuring that GitLab Duo is on and that you are properly connected.

- Ensure you meet [the prerequisites](_index.md#prerequisites).
- Ensure the branch you want to work in is checked out.
- Ensure you have turned on the necessary settings in the IDE.
- Ensure that [Admin mode is disabled](../../administration/settings/sign_in_restrictions.md#turn-off-admin-mode-for-your-session).

### Project not in a group namespace

GitLab Duo Agent Platform requires that projects belong to a group namespace.

To determine the namespace your project is in, [look at the URL](../namespace/_index.md#determine-which-type-of-namespace-youre-in).

If necessary, you can
[transfer your project to a group namespace](../../tutorials/move_personal_project_to_group/_index.md#move-your-project-to-a-group).

### IDE-specific troubleshooting

For more support, refer to the extension troubleshooting pages:

- [GitLab for VS Code](../../editor_extensions/visual_studio_code/troubleshooting.md)
- [GitLab Duo plugin for JetBrains IDEs](../../editor_extensions/jetbrains_ide/jetbrains_troubleshooting.md)
- [GitLab for Visual Studio](../../editor_extensions/visual_studio/visual_studio_troubleshooting.md)

## Still having issues?

Contact your GitLab administrator for assistance.
