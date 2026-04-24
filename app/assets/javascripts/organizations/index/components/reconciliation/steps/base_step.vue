<script>
import { GlButton, GlIcon } from '@gitlab/ui';
import { __ } from '~/locale';

export default {
  name: 'ReconciliationBaseStep',
  components: {
    GlButton,
    GlIcon,
  },
  props: {
    icon: {
      type: String,
      required: false,
      default: '',
    },
    title: {
      type: String,
      required: false,
      default: '',
    },
    nextButtonText: {
      type: String,
      required: false,
      default: __('Continue'),
    },
    prevButtonText: {
      type: String,
      required: false,
      default: __('Cancel'),
    },
  },
  emits: ['next', 'prev'],
};
</script>

<template>
  <div>
    <gl-icon v-if="icon" :name="icon" />
    <h4 v-if="title">{{ title }}</h4>
    <slot></slot>
    <gl-button @click="$emit('prev')">{{ prevButtonText }}</gl-button>
    <gl-button variant="confirm" @click="$emit('next')">{{ nextButtonText }}</gl-button>
  </div>
</template>
