import { GlTabs, GlSearchBoxByType } from '@gitlab/ui';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import ExploreAnalyticsDashboardsApp from '~/explore/analytics_dashboards/components/app.vue';
import DashboardListTab from '~/explore/analytics_dashboards/components/dashboard_list_tab.vue';

describe('ExploreAnalyticsDashboardsApp', () => {
  let wrapper;

  const createComponent = () => {
    wrapper = shallowMountExtended(ExploreAnalyticsDashboardsApp, {
      provide: {
        currentUserId: 'gid://gitlab/User/20',
      },
    });
  };

  const findTabs = () => wrapper.findComponent(GlTabs);
  const findSearchBox = () => wrapper.findComponent(GlSearchBoxByType);
  const findDashboardListTabs = () => wrapper.findAllComponents(DashboardListTab);

  describe('renders the main layout', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders the tabs component', () => {
      expect(findTabs().exists()).toBe(true);
    });

    it('renders the search box', () => {
      expect(findSearchBox().exists()).toBe(true);
    });

    it('renders three dashboard list tabs', () => {
      expect(findDashboardListTabs()).toHaveLength(3);
    });
  });

  describe('dashboard list tabs', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders the "Created by me" tab with currentUserId', () => {
      const tabs = findDashboardListTabs();
      expect(tabs.at(0).props('createdById')).toBe('gid://gitlab/User/20');
    });

    it('renders the "Created by GitLab" tab without createdById filter', () => {
      const tabs = findDashboardListTabs();
      expect(tabs.at(1).props('createdById')).toEqual('');
    });

    it('renders the "Created by GitLab" tab with a placeholder search filter', () => {
      const tabs = findDashboardListTabs();
      expect(tabs.at(1).props('search')).toEqual('created by gitlab (placeholder)');
    });

    it('renders the "All" tab without createdById filter', () => {
      const tabs = findDashboardListTabs();
      expect(tabs.at(2).props('createdById')).toEqual('');
    });
  });

  describe('search functionality', () => {
    // The `Created by GitLab` tab is not yet implemented, so exclude it from
    // the search tests for the time being.
    const findSearchableTabs = () =>
      findDashboardListTabs().wrappers.filter((_, index) => index !== 1);

    beforeEach(() => {
      createComponent();
    });

    it('does not pass search text to tabs when less than 3 characters', async () => {
      await findSearchBox().vm.$emit('input', 'ab');

      const tabs = findSearchableTabs();
      tabs.forEach((tab) => {
        expect(tab.props('search')).toBe('');
      });
    });

    it('passes search text to tabs when 3 or more characters', async () => {
      await findSearchBox().vm.$emit('input', 'test');

      const tabs = findSearchableTabs();
      tabs.forEach((tab) => {
        expect(tab.props('search')).toBe('test');
      });
    });

    it('clears search text when input is cleared', async () => {
      await findSearchBox().vm.$emit('input', 'test');

      let tabs = findSearchableTabs();
      tabs.forEach((tab) => {
        expect(tab.props('search')).toBe('test');
      });

      await findSearchBox().vm.$emit('input', '');

      tabs = findSearchableTabs();
      tabs.forEach((tab) => {
        expect(tab.props('search')).toBe('');
      });
    });
  });

  describe('tab management', () => {
    beforeEach(() => {
      createComponent();
    });

    it('defaults to the "All" tab', () => {
      expect(findTabs().props('value')).toBe(2);
    });

    it('updates the active tab when changed', async () => {
      await findTabs().vm.$emit('input', 0);

      expect(findTabs().props('value')).toBe(0);
    });
  });
});
