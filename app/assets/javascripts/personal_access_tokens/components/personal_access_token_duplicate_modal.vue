<script>
import { GlModal } from '@gitlab/ui';
import { s__, __, sprintf } from '~/locale';
import { buildDuplicateUrl } from '../utils';

export default {
  name: 'PersonalAccessTokenDuplicateModal',
  components: {
    GlModal,
  },
  inject: ['accessTokenGranularNewUrl'],
  props: {
    token: {
      type: Object,
      required: false,
      default: null,
    },
  },
  emits: ['cancel'],
  computed: {
    isModalVisible() {
      return Boolean(this.token);
    },
    modalTitle() {
      if (!this.token) {
        return '';
      }

      return sprintf(this.$options.i18n.title, { tokenName: this.token.name }, false);
    },
    actionPrimary() {
      return { text: this.$options.i18n.duplicate, attributes: { variant: 'confirm' } };
    },
    actionCancel() {
      return { text: this.$options.i18n.cancel };
    },
  },
  methods: {
    handleConfirm() {
      if (!this.token) return;
      window.location.href = buildDuplicateUrl(this.token, this.accessTokenGranularNewUrl);
    },
    handleCancel() {
      this.$emit('cancel');
    },
  },
  i18n: {
    title: s__("AccessTokens|Duplicate '%{tokenName}'?"),
    description: s__(
      'AccessTokens|Duplicate a token to generate a new token with the same scope as the original token. The original token remains unchanged and both tokens operate independently.',
    ),
    duplicate: s__('AccessTokens|Duplicate'),
    cancel: __('Cancel'),
  },
};
</script>

<template>
  <gl-modal
    :visible="isModalVisible"
    :title="modalTitle"
    :action-primary="actionPrimary"
    :action-cancel="actionCancel"
    modal-id="duplicate-token-modal"
    @primary="handleConfirm"
    @hidden="handleCancel"
  >
    <p>{{ $options.i18n.description }}</p>
  </gl-modal>
</template>
