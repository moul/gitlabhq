import Vue from 'vue';
import VueApollo from 'vue-apollo';
import { shallowMount } from '@vue/test-utils';
import { GlSkeletonLoader } from '@gitlab/ui';
import createMockApollo from 'helpers/mock_apollo_helper';
import waitForPromises from 'helpers/wait_for_promises';
import { createAlert } from '~/alert';
import EmptyState from '~/vue_shared/components/dashboards_list/empty_state.vue';
import DashboardsList from '~/vue_shared/components/dashboards_list/dashboards_list.vue';
import ExploreAnalyticsDashboardsApp from '~/explore/analytics_dashboards/components/app.vue';
import getDashboardsQuery from '~/explore/analytics_dashboards/graphql/get_dashboards.query.graphql';
import { mockDashboardsListResponse, mockEmptyDashboardsListResponse } from './mock_data';

Vue.use(VueApollo);

jest.mock('~/alert');

describe('ExploreAnalyticsDashboardsApp', () => {
  let wrapper;

  const defaultPropsData = {
    organizationId: 'gid://gdktest/Organizations::Organization/1',
  };

  const mockResolvedQuery = (queryResponse = mockDashboardsListResponse) =>
    createMockApollo([[getDashboardsQuery, jest.fn().mockResolvedValue({ data: queryResponse })]]);

  const mockRejectedQuery = (queryResponse = {}) =>
    createMockApollo([[getDashboardsQuery, jest.fn().mockRejectedValue({ data: queryResponse })]]);

  const createComponent = (requestHandlers) => {
    wrapper = shallowMount(ExploreAnalyticsDashboardsApp, {
      propsData: {
        ...defaultPropsData,
      },
      apolloProvider: requestHandlers || mockResolvedQuery(),
    });
  };

  const findSkeletonLoader = () => wrapper.findComponent(GlSkeletonLoader);
  const findEmptyState = () => wrapper.findComponent(EmptyState);
  const findDashboardsList = () => wrapper.findComponent(DashboardsList);

  describe('while the query is loading', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders the skeleton loader', () => {
      expect(findSkeletonLoader().exists()).toBe(true);
    });

    it('does not render the dashboard list', () => {
      expect(findDashboardsList().exists()).toBe(false);
    });

    it('does not render the empty state', () => {
      expect(findEmptyState().exists()).toBe(false);
    });
  });

  describe('with an error', () => {
    beforeEach(async () => {
      createComponent(mockRejectedQuery());

      await waitForPromises();
    });

    it('does not render the skeleton loader', () => {
      expect(findSkeletonLoader().exists()).toBe(false);
    });

    it('does not render the dashboard list', () => {
      expect(findDashboardsList().exists()).toBe(false);
    });

    it('renders the empty state', () => {
      expect(findEmptyState().exists()).toBe(true);
    });

    it('renders an error', () => {
      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to load dashboards list. Please try again.',
          captureError: true,
        }),
      );
    });
  });

  describe('with data available', () => {
    beforeEach(async () => {
      createComponent();

      await waitForPromises();
    });

    it('does not render the skeleton loader', () => {
      expect(findSkeletonLoader().exists()).toBe(false);
    });

    it('does not render the empty state', () => {
      expect(findEmptyState().exists()).toBe(false);
    });

    it('renders the dashboards list', () => {
      expect(findDashboardsList().exists()).toBe(true);

      const dashboards = findDashboardsList().props('dashboards');
      expect(dashboards).toHaveLength(1);
      expect(dashboards[0].name).toBe('Fake trends');
    });
  });

  describe('with no dashboards', () => {
    beforeEach(async () => {
      createComponent(mockResolvedQuery(mockEmptyDashboardsListResponse));

      await waitForPromises();
    });

    it('does not render the skeleton loader', () => {
      expect(findSkeletonLoader().exists()).toBe(false);
    });

    it('does not render the dashboard list', () => {
      expect(findDashboardsList().exists()).toBe(false);
    });

    it('renders the empty state', () => {
      expect(findEmptyState().exists()).toBe(true);
    });
  });
});
