<script>
import { uniqueId } from 'lodash';
import Tracking from '~/tracking';
import ModalCopyButton from '~/vue_shared/components/modal_copy_button.vue';

export default {
  name: 'CodeInstruction',
  components: {
    ModalCopyButton,
  },
  mixins: [Tracking.mixin()],
  props: {
    label: {
      type: String,
      required: false,
      default: '',
    },
    instruction: {
      type: String,
      required: true,
    },
    copyText: {
      type: String,
      required: true,
    },
    multiline: {
      type: Boolean,
      required: false,
      default: false,
    },
    trackingAction: {
      type: String,
      required: false,
      default: '',
    },
    trackingLabel: {
      type: String,
      required: false,
      default: '',
    },
  },
  created() {
    this.uniqueId = uniqueId();
  },
  methods: {
    trackCopy() {
      if (this.trackingAction) {
        this.track(this.trackingAction, { label: this.trackingLabel });
      }
    },
    generateFormId(name) {
      return `${name}_${this.uniqueId}`;
    },
  },
};
</script>

<template>
  <div>
    <label v-if="label" :for="generateFormId('instruction-input')">{{ label }}</label>
    <div v-if="!multiline" class="gl-mb-3">
      <div class="input-group gl-mb-3">
        <input
          :id="generateFormId('instruction-input')"
          :value="instruction"
          type="text"
          class="form-control gl-font-monospace"
          data-testid="instruction-input"
          readonly
          @copy="trackCopy"
        />
        <span class="input-group-append" data-testid="instruction-button" @click="trackCopy">
          <modal-copy-button :text="instruction" :title="copyText" class="input-group-text" />
        </span>
      </div>
    </div>

    <div v-else class="gl-relative">
      <pre class="gl-font-monospace" data-testid="multiline-instruction" @copy="trackCopy">{{
        instruction
      }}</pre>
      <modal-copy-button
        :text="instruction"
        :title="copyText"
        class="gl-absolute gl-right-3 gl-top-3"
        @click="trackCopy"
      />
    </div>
  </div>
</template>
