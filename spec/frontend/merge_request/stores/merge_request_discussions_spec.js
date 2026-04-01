import { createTestingPinia } from '@pinia/testing';
import { useMergeRequestDiscussions } from '~/merge_request/stores/merge_request_discussions';
import { useMergeRequestVersions } from '~/merge_request/stores/merge_request_versions';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';
import { useDiffsView } from '~/rapid_diffs/stores/diffs_view';
import { useDiscussions } from '~/notes/store/discussions';
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
      saveNote: jest.fn().mockResolvedValue(),
      replyToDiscussion: jest.fn().mockResolvedValue({ discussion: { id: 'disc-1' } }),
      updateNote: jest.fn().mockResolvedValue({ id: 1, body: 'updated' }),
      deleteNote: jest.fn().mockResolvedValue(),
      toggleAwardRequest: jest.fn().mockResolvedValue(),
      toggleResolveNote: jest.fn().mockResolvedValue(),
      noteableData: {
        create_note_path: '/api/notes',
        noteableType: 'MergeRequest',
        id: 42,
        diff_head_sha: 'abc123',
        targetType: 'merge_request',
        can_receive_suggestion: true,
      },
    };
    useNotes.mockReturnValue(mockNotesStore);
    useMergeRequestVersions().setVersions({
      sourceVersions: [{ selected: true, base_sha: 'base000', head_sha: 'head222' }],
      targetVersions: [{ selected: true, start_sha: 'start111' }],
    });
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
    'updateDiscussion',
    'collapseDiscussion',
    'expandDiscussion',
    'addNewLineDiscussionForm',
    'replaceDiscussionForm',
    'removeNewLineDiscussionForm',
    'setDiscussionFormText',
    'setNewLineDiscussionFormAutofocus',
    'setFileDiscussionsHidden',
    'expandFileDiscussions',
    'addNewFileDiscussionForm',
    'removeNewFileDiscussionForm',
    'createNewDiscussion',
    'createLineDiscussion',
    'createFileDiscussion',
    'replyToDiscussion',
    'saveNote',
    'destroyNote',
    'toggleAwardOnNote',
    'toggleResolveNote',
    'setPositionDiscussionsHidden',
  ])('exposes %s action', (action) => {
    expect(store[action]).toEqual(expect.any(Function));
  });

  it.each([
    'discussionForms',
    'discussionsWithForms',
    'findDiscussionsForPosition',
    'findDiscussionsForFile',
    'findAllDiscussionsForFile',
    'findAllLineDiscussionsForFile',
    'findAllFileDiscussionsForFile',
    'findAllImageDiscussionsForFile',
  ])('exposes %s getter', (getter) => {
    expect(store[getter]).toBeDefined();
  });

  describe('fetchNotes', () => {
    it('delegates to the legacy notes store', async () => {
      await store.fetchNotes();
      expect(mockNotesStore.fetchNotes).toHaveBeenCalled();
    });

    it('marks resolved discussions as hidden after fetching', async () => {
      const resolvedDiscussion = { id: '1', resolvable: true, resolved: true };
      const unresolvedDiscussion = { id: '2', resolvable: true, resolved: false };
      const nonResolvableDiscussion = { id: '3', resolvable: false };
      useDiscussions().discussions = [
        resolvedDiscussion,
        unresolvedDiscussion,
        nonResolvableDiscussion,
      ];

      await store.fetchNotes();

      expect(resolvedDiscussion).toMatchObject({ hidden: true });
      expect(unresolvedDiscussion).not.toHaveProperty('hidden');
      expect(nonResolvableDiscussion).not.toHaveProperty('hidden');
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
    it('delegates to notes store saveNote and removes the form', async () => {
      const formDiscussion = {
        id: 'form-1',
        isForm: true,
        position: { old_line: 1 },
        lineChange: { change: 'added', position: 'new' },
        lineCode: 'hash_0_1',
      };
      useDiffDiscussions().discussionForms.push(formDiscussion);

      await store.createLineDiscussion(formDiscussion, 'test');

      expect(mockNotesStore.saveNote).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: {
          view: useDiffsView().viewType,
          line_type: 'new',
          merge_request_diff_head_sha: 'head222',
          note_project_id: '',
          target_type: 'merge_request',
          target_id: 42,
          return_discussion: true,
          note: {
            note: 'test',
            position: JSON.stringify({
              base_sha: 'base000',
              start_sha: 'start111',
              head_sha: 'head222',
              old_line: 1,
              position_type: 'text',
              ignore_whitespace_change: !useDiffsView().showWhitespace,
            }),
            noteable_type: 'MergeRequest',
            noteable_id: 42,
            commit_id: null,
            type: 'DiffNote',
            line_code: 'hash_0_1',
          },
        },
      });
      expect(useDiffDiscussions().discussionForms).not.toContainEqual(formDiscussion);
    });
  });

  describe('addNewLineDiscussionForm', () => {
    const lineRange = {
      start: { old_line: null, new_line: 5 },
      end: { old_line: null, new_line: 5 },
    };

    it('sets canSuggest to true for added lines', () => {
      store.addNewLineDiscussionForm({
        oldPath: 'a.rb',
        newPath: 'a.rb',
        lineRange,
        lineChange: { change: 'added', position: 'new' },
        lineCode: 'abc_0_5',
      });
      const form = useDiffDiscussions().discussionForms[0];
      expect(form.canSuggest).toBe(true);
    });

    it('sets canSuggest to false for removed lines', () => {
      store.addNewLineDiscussionForm({
        oldPath: 'a.rb',
        newPath: 'a.rb',
        lineRange,
        lineChange: { change: 'removed', position: 'old' },
        lineCode: 'abc_5_0',
      });
      const form = useDiffDiscussions().discussionForms[0];
      expect(form.canSuggest).toBe(false);
    });

    it('builds previewParams when diffRefs and newPath and newLine are present', () => {
      store.addNewLineDiscussionForm({
        oldPath: 'a.rb',
        newPath: 'a.rb',
        lineRange,
        lineChange: { change: 'added', position: 'new' },
        lineCode: 'abc_0_5',
      });
      const form = useDiffDiscussions().discussionForms[0];
      expect(form.previewParams).toStrictEqual({
        preview_suggestions: true,
        line: 5,
        file_path: 'a.rb',
        base_sha: 'base000',
        start_sha: 'start111',
        head_sha: 'head222',
      });
    });

    it('sets previewParams to null for removed lines', () => {
      store.addNewLineDiscussionForm({
        oldPath: 'a.rb',
        newPath: 'a.rb',
        lineRange,
        lineChange: { change: 'removed', position: 'old' },
        lineCode: 'abc_5_0',
      });
      const form = useDiffDiscussions().discussionForms[0];
      expect(form.previewParams).toBeNull();
    });
  });

  describe('createFileDiscussion', () => {
    it('delegates to notes store saveNote and removes the form', async () => {
      const position = {
        position_type: 'file',
        old_path: 'file.js',
        new_path: 'file.js',
        old_line: null,
        new_line: null,
      };
      const formDiscussion = { id: 'form-1', isForm: true, position };
      useDiffDiscussions().discussionForms.push(formDiscussion);

      await store.createFileDiscussion(formDiscussion, 'test');

      expect(mockNotesStore.saveNote).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: expect.objectContaining({
          note: expect.objectContaining({
            note: 'test',
            position: expect.stringContaining('"position_type":"file"'),
          }),
        }),
      });
      expect(useDiffDiscussions().discussionForms).not.toContainEqual(formDiscussion);
    });
  });

  describe('replyToDiscussion', () => {
    it('delegates to notes store saveNote with reply data', async () => {
      const discussion = { id: 'disc-1', reply_id: 'reply-1' };

      await store.replyToDiscussion(discussion, 'reply text');

      expect(mockNotesStore.saveNote).toHaveBeenCalledWith({
        endpoint: '/api/notes',
        data: {
          in_reply_to_discussion_id: 'reply-1',
          target_type: 'merge_request',
          note: { note: 'reply text' },
          merge_request_diff_head_sha: 'head222',
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
        note: {
          target_type: 'merge_request',
          target_id: 10,
          note: { note: 'updated' },
        },
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

  describe('toggleResolveNote', () => {
    it('delegates to the legacy notes store', async () => {
      const discussion = {
        id: 'discussion-1',
        resolved: false,
        resolve_path: '/resolve/path',
      };

      await store.toggleResolveNote(discussion);

      expect(mockNotesStore.toggleResolveNote).toHaveBeenCalledWith({
        endpoint: '/resolve/path',
        isResolved: false,
        discussion: true,
        discussionId: 'discussion-1',
      });
    });
  });

  describe('version-aware discussion matching', () => {
    const diffRefs = { base_sha: 'base000', head_sha: 'head222', start_sha: 'start111' };
    const otherRefs = { base_sha: 'other', head_sha: 'other', start_sha: 'other' };
    const filePaths = { oldPath: 'a.js', newPath: 'a.js' };
    const makePos = (refs, line = 5) => ({
      old_path: 'a.js',
      new_path: 'a.js',
      old_line: line,
      new_line: line,
      position_type: 'text',
      ...refs,
    });

    function makeDiscussion(id, overrides = {}) {
      return {
        id,
        diff_discussion: true,
        position: makePos(diffRefs),
        original_position: makePos(diffRefs),
        notes: [],
        ...overrides,
      };
    }

    describe('findAllDiscussionsForFile', () => {
      it.each([
        ['includes', diffRefs, 1],
        ['excludes', otherRefs, 0],
      ])('%s discussions based on SHA match', (_, refs, expected) => {
        useDiscussions().setInitialDiscussions([
          makeDiscussion('d', { position: makePos(refs), original_position: makePos(refs) }),
        ]);

        expect(store.findAllDiscussionsForFile(filePaths)).toHaveLength(expected);
      });

      it('returns original reactive discussion objects', () => {
        const discussion = makeDiscussion('swap', {
          position: makePos(otherRefs, 99),
          original_position: makePos(diffRefs),
        });
        useDiscussions().setInitialDiscussions([discussion]);

        const [result] = store.findAllDiscussionsForFile(filePaths);
        expect(result).toBe(useDiscussions().discussions[0]);
      });

      it('swaps position to applicable version in findAllLineDiscussionsForFile', () => {
        useDiscussions().setInitialDiscussions([
          makeDiscussion('swap', {
            position: makePos(otherRefs, 99),
            original_position: makePos(diffRefs),
          }),
        ]);

        const [result] = store.findAllLineDiscussionsForFile(filePaths);
        expect(result.position.old_line).toBe(5);
        expect(result.position).toMatchObject(diffRefs);
      });

      it('includes forms', () => {
        store.addNewLineDiscussionForm({
          ...filePaths,
          lineRange: { start: { old_line: 1, new_line: 1 }, end: { old_line: 1, new_line: 1 } },
        });

        const [result] = store.findAllDiscussionsForFile(filePaths);
        expect(result.isForm).toBe(true);
      });
    });

    describe('findDiscussionsForPosition', () => {
      const linePos = { ...filePaths, oldLine: 5, newLine: 5 };

      it.each([
        ['position', { position: makePos(diffRefs) }],
        [
          'original_position',
          { position: makePos(otherRefs, 99), original_position: makePos(diffRefs) },
        ],
        [
          'positions array',
          {
            position: makePos(otherRefs, 99),
            original_position: makePos(otherRefs, 99),
            positions: [makePos(diffRefs)],
          },
        ],
      ])('matches via %s', (_, overrides) => {
        useDiscussions().setInitialDiscussions([makeDiscussion('d', overrides)]);

        expect(store.findDiscussionsForPosition(linePos)).toHaveLength(1);
      });

      it('excludes discussions with no matching position', () => {
        useDiscussions().setInitialDiscussions([
          makeDiscussion('miss', {
            position: makePos(otherRefs),
            original_position: makePos(otherRefs),
          }),
        ]);

        expect(store.findDiscussionsForPosition(linePos)).toHaveLength(0);
      });

      it('matches forms via the same SHA+line path as real discussions', () => {
        store.addNewLineDiscussionForm({
          ...filePaths,
          lineRange: { start: { old_line: 5, new_line: 5 }, end: { old_line: 5, new_line: 5 } },
        });

        expect(store.findDiscussionsForPosition(linePos)).toHaveLength(1);
      });

      it('excludes non-diff discussions', () => {
        useDiscussions().setInitialDiscussions([
          makeDiscussion('non-diff', { diff_discussion: false }),
        ]);

        expect(store.findDiscussionsForPosition(linePos)).toHaveLength(0);
      });
    });

    describe('findAllImageDiscussionsForFile', () => {
      it.each([
        ['returns', diffRefs, 1],
        ['excludes', otherRefs, 0],
      ])('%s image discussions with %s SHAs', (_, refs, expected) => {
        useDiscussions().setInitialDiscussions([
          {
            id: 'img',
            notes: [
              { position: { position_type: 'image', old_path: 'a.js', new_path: 'a.js', ...refs } },
            ],
            position: { position_type: 'image', old_path: 'a.js', new_path: 'a.js', ...refs },
            original_position: {
              position_type: 'image',
              old_path: 'a.js',
              new_path: 'a.js',
              ...refs,
            },
          },
        ]);

        expect(store.findAllImageDiscussionsForFile('a.js', 'a.js')).toHaveLength(expected);
      });
    });
  });
});
