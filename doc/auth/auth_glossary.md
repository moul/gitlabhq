---
stage: Software Supply Chain Security
group: Authentication
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
title: Authentication and authorization glossary
description: Authentication, authorization, permissions, roles, and access control terminology.
---

This glossary defines terms related to authentication, authorization, and access control in GitLab.
Understanding these concepts helps you configure secure access and manage permissions effectively.

## Access control

The practice of restricting access to resources based on authentication (verifying the identity of users)
and authorization (determining what users can do).
Use access control to protect sensitive information and functionality.

## User account

An individual account that represents a person ([human user type](https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/models/concerns/has_user_type.rb#L7)) accessing GitLab. User accounts can be assigned various roles across different groups and projects.

## Visibility

[Settings](../user/public_access.md) that control who can view and access your content:

- Public: Visible to everyone, including users without GitLab accounts
- Internal: Visible to all authenticated GitLab users
- Private: Restricted to members only

## User Types

The type you assign when you create a new user that implicitly grants a certain set of permissible actions. Types include Regular, Auditor, and Administrator. Types are different from roles and permissions.

## Administrator users

A user type with the highest level of system access who can configure instance-wide settings, manage
other users, and perform administrative tasks across all groups and projects.

## Auditor users

A special user type with read-only access to all groups, projects, and administrative functions.
[Auditor users](../administration/auditor_users.md) cannot make changes but can view content for
compliance and security purposes.

## External users

Users designated as external to your organization who have restricted access to internal projects
and groups. [External users](../administration/external_users.md) can only access projects where
they have explicit membership.

## Authentication

The process of verifying a user's identity before granting access to GitLab.
[Authentication methods](user_authentication.md) include passwords, two-factor authentication, SSH
keys, personal access tokens, and integration with external identity providers.

## Service accounts

Non-human user accounts designed to perform automated actions, access data, or run scheduled
processes. [Service accounts](../user/profile/service_accounts.md) are commonly used in pipelines
or third-party integrations.

## SSH keys

Cryptographic keys used for secure authentication when accessing Git repositories. [SSH keys](../user/ssh.md)
provide a secure alternative to password-based authentication for Git operations.

## Two-factor authentication (2FA)

An additional security layer that requires users to provide a second form of authentication
beyond their password. GitLab supports various [2FA methods](../user/profile/account/two_factor_authentication.md)
including authenticator apps and recovery codes.

## Group

A collection of related projects and users that enables efficient organization and permission
management. Groups can contain subgroups and inherit permissions from parent groups.

## Member

A user who has been granted access to a specific group or project. Members have an assigned role
that determines their permissions in that resource.

## Membership

The association between users and specific groups or projects that defines their access rights
in those resources. Users can have different memberships and roles across multiple groups
and projects.

## Authorization

The process of determining what actions an authenticated user can perform in GitLab.
Authorization is based on the user's assigned roles, permissions, and membership in groups
and projects.
Authorization decisions answer yes/no for a triplet of the form `(principal, permission, resource)` accounting for namespace membership and contextual data like attributes of the resource and/or actor. Internally, we use the [Declarative Policy framework](../development/policies.md) to implement authorization.

### Authorization Principal

Actors including human users, personal access tokens, composite identities, service accounts etc. that are used in an authorization triplet (mentioned above) to determine what action they can do a resource.

### Resource

Objects that you can manage or operate on in GitLab, including projects, groups, issues,
merge requests, snippets, pipelines, milestones etc.

### Feature Category

Resources belong to feature categories that are defined in our [monorepo](https://gitlab.com/gitlab-org/gitlab/-/blob/master/config/feature_categories.yml) to associate resources against feature domains owned by engineering teams within GitLab.

## Permission

The [specific actions](../user/permissions.md) a user can perform on GitLab resources like creating issues,
pushing code, or managing project settings. These make up roles.

Internally, they are referred to as assignable permission groups and defined in [YAML files](https://gitlab.com/gitlab-org/gitlab/-/tree/master/config/authz/permission_groups/assignable_permissions).

### Raw permissions

The most atomic, granular permission that is not customer facing and are used to build up an assignable permission group (called "Permission" above). They are defined as YAML definitions in our [monorepo](https://gitlab.com/gitlab-org/gitlab/-/tree/master/config/authz/permissions).
Roles are built from assignable permission groups, which are built from raw permissions.

## Roles

Sets of one or more permissions assigned to a user that define the actions they can perform in
groups and projects. Roles include both default roles and custom roles.

## Default roles

The [predefined roles](../user/permissions.md) available in GitLab: Minimal Access, Guest, Planner, Reporter, Security Manager, Developer,
Maintainer, and Owner. Each role includes a specific set of permissions.

## Custom roles

Customer-defined roles with specific permissions tailored to organizational needs. Use [custom roles](../user/custom_roles/_index.md)
to extend the default roles and add additional permissions. Available permissions are defined as
[YAML files](https://gitlab.com/gitlab-org/gitlab/-/tree/master/ee/config/custom_abilities).

## Boundaries

The organizational levels where permissions and policies can be applied:

- Instance: Applies across the entire GitLab deployment
- Group: Applies to a specific group and its subgroups or projects
- Project: Applies only to a single project
- User: Applies to actions performed by or on behalf of a specific user

## Scopes

Scopes define what permissions are available to certain resources in each organizational
level (boundary). Each scope is fully qualified by resource permission and boundary. GitLab uses
these scopes to determine the access given to personal access tokens, group access tokens,
project access tokens, and OAuth applications.

## Inheritance

The automatic flow of permissions from parent groups to child groups and projects. Inheritance
simplifies access management by applying permissions granted at higher levels to all nested
content below.

## Personal access token

A token that acts as an alternative to passwords for authentication when using the GitLab API
or Git over HTTPS. [Personal access tokens](../user/profile/personal_access_tokens.md) have defined
scopes that limit what actions they can perform.

## Identity provider (IdP)

The service that manages your user identities, such as Okta or OneLogin.

## Service provider (SP)

An application that delegates authentication to an external identity provider. The service provider
consumes authentication assertions from a SAML IdP to verify user identities. GitLab acts as a
service provider when configured for SAML or OIDC authentication.

## Assertion

A piece of information about a user's identity, such as their name or role. Also known as a claim or
an attribute.

## Single Sign-On (SSO)

An authentication method that allows users to access multiple applications with a single set of
credentials. With SSO, users authenticate once through an identity provider and gain access to
GitLab and other connected services without re-entering credentials.

## Assertion consumer service URL

The callback on GitLab where users are redirected after successfully authenticating with the IdP.

## Issuer

How GitLab identifies itself to the IdP. Also known as a "Relying party trust identifier".

## Certificate fingerprint

Confirms that communications over SAML are secure by checking that the server is signing
communications with the correct certificate. Also known as a certificate thumbprint.
