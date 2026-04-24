<script>
import { s__ } from '~/locale';
import BaseStep from './base_step.vue';

export default {
  name: 'ReconciliationStep2',
  i18n: {
    placeholder: s__('Organization|Step 2 placeholder'),
  },
  components: {
    BaseStep,
  },
  emits: ['next', 'prev'],
};
</script>

<template>
  <base-step @next="$emit('next')" @prev="$emit('prev')">
    <p>{{ $options.i18n.placeholder }}</p>
  </base-step>
</template>
