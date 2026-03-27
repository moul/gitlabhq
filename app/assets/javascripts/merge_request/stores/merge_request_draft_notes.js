import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useBatchComments } from '~/batch_comments/store';
import draftsService from '~/batch_comments/services/drafts_service';
import { useNotes } from '~/notes/store/legacy_notes';
import {
  isFileDiscussion,
  isImageDiscussion,
  positionMatchesFilePath,
  positionMatchesLine,
} from '~/rapid_diffs/utils/discussion_position';

function draftAsDiscussion(draft) {
  return {
    id: `draft_${draft.id}`,
    isDraft: true,
    draft,
    diff_discussion: true,
    position: draft.position,
    notes: [draft],
    resolvable: false,
    resolved: false,
    individual_note: false,
    hidden: draft.hidden,
    isReplying: false,
    repliesExpanded: true,
  };
}

export const useMergeRequestDraftNotes = defineStore('mergeRequestDraftNotes', () => {
  const batchComments = useBatchComments();

  const drafts = computed(() => batchComments.drafts);
  const hasDrafts = computed(() => drafts.value.length > 0);
  const draftsCount = computed(() => drafts.value.length);
  const isPublishing = computed(() => batchComments.isPublishing);

  const newDrafts = computed(() =>
    drafts.value.filter((draft) => draft.position && !draft.discussion_id),
  );

  function findDraftsAsDiscussionsForFile({ oldPath, newPath }) {
    return newDrafts.value
      .filter((draft) => positionMatchesFilePath(draft.position, { oldPath, newPath }))
      .map(draftAsDiscussion);
  }

  function findDraftsAsFileDiscussionsForFile({ oldPath, newPath }) {
    return newDrafts.value
      .filter(
        (draft) =>
          isFileDiscussion(draft) && positionMatchesFilePath(draft.position, { oldPath, newPath }),
      )
      .map(draftAsDiscussion);
  }

  function findDraftsAsImageDiscussionsForFile({ oldPath, newPath }) {
    return newDrafts.value
      .filter(
        (draft) =>
          isImageDiscussion(draft) && positionMatchesFilePath(draft.position, { oldPath, newPath }),
      )
      .map(draftAsDiscussion);
  }

  function findDraftsForPosition({ oldPath, newPath, oldLine, newLine }) {
    return newDrafts.value
      .filter((draft) =>
        positionMatchesLine(draft.position, { oldPath, newPath, oldLine, newLine }),
      )
      .map(draftAsDiscussion);
  }

  function findDraftForDiscussion(discussionId) {
    return drafts.value.find((draft) => draft.discussion_id === discussionId);
  }

  function setPositionDraftsHidden({ oldPath, newPath, oldLine, newLine }, newState) {
    drafts.value.forEach((draft) => {
      if (
        draft.position &&
        positionMatchesLine(draft.position, { oldPath, newPath, oldLine, newLine })
      ) {
        draft.hidden = newState;
      }
    });
  }

  function setFileDraftsHidden({ oldPath, newPath }, newState) {
    drafts.value.forEach((draft) => {
      if (draft.position && positionMatchesFilePath(draft.position, { oldPath, newPath })) {
        draft.hidden = newState;
      }
    });
  }

  async function fetchDrafts() {
    if (!window.gon?.current_user_id) return;
    await batchComments.fetchDrafts();
  }

  async function updateDraft({ note, noteText }) {
    const { draftsPath } = useNotes().notesData;
    await draftsService.update(draftsPath, { draftId: note.id, note: noteText });
    await batchComments.fetchDrafts();
  }

  return {
    drafts,
    hasDrafts,
    draftsCount,
    isPublishing,

    findDraftsAsDiscussionsForFile,
    findDraftsAsFileDiscussionsForFile,
    findDraftsAsImageDiscussionsForFile,
    findDraftsForPosition,
    findDraftForDiscussion,

    setPositionDraftsHidden,
    setFileDraftsHidden,

    fetchDrafts,
    createNewDraft: batchComments.createNewDraft,
    addDraftToDiscussion: batchComments.addDraftToDiscussion,
    updateDraft,
    deleteDraft: batchComments.deleteDraft,
    publishReview: batchComments.publishReview,
    discardDrafts: batchComments.discardDrafts,
  };
});
