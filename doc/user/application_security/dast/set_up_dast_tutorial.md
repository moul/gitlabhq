---
stage: Application Security Testing
group: Dynamic Analysis
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments
title: 'Tutorial: Set up DAST to scan your web application'
---

<!-- vale gitlab_base.FutureTense = NO -->

Learn how to integrate Dynamic Application Security Testing (DAST) into your CI/CD pipeline.

Static analysis finds vulnerabilities in source code. DAST identifies runtime security issues
that only appear when your application runs in a real environment and interacts with services
and user workflows. With GitLab-integrated DAST solution, you can set up GitLab DAST to
automatically check for these issues every time you deploy code to a test environment.

In this tutorial, you'll learn how to:

1. [Set up the Tanuki Shop application](#set-up-the-tanuki-shop-application)
1. [Define the build stage](#define-the-build-stage)
1. [Deploy the application](#deploy-the-application)
1. [Configure passive and active scan](#configure-passive-and-active-scans)
1. [Verify the setup](#verify-your-setup)

> [!note]
> The Tanuki Shop application in this tutorial doesn't require authentication. If your application requires login,
> see [DAST authentication](../../application_security/dast/browser/configuration/authentication.md).

## Before you begin

- GitLab Ultimate subscription.
- The Maintainer role for your project.

## Set up the Tanuki Shop application

We will start by creating your own version of the Tanuki Shop directly in GitLab.

1. Go to the [Tanuki Shop repository](https://gitlab.com/gitlab-da/tutorials/security-and-governance/tanuki-shop).
1. In the top-right corner, select **Fork**.
1. Select your namespace (personal or group) and select **Fork project**.

   The forked repository contains all the necessary files for this tutorial, including the application code and initial CI/CD
   configuration. We'll modify the configuration in the following steps.

1. After you fork the repository, go to **Settings** > **General** > **Visibility, project features, permissions** and ensure the **Container Registry** toggle is turned on.
1. Verify the Container Registry is working:
   1. Go to **Deploy** > **Container Registry**.
   1. You should see an empty registry. If you see an error, check your project permissions.

   > [!note]
   > The Container Registry stores Docker images built in your pipeline. If this step fails, the build job will fail later.

## Define the build stage

Now you'll configure the build stage to create a Docker image and push it to the container registry.

1. In your project, open the `.gitlab-ci.yml` file.
1. Replace the existing content with the following build stage configuration:

   ```yaml
   stages:
     - build
     - dast

   include:
     - template: Security/DAST.gitlab-ci.yml

   # Build: Create the Docker image and push to the container registry
   build:
     services:
       - name: docker:dind
         alias: dind
     image: docker:20.10.16
     stage: build
     script:
       - docker login -u gitlab-ci-token -p $CI_JOB_TOKEN $CI_REGISTRY
       - docker pull $CI_REGISTRY_IMAGE:latest || true
       - docker build --tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA --tag $CI_REGISTRY_IMAGE:latest .
       - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
       - docker push $CI_REGISTRY_IMAGE:latest
   ```

This configuration builds a Docker image from the Dockerfile in your repository and pushes it to the GitLab Container Registry.

## Deploy the application

To deploy the application:

1. In your `.gitlab-ci.yml` file, add the DAST job configuration below the build job:

   ```yaml
   # DAST: Scan the application running in a Docker container
   dast:
     stage: dast
     services:
       - name: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
         alias: yourapp
     variables:
       DAST_TARGET_URL: http://yourapp:3000
       DAST_FULL_SCAN: "false"
       DAST_BROWSER_SCAN: "true"
   ```

   > [!note]
   > This configuration uses the services feature to run the application container alongside the DAST job.
   > The application is accessible at `http://yourapp:3000` from within the DAST job.

1. Select **Commit changes** to save the pipeline configuration.

## Configure passive and active scans

DAST supports two scanning modes that balance security coverage with scan time. Passive scans
provide quick feedback. Active scans discover vulnerabilities that emerge only when the
application is tested with crafted requests, providing more thorough security validation before
code reaches production.

**Passive scans** (default, ~2-5 minutes):

- Analyze application responses without sending potentially harmful requests
- Examine HTTP headers, cookies, response content, and SSL/TLS configuration
- Safe to run on any environment
- Good for quick feedback in CI/CD pipelines

**Active scans** (~10-30 minutes depending on application size):

- Send crafted requests designed to trigger vulnerabilities
- Test for injection flaws, authentication issues, and business logic vulnerabilities
- More thorough but slower
- Best for feature branches before merging to main

> [!note]
> Do not run DAST scans against a production server. Not only can it perform any function that a
> user can, such as selecting buttons or submitting forms, but it may also trigger bugs, leading to
> modification or loss of production data. Only run DAST scans against a test server.

To configure passive and active scans:

1. In your `.gitlab-ci.yml` file, update the `dast` job to use active scans for non-default branches and passive scans for the default branch:

   ```yaml
   dast:
     stage: dast
     rules:
       - if: $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH
         variables:
           DAST_FULL_SCAN: "false"  # Passive scan only for main branch (~2-5 mins)
       - if: $CI_COMMIT_REF_NAME != $CI_DEFAULT_BRANCH
         variables:
           DAST_FULL_SCAN: "true"   # Active scan for feature branches (~10-30 mins)
   ```

> [!note]
> For your first run, keep `DAST_FULL_SCAN: "false"` to see results faster.
> You can enable active scans after verifying the setup works.

## Verify your setup

Now, verify that DAST can successfully discover vulnerabilities in your running application.

1. Select **Commit changes** in the pipeline editor.
1. Go to **Build** > **Pipelines** and verify your latest pipeline completed successfully.

   Expected timeline:
   - Build stage: 2-3 minutes (building Docker image)
   - DAST stage: 2-5 minutes (passive scan)

1. After the pipeline completes successfully, go to **Secure** > **Vulnerability Report**.
1. Review the security findings.

> [!note]
> The Tanuki Shop application is intentionally vulnerable for demonstration purposes. You should see findings
> related to security headers, outdated dependencies, and other common web vulnerabilities.

### Test the vulnerability workflow

To see DAST in action on a new change:

1. Create a merge request with a small UI change.

   For example, edit the storefront heading from `Welcome to Tanuki Shop` to
   `Welcome to the Tanuki Shop`.
1. Commit the changes to a new development branch and open a merge request against the default
   branch.
1. After the pipeline completes, on the **Security** tab, view new vulnerabilities found in
   your feature branch.
1. Merge the merge request. The vulnerabilities appear in the project-wide
   **Vulnerability Report**.

## Troubleshooting

### Build job fails with authentication errors

Authentication errors occur when the Container Registry credentials are not available.

To resolve the issue:

1. Verify Container Registry is enabled: **Settings** > **General** > **Visibility, project features, permissions** > **Container Registry**.
1. Check that your project has a valid CI/CD token. GitLab automatically provides `$CI_REGISTRY_USER` and `$CI_REGISTRY_PASSWORD`.

### DAST job completes but no vulnerabilities are found

This issue occurs when DAST cannot reach the application, or the application is not vulnerable.

To resolve this issue:

1. Verify the application is running:

   ```shell
   curl "http://yourapp:3000"
   ```

1. Check the DAST job logs for errors related to connectivity.
1. Verify the `DAST_TARGET_URL` variable is set correctly (should be `http://yourapp:3000`).
1. The Tanuki Shop application should have vulnerabilities. If none are found, check that you're using the correct forked repository.

## Next steps

After completing this tutorial, you can:

- Configure [advanced DAST settings](../../application_security/dast/browser/configuration/customize_settings.md) for your specific requirements.
- Set up [on-demand DAST scans](../../application_security/dast/on-demand_scan.md) for ad-hoc testing.
- Integrate DAST with [vulnerability management workflows](../../application_security/vulnerabilities/_index.md).
- Explore the [DAST demos repository](https://gitlab.com/gitlab-org/security-products/demos/dast/) for more examples.

## Related topics

- [DAST configuration reference](../../application_security/dast/browser/configuration/_index.md)
- [Security policies](../../application_security/policies/_index.md)
- [Vulnerability management](../../application_security/vulnerabilities/_index.md)
- [Application security testing solutions](https://about.gitlab.com/solutions/application-security-testing/)
