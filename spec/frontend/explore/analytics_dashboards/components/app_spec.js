import { shallowMount } from '@vue/test-utils';
import EmptyState from '~/vue_shared/components/dashboards_list/empty_state.vue';
import ExploreAnalyticsDashboardsApp from '~/explore/analytics_dashboards/components/app.vue';

describe('ExploreAnalyticsDashboardsApp', () => {
  let wrapper;

  const defaultPropsData = {};

  const createComponent = () => {
    wrapper = shallowMount(ExploreAnalyticsDashboardsApp, {
      propsData: defaultPropsData,
    });
  };

  const findEmptyState = () => wrapper.findComponent(EmptyState);

  beforeEach(() => {
    createComponent();
  });

  it('renders the empty state when there are no dashboards available', () => {
    expect(findEmptyState().exists()).toBe(true);
  });
});
