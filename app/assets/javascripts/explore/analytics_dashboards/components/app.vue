<script>
import { GlTabs, GlSearchBoxByType } from '@gitlab/ui';
import { debounce } from 'lodash-es';
import { DEFAULT_DEBOUNCE_AND_THROTTLE_MS } from '~/lib/utils/constants';
import DashboardListTab from './dashboard_list_tab.vue';

const DEFAULT_ACTIVE_TAB_INDEX = 2; // Defaults to the 'All' tab
const MIN_SEARCH_TEXT_LENGTH = 3;

export default {
  name: 'AnalyticsDashboards',
  components: { DashboardListTab, GlTabs, GlSearchBoxByType },
  inject: ['currentUserId'],
  data() {
    return { searchText: '', activeTabIndex: DEFAULT_ACTIVE_TAB_INDEX };
  },
  methods: {
    handleSearchText: debounce(function debouncedSearch(searchText) {
      const search = searchText.trim();
      this.searchText = search.length >= MIN_SEARCH_TEXT_LENGTH ? search : '';
    }, DEFAULT_DEBOUNCE_AND_THROTTLE_MS),
  },
};
</script>
<template>
  <gl-tabs v-model="activeTabIndex" content-class="gl-p-0">
    <div class="gl-bg-subtle gl-p-5">
      <gl-search-box-by-type @input="handleSearchText" />
    </div>

    <dashboard-list-tab
      :title="s__('AnalyticsDashboards|Created by me')"
      :sr-text="s__('AnalyticsDashboards|Dashboards created by me')"
      :created-by-id="currentUserId"
      :search="searchText"
    />
    <dashboard-list-tab
      :title="s__('AnalyticsDashboards|Created by GitLab')"
      :sr-text="s__('AnalyticsDashboards|Dashboards created by GitLab')"
      search="created by gitlab (placeholder)"
    />
    <dashboard-list-tab
      :title="s__('AnalyticsDashboards|All')"
      :sr-text="s__('AnalyticsDashboards|All available dashboards')"
      :search="searchText"
    />
  </gl-tabs>
</template>
