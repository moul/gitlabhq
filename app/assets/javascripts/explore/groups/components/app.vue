<script>
import TabsWithList from '~/groups_projects/components/tabs_with_list.vue';
import {
  EXPLORE_GROUPS_TABS,
  FILTERED_SEARCH_NAMESPACE,
  FILTERED_SEARCH_TERM_KEY,
  SORT_OPTION_CREATED,
  SORT_OPTION_UPDATED,
} from '~/explore/groups/constants';
import { RECENT_SEARCHES_STORAGE_KEY_GROUPS } from '~/filtered_search/recent_searches_storage_keys';
import {
  TIMESTAMP_TYPE_CREATED_AT,
  TIMESTAMP_TYPE_UPDATED_AT,
} from '~/vue_shared/components/resource_lists/constants';
import { PAGINATION_TYPE_KEYSET, PAGINATION_TYPE_OFFSET } from '~/groups_projects/constants';
import glFeatureFlagMixin from '~/vue_shared/mixins/gl_feature_flags_mixin';

export default {
  EXPLORE_GROUPS_TABS,
  FILTERED_SEARCH_TERM_KEY,
  FILTERED_SEARCH_NAMESPACE,
  RECENT_SEARCHES_STORAGE_KEY_GROUPS,
  timestampTypeMap: {
    [SORT_OPTION_CREATED.value]: TIMESTAMP_TYPE_CREATED_AT,
    [SORT_OPTION_UPDATED.value]: TIMESTAMP_TYPE_UPDATED_AT,
  },
  eventTracking: {
    filteredSearch: {
      [FILTERED_SEARCH_TERM_KEY]: 'search_on_explore_groups',
    },
    pagination: 'click_pagination_on_explore_groups',
    tabs: 'click_tab_on_explore_groups',
    sort: 'click_sort_on_explore_groups',
    hoverStat: 'hover_stat_on_explore_groups',
    hoverVisibility: 'hover_visibility_icon_on_explore_groups',
    initialLoad: 'initial_load_on_explore_groups',
    clickItem: 'click_group_on_explore_groups',
    clickItemAfterFilter: 'click_group_after_filter_on_explore_groups',
  },
  name: 'ExploreGroupsApp',
  components: { TabsWithList },
  mixins: [glFeatureFlagMixin()],
  props: {
    initialSort: {
      type: String,
      required: true,
    },
  },
  computed: {
    tabs() {
      const paginationType = this.glFeatures.groupsListKeysetPagination
        ? PAGINATION_TYPE_KEYSET
        : PAGINATION_TYPE_OFFSET;

      return this.$options.EXPLORE_GROUPS_TABS.map(({ variables = {}, ...tab }) => ({
        ...tab,
        variables: { pagination: paginationType, ...variables },
        paginationType,
      }));
    },
  },
};
</script>

<template>
  <tabs-with-list
    :tabs="tabs"
    :filtered-search-term-key="$options.FILTERED_SEARCH_TERM_KEY"
    :filtered-search-namespace="$options.FILTERED_SEARCH_NAMESPACE"
    :filtered-search-recent-searches-storage-key="$options.RECENT_SEARCHES_STORAGE_KEY_GROUPS"
    :filtered-search-input-placeholder="__('Search')"
    :timestamp-type-map="$options.timestampTypeMap"
    :initial-sort="initialSort"
    :event-tracking="$options.eventTracking"
    :should-update-active-tab-count-from-tab-query="false"
  />
</template>
