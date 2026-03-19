import { nextTick } from 'vue';
import { merge } from 'lodash-es';
import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { confirmAction } from '~/lib/utils/confirm_via_gl_modal/confirm_action';
import { clearDraft } from '~/lib/utils/autosave';
import { createAlert } from '~/alert';
import { SOMETHING_WENT_WRONG } from '~/diffs/i18n';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';
import NoteForm from '~/rapid_diffs/app/discussions/note_form.vue';
import NewLineDiscussionForm from '~/rapid_diffs/app/discussions/new_line_discussion_form.vue';

jest.mock('~/alert');
jest.mock('~/lib/utils/autosave');
jest.mock('~/lib/utils/confirm_via_gl_modal/confirm_action');

describe('NewLineDiscussionForm', () => {
  let pinia;
  let wrapper;

  const createDiscussion = () => ({
    id: 'new-line-form',
    noteBody: '',
    shouldFocus: false,
    position: {
      old_path: 'file.txt',
      new_path: 'file.txt',
      old_line: null,
      new_line: 10,
    },
  });

  let store;

  const createComponent = (props = {}, provide = {}) => {
    const { discussion = createDiscussion() } = props;
    store.discussionForms = [discussion];
    wrapper = shallowMount(NewLineDiscussionForm, {
      pinia,
      propsData: merge({ discussion }, props),
      provide: merge({ store }, provide),
    });
  };

  const findNoteForm = () => wrapper.findComponent(NoteForm);

  beforeEach(() => {
    pinia = createTestingPinia({ stubActions: false });
    store = useDiffDiscussions();
    store.createLineDiscussion = jest.fn().mockResolvedValue();
  });

  it('has data-discussion-id attribute', () => {
    createComponent();
    expect(wrapper.find('[data-discussion-id]').element.dataset.discussionId).toBe(
      useDiffDiscussions().discussionForms[0].id,
    );
  });

  it('shows NoteForm component', () => {
    const autosaveKey = '/-file.txt--10';
    createComponent();
    expect(findNoteForm().exists()).toBe(true);
    expect(findNoteForm().props()).toMatchObject({
      autosaveKey,
      autofocus: useDiffDiscussions().discussionForms[0].shouldFocus,
      noteBody: useDiffDiscussions().discussionForms[0].noteBody,
      saveNote: expect.any(Function),
      saveButtonTitle: 'Comment',
      restoreFromAutosave: true,
    });
  });

  it('stops autofocus after first mount', () => {
    createComponent();
    createComponent();
    expect(findNoteForm().props('autofocus')).toBe(false);
  });

  it('updates form value', async () => {
    createComponent();
    const newText = 'new text';
    findNoteForm().vm.$emit('input', newText);
    await nextTick();
    expect(findNoteForm().props('noteBody')).toBe(newText);
  });

  it('cancels reply', async () => {
    createComponent();
    await findNoteForm().vm.$emit('cancel');
    expect(clearDraft).toHaveBeenCalled();
    expect(useDiffDiscussions().discussionForms).toHaveLength(0);
  });

  it('prevents reply cancel when has changed text and dismissed confirm', async () => {
    confirmAction.mockResolvedValue(false);
    createComponent({ discussion: { ...createDiscussion(), noteBody: 'has text' } });
    await findNoteForm().vm.$emit('cancel');
    expect(clearDraft).not.toHaveBeenCalled();
    expect(useDiffDiscussions().discussionForms).toHaveLength(1);
  });

  describe('saving note', () => {
    const noteBody = 'Test note body';

    it('calls store.createLineDiscussion', async () => {
      const oldDiscussion = createDiscussion();
      createComponent({ props: { discussion: oldDiscussion } });

      await findNoteForm().props('saveNote')(noteBody);

      expect(store.createLineDiscussion).toHaveBeenCalledWith(oldDiscussion, noteBody);
    });

    it('shows alert on submission failure', async () => {
      store.createLineDiscussion.mockRejectedValue(new Error('fail'));
      createComponent();

      await findNoteForm().props('saveNote')(noteBody);

      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: SOMETHING_WENT_WRONG,
        }),
      );
    });
  });
});
