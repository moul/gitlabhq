<script>
import { GlButton, GlTooltipDirective } from '@gitlab/ui';
import { __ } from '~/locale';

export default {
  name: 'DynamicPanel',
  components: {
    GlButton,
  },
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  props: {
    /**
     * Text to display in the panel header. The header slot takes precendence.
     */
    header: {
      type: String,
      required: false,
      default: null,
    },
  },
  i18n: {
    openTooltipText: __('Open in full page'),
    closePanelText: __('Close panel'),
  },
  emits: ['close'],
};
</script>

<template>
  <div
    class="contextual-panel paneled-view gl-relative !gl-w-full gl-flex-1 gl-overflow-y-auto gl-bg-default"
  >
    <div class="panel-header">
      <div
        class="top-bar-fixed container-fluid gl-sticky gl-left-0 gl-top-0 gl-mx-0 gl-w-full gl-rounded-t-lg"
      >
        <div class="top-bar-container gl-flex gl-items-center gl-gap-2">
          <div class="gl-flex gl-grow gl-basis-0 gl-items-center gl-justify-start gl-gap-3">
            <slot name="header">
              <span class="gl-text-sm gl-font-bold">{{ header }}</span>
            </slot>

            <div class="gl-ml-auto gl-flex gl-gap-3">
              <gl-button
                v-gl-tooltip.bottom
                category="tertiary"
                icon="close"
                size="small"
                :aria-label="$options.i18n.closePanelText"
                :title="$options.i18n.closePanelText"
                @click="$emit('close')"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="panel-content">
      <div class="panel-content-inner js-dynamic-panel-inner">
        <div class="container-fluid">
          <div class="content gl-pb-3 gl-@container/panel">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
