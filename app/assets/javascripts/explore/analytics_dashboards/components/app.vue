<script>
import EmptyState from '~/vue_shared/components/dashboards_list/empty_state.vue';
import DashboardsList from '~/vue_shared/components/dashboards_list/dashboards_list.vue';

export default {
  name: 'AnalyticsDashboards',
  components: { DashboardsList, EmptyState },
  data() {
    return { dashboards: [] };
  },
  computed: {
    hasDashboards() {
      return Boolean(this.dashboards.length);
    },
  },
};
</script>
<template>
  <dashboards-list v-if="hasDashboards" :dashboards="dashboards" />
  <empty-state v-else />
</template>
