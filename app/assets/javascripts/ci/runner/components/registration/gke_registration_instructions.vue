<script>
import { GlAlert, GlButton, GlLink, GlIcon, GlSprintf } from '@gitlab/ui';
import HelpPopover from '~/vue_shared/components/help_popover.vue';
import ClipboardButton from '~/vue_shared/components/clipboard_button.vue';
import GoogleCloudFieldGroup from '~/ci/runner/components/registration/google_cloud_field_group.vue';
import GoogleCloudRegistrationInstructionsModal from '~/ci/runner/components/registration/google_cloud_registration_instructions_modal.vue';
import GoogleCloudLearnMoreLink from '~/ci/runner/components/registration/google_cloud_learn_more_link.vue';
import GkeNodePoolGroup from '~/ci/runner/components/registration/gke_node_pool_group.vue';
import { s__, __ } from '~/locale';
import { fetchPolicies } from '~/lib/graphql';
import provisionGkeRunnerProject from '../../graphql/register/provision_gke_runner_project.query.graphql';
import provisionGkeRunnerGroup from '../../graphql/register/provision_gke_runner_group.query.graphql';

import { captureException } from '../../sentry_utils';

const GC_PROJECT_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/; // https://cloud.google.com/resource-manager/reference/rest/v1/projects
const GC_REGION_PATTERN = /^[a-z]+-[a-z]+\d+$/;
const GC_ZONE_PATTERN = /^[a-z]+-[a-z]+\d+-[a-z]$/;
const GC_MACHINE_TYPE_PATTERN = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;

export default {
  name: 'GkeRegistrationInstructions',
  GC_PROJECT_PATTERN,
  GC_REGION_PATTERN,
  GC_ZONE_PATTERN,
  GC_MACHINE_TYPE_PATTERN,
  i18n: {
    heading: s__('Runners|Register runner'),
    headingDescription: s__(
      'Runners|To set up an autoscaling fleet of runners on Google Cloud, you can use the following recommended setup or %{linkStart}customize the Terraform configuration%{linkEnd}.',
    ),
    beforeHeading: s__('Runners|Before you begin'),
    permissionsText: s__(
      'Runners|Ensure you have the %{linkStart}Owner%{linkEnd} IAM role on your Google Cloud project.',
    ),
    billingLinkText: s__(
      'Runners|Ensure that %{linkStart}billing is enabled%{linkEnd} for your Google Cloud project.',
    ),
    preInstallText: s__(
      'Runners|Install the %{gcloudLinkStart}Google Cloud CLI%{gcloudLinkEnd} and %{terraformLinkStart}Terraform%{terraformLinkEnd}.',
    ),
    stepOneHeading: s__('Runners|1. Environment'),
    stepOneDescription: s__(
      'Runners|Environment in Google Cloud where runners execute CI/CD jobs. Runners are created in temporary virtual machines based on demand. To improve security, use a Google Cloud project for CI/CD only.',
    ),
    stepOneNodePoolHeading: s__('Runners|1.2 Node Pools'),
    stepOneNodePoolDescription: s__(
      'Runners|1.2 Set up the Node pools for your Kubernetes cluster.',
    ),
    stepTwoHeading: s__('Runners|2. Set up GitLab Runner'),
    stepTwoDescription: s__(
      'Runners|To view the setup instructions, complete the previous form. The instructions help you set up an autoscaling fleet of runners to execute your CI/CD jobs in Google Cloud.',
    ),
    runnerSetupBtnText: s__('Runners|Setup instructions'),
    copyCommands: __('Copy commands'),
    emptyFieldsAlertMessage: s__(
      'Runners|To view the setup instructions, complete the previous form.',
    ),
    invalidFieldsAlertMessage: s__(
      'Runners|To view the setup instructions, make sure all form fields are completed and correct.',
    ),
    invalidFormButton: s__('Runners|Go to first invalid form field'),
    externalLink: __('(external link)'),
    addNodePool: s__('Runners|Add Node Pool'),
    removeNodePool: s__('Runners|Remove Node Pool'),
  },
  links: {
    terraformConfigLink:
      'https://gitlab.com/gitlab-org/ci-cd/runner-tools/grit/-/blob/main/docs/scenarios/google/linux/docker-autoscaler-default/index.md',
    permissionsLink: 'https://cloud.google.com/iam/docs/understanding-roles#owner',
    billingLink:
      'https://cloud.google.com/billing/docs/how-to/verify-billing-enabled#confirm_billing_is_enabled_on_a_project',
    gcloudLink: 'https://cloud.google.com/sdk/docs/install',
    terraformLink: 'https://developer.hashicorp.com/terraform/install',
    projectIdLink:
      'https://cloud.google.com/resource-manager/docs/creating-managing-projects#identifying_projects',
    regionAndZonesLink: 'https://cloud.google.com/compute/docs/regions-zones',
    zonesLink: 'https://console.cloud.google.com/compute/zones?pli=1',
    machineTypesLink: 'https://cloud.google.com/compute/docs/machine-resource',
    n2dMachineTypesLink:
      'https://cloud.google.com/compute/docs/general-purpose-machines#n2d_machine_types',
  },
  components: {
    ClipboardButton,
    GkeNodePoolGroup,
    GoogleCloudFieldGroup,
    GoogleCloudLearnMoreLink,
    GoogleCloudRegistrationInstructionsModal,
    GlAlert,
    GlButton,
    GlIcon,
    GlLink,
    GlSprintf,
    HelpPopover,
  },
  props: {
    token: {
      type: String,
      required: false,
      default: null,
    },
    projectPath: {
      type: String,
      required: false,
      default: null,
    },
    groupPath: {
      type: String,
      required: false,
      default: null,
    },
    isWidget: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      showInstructionsModal: false,
      showInstructionsButtonVariant: 'default',
      cloudProjectId: null,
      region: null,
      zone: null,
      machineType: { state: true, value: 'n2d-standard-2' },
      nodePools: [
        {
          imageType: { state: true, value: 'ubuntu' },
          machineType: { state: true, value: 'n2d-standard-2' },
          nodeCount: { state: true, value: '10' },
          nodePoolName: null,
        },
      ],
      setupBashScript: null,
      setupTerraformFile: null,
      applyTerraformScript: null,
      showAlert: false,
      group: null,
      project: null,
    };
  },
  apollo: {
    project: {
      query: provisionGkeRunnerProject,
      fetchPolicy: fetchPolicies.NETWORK_ONLY,
      skip: true,
      manual: true,
      variables() {
        return {
          fullPath: this.projectPath,
          ...this.variables,
        };
      },
      result(res) {
        this.parseQueryResults(res);
      },
      error(error) {
        this.handleError(error);
      },
    },
    group: {
      query: provisionGkeRunnerGroup,
      fetchPolicy: fetchPolicies.NETWORK_ONLY,
      skip: true,
      manual: true,
      variables() {
        return {
          fullPath: this.groupPath,
          ...this.variables,
        };
      },
      result(res) {
        this.parseQueryResults(res);
      },
      error(error) {
        this.handleError(error);
      },
    },
  },
  computed: {
    variables() {
      return {
        runnerToken: this.token,
        cloudProjectId: this.cloudProjectId?.value,
        region: this.region?.value,
        zone: this.zone?.value,
        nodePools: this.formattedNodePools,
      };
    },
    formattedNodePools() {
      return this.nodePools.map((nodePool) => {
        return {
          machineType: nodePool.machineType.value,
          imageType: nodePool.imageType.value,
          nodeCount: parseInt(nodePool.nodeCount.value, 10),
          name: nodePool.nodePoolName?.value,
          labels: nodePool.nodePoolLabels?.reduce((acc, label) => {
            if (label.key !== '' || label.key != null) {
              acc.push({
                key: label.key,
                value: label.value,
              });
            }

            return acc;
          }, []),
        };
      });
    },
    validNodePools() {
      return this.nodePools.some((nodePool) => {
        return (
          nodePool.machineType?.state === true &&
          nodePool.imageType?.state === true &&
          nodePool.nodeCount?.state === true &&
          nodePool.nodePoolName?.state === true
        );
      });
    },
    tokenMessage() {
      if (this.token) {
        return s__(
          'Runners|The %{boldStart}runner authentication token%{boldEnd} %{token} displays here %{boldStart}for a short time only%{boldEnd}. After you register the runner, this token is stored in the %{codeStart}config.toml%{codeEnd} and cannot be accessed again from the UI.',
        );
      }
      return s__(
        'Runners|The %{boldStart}runner authentication token%{boldEnd} is no longer visible, it is stored in the %{codeStart}config.toml%{codeEnd} if you have registered the runner.',
      );
    },
    invalidFields() {
      return ['cloudProjectId', 'region', 'zone'].filter((field) => {
        return !this[field]?.state;
      });
    },
  },
  watch: {
    invalidFields() {
      if (this.invalidFields.length === 0 && !this.validNodePools) {
        this.showAlert = false;
        this.showInstructionsButtonVariant = 'confirm';
      } else {
        this.showInstructionsButtonVariant = 'default';
      }
    },
  },
  methods: {
    showInstructions() {
      if (this.invalidFields.length > 0 && !this.validNodePools) {
        this.showAlert = true;
      } else {
        if (this.projectPath) {
          this.$apollo.queries.project.start();
        } else {
          this.$apollo.queries.group.start();
        }
        this.showAlert = false;
        this.showInstructionsModal = true;
      }
    },
    goToFirstInvalidField() {
      if (this.invalidFields.length > 0) {
        this.$refs[this.invalidFields[0]].$el.querySelector('input').focus();
      }
    },
    handleError(error) {
      if (error.message.includes('GraphQL error')) {
        this.showAlert = true;
      }
      if (error.networkError) {
        captureException({ error, component: this.$options.name });
      }
    },
    addNodePool() {
      this.nodePools.push({
        imageType: { state: true, value: 'ubuntu' },
        machineType: { state: true, value: 'n2d-standard-2' },
        nodeCount: { state: true, value: '10' },
        nodePoolName: null,
      });
    },
    removeNodePool(event) {
      this.nodePools.splice(event.uniqueIdentifier, 1);
    },
    updateNodePool(event) {
      this.nodePools.splice(event.uniqueIdentifier, 1, event.nodePool);
    },
    showRemoveNodePoolButton(index) {
      return this.nodePools.length > 1 && index !== 0;
    },
    parseQueryResults({ data, error }) {
      if (!error) {
        this.showAlert = false;

        const { runnerCloudProvisioning } = this.projectPath ? data.project : data.group;

        this.setupBashScript = runnerCloudProvisioning?.projectSetupShellScript;
        this.setupTerraformFile = runnerCloudProvisioning?.provisioningSteps?.[0].instructions;
        this.applyTerraformScript = runnerCloudProvisioning?.provisioningSteps?.[1].instructions;
      }
    },
  },
};
</script>

<template>
  <div>
    <div class="gl-mt-5">
      <p v-if="!isWidget" data-testid="runner-token-message">
        <gl-icon name="information-o" variant="info" />
        <gl-sprintf :message="tokenMessage">
          <template #token>
            <code data-testid="runner-token">{{ token }}</code>
            <clipboard-button :text="token" :title="__('Copy')" size="small" category="tertiary" />
          </template>
          <template #bold="{ content }">
            <span class="gl-font-bold">{{ content }}</span>
          </template>
          <template #code="{ content }">
            <code>{{ content }}</code>
          </template>
        </gl-sprintf>
      </p>
      <p>
        <gl-sprintf :message="$options.i18n.headingDescription">
          <template #link="{ content }">
            <gl-link :href="$options.links.terraformConfigLink" target="_blank">
              {{ content }}
              <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
            </gl-link>
          </template>
        </gl-sprintf>
      </p>
    </div>
    <hr v-if="!isWidget" />

    <!-- start: before you begin -->
    <div>
      <h3 v-if="isWidget" class="gl-heading-3">{{ $options.i18n.beforeHeading }}</h3>
      <h2 v-else class="gl-heading-2">{{ $options.i18n.beforeHeading }}</h2>
      <ul>
        <li>
          <gl-sprintf :message="$options.i18n.permissionsText">
            <template #link="{ content }">
              <gl-link :href="$options.links.permissionsLink" target="_blank">
                {{ content }}
                <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
              </gl-link>
            </template>
          </gl-sprintf>
        </li>
        <li>
          <gl-sprintf :message="$options.i18n.billingLinkText">
            <template #link="{ content }">
              <gl-link :href="$options.links.billingLink" target="_blank">
                {{ content }}
                <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
              </gl-link>
            </template>
          </gl-sprintf>
        </li>
        <li>
          <gl-sprintf :message="$options.i18n.preInstallText">
            <template #gcloudLink="{ content }">
              <gl-link :href="$options.links.gcloudLink" target="_blank">
                {{ content }}
                <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
              </gl-link>
            </template>
            <template #terraformLink="{ content }">
              <gl-link :href="$options.links.terraformLink" target="_blank">
                {{ content }}
                <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
              </gl-link>
            </template>
          </gl-sprintf>
        </li>
      </ul>
    </div>
    <hr />
    <!-- end: before you begin -->

    <!-- start: step one -->
    <h3 v-if="isWidget" class="gl-heading-3">{{ $options.i18n.stepOneHeading }}</h3>
    <h2 v-else class="gl-heading-2">{{ $options.i18n.stepOneHeading }}</h2>
    <p>{{ $options.i18n.stepOneDescription }}</p>

    <google-cloud-field-group
      ref="cloudProjectId"
      v-model="cloudProjectId"
      name="cloudProjectId"
      :label="s__('Runners|Google Cloud project ID')"
      :invalid-feedback-if-empty="s__('Runners|Project ID is required.')"
      :invalid-feedback-if-malformed="s__('Runners|Project ID must have the right format.')"
      :regexp="$options.GC_PROJECT_PATTERN"
      data-testid="project-id-input"
    >
      <template #description>
        <gl-sprintf
          :message="
            s__(
              'Runners|%{linkStart}Where\'s my project ID?%{linkEnd} Can be 6 to 30 lowercase letters, digits, or hyphens. Must start with a letter and end with a letter or number. Example: %{example}.',
            )
          "
        >
          <template #link="{ content }">
            <gl-link
              :href="$options.links.projectIdLink"
              target="_blank"
              data-testid="project-id-link"
            >
              {{ content }}
              <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
            </gl-link>
          </template>
          <!-- eslint-disable @gitlab/vue-require-i18n-strings -->
          <template #example>
            <code>my-sample-project-191923</code>
          </template>
          <!-- eslint-enable @gitlab/vue-require-i18n-strings -->
        </gl-sprintf>
      </template>
    </google-cloud-field-group>

    <google-cloud-field-group
      ref="region"
      v-model="region"
      name="region"
      :invalid-feedback-if-empty="s__('Runners|Region is required.')"
      :invalid-feedback-if-malformed="s__('Runners|Region must have the right format.')"
      :regexp="$options.GC_REGION_PATTERN"
      data-testid="region-input"
    >
      <template #label>
        <div>
          {{ s__('Runners|Region') }}
          <help-popover :aria-label="s__('Runners|Region help')">
            <p>
              {{ s__('Runners|Specific geographical location where you can run your resources.') }}
            </p>
            <google-cloud-learn-more-link :href="$options.links.regionAndZonesLink" />
          </help-popover>
        </div>
      </template>
      <template #description>
        <gl-sprintf :message="s__('Runners|Must have the format %{format}. Example: %{example}.')">
          <!-- eslint-disable @gitlab/vue-require-i18n-strings -->
          <template #format>
            <code>&lt;location&gt;-&lt;sublocation&gt;&lt;number&gt;</code>
          </template>
          <template #example>
            <code>us-central1</code>
          </template>
          <!-- eslint-enable @gitlab/vue-require-i18n-strings -->
        </gl-sprintf>
      </template>
    </google-cloud-field-group>

    <google-cloud-field-group
      ref="zone"
      v-model="zone"
      name="zone"
      :invalid-feedback-if-empty="s__('Runners|Zone is required.')"
      :invalid-feedback-if-malformed="s__('Runners|Zone must have the right format.')"
      :regexp="$options.GC_ZONE_PATTERN"
      data-testid="zone-input"
    >
      <template #label>
        <div>
          {{ s__('Runners|Zone') }}
          <help-popover :aria-label="s__('Runners|Zone help')">
            <p>
              {{
                s__(
                  'Runners|Isolated location within a region. The zone determines what computing resources are available and where your data is stored and used.',
                )
              }}
            </p>
            <google-cloud-learn-more-link :href="$options.links.regionAndZonesLink" />
          </help-popover>
        </div>
      </template>
      <template #description>
        <gl-sprintf
          :message="
            s__(
              'Runners|%{linkStart}View available zones%{linkEnd}. Must have the format %{format}. Example: %{example}.',
            )
          "
        >
          <template #link="{ content }">
            <gl-link :href="$options.links.zonesLink" target="_blank" data-testid="zone-link">
              {{ content }}
              <gl-icon name="external-link" :aria-label="$options.i18n.externalLink" />
            </gl-link>
          </template>
          <!-- eslint-disable @gitlab/vue-require-i18n-strings -->
          <template #format>
            <code>&lt;region&gt;-&lt;zone_letter&gt;</code>
          </template>
          <template #example>
            <code>us-central1-a</code>
          </template>
          <!-- eslint-enable @gitlab/vue-require-i18n-strings -->
        </gl-sprintf>
      </template>
    </google-cloud-field-group>

    <!-- end: step one -->

    <!-- start: step 1.2 -->

    <hr />

    <h3 v-if="isWidget" class="gl-heading-3">{{ $options.i18n.stepOneNodePoolHeading }}</h3>
    <h2 v-else class="gl-heading-2">{{ $options.i18n.stepOneNodePoolHeading }}</h2>
    <p>{{ $options.i18n.stepOneNodePoolDescription }}</p>

    <template v-for="(nodePool, index) in nodePools">
      <gke-node-pool-group
        :key="index"
        :node-pool="nodePool"
        :unique-identifier="index"
        :show-remove-button="showRemoveNodePoolButton(index)"
        @update-node-pool="updateNodePool"
        @remove-node-pool="removeNodePool"
      />
    </template>

    <gl-button data-testid="add-node-pool-button" @click="addNodePool">
      {{ $options.i18n.addNodePool }}
    </gl-button>

    <hr />

    <!-- end: step 1.2 -->

    <!-- start: step two -->
    <h3 v-if="isWidget" class="gl-heading-3">{{ $options.i18n.stepTwoHeading }}</h3>
    <h2 v-else class="gl-heading-2">{{ $options.i18n.stepTwoHeading }}</h2>
    <p>{{ $options.i18n.stepTwoDescription }}</p>
    <gl-alert
      v-if="showAlert"
      :primary-button-text="$options.i18n.invalidFormButton"
      :dismissible="false"
      variant="danger"
      class="gl-mb-4"
      @primaryAction="goToFirstInvalidField"
    >
      <template v-if="invalidFields.length > 0">
        {{ $options.i18n.emptyFieldsAlertMessage }}
      </template>
      <template v-else>
        {{ $options.i18n.invalidFieldsAlertMessage }}
      </template>
    </gl-alert>
    <gl-button
      data-testid="show-instructions-button"
      :variant="showInstructionsButtonVariant"
      category="secondary"
      @click="showInstructions"
      >{{ $options.i18n.runnerSetupBtnText }}</gl-button
    >

    <google-cloud-registration-instructions-modal
      v-model="showInstructionsModal"
      :setup-bash-script="setupBashScript"
      :setup-terraform-file="setupTerraformFile"
      :apply-terraform-script="applyTerraformScript"
    />

    <hr v-if="!isWidget" />
  </div>
</template>
