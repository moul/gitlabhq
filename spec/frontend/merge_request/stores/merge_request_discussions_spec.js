import { createTestingPinia } from '@pinia/testing';
import { useMergeRequestDiscussions } from '~/merge_request/stores/merge_request_discussions';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';
import { useNotes } from '~/notes/store/legacy_notes';

jest.mock('~/notes/store/legacy_notes');

describe('mergeRequestDiscussions store', () => {
  let store;
  let mockNotesStore;

  beforeEach(() => {
    createTestingPinia({ stubActions: false });
    mockNotesStore = {
      fetchNotes: jest.fn().mockResolvedValue(),
      createNewNote: jest.fn().mockResolvedValue({ id: 'new-1' }),
      replyToDiscussion: jest.fn().mockResolvedValue({ discussion: { id: 'disc-1' } }),
      updateNote: jest.fn().mockResolvedValue({ id: 1, body: 'updated' }),
      deleteNote: jest.fn().mockResolvedValue(),
      toggleAwardRequest: jest.fn().mockResolvedValue(),
      noteableData: { create_note_path: '/api/notes' },
    };
    useNotes.mockReturnValue(mockNotesStore);
    store = useMergeRequestDiscussions();
  });

  it.each([
    'setInitialDiscussions',
    'replaceDiscussion',
    'toggleDiscussionReplies',
    'expandDiscussionReplies',
    'startReplying',
    'stopReplying',
    'addNote',
    'updateNote',
    'updateNoteTextById',
    'editNote',
    'deleteNote',
    'addDiscussion',
    'deleteDiscussion',
    'setEditingMode',
    'requestLastNoteEditing',
    'toggleAward',
    'replyToLineDiscussion',
    'addNewLineDiscussionForm',
    'replaceDiscussionForm',
    'removeNewLineDiscussionForm',
    'setDiscussionFormText',
    'setNewLineDiscussionFormAutofocus',
    'setFileDiscussionsHidden',
    'addNewFileDiscussionForm',
    'removeNewFileDiscussionForm',
    'createNewDiscussion',
    'createLineDiscussion',
    'replyToDiscussion',
    'saveNote',
    'destroyNote',
    'toggleAwardOnNote',
    'setPositionDiscussionsHidden',
  ])('exposes %s action', (action) => {
    expect(store[action]).toEqual(expect.any(Function));
  });

  it.each([
    'discussionForms',
    'discussionsWithForms',
    'getImageDiscussions',
    'findDiscussionsForPosition',
    'findDiscussionsForFile',
    'findAllDiscussionsForFile',
    'findVisibleDiscussionsForFile',
    'findFileDiscussionsForFile',
  ])('exposes %s getter', (getter) => {
    expect(store[getter]).toBeDefined();
  });

  describe('fetchNotes', () => {
    it('delegates to the legacy notes store', async () => {
      await store.fetchNotes();
      expect(mockNotesStore.fetchNotes).toHaveBeenCalled();
    });
  });

  describe('createNewDiscussion', () => {
    it('delegates to notes store createNewNote', async () => {
      await store.createNewDiscussion({ note: 'test' });
      expect(mockNotesStore.createNewNote).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: { note: { note: 'test' } },
      });
    });
  });

  describe('createLineDiscussion', () => {
    it('delegates to notes store and removes the form', async () => {
      const formDiscussion = { id: 'form-1', isForm: true };
      useDiffDiscussions().discussionForms.push(formDiscussion);

      await store.createLineDiscussion(formDiscussion, {
        position: { old_line: 1 },
        note: 'test',
      });

      expect(mockNotesStore.createNewNote).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: { note: { position: { old_line: 1 }, note: 'test' } },
      });
      expect(useDiffDiscussions().discussionForms).not.toContainEqual(formDiscussion);
    });
  });

  describe('replyToDiscussion', () => {
    it('delegates to notes store replyToDiscussion', async () => {
      const discussion = { id: 'disc-1', reply_id: 'reply-1' };

      await store.replyToDiscussion(discussion, 'reply text');

      expect(mockNotesStore.replyToDiscussion).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: {
          in_reply_to_discussion_id: 'reply-1',
          note: { note: 'reply text' },
        },
      });
    });
  });

  describe('saveNote', () => {
    it('delegates to notes store updateNote', async () => {
      const note = { id: 1, path: '/note/1', noteable_id: 10 };

      await store.saveNote(note, 'updated');

      expect(mockNotesStore.updateNote).toHaveBeenCalledWith({
        endpoint: '/note/1',
        note: { target_id: 10, note: { note: 'updated' } },
      });
    });
  });

  describe('destroyNote', () => {
    it('delegates to notes store deleteNote', async () => {
      const note = { id: 1, path: '/note/1' };

      await store.destroyNote(note);

      expect(mockNotesStore.deleteNote).toHaveBeenCalledWith(note);
    });
  });

  describe('toggleAwardOnNote', () => {
    it('delegates to notes store toggleAwardRequest', async () => {
      const note = { id: 1, toggle_award_path: '/award/1' };

      await store.toggleAwardOnNote(note, 'thumbsup');

      expect(mockNotesStore.toggleAwardRequest).toHaveBeenCalledWith({
        endpoint: '/award/1',
        awardName: 'thumbsup',
        noteId: 1,
      });
    });
  });

  describe('replyToLineDiscussion', () => {
    it('always creates a new discussion form', () => {
      const lineRange = {
        start: { old_line: 5, new_line: 15 },
        end: { old_line: 10, new_line: 20 },
      };

      store.replyToLineDiscussion({ oldPath: 'old/file.js', newPath: 'new/file.js', lineRange });

      const forms = useDiffDiscussions().discussionForms;
      expect(forms).toHaveLength(1);
      expect(forms[0].position.line_range).toStrictEqual(lineRange);
    });
  });
});
