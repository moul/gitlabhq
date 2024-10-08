<script>
import { GlButton, GlButtonGroup, GlIcon, GlLink, GlPopover } from '@gitlab/ui';
import { s__ } from '~/locale';
import { helpPagePath } from '~/helpers/help_page_helper';
import TimeagoTooltip from '~/vue_shared/components/time_ago_tooltip.vue';
import timeagoMixin from '~/vue_shared/mixins/timeago';

export default {
  i18n: {
    jobArtifacts: s__('Job|Job artifacts'),
    artifactsHelpText: s__(
      'Job|Job artifacts are files that are configured to be uploaded when a job finishes execution. Artifacts could be compiled files, unit tests or scanning reports, or any other files generated by a job.',
    ),
    expiredText: s__('Job|The artifacts were removed'),
    willExpireText: s__('Job|The artifacts will be removed'),
    lockedText: s__(
      'Job|These artifacts are the latest. They will not be deleted (even if expired) until newer artifacts are available.',
    ),
    keepText: s__('Job|Keep'),
    downloadText: s__('Job|Download'),
    browseText: s__('Job|Browse'),
  },
  artifactsHelpPath: helpPagePath('ci/jobs/job_artifacts'),
  components: {
    GlButton,
    GlButtonGroup,
    GlIcon,
    GlLink,
    GlPopover,
    TimeagoTooltip,
  },
  mixins: [timeagoMixin],
  props: {
    artifact: {
      type: Object,
      required: true,
    },
    helpUrl: {
      type: String,
      required: true,
    },
  },
  computed: {
    isExpired() {
      return this.artifact?.expired && !this.isLocked;
    },
    isLocked() {
      return this.artifact?.locked;
    },
    // Only when the key is `false` we can render this block
    willExpire() {
      return this.artifact?.expired === false && !this.isLocked;
    },
  },
};
</script>
<template>
  <div>
    <div class="title gl-font-bold">
      <span class="gl-mr-2">{{ $options.i18n.jobArtifacts }}</span>
      <gl-link :href="$options.artifactsHelpPath" data-testid="artifacts-help-link">
        <gl-icon id="artifacts-help" name="question-o" />
      </gl-link>
      <gl-popover
        target="artifacts-help"
        :title="$options.i18n.jobArtifacts"
        triggers="hover focus"
      >
        {{ $options.i18n.artifactsHelpText }}
      </gl-popover>
    </div>
    <p
      v-if="isExpired || willExpire"
      class="build-detail-row"
      data-testid="artifacts-remove-timeline"
    >
      <span v-if="isExpired">{{ $options.i18n.expiredText }}</span>
      <span v-if="willExpire" data-testid="artifacts-unlocked-message-content">
        {{ $options.i18n.willExpireText }}
      </span>
      <timeago-tooltip v-if="artifact.expireAt" :time="artifact.expireAt" />
      <gl-link
        :href="helpUrl"
        target="_blank"
        rel="noopener noreferrer nofollow"
        data-testid="artifact-expired-help-link"
      >
        <gl-icon name="question-o" />
      </gl-link>
    </p>
    <p v-else-if="isLocked" class="build-detail-row">
      <span data-testid="artifacts-locked-message-content">
        {{ $options.i18n.lockedText }}
      </span>
    </p>
    <gl-button-group class="gl-mt-3 gl-flex">
      <gl-button
        v-if="artifact.keepPath"
        :href="artifact.keepPath"
        data-method="post"
        data-testid="keep-artifacts"
        >{{ $options.i18n.keepText }}</gl-button
      >
      <gl-button
        v-if="artifact.downloadPath"
        :href="artifact.downloadPath"
        rel="nofollow"
        data-testid="download-artifacts"
        download
        >{{ $options.i18n.downloadText }}</gl-button
      >
      <gl-button
        v-if="artifact.browsePath"
        :href="artifact.browsePath"
        data-testid="browse-artifacts-button"
        >{{ $options.i18n.browseText }}</gl-button
      >
    </gl-button-group>
  </div>
</template>
