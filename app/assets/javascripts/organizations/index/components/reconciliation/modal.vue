<script>
import { GlModal } from '@gitlab/ui';
import { s__ } from '~/locale';

export default {
  name: 'OrganizationReconciliationModal',
  i18n: {
    placeholder: s__('Organization|Placeholder'),
  },
  components: {
    GlModal,
  },
  model: {
    prop: 'visible',
    event: 'change',
  },
  props: {
    visible: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ['change'],
};
</script>

<template>
  <gl-modal
    modal-id="organization-reconciliation-modal"
    :visible="visible"
    @change="$emit('change', $event)"
  >
    {{ $options.i18n.placeholder }}
  </gl-modal>
</template>
