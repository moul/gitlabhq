import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import DiffDiscussionRow from '~/rapid_diffs/app/discussions/diff_discussion_row.vue';
import DiffLineDiscussions from '~/rapid_diffs/app/discussions/diff_line_discussions.vue';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';
import { useDiscussions } from '~/notes/store/discussions';

describe('DiffDiscussionRow', () => {
  let wrapper;
  let store;

  const oldPath = 'file.js';
  const newPath = 'file.js';

  const createDiscussion = (overrides = {}) => ({
    id: '1',
    diff_discussion: true,
    hidden: false,
    position: { old_path: oldPath, new_path: newPath, old_line: 5, new_line: null },
    notes: [{ id: 'note-1', author: { id: 1 } }],
    ...overrides,
  });

  const createComponent = (props = {}) => {
    wrapper = shallowMount(DiffDiscussionRow, {
      propsData: {
        oldPath,
        newPath,
        oldLine: 5,
        newLine: null,
        parallel: false,
        ...props,
      },
      provide: { store },
    });
  };

  const findCells = () => wrapper.findAll('td');
  const findDiscussions = () => wrapper.findAllComponents(DiffLineDiscussions);

  beforeEach(() => {
    createTestingPinia({ stubActions: false });
    store = useDiffDiscussions();
  });

  describe('inline view', () => {
    it('renders one cell with colspan 3', () => {
      useDiscussions().discussions = [createDiscussion()];
      createComponent();
      expect(findCells()).toHaveLength(1);
      expect(findCells().at(0).attributes('colspan')).toBe('3');
    });

    it('passes visible discussions to DiffLineDiscussions', () => {
      const discussion = createDiscussion();
      useDiscussions().discussions = [discussion];
      createComponent();
      expect(findDiscussions().at(0).props('discussions')).toHaveLength(1);
    });
  });

  describe('parallel view', () => {
    it('renders two cells with colspan 2 for side-specific discussions', () => {
      useDiscussions().discussions = [createDiscussion()];
      createComponent({ parallel: true, oldLine: 5, newLine: null });
      expect(findCells()).toHaveLength(2);
      expect(findCells().at(0).attributes('colspan')).toBe('2');
      expect(findCells().at(1).attributes('colspan')).toBe('2');
    });

    it('renders one cell with colspan 4 for spanning discussions', () => {
      useDiscussions().discussions = [
        createDiscussion({
          position: { old_path: oldPath, new_path: newPath, old_line: 5, new_line: 3 },
        }),
      ];
      createComponent({ parallel: true, oldLine: 5, newLine: 3 });
      expect(findCells()).toHaveLength(1);
      expect(findCells().at(0).attributes('colspan')).toBe('4');
    });

    it('renders two cells with colspan 2 for changed row even when both lines are set', () => {
      useDiscussions().discussions = [createDiscussion()];
      createComponent({ parallel: true, oldLine: 5, newLine: 3, changed: true });
      expect(findCells()).toHaveLength(2);
      expect(findCells().at(0).attributes('colspan')).toBe('2');
      expect(findCells().at(1).attributes('colspan')).toBe('2');
    });
  });

  describe('collapsed state', () => {
    it('sets data-collapsed when all discussions are hidden', () => {
      useDiscussions().discussions = [createDiscussion({ hidden: true })];
      createComponent();
      expect(wrapper.find('tr').attributes('data-collapsed')).toBe('');
    });

    it('removes data-collapsed when discussions are visible', () => {
      useDiscussions().discussions = [createDiscussion()];
      createComponent();
      expect(wrapper.find('tr').attributes('data-collapsed')).toBeUndefined();
    });
  });

  it('hides DiffLineDiscussions when all discussions are hidden', () => {
    useDiscussions().discussions = [createDiscussion({ hidden: true })];
    createComponent();
    expect(findDiscussions()).toHaveLength(0);
  });

  it('emits empty when all discussions are removed', async () => {
    useDiscussions().discussions = [createDiscussion()];
    createComponent();
    useDiscussions().discussions = [];
    await nextTick();
    expect(wrapper.emitted('empty')).toStrictEqual([[]]);
  });
});
