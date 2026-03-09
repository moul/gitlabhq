<script>
import { GlFormCheckboxGroup, GlFormCheckbox } from '@gitlab/ui';
// eslint-disable-next-line no-restricted-imports
import { mapActions, mapGetters } from 'vuex';
import {
  WORK_ITEM_TYPE_FILTER_PARAM,
  WORK_ITEM_TYPE_FILTER_HEADER,
  LABEL_DEFAULT_CLASSES,
} from '~/search/sidebar/constants';
import WorkItemTypeIcon from '~/work_items/components/work_item_type_icon.vue';

export default {
  name: 'TypeFilter',
  components: {
    GlFormCheckboxGroup,
    GlFormCheckbox,
    WorkItemTypeIcon,
  },
  i18n: {
    header: WORK_ITEM_TYPE_FILTER_HEADER,
  },
  data() {
    return {
      selectedTypes: [],
    };
  },
  computed: {
    ...mapGetters(['queryWorkItemTypeFilters', 'workItemTypes']),
    selectedTypesModel: {
      get() {
        return this.selectedTypes;
      },
      set(value) {
        this.selectedTypes = value;
        this.updateFilter();
      },
    },
  },
  created() {
    // Initialize from Vuex store state
    this.selectedTypes = this.queryWorkItemTypeFilters;
  },
  methods: {
    ...mapActions(['setQuery']),
    updateFilter() {
      this.setQuery({ key: WORK_ITEM_TYPE_FILTER_PARAM, value: this.selectedTypes });
    },
  },
  WORK_ITEM_TYPE_FILTER_PARAM,
  LABEL_DEFAULT_CLASSES,
};
</script>

<template>
  <div class="type-filter-checkbox">
    <div class="gl-mb-2 gl-text-sm gl-font-bold">
      {{ $options.i18n.header }}
    </div>
    <gl-form-checkbox-group v-model="selectedTypesModel">
      <gl-form-checkbox
        v-for="type in workItemTypes"
        :key="type.name"
        :value="type.name"
        class="gl-w-full gl-grow gl-justify-between"
        :class="$options.LABEL_DEFAULT_CLASSES"
      >
        <span class="gl-inline-flex gl-w-full gl-grow gl-justify-between gl-gap-2">
          <work-item-type-icon :work-item-type="type.name" />
          <span data-testid="label">
            {{ type.label }}
          </span>
        </span>
      </gl-form-checkbox>
    </gl-form-checkbox-group>
  </div>
</template>
