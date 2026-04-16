import { GlDrawer } from '@gitlab/ui';
import { mount, shallowMount } from '@vue/test-utils';
import Vue, { nextTick } from 'vue';
// eslint-disable-next-line no-restricted-imports
import Vuex from 'vuex';
import { mockTracking, unmockTracking } from 'helpers/tracking_helper';
import App from '~/whats_new/components/app.vue';

Vue.use(Vuex);

describe('App', () => {
  let wrapper;
  let store;
  let actions;
  let trackingSpy;

  const withClose = jest.fn();
  const updateHelpMenuUnreadBadge = jest.fn();

  const createWrapper = (options = {}) => {
    const {
      glFeatures = {},
      shallow = false,
      includeWithClose = false,
      stateOverrides = {},
    } = options;

    actions = {
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      fetchItems: jest.fn(),
      setReadArticles: jest.fn(),
    };

    store = new Vuex.Store({
      actions,
      state: {
        open: false,
        features: [],
        fetching: false,
        pageInfo: { nextPage: null },
        readArticles: [],
        ...stateOverrides,
      },
    });

    const mountOptions = {
      store,
      propsData: {
        versionDigest: 'version-digest',
        initialReadArticles: [1, 2],
        mostRecentReleaseItemsCount: 3,
        updateHelpMenuUnreadBadge,
        ...(includeWithClose && { withClose }),
      },
      ...(Object.keys(glFeatures).length > 0 && { provide: { glFeatures } }),
      ...(!shallow && {
        attachTo: document.body,
      }),
    };

    wrapper = shallow ? shallowMount(App, mountOptions) : mount(App, mountOptions);
  };

  const setup = async (features, fetching) => {
    document.body.dataset.page = 'test-page';
    document.body.dataset.namespaceId = 'namespace-840';

    trackingSpy = mockTracking('_category_', null, jest.spyOn);

    createWrapper({
      includeWithClose: true,
      stateOverrides: {
        open: true,
        features,
        fetching,
      },
    });

    await nextTick();
  };

  const getDrawer = () => wrapper.findComponent(GlDrawer);

  afterEach(() => {
    if (trackingSpy) {
      unmockTracking();
      trackingSpy = null;
    }
  });

  describe('drawer behavior', () => {
    describe('with features', () => {
      beforeEach(() => {
        setup(
          [{ name: 'Whats New Drawer', documentation_link: 'www.url.com', release: 3.11 }],
          false,
        );
      });

      const getBackdrop = () => wrapper.find('.whats-new-modal-backdrop');

      it('contains a drawer', () => {
        expect(getDrawer().exists()).toBe(true);
      });

      it('dispatches openDrawer and tracking calls when mounted', () => {
        expect(actions.openDrawer).toHaveBeenCalledWith(expect.any(Object), 'version-digest');
        expect(trackingSpy).toHaveBeenCalledWith(undefined, 'click_whats_new_drawer', {
          label: 'namespace_id',
          property: 'navigation_top',
          value: 'namespace-840',
        });
      });

      it('sets readArticles from initialReadArticles', () => {
        expect(actions.setReadArticles).toHaveBeenCalledWith(expect.any(Object), [1, 2]);
      });

      it('calls updateHelpMenuUnreadBadge when readArticles is updated', async () => {
        store.state.readArticles = [1, 2, 3];

        await nextTick();

        expect(updateHelpMenuUnreadBadge).toHaveBeenCalledWith(0);
      });

      it('dispatches closeDrawer when clicking close', () => {
        getDrawer().vm.$emit('close');
        expect(actions.closeDrawer).toHaveBeenCalled();
        expect(withClose).toHaveBeenCalled();
      });

      it('dispatches closeDrawer when clicking the backdrop', () => {
        getBackdrop().trigger('click');
        expect(actions.closeDrawer).toHaveBeenCalled();
      });

      it.each([true, false])('passes open property', async (openState) => {
        store.state.open = openState;

        await nextTick();

        expect(getDrawer().props('open')).toBe(openState);
      });

      it('renders features when provided via ajax', () => {
        expect(actions.fetchItems).toHaveBeenCalled();
        expect(wrapper.find('[data-testid="toggle-feature-name"]').text()).toBe('Whats New Drawer');
      });
    });

    describe('focus', () => {
      it('takes focus after being opened', () => {
        setup([], false);
        expect(document.activeElement).not.toBe(getDrawer().element);
        getDrawer().vm.$emit('opened');
        expect(document.activeElement).toBe(getDrawer().element);
      });
    });

    describe('fetchInitialItems', () => {
      it('fetches up to 3 pages sequentially', async () => {
        document.body.dataset.page = 'test-page';
        document.body.dataset.namespaceId = 'namespace-840';

        let fetchCount = 0;
        const fetchItemsMock = jest.fn().mockImplementation(() => {
          fetchCount += 1;
          if (fetchCount < 3) {
            store.state.pageInfo = { nextPage: fetchCount + 1 };
          } else {
            store.state.pageInfo = { nextPage: null };
          }
          return Promise.resolve();
        });

        actions = {
          openDrawer: jest.fn(),
          closeDrawer: jest.fn(),
          fetchItems: fetchItemsMock,
          setReadArticles: jest.fn(),
        };

        store = new Vuex.Store({
          actions,
          state: {
            open: true,
            features: [],
            fetching: false,
            pageInfo: { nextPage: null },
            readArticles: [],
          },
        });

        wrapper = mount(App, {
          store,
          propsData: {
            versionDigest: 'version-digest',
            initialReadArticles: [],
            mostRecentReleaseItemsCount: 3,
            updateHelpMenuUnreadBadge,
          },
          attachTo: document.body,
        });

        await nextTick();
        await nextTick();
        await nextTick();
        await nextTick();

        expect(fetchItemsMock).toHaveBeenCalledTimes(3);
        expect(fetchItemsMock).toHaveBeenNthCalledWith(1, expect.any(Object), {
          page: undefined,
          versionDigest: 'version-digest',
        });
        expect(fetchItemsMock).toHaveBeenNthCalledWith(2, expect.any(Object), {
          page: 2,
          versionDigest: 'version-digest',
        });
        expect(fetchItemsMock).toHaveBeenNthCalledWith(3, expect.any(Object), {
          page: 3,
          versionDigest: 'version-digest',
        });
      });

      it('stops fetching when fetchItems returns false', async () => {
        document.body.dataset.page = 'test-page';
        document.body.dataset.namespaceId = 'namespace-840';

        let fetchCount = 0;
        const fetchItemsMock = jest.fn().mockImplementation(() => {
          fetchCount += 1;
          if (fetchCount === 1) {
            store.state.pageInfo = { nextPage: 2 };
            return Promise.resolve();
          }
          return Promise.resolve(false);
        });

        actions = {
          openDrawer: jest.fn(),
          closeDrawer: jest.fn(),
          fetchItems: fetchItemsMock,
          setReadArticles: jest.fn(),
        };

        store = new Vuex.Store({
          actions,
          state: {
            open: true,
            features: [],
            fetching: false,
            pageInfo: { nextPage: null },
            readArticles: [],
          },
        });

        wrapper = mount(App, {
          store,
          propsData: {
            versionDigest: 'version-digest',
            initialReadArticles: [],
            mostRecentReleaseItemsCount: 3,
            updateHelpMenuUnreadBadge,
          },
          attachTo: document.body,
        });

        await nextTick();
        await nextTick();
        await nextTick();

        expect(fetchItemsMock).toHaveBeenCalledTimes(2);
      });

      it('stops fetching when there is no next page', async () => {
        document.body.dataset.page = 'test-page';
        document.body.dataset.namespaceId = 'namespace-840';

        const fetchItemsMock = jest.fn().mockImplementation(() => {
          store.state.pageInfo = { nextPage: null };
          return Promise.resolve();
        });

        actions = {
          openDrawer: jest.fn(),
          closeDrawer: jest.fn(),
          fetchItems: fetchItemsMock,
          setReadArticles: jest.fn(),
        };

        store = new Vuex.Store({
          actions,
          state: {
            open: true,
            features: [],
            fetching: false,
            pageInfo: { nextPage: null },
            readArticles: [],
          },
        });

        wrapper = mount(App, {
          store,
          propsData: {
            versionDigest: 'version-digest',
            initialReadArticles: [],
            mostRecentReleaseItemsCount: 3,
            updateHelpMenuUnreadBadge,
          },
          attachTo: document.body,
        });

        await nextTick();
        await nextTick();

        expect(fetchItemsMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('handleLoadMore', () => {
      it('fetches next page when nextPage exists', async () => {
        document.body.dataset.page = 'test-page';
        document.body.dataset.namespaceId = 'namespace-840';

        createWrapper({
          stateOverrides: {
            open: true,
            features: [{ name: 'Feature', documentation_link: 'www.url.com', release: 3.11 }],
            pageInfo: { nextPage: 2 },
          },
        });

        await nextTick();

        actions.fetchItems.mockClear();

        wrapper.findComponent({ name: 'OtherUpdates' }).vm.$emit('load-more');

        expect(actions.fetchItems).toHaveBeenCalledWith(expect.any(Object), {
          page: 2,
          versionDigest: 'version-digest',
        });
      });

      it('does not fetch when nextPage is null', async () => {
        document.body.dataset.page = 'test-page';
        document.body.dataset.namespaceId = 'namespace-840';

        createWrapper({
          stateOverrides: {
            open: true,
            features: [{ name: 'Feature', documentation_link: 'www.url.com', release: 3.11 }],
            pageInfo: { nextPage: null },
          },
        });

        await nextTick();

        actions.fetchItems.mockClear();

        wrapper.findComponent({ name: 'OtherUpdates' }).vm.$emit('load-more');

        expect(actions.fetchItems).not.toHaveBeenCalled();
      });
    });
  });
});
