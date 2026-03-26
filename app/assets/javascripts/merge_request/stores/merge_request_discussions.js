import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useNotes } from '~/notes/store/legacy_notes';
import { useDiscussions } from '~/notes/store/discussions';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';
import { useDiffsView } from '~/rapid_diffs/stores/diffs_view';
import { useMergeRequestVersions } from '~/merge_request/stores/merge_request_versions';
import {
  buildLineDiscussionData,
  buildReplyData,
  buildUpdateNoteData,
} from '~/merge_request/utils';
import {
  isFileDiscussion,
  isLineDiscussion,
  findApplicablePosition,
  discussionMatchesLinePosition,
} from '~/rapid_diffs/utils/discussion_position';

export const useMergeRequestDiscussions = defineStore('mergeRequestDiscussions', () => {
  const diffDiscussions = useDiffDiscussions();
  const versions = useMergeRequestVersions();

  async function fetchNotes() {
    await useNotes().fetchNotes();
    const discussionsStore = useDiscussions();
    discussionsStore.discussions.forEach((discussion) => {
      if (discussion.resolvable && discussion.resolved) {
        discussionsStore.collapseDiscussion(discussion);
      }
    });
  }

  async function createNewDiscussion(noteData) {
    const notes = useNotes();
    await notes.createNewNote({
      endpoint: notes.noteableData.create_note_path,
      data: { note: noteData },
    });
  }

  async function createLineDiscussion(discussion, noteBody) {
    const notes = useNotes();
    const { diffRefs } = useMergeRequestVersions();
    await notes.saveNote(
      buildLineDiscussionData({
        discussion,
        noteBody,
        noteableData: notes.noteableData,
        viewConfig: useDiffsView(),
        diffRefs,
      }),
    );
    diffDiscussions.removeNewLineDiscussionForm(discussion);
  }

  async function createFileDiscussion(discussion, noteBody) {
    const notes = useNotes();
    const { diffRefs } = useMergeRequestVersions();
    await notes.saveNote(
      buildLineDiscussionData({
        discussion,
        noteBody,
        noteableData: notes.noteableData,
        viewConfig: useDiffsView(),
        diffRefs,
      }),
    );
    diffDiscussions.removeNewFileDiscussionForm(discussion);
  }

  async function replyToDiscussion(discussion, noteText) {
    const notes = useNotes();
    const { diffRefs } = useMergeRequestVersions();
    await notes.saveNote(
      buildReplyData({
        discussion,
        noteText,
        noteableData: notes.noteableData,
        diffRefs,
      }),
    );
  }

  async function saveNote(note, noteText) {
    const notes = useNotes();
    await notes.updateNote(
      buildUpdateNoteData({
        note,
        noteText,
        noteableData: notes.noteableData,
      }),
    );
  }

  async function destroyNote(note) {
    await useNotes().deleteNote(note);
  }

  async function toggleAwardOnNote(note, name) {
    await useNotes().toggleAwardRequest({
      endpoint: note.toggle_award_path,
      awardName: name,
      noteId: note.id,
    });
  }

  async function toggleResolveNote(discussion) {
    await useNotes().toggleResolveNote({
      endpoint: discussion.resolve_path,
      isResolved: discussion.resolved,
      discussion: true,
      discussionId: discussion.id,
    });
  }

  function addNewLineDiscussionForm(params) {
    return diffDiscussions.addNewLineDiscussionForm({
      ...params,
      positionExtras: versions.diffRefs,
    });
  }

  function addNewFileDiscussionForm(params) {
    return diffDiscussions.addNewFileDiscussionForm({
      ...params,
      positionExtras: versions.diffRefs,
    });
  }

  const findAllImageDiscussionsForFile = computed(() => {
    const { diffRefs } = versions;
    return (oldPath, newPath) => {
      return diffDiscussions
        .findAllImageDiscussionsForFile(oldPath, newPath)
        .filter((discussion) => findApplicablePosition(discussion, diffRefs));
    };
  });

  const findAllDiscussionsForFile = computed(() => {
    const { diffRefs } = versions;
    return ({ oldPath, newPath }) => {
      return diffDiscussions
        .findAllDiscussionsForFile({ oldPath, newPath })
        .filter((discussion) => findApplicablePosition(discussion, diffRefs));
    };
  });

  const findAllLineDiscussionsForFile = computed(() => {
    const { diffRefs } = versions;
    return ({ oldPath, newPath }) => {
      return diffDiscussions
        .findAllDiscussionsForFile({ oldPath, newPath })
        .map((discussion) => {
          if (!isLineDiscussion(discussion)) return null;
          const position = findApplicablePosition(discussion, diffRefs);
          return position ? { ...discussion, position } : null;
        })
        .filter(Boolean);
    };
  });

  const findDiscussionsForPosition = computed(() => {
    const { diffRefs } = versions;
    const { discussionsWithForms } = diffDiscussions;
    return ({ oldPath, newPath, oldLine, newLine }) => {
      const linePos = { oldPath, newPath, oldLine, newLine };
      return discussionsWithForms.filter((discussion) => {
        if (!discussion.diff_discussion) return false;
        return discussionMatchesLinePosition(discussion, linePos, diffRefs);
      });
    };
  });

  const findDiscussionsForFile = computed(() => {
    const { diffRefs } = versions;
    return ({ oldPath, newPath }) => {
      return diffDiscussions
        .findAllDiscussionsForFile({ oldPath, newPath })
        .filter((discussion) => !discussion.isForm && findApplicablePosition(discussion, diffRefs));
    };
  });

  const findAllFileDiscussionsForFile = computed(() => {
    const { diffRefs } = versions;
    return ({ oldPath, newPath }) => {
      return diffDiscussions
        .findAllDiscussionsForFile({ oldPath, newPath })
        .filter((d) => isFileDiscussion(d) && findApplicablePosition(d, diffRefs));
    };
  });

  return {
    fetchNotes,
    createNewDiscussion,
    createLineDiscussion,
    createFileDiscussion,
    replyToDiscussion,
    saveNote,
    destroyNote,
    toggleAwardOnNote,
    toggleResolveNote,
    setInitialDiscussions: diffDiscussions.setInitialDiscussions,
    replaceDiscussion: diffDiscussions.replaceDiscussion,
    updateDiscussion: diffDiscussions.updateDiscussion,
    toggleDiscussionReplies: diffDiscussions.toggleDiscussionReplies,
    expandDiscussionReplies: diffDiscussions.expandDiscussionReplies,
    startReplying: diffDiscussions.startReplying,
    stopReplying: diffDiscussions.stopReplying,
    addNote: diffDiscussions.addNote,
    updateNote: diffDiscussions.updateNote,
    updateNoteTextById: diffDiscussions.updateNoteTextById,
    editNote: diffDiscussions.editNote,
    deleteNote: diffDiscussions.deleteNote,
    addDiscussion: diffDiscussions.addDiscussion,
    deleteDiscussion: diffDiscussions.deleteDiscussion,
    setEditingMode: diffDiscussions.setEditingMode,
    requestLastNoteEditing: diffDiscussions.requestLastNoteEditing,
    toggleAward: diffDiscussions.toggleAward,
    collapseDiscussion: diffDiscussions.collapseDiscussion,
    expandDiscussion: diffDiscussions.expandDiscussion,
    addNewLineDiscussionForm,
    replaceDiscussionForm: diffDiscussions.replaceDiscussionForm,
    removeNewLineDiscussionForm: diffDiscussions.removeNewLineDiscussionForm,
    setDiscussionFormText: diffDiscussions.setDiscussionFormText,
    setNewLineDiscussionFormAutofocus: diffDiscussions.setNewLineDiscussionFormAutofocus,
    setFileDiscussionsHidden: diffDiscussions.setFileDiscussionsHidden,
    setPositionDiscussionsHidden: diffDiscussions.setPositionDiscussionsHidden,
    discussionForms: computed(() => diffDiscussions.discussionForms),
    discussionsWithForms: computed(() => diffDiscussions.discussionsWithForms),
    findDiscussionsForPosition,
    findDiscussionsForFile,
    findAllDiscussionsForFile,
    findAllLineDiscussionsForFile,
    findAllFileDiscussionsForFile,
    findAllImageDiscussionsForFile,
    expandFileDiscussions: diffDiscussions.expandFileDiscussions,
    addNewFileDiscussionForm,
    removeNewFileDiscussionForm: diffDiscussions.removeNewFileDiscussionForm,
  };
});
