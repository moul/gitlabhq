<script>
import { GlLink } from '@gitlab/ui';
import initIssuablePopovers from '~/issuable/popover';
import { extractGroupOrProject } from '../../utils/common';

export default {
  name: 'MilestonePresenter',
  components: {
    GlLink,
  },
  props: {
    data: {
      required: true,
      type: Object,
    },
  },
  data() {
    return {
      project: undefined,
      group: undefined,
      ...extractGroupOrProject(this.data.webPath),
    };
  },
  mounted() {
    initIssuablePopovers([this.$refs.reference.$el]);
  },
};
</script>
<template>
  <gl-link
    ref="reference"
    class="gfm gfm-milestone"
    data-reference-type="milestone"
    :data-original="`%\&quot;${data.title}\&quot;`"
    :title="data.title"
    :data-project="project"
    :data-group="group"
    :data-milestone="data.id"
    :href="data.webPath"
    >%{{ data.title }}</gl-link
  >
</template>
