<script>
import { GlModal } from '@gitlab/ui';
import { uniqueId } from 'lodash-es';
import { __ } from '~/locale';
import TransferLocations from './transfer_locations.vue';

export default {
  name: 'GroupsProjectsTransferModal',
  components: {
    GlModal,
    TransferLocations,
  },
  inject: ['resourceId', 'resourcePath'],
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
    groupTransferLocationsApiMethod: {
      type: Function,
      required: true,
    },
    transferApiMethod: {
      type: Function,
      required: true,
    },
    showUserTransferLocations: {
      type: Boolean,
      required: false,
      default: true,
    },
    additionalDropdownItems: {
      type: Array,
      required: false,
      default() {
        return [];
      },
    },
  },
  emits: ['change', 'success', 'error'],
  data() {
    return {
      modalId: uniqueId('transfer-modal-'),
      selectedLocation: null,
      isLoading: false,
    };
  },
  computed: {
    isTransferDisabled() {
      return !this.selectedLocation;
    },
    modalActionProps() {
      return {
        primary: {
          text: __('Transfer'),
          attributes: {
            variant: 'danger',
            disabled: this.isTransferDisabled,
            loading: this.isLoading,
          },
        },
        cancel: {
          text: __('Cancel'),
        },
      };
    },
  },
  methods: {
    async transferLocation() {
      this.isLoading = true;

      try {
        await this.transferApiMethod(this.resourceId, this.selectedLocation.id);

        this.$emit('success');
      } catch (error) {
        this.$emit('error', error.response?.data?.message || error.message);
      } finally {
        this.isLoading = false;
        this.handleVisibilityChange(false);
      }
    },
    handleVisibilityChange(isVisible) {
      if (!isVisible) this.resetForm();

      this.$emit('change', isVisible);
    },
    resetForm() {
      this.selectedLocation = null;
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
    @primary.prevent="transferLocation"
    @change="handleVisibilityChange"
  >
    <div class="gl-gap-5">
      <slot name="body"></slot>
      <transfer-locations
        v-model="selectedLocation"
        :show-user-transfer-locations="showUserTransferLocations"
        :additional-dropdown-items="additionalDropdownItems"
        :group-transfer-locations-api-method="groupTransferLocationsApiMethod"
      />
    </div>
  </gl-modal>
</template>
