import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { defineStore } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import DiffFileDiscussions from '~/rapid_diffs/app/discussions/diff_file_discussions.vue';
import DiffDiscussions from '~/rapid_diffs/app/discussions/diff_discussions.vue';
import NoteForm from '~/rapid_diffs/app/discussions/note_form.vue';

const useMockStore = defineStore('fileDiscussionsTestStore', {
  state: () => ({
    discussions: [],
  }),
  actions: {
    findFileDiscussionsForFile() {
      return this.discussions;
    },
    removeNewFileDiscussionForm() {},
    createFileDiscussion() {},
    setDiscussionFormText() {},
  },
});

describe('DiffFileDiscussions', () => {
  let wrapper;
  let store;

  const oldPath = 'file.js';
  const newPath = 'file.js';

  const createFileDiscussion = () => ({
    id: 'file-disc-1',
    diff_discussion: true,
    position: {
      old_path: oldPath,
      new_path: newPath,
      position_type: 'file',
      old_line: null,
      new_line: null,
    },
    notes: [{ id: 'note-1', author: { id: 1 }, created_at: new Date().toISOString() }],
  });

  const createFileForm = () => ({
    id: 'form-1',
    diff_discussion: true,
    position: {
      old_path: oldPath,
      new_path: newPath,
      position_type: 'file',
      old_line: null,
      new_line: null,
    },
    isForm: true,
    noteBody: '',
  });

  const createComponent = () => {
    wrapper = shallowMount(DiffFileDiscussions, {
      propsData: { oldPath, newPath },
      provide: {
        store,
        userPermissions: { can_create_note: true },
      },
    });
  };

  beforeEach(() => {
    createTestingPinia({ stubActions: false });
    store = useMockStore();
  });

  it('renders existing discussions', () => {
    store.discussions = [createFileDiscussion()];
    createComponent();
    const discussions = wrapper.findComponent(DiffDiscussions).props('discussions');
    expect(discussions).toHaveLength(1);
    expect(discussions[0].id).toBe('file-disc-1');
  });

  it('renders NoteForm when a file discussion form exists', () => {
    store.discussions = [createFileForm()];
    createComponent();
    expect(wrapper.findComponent(NoteForm).exists()).toBe(true);
  });

  it('emits empty when discussions become empty', async () => {
    store.discussions = [createFileForm()];
    createComponent();
    store.discussions = [];
    await nextTick();
    expect(wrapper.emitted('empty')).toStrictEqual([[]]);
  });

  it('delegates note saving to store.createFileDiscussion', async () => {
    const form = createFileForm();
    store.discussions = [form];
    createComponent();
    await wrapper.findComponent(NoteForm).props('saveNote')('my comment');
    expect(store.createFileDiscussion).toHaveBeenCalledWith(form, {
      note: 'my comment',
      position: form.position,
    });
  });
});
