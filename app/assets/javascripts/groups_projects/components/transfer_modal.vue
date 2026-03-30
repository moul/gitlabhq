<script>
import { GlModal } from '@gitlab/ui';
import { uniqueId } from 'lodash-es';
import { __ } from '~/locale';

export default {
  name: 'GroupsProjectsTransferModal',
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
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
  },
  emits: ['change'],
  data() {
    return {
      modalId: uniqueId('transfer-modal-'),
    };
  },
  computed: {
    modalActionProps() {
      return {
        primary: {
          text: __('Transfer'),
          attributes: {
            variant: 'danger',
          },
        },
        cancel: {
          text: __('Cancel'),
        },
      };
    },
  },
};
</script>

<template>
  <gl-modal
    :visible="visible"
    :modal-id="modalId"
    :title="title"
    :action-primary="modalActionProps.primary"
    :action-cancel="modalActionProps.cancel"
    @change="$emit('change', $event)"
  >
    <slot name="body"></slot>
  </gl-modal>
</template>
