import Vue, { nextTick } from 'vue';
import VueApollo from 'vue-apollo';
import * as Sentry from '~/sentry/sentry_browser_wrapper';

import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import createMockApollo from 'helpers/mock_apollo_helper';
import waitForPromises from 'helpers/wait_for_promises';

import { CREATED_DESC } from '~/work_items/list/constants';
import { WORK_ITEM_TYPE_NAME_ISSUE, WORK_ITEM_TYPE_NAME_TICKET } from '~/work_items/constants';
import { STATUS_OPEN } from '~/issues/constants';

import namespaceWorkItemTypesQuery from '~/work_items/graphql/namespace_work_item_types.query.graphql';
import getWorkItemStateCountsQuery from 'ee_else_ce/work_items/list/graphql/get_work_item_state_counts.query.graphql';
import getWorkItemsFullQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_full.query.graphql';
import getWorkItemsSlimQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_slim.query.graphql';
import hasWorkItemsQuery from '~/work_items/list/graphql/has_work_items.query.graphql';
import getWorkItemsCountOnlyQuery from 'ee_else_ce/work_items/list/graphql/get_work_items_count_only.query.graphql';

import PlanningView from '~/work_items/pages/planning_view.vue';
import ListView from 'ee_else_ce/work_items/list/list_view.vue';

import {
  workItemsQueryResponseNoLabels,
  workItemsQueryResponseNoAssignees,
  groupWorkItemStateCountsQueryResponse,
  combinedQueryResultExample,
  namespaceWorkItemTypesQueryResponse,
  workItemCountsOnlyResponse,
  mockFullWorkItemTypeConfiguration,
} from '../mock_data';

jest.mock('~/sentry/sentry_browser_wrapper');

const hasWorkItemsData = {
  data: {
    namespace: {
      id: 'namespace',
      workItems: {
        nodes: [{ id: 'thing' }],
      },
    },
  },
};

const defaultQueryHandler = jest.fn().mockResolvedValue(workItemsQueryResponseNoLabels);
const defaultSlimQueryHandler = jest.fn().mockResolvedValue(workItemsQueryResponseNoAssignees);
const defaultCountsQueryHandler = jest
  .fn()
  .mockResolvedValue(groupWorkItemStateCountsQueryResponse);
const namespaceQueryHandler = jest.fn().mockResolvedValue(namespaceWorkItemTypesQueryResponse);

/** @type {import('helpers/vue_test_utils_helper').ExtendedWrapper} */
let wrapper;

Vue.use(VueApollo);

const defaultHasWorkItemsHandler = jest.fn().mockResolvedValue(hasWorkItemsData);
const defaultCountsOnlyHandler = jest.fn().mockResolvedValue(workItemCountsOnlyResponse);

const findListView = () => wrapper.findComponent(ListView);

const mountComponent = ({
  queryHandler = defaultQueryHandler,
  slimQueryHandler = defaultSlimQueryHandler,
  countsQueryHandler = defaultCountsQueryHandler,
  hasWorkItemsHandler = defaultHasWorkItemsHandler,
  countsOnlyHandler = defaultCountsOnlyHandler,
  additionalHandlers = [],
  provide = {},
  workItemPlanningView = false,
  workItemType = WORK_ITEM_TYPE_NAME_ISSUE,
} = {}) => {
  const apolloProvider = createMockApollo([
    [getWorkItemsFullQuery, queryHandler],
    [getWorkItemsSlimQuery, slimQueryHandler],
    [getWorkItemStateCountsQuery, countsQueryHandler],
    [namespaceWorkItemTypesQuery, namespaceQueryHandler],
    [hasWorkItemsQuery, hasWorkItemsHandler],
    [getWorkItemsCountOnlyQuery, countsOnlyHandler],
    ...additionalHandlers,
  ]);

  wrapper = shallowMountExtended(PlanningView, {
    apolloProvider,
    provide: {
      glFeatures: {
        okrsMvc: true,
        workItemPlanningView,
      },
      metadataLoading: false,
      isGroup: false,
      isGroupIssuesList: false,
      isServiceDeskSupported: true,
      hasEpicsFeature: false,
      hasOkrsFeature: false,
      hasQualityManagementFeature: false,
      workItemType,
      getWorkItemTypeConfiguration: jest
        .fn()
        .mockReturnValue({ id: 'gid://gitlab/WorkItems::Type/1' }),
      workItemTypesConfiguration: mockFullWorkItemTypeConfiguration,
      ...provide,
    },
    propsData: {
      rootPageFullPath: 'full/path',
    },
  });
};

const exampleQueryParams = {
  fullPath: 'full/path',
  includeDescendants: true,
  sort: CREATED_DESC,
  state: STATUS_OPEN,
  firstPageSize: 20,
  types: ['ISSUE', 'INCIDENT', 'TASK', 'TICKET'],
};

describe('planning-view', () => {
  it('calls query to fetch work items when list-view emits update-query', async () => {
    mountComponent();

    findListView().vm.$emit('update-query', exampleQueryParams);

    await waitForPromises();

    expect(defaultQueryHandler).toHaveBeenCalledWith(expect.objectContaining(exampleQueryParams));
  });

  describe('slim and full queries', () => {
    beforeEach(() => {
      mountComponent();

      findListView().vm.$emit('update-query', exampleQueryParams);

      return waitForPromises();
    });

    it('calls the slim query as well as the full query', () => {
      expect(defaultQueryHandler).toHaveBeenCalled();
      expect(defaultSlimQueryHandler).toHaveBeenCalled();
    });

    it('combines the slim and full results correctly and passes the to the list component', () => {
      expect(findListView().props('workItems')).toEqual(combinedQueryResultExample);
    });
  });

  describe.each`
    queryName | handlerName
    ${'full'} | ${'queryHandler'}
    ${'slim'} | ${'slimQueryHandler'}
  `('when there is an error with the $queryName list query', ({ handlerName }) => {
    const message = 'Something went wrong when fetching work items. Please try again.';

    beforeEach(async () => {
      mountComponent({ [handlerName]: jest.fn().mockRejectedValue(new Error('ERROR')) });
      findListView().vm.$emit('update-query', exampleQueryParams);
      await waitForPromises();
    });

    it('renders an error message', () => {
      expect(findListView().props('error')).toBe(message);
      expect(Sentry.captureException).toHaveBeenCalledWith(new Error('ERROR'));
    });

    it('clears error message when "dismiss-alert" event is emitted from IssuableList', async () => {
      findListView().vm.$emit('dismiss-alert');
      await nextTick();

      expect(findListView().props('error')).toBeUndefined();
    });
  });

  describe('document title', () => {
    it('renders "Service Desk"', async () => {
      mountComponent({
        provide: { isServiceDeskSupported: true },
        workItemType: WORK_ITEM_TYPE_NAME_TICKET,
        workItemPlanningView: true,
      });
      findListView().vm.$emit('update-query', exampleQueryParams);
      await waitForPromises();

      expect(document.title).toBe('Service Desk · Test · GitLab');
    });
  });

  it('skips the work item queries when metadata is loading', async () => {
    mountComponent({ provide: { metadataLoading: true } });
    await waitForPromises();

    expect(defaultQueryHandler).not.toHaveBeenCalled();
    expect(defaultSlimQueryHandler).not.toHaveBeenCalled();
  });
});
