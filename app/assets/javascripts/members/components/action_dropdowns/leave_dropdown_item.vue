<script>
import { GlDisclosureDropdownItem, GlModalDirective } from '@gitlab/ui';
import { LEAVE_MODAL_ID } from '../../constants';
import LeaveModal from '../modals/leave_modal.vue';

export default {
  name: 'LeaveGroupDropdownItem',
  modalId: LEAVE_MODAL_ID,
  components: {
    GlDisclosureDropdownItem,
    LeaveModal,
  },
  directives: {
    GlModal: GlModalDirective,
  },
  props: {
    member: {
      type: Object,
      required: true,
    },
    permissions: {
      type: Object,
      required: true,
    },
  },
};
</script>

<template>
  <gl-disclosure-dropdown-item v-gl-modal="$options.modalId" variant="danger">
    <template #list-item>
      <slot></slot>
      <leave-modal :member="member" :permissions="permissions" />
    </template>
  </gl-disclosure-dropdown-item>
</template>
