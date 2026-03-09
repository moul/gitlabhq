import { GlFormCheckboxGroup, GlFormCheckbox } from '@gitlab/ui';
import Vue, { nextTick } from 'vue';
// eslint-disable-next-line no-restricted-imports
import Vuex from 'vuex';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import TypeFilter from '~/search/sidebar/components/type_filter/index.vue';
import {
  WORK_ITEM_TYPE_FILTER_PARAM,
  WORK_ITEM_TYPE_FILTER_HEADER,
  LABEL_DEFAULT_CLASSES,
} from '~/search/sidebar/constants';

Vue.use(Vuex);

describe('TypeFilter', () => {
  let wrapper;

  const mockWorkItemTypes = [
    { name: 'issue', label: 'Issue' },
    { name: 'task', label: 'Task' },
    { name: 'epic', label: 'Epic' },
    { name: 'objective', label: 'Objective' },
  ];

  const actionSpies = {
    setQuery: jest.fn(),
  };

  const getterSpies = {
    queryWorkItemTypeFilters: jest.fn(() => []),
    workItemTypes: jest.fn(() => mockWorkItemTypes),
  };

  const createComponent = (getters = getterSpies) => {
    const store = new Vuex.Store({
      getters,
      actions: actionSpies,
    });

    wrapper = shallowMountExtended(TypeFilter, {
      store,
    });
  };

  const findFormCheckboxGroup = () => wrapper.findComponent(GlFormCheckboxGroup);
  const findAllCheckboxes = () => wrapper.findAllComponents(GlFormCheckbox);
  const findCheckboxByValue = (value) =>
    findAllCheckboxes().wrappers.find((checkbox) => checkbox.props('value') === value);
  const findHeader = () => wrapper.find('[class*="gl-mb-2"]');

  describe('Renders correctly', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders the component', () => {
      expect(wrapper.exists()).toBe(true);
    });

    it('renders the header with correct text', () => {
      expect(findHeader().text()).toBe(WORK_ITEM_TYPE_FILTER_HEADER);
    });

    it('renders form checkbox group', () => {
      expect(findFormCheckboxGroup().exists()).toBe(true);
    });

    it('renders all work item type checkboxes', () => {
      expect(findAllCheckboxes()).toHaveLength(mockWorkItemTypes.length);
    });

    it('renders checkboxes with correct values', () => {
      mockWorkItemTypes.forEach((type) => {
        const checkbox = findCheckboxByValue(type.name);
        expect(checkbox.exists()).toBe(true);
      });
    });

    it('renders checkboxes with correct labels', () => {
      findAllCheckboxes().wrappers.forEach((checkbox, index) => {
        expect(checkbox.text()).toContain(mockWorkItemTypes[index].label);
      });
    });
  });

  describe('User interactions', () => {
    beforeEach(() => {
      createComponent();
    });

    it('updates selection when checkbox is checked', async () => {
      const newSelection = ['issue', 'task'];
      findFormCheckboxGroup().vm.$emit('input', newSelection);

      await nextTick();

      expect(actionSpies.setQuery).toHaveBeenCalledWith(expect.any(Object), {
        key: WORK_ITEM_TYPE_FILTER_PARAM,
        value: newSelection,
      });
    });

    it('calls setQuery action when selection changes', async () => {
      const newSelection = ['issue'];
      findFormCheckboxGroup().vm.$emit('input', newSelection);

      await nextTick();

      expect(actionSpies.setQuery).toHaveBeenCalledWith(expect.any(Object), {
        key: WORK_ITEM_TYPE_FILTER_PARAM,
        value: newSelection,
      });
    });

    it('calls setQuery with multiple selections', async () => {
      const newSelection = ['issue', 'task', 'epic'];
      findFormCheckboxGroup().vm.$emit('input', newSelection);

      await nextTick();

      expect(actionSpies.setQuery).toHaveBeenCalledWith(expect.any(Object), {
        key: WORK_ITEM_TYPE_FILTER_PARAM,
        value: newSelection,
      });
    });

    it('calls setQuery with empty array when all selections are cleared', async () => {
      findFormCheckboxGroup().vm.$emit('input', []);

      await nextTick();

      expect(actionSpies.setQuery).toHaveBeenCalledWith(expect.any(Object), {
        key: WORK_ITEM_TYPE_FILTER_PARAM,
        value: [],
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty workItemTypes array', () => {
      const customGetters = {
        queryWorkItemTypeFilters: jest.fn(() => []),
        workItemTypes: jest.fn(() => []),
      };

      createComponent(customGetters);

      expect(findAllCheckboxes()).toHaveLength(0);
    });

    it('handles workItemTypes with special characters in names', () => {
      const specialTypes = [
        { name: 'work-item-type', label: 'Work Item Type' },
        { name: 'type_with_underscore', label: 'Type With Underscore' },
      ];
      const customGetters = {
        queryWorkItemTypeFilters: jest.fn(() => []),
        workItemTypes: jest.fn(() => specialTypes),
      };

      createComponent(customGetters);

      expect(findAllCheckboxes()).toHaveLength(specialTypes.length);
    });

    it('renders checkboxes when workItemTypes are updated', async () => {
      createComponent();
      expect(findAllCheckboxes()).toHaveLength(mockWorkItemTypes.length);

      const updatedTypes = [...mockWorkItemTypes, { name: 'requirement', label: 'Requirement' }];
      const customGetters = {
        queryWorkItemTypeFilters: jest.fn(() => []),
        workItemTypes: jest.fn(() => updatedTypes),
      };

      wrapper = shallowMountExtended(TypeFilter, {
        store: new Vuex.Store({
          getters: customGetters,
          actions: actionSpies,
        }),
      });

      await nextTick();

      expect(findAllCheckboxes()).toHaveLength(updatedTypes.length);
    });
  });

  describe('Component options', () => {
    beforeEach(() => {
      createComponent();
    });

    it('exposes WORK_ITEM_TYPE_FILTER_PARAM as component option', () => {
      expect(wrapper.vm.$options.WORK_ITEM_TYPE_FILTER_PARAM).toBe(WORK_ITEM_TYPE_FILTER_PARAM);
    });

    it('exposes LABEL_DEFAULT_CLASSES as component option', () => {
      expect(wrapper.vm.$options.LABEL_DEFAULT_CLASSES).toBe(LABEL_DEFAULT_CLASSES);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders checkboxes with proper test IDs', () => {
      const labels = wrapper.findAllByTestId('label');
      expect(labels).toHaveLength(mockWorkItemTypes.length);
    });

    it('renders header with semantic structure', () => {
      const header = findHeader();
      expect(header.classes()).toContain('gl-text-sm');
      expect(header.classes()).toContain('gl-font-bold');
    });
  });
});
