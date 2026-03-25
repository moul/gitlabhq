<script>
import { isEmpty } from 'lodash-es';
import { s__, __ } from '~/locale';
import * as Sentry from '~/sentry/sentry_browser_wrapper';
import glFeatureFlagMixin from '~/vue_shared/mixins/gl_feature_flags_mixin';
import { TYPENAME_NAMESPACE } from '~/graphql_shared/constants';
import getWorkItemStateCountsQuery from 'ee_else_ce/work_items/list/graphql/get_work_item_state_counts.query.graphql';
import getWorkItemsQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_full.query.graphql';
import getWorkItemsSlimQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_slim.query.graphql';
import getWorkItemsCountOnlyQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_count_only.query.graphql';
import hasWorkItemsQuery from '~/work_items/list/graphql/has_work_items.query.graphql';
import namespaceWorkItemTypesQuery from '~/work_items/graphql/namespace_work_item_types.query.graphql';
import { NAMESPACE_GROUP, NAMESPACE_PROJECT } from '~/issues/constants';

import ListView from 'ee_else_ce/work_items/list/list_view.vue';

import { getDefaultWorkItemTypes } from 'ee_else_ce/work_items/list/utils';
import { combineWorkItemLists } from '../utils';

import {
  WORK_ITEM_TYPE_NAME_EPIC,
  WORK_ITEM_TYPE_NAME_TICKET,
  NAME_TO_ENUM_MAP,
} from '../constants';

export default {
  name: 'PlanningView',
  components: {
    ListView,
  },
  mixins: [glFeatureFlagMixin()],
  inject: [
    'metadataLoading',
    'isGroup',
    'isGroupIssuesList',
    'isServiceDeskSupported',
    'workItemType',
    'hasEpicsFeature',
    'hasOkrsFeature',
    'hasQualityManagementFeature',
  ],
  props: {
    rootPageFullPath: {
      type: String,
      required: true,
    },
    withTabs: {
      type: Boolean,
      required: false,
      default: true,
    },
  },

  data() {
    return {
      error: undefined,
      shouldSkipDueToSavedViewState: false,
      filterTokens: [],
      workItemTypes: [],
      workItemsFull: [],
      workItemsSlim: [],
      workItemStateCounts: {},
      workItemsCount: 0,
      hasWorkItems: false,
      queryVariables: {},
      isInitialLoadComplete: false,
      initialLoadWasFiltered: false,
      namespaceId: null,
      pageInfo: {},
      namespaceName: null,
    };
  },

  apollo: {
    workItemsFull() {
      return this.createWorkItemQuery(getWorkItemsQuery);
    },

    workItemsSlim() {
      return this.createWorkItemQuery(getWorkItemsSlimQuery);
    },

    workItemsCount: {
      query() {
        return getWorkItemsCountOnlyQuery;
      },
      variables() {
        return this.queryVariables;
      },
      update(data) {
        return data?.namespace?.workItems.count || 0;
      },
      skip() {
        return isEmpty(this.queryVariables) || this.metadataLoading || !this.isPlanningViewsEnabled;
      },
      error(error) {
        Sentry.captureException(error);
      },
    },

    // TODO: remove entirely once consolidated list is GA
    workItemStateCounts: {
      query: getWorkItemStateCountsQuery,
      variables() {
        return this.queryVariables;
      },
      update(data) {
        return data?.[this.namespace]?.workItemStateCounts ?? {};
      },
      skip() {
        return (
          (this.isPlanningViewsEnabled && !this.isServiceDeskList) ||
          isEmpty(this.queryVariables) ||
          this.metadataLoading ||
          this.shouldSkipDueToSavedViewState
        );
      },
      error(error) {
        Sentry.captureException(error);
      },
    },

    hasWorkItems: {
      query: hasWorkItemsQuery,
      variables() {
        const singleWorkItemType = this.workItemType ? NAME_TO_ENUM_MAP[this.workItemType] : null;
        return {
          fullPath: this.rootPageFullPath,
          types: singleWorkItemType || this.defaultWorkItemTypes,
        };
      },
      update(data) {
        return data?.namespace?.workItems.nodes.length > 0 || false;
      },
      error(error) {
        this.error = s__('WorkItem|An error occurred while getting work item counts.');
        Sentry.captureException(error);
      },
      result() {
        if (!this.isInitialLoadComplete) {
          this.isInitialLoadComplete = true;
          this.initialLoadWasFiltered = this.filterTokens.length > 0;
        }
      },
    },

    workItemTypes: {
      query: namespaceWorkItemTypesQuery,
      variables() {
        return {
          fullPath: this.rootPageFullPath,
        };
      },
      update(data) {
        return data?.namespace?.workItemTypes?.nodes;
      },
      error(error) {
        Sentry.captureException(error);
      },
    },
  },

  computed: {
    workItems() {
      return combineWorkItemLists(
        this.workItemsSlim,
        this.workItemsFull,
        Boolean(this.glFeatures.workItemFeaturesField),
      );
    },
    detailLoading() {
      return this.$apollo.queries.workItemsFull.loading;
    },
    isLoading() {
      return this.$apollo.queries.workItemsSlim.loading;
    },
    defaultWorkItemTypes() {
      return getDefaultWorkItemTypes({
        hasEpicsFeature: this.hasEpicsFeature,
        hasOkrsFeature: this.hasOkrsFeature,
        hasQualityManagementFeature: this.hasQualityManagementFeature,
        isGroupIssuesList: this.isGroupIssuesList,
      });
    },
    isServiceDeskList() {
      return this.workItemType === WORK_ITEM_TYPE_NAME_TICKET;
    },
    isPlanningViewsEnabled() {
      return this.glFeatures.workItemPlanningView || !this.withTabs;
    },
    isEpicsList() {
      return this.workItemType === WORK_ITEM_TYPE_NAME_EPIC;
    },
    namespace() {
      return this.isGroup ? NAMESPACE_GROUP : NAMESPACE_PROJECT;
    },
  },

  methods: {
    createWorkItemQuery(query) {
      return {
        query,
        context: {
          featureCategory: 'portfolio_management',
        },
        variables() {
          return this.queryVariables;
        },
        update(data) {
          return data?.namespace?.workItems.nodes ?? [];
        },
        skip() {
          return (
            isEmpty(this.queryVariables) ||
            this.metadataLoading ||
            this.shouldSkipDueToSavedViewState
          );
        },
        result({ data }) {
          this.namespaceId = data?.namespace?.id;
          this.handleListDataResults(data);
        },
        error(error) {
          this.error = s__(
            'WorkItem|Something went wrong when fetching work items. Please try again.',
          );
          Sentry.captureException(error);
        },
      };
    },
    handleListDataResults(listData) {
      this.pageInfo = listData?.namespace?.workItems.pageInfo ?? {};

      if (listData?.namespace) {
        this.namespaceName = listData.namespace.name;
        document.title = this.calculateDocumentTitle(listData);
      }
      if (!this.withTabs) {
        this.isInitialLoadComplete = true;
      }
    },
    calculateDocumentTitle(data) {
      const middleCrumb = data.namespace.name;
      if (this.isServiceDeskList) {
        return `${__('Service Desk')} · ${middleCrumb} · GitLab`;
      }
      if (this.isPlanningViewsEnabled) {
        return `${s__('WorkItem|Work items')} · ${middleCrumb} · GitLab`;
      }
      if (this.isGroup && this.isEpicsList) {
        return `${__('Epics')} · ${middleCrumb} · GitLab`;
      }
      if (this.isGroup && !this.isGroupIssuesList) {
        return `${s__('WorkItem|Work items')} · ${middleCrumb} · GitLab`;
      }
      return `${__('Issues')} · ${middleCrumb} · GitLab`;
    },
    handleSavedViewSkipState(newValue) {
      this.shouldSkipDueToSavedViewState = newValue;
    },
    handleQueryUpdate(newValue) {
      this.queryVariables = newValue;
    },
    handleRefetch(scope) {
      if (scope === 'counts') {
        this.$apollo.queries.workItemStateCounts.refetch();
      }
      if (scope === 'all') {
        this.$apollo.queries.workItemStateCounts.refetch();
        this.$apollo.queries.workItemsFull.refetch();
        this.$apollo.queries.workItemsSlim.refetch();
        this.$apollo.queries.hasWorkItems.refetch();
        this.$apollo.queries.workItemsCount.refetch();
      }
    },
    handleEvictCache() {
      // evict the namespace's workItems cache to force a full refetch
      const { cache } = this.$apollo.provider.defaultClient;
      cache.evict({
        id: cache.identify({ __typename: TYPENAME_NAMESPACE, id: this.namespaceId }),
        fieldName: 'workItems',
      });
      cache.gc();
    },
  },
};
</script>

<template>
  <list-view
    :root-page-full-path="rootPageFullPath"
    :with-tabs="withTabs"
    :work-items="workItems"
    :page-info="pageInfo"
    :work-item-state-counts="workItemStateCounts"
    :work-items-count="workItemsCount"
    :work-item-types="workItemTypes"
    :has-work-items="hasWorkItems"
    :is-initial-load-complete="isInitialLoadComplete"
    :initial-load-was-filtered="initialLoadWasFiltered"
    :is-loading="isLoading"
    :detail-loading="detailLoading"
    :error="error"
    @skip-due-to-saved-view="handleSavedViewSkipState"
    @update-query="handleQueryUpdate"
    @update-filter-tokens="($evt) => (filterTokens = $evt)"
    @reset-initial-load-state="isInitialLoadComplete = false"
    @refetch-data="handleRefetch"
    @evict-cache="handleEvictCache"
    @dismiss-alert="error = undefined"
    @set-error="($evt) => (error = $evt)"
  />
</template>
