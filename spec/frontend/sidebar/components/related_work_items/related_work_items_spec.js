import { nextTick } from 'vue';
import { GlButton, GlCollapse, GlIcon, GlLink, GlPopover } from '@gitlab/ui';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import WorkItemDrawer from '~/work_items/components/work_item_drawer.vue';
import MRRelatedWorkItems from '~/sidebar/components/related_work_items/related_work_items.vue';
import { getParameterByName, removeParams, updateHistory } from '~/lib/utils/url_utility';

jest.mock('~/lib/utils/url_utility');

const CLOSING_HTML = `
  <a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>
  <a data-issue="2" data-iid="20" title="Update docs" data-project-path="group/project">Update docs</a>
`;

const MENTIONED_HTML = `
  <a data-issue="3" data-iid="30" title="Refactor code" data-project-path="group/other">Refactor code</a>
`;

const buildIssuesLinks = ({ closing = null, mentionedButNotClosing = null } = {}) => ({
  closing,
  mentioned_but_not_closing: mentionedButNotClosing,
});

describe('MRRelatedWorkItems', () => {
  let wrapper;

  const findCollapseButton = () => wrapper.findComponent(GlButton);
  const findInfoIcon = () => wrapper.findComponent(GlIcon);
  const findPopover = () => wrapper.findComponent(GlPopover);
  const findCollapse = () => wrapper.findComponent(GlCollapse);
  const findDrawer = () => wrapper.findComponent(WorkItemDrawer);
  const findAllLinks = () => wrapper.findAllComponents(GlLink);
  const findNoneText = () => wrapper.find('.hide-collapsed.gl-text-subtle');

  const createComponent = async (issuesLinks = {}) => {
    window.gl = { mrWidgetData: { issues_links: issuesLinks } };

    wrapper = shallowMountExtended(MRRelatedWorkItems, {
      stubs: {
        GlCollapse,
      },
    });
    await nextTick();
  };

  describe('with no items', () => {
    beforeEach(() => createComponent(buildIssuesLinks()));

    it('renders "None" text', () => {
      expect(findNoneText().text()).toBe('None');
    });

    it('renders info icon', () => {
      expect(findInfoIcon().exists()).toBe(true);
      expect(findInfoIcon().attributes('name')).toBe('information-o');
    });

    it('renders popover with closing patterns link', () => {
      const popover = findPopover();
      expect(popover.exists()).toBe(true);
      expect(popover.attributes('target')).toBe('related-work-items-info');
    });

    it('does not render collapse button', () => {
      expect(findCollapseButton().exists()).toBe(false);
    });
  });

  describe('with items (not exceeding collapse threshold)', () => {
    beforeEach(() =>
      createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
          mentionedButNotClosing:
            '<a data-issue="3" data-iid="30" title="Refactor code" data-project-path="group/other">Refactor code</a>',
        }),
      ),
    );

    it('does not render "None" text', () => {
      expect(wrapper.text()).not.toContain('None');
    });

    it('does not render info icon', () => {
      expect(wrapper.find('#related-work-items-info').exists()).toBe(false);
    });

    it('renders closing and mentioned section labels', () => {
      expect(wrapper.text()).toContain('Closing');
      expect(wrapper.text()).toContain('Mentioned');
    });

    it('renders work item links', () => {
      const links = findAllLinks();
      expect(links).toHaveLength(2);
      expect(links.at(0).text()).toBe('Fix bug');
      expect(links.at(1).text()).toBe('Refactor code');
    });

    it('sets popover data attributes on links', () => {
      const link = findAllLinks().at(0);
      expect(link.classes()).toContain('has-popover');
      expect(link.attributes('data-reference-type')).toBe('work_item');
      expect(link.attributes('data-iid')).toBe('10');
      expect(link.attributes('data-project-path')).toBe('group/project');
    });

    it('does not show collapse button when items <= 2', () => {
      expect(findCollapseButton().exists()).toBe(false);
    });

    it('shows items directly without collapsing', () => {
      expect(findCollapse().props('visible')).toBe(true);
    });
  });

  describe('with items exceeding collapse threshold (> 2)', () => {
    beforeEach(() =>
      createComponent(
        buildIssuesLinks({
          closing: CLOSING_HTML,
          mentionedButNotClosing: MENTIONED_HTML,
        }),
      ),
    );

    it('renders collapsed summary link', () => {
      const summaryLink = findAllLinks().at(0);
      expect(summaryLink.text()).toBe('Closing 2, Mentioned 1');
    });

    it('starts in collapsed state', () => {
      expect(findCollapse().props('visible')).toBe(false);
    });

    it('expands when summary link is clicked', async () => {
      findAllLinks().at(0).vm.$emit('click');
      await nextTick();

      expect(findCollapse().props('visible')).toBe(true);
    });

    it('shows collapse button when expanded', async () => {
      findAllLinks().at(0).vm.$emit('click');
      await nextTick();

      const collapseBtn = findCollapseButton();
      expect(collapseBtn.exists()).toBe(true);
      expect(collapseBtn.attributes('icon')).toBe('chevron-down');
      expect(collapseBtn.attributes('title')).toBe('Collapse work items');
    });

    it('collapses when collapse button is clicked', async () => {
      findAllLinks().at(0).vm.$emit('click');
      await nextTick();

      findCollapseButton().vm.$emit('click');
      await nextTick();

      expect(findCollapse().props('visible')).toBe(false);
    });
  });

  describe('drawer interaction', () => {
    beforeEach(() =>
      createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      ),
    );

    it('opens drawer when link is clicked', async () => {
      findAllLinks().at(0).vm.$emit('click', { preventDefault: jest.fn() });
      await nextTick();

      expect(findDrawer().props('open')).toBe(true);
      expect(findDrawer().props('activeItem')).toMatchObject({
        iid: '10',
        title: 'Fix bug',
        fullPath: 'group/project',
      });
    });

    it('closes drawer on close event', async () => {
      findAllLinks().at(0).vm.$emit('click', { preventDefault: jest.fn() });
      await nextTick();
      expect(findDrawer().props('open')).toBe(true);

      findDrawer().vm.$emit('close');
      await nextTick();
      expect(findDrawer().props('open')).toBe(false);
    });
  });

  describe('checkDrawerParams', () => {
    const validItem = { id: 1, iid: '10', full_path: 'group/project' };
    const encodedParam = btoa(JSON.stringify(validItem));

    it('opens drawer when valid show param is present', async () => {
      getParameterByName.mockReturnValue(encodedParam);

      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      );

      expect(findDrawer().props('open')).toBe(true);
      expect(findDrawer().props('activeItem')).toMatchObject({
        iid: '10',
        title: 'Fix bug',
      });
    });

    it('removes param when item is not found', async () => {
      getParameterByName.mockReturnValue(
        btoa(JSON.stringify({ id: 999, iid: '999', full_path: 'group/project' })),
      );
      removeParams.mockReturnValue('http://test.host/');

      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      );

      expect(updateHistory).toHaveBeenCalledWith({
        url: 'http://test.host/',
      });
      expect(findDrawer().props('open')).toBe(false);
    });

    it('removes param when base64 is invalid', async () => {
      getParameterByName.mockReturnValue('not-valid-base64!!!');
      removeParams.mockReturnValue('http://test.host/');

      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      );

      expect(updateHistory).toHaveBeenCalled();
      expect(findDrawer().props('open')).toBe(false);
    });

    it('sets activeItem to null when no show param', async () => {
      getParameterByName.mockReturnValue(null);

      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      );

      expect(findDrawer().props('open')).toBe(false);
    });

    it('responds to popstate events', async () => {
      getParameterByName.mockReturnValue(null);

      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="1" data-iid="10" title="Fix bug" data-project-path="group/project">Fix bug</a>',
        }),
      );

      expect(findDrawer().props('open')).toBe(false);

      getParameterByName.mockReturnValue(encodedParam);
      window.dispatchEvent(new PopStateEvent('popstate'));
      await nextTick();

      expect(findDrawer().props('open')).toBe(true);
    });
  });

  describe('extractItemsFromHtml', () => {
    it('renders no links for null input', async () => {
      await createComponent(buildIssuesLinks({ closing: null }));

      expect(findAllLinks()).toHaveLength(0);
      expect(wrapper.html()).not.toContain('Closing');
    });

    it('renders no links for undefined input', async () => {
      await createComponent(buildIssuesLinks());

      expect(findAllLinks()).toHaveLength(0);
      expect(wrapper.html()).not.toContain('Closing');
    });

    it('extracts id, iid, title, and fullPath from HTML', async () => {
      await createComponent(
        buildIssuesLinks({
          closing:
            '<a data-issue="42" data-iid="7" title="Test issue" data-project-path="my/project">Test issue</a>',
        }),
      );

      expect(findAllLinks()).toHaveLength(1);
      expect(findAllLinks().at(0).attributes()).toMatchObject(
        expect.objectContaining({ 'data-iid': '7', 'data-project-path': 'my/project' }),
      );
      expect(findAllLinks().at(0).text()).toBe('Test issue');
    });
  });
});
