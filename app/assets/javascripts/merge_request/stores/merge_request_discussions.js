import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useNotes } from '~/notes/store/legacy_notes';
import { useDiffDiscussions } from '~/rapid_diffs/stores/diff_discussions';

export const useMergeRequestDiscussions = defineStore('mergeRequestDiscussions', () => {
  const diffDiscussions = useDiffDiscussions();

  async function fetchNotes() {
    await useNotes().fetchNotes();
  }

  async function createNewDiscussion(noteData) {
    const notes = useNotes();
    await notes.createNewNote({
      endpoint: notes.noteableData.create_note_path,
      data: { note: noteData },
    });
  }

  async function createLineDiscussion(formDiscussion, noteData) {
    const notes = useNotes();
    await notes.createNewNote({
      endpoint: notes.noteableData.create_note_path,
      data: { note: noteData },
    });
    diffDiscussions.removeNewLineDiscussionForm(formDiscussion);
  }

  async function replyToDiscussion(discussion, noteText) {
    const notes = useNotes();
    await notes.replyToDiscussion({
      endpoint: notes.noteableData.create_note_path,
      data: {
        in_reply_to_discussion_id: discussion.reply_id,
        note: { note: noteText },
      },
    });
  }

  async function saveNote(note, noteText) {
    await useNotes().updateNote({
      endpoint: note.path,
      note: {
        target_id: note.noteable_id,
        note: { note: noteText },
      },
    });
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

  return {
    fetchNotes,
    createNewDiscussion,
    createLineDiscussion,
    replyToDiscussion,
    saveNote,
    destroyNote,
    toggleAwardOnNote,
    setInitialDiscussions: diffDiscussions.setInitialDiscussions,
    replaceDiscussion: diffDiscussions.replaceDiscussion,
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
    replyToLineDiscussion: diffDiscussions.replyToLineDiscussion,
    addNewLineDiscussionForm: diffDiscussions.addNewLineDiscussionForm,
    replaceDiscussionForm: diffDiscussions.replaceDiscussionForm,
    removeNewLineDiscussionForm: diffDiscussions.removeNewLineDiscussionForm,
    setNewLineDiscussionFormText: diffDiscussions.setNewLineDiscussionFormText,
    setNewLineDiscussionFormAutofocus: diffDiscussions.setNewLineDiscussionFormAutofocus,
    setFileDiscussionsHidden: diffDiscussions.setFileDiscussionsHidden,
    discussionForms: computed(() => diffDiscussions.discussionForms),
    discussionsWithForms: computed(() => diffDiscussions.discussionsWithForms),
    getImageDiscussions: computed(() => diffDiscussions.getImageDiscussions),
    findDiscussionsForPosition: computed(() => diffDiscussions.findDiscussionsForPosition),
    findDiscussionsForFile: computed(() => diffDiscussions.findDiscussionsForFile),
    findAllDiscussionsForFile: computed(() => diffDiscussions.findAllDiscussionsForFile),
    findVisibleDiscussionsForFile: computed(() => diffDiscussions.findVisibleDiscussionsForFile),
  };
});
