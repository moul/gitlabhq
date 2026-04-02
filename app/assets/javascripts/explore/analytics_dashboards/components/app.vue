<script>
import { GlSkeletonLoader } from '@gitlab/ui';
import { createAlert } from '~/alert';
import { s__ } from '~/locale';
import EmptyState from '~/vue_shared/components/dashboards_list/empty_state.vue';
import DashboardsList from '~/vue_shared/components/dashboards_list/dashboards_list.vue';
import getDashboardsQuery from '../graphql/get_dashboards.query.graphql';

export default {
  name: 'AnalyticsDashboards',
  components: { DashboardsList, EmptyState, GlSkeletonLoader },
  props: {
    organizationId: {
      type: String,
      required: true,
    },
  },
  data() {
    return { dashboards: [] };
  },
  computed: {
    hasDashboards() {
      return Boolean(this.dashboards.length);
    },
    isLoading() {
      return Boolean(this.$apollo.queries.dashboards?.loading);
    },
  },
  apollo: {
    dashboards: {
      query: getDashboardsQuery,
      variables() {
        return {
          organizationId: this.organizationId,
        };
      },
      update({ customDashboards }) {
        return customDashboards?.nodes || [];
      },
      error(err) {
        createAlert({
          message: s__('AnalyticsDashboards|Failed to load dashboards list. Please try again.'),
          captureError: true,
          error: err,
        });
      },
    },
  },
};
</script>
<template>
  <gl-skeleton-loader v-if="isLoading" size="lg" />
  <div v-else>
    <dashboards-list v-if="hasDashboards" :dashboards="dashboards" />
    <empty-state v-else />
  </div>
</template>
