<script>
import PageHeading from './page_heading.vue';

export default {
  name: 'IndexLayout',
  components: {
    PageHeading,
  },
  props: {
    heading: {
      type: String,
      required: false,
      default: null,
    },
    description: {
      type: String,
      required: false,
      default: null,
    },
    pageHeadingSrOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
};
</script>

<template>
  <div>
    <page-heading :heading="heading" :class="{ 'gl-sr-only': pageHeadingSrOnly }">
      <template v-if="$scopedSlots.heading" #heading>
        <slot name="heading"></slot>
      </template>
      <template v-if="$scopedSlots.actions" #actions>
        <slot name="actions"></slot>
      </template>
      <template v-if="$scopedSlots.description || description" #description>
        <slot v-if="$scopedSlots.description" name="description"></slot>
        <template v-else>{{ description }}</template>
      </template>
    </page-heading>
    <div
      id="index-layout-alerts"
      class="gl-mb-5 gl-flex gl-flex-col gl-gap-3 empty:gl-mb-0"
      data-testid="index-layout-alerts"
    >
      <slot name="alerts"></slot>
    </div>
    <div data-testid="index-layout-content">
      <slot></slot>
    </div>
  </div>
</template>
