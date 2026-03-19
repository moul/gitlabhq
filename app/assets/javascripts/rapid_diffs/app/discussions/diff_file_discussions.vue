<script>
import { __ } from '~/locale';
import { confirmAction } from '~/lib/utils/confirm_via_gl_modal/confirm_action';
import { ignoreWhilePending } from '~/lib/utils/ignore_while_pending';
import { clearDraft } from '~/lib/utils/autosave';
import DiffFileDiscussionExpansion from '~/diffs/components/diff_file_discussion_expansion.vue';
import NoteForm from './note_form.vue';
import DiffDiscussions from './diff_discussions.vue';

export default {
  name: 'DiffFileDiscussions',
  components: {
    DiffFileDiscussionExpansion,
    NoteForm,
    DiffDiscussions,
  },
  inject: {
    store: { type: Object },
    userPermissions: {
      type: Object,
    },
  },
  props: {
    oldPath: {
      type: String,
      required: true,
    },
    newPath: {
      type: String,
      required: true,
    },
  },
  emits: ['empty'],
  computed: {
    allDiscussions() {
      return this.store.findAllFileDiscussionsForFile({
        oldPath: this.oldPath,
        newPath: this.newPath,
      });
    },
    collapsedDiscussions() {
      return this.allDiscussions.filter((d) => !d.isForm && d.hidden);
    },
    expandedDiscussions() {
      return this.allDiscussions.filter((d) => !d.isForm && !d.hidden);
    },
    formDiscussion() {
      return this.allDiscussions.find((d) => d.isForm);
    },
    autosaveKey() {
      const path =
        this.oldPath === this.newPath ? this.oldPath : [this.oldPath, this.newPath].join('-');
      // eslint-disable-next-line @gitlab/require-i18n-strings
      return `${window.location.pathname}-${path}-file`;
    },
  },
  watch: {
    allDiscussions(value) {
      if (value.length === 0) this.$emit('empty');
    },
  },
  methods: {
    cancelReplyForm: ignoreWhilePending(async function cancelReplyForm() {
      if (this.formDiscussion?.noteBody) {
        const confirmed = await confirmAction(
          __('Are you sure you want to cancel creating this comment?'),
          {
            primaryBtnText: __('Discard changes'),
            cancelBtnText: __('Continue editing'),
          },
        );
        if (!confirmed) return;
      }
      clearDraft(this.autosaveKey);
      this.store.removeNewFileDiscussionForm(this.formDiscussion);
    }),
    async saveNote(noteBody) {
      await this.store.createFileDiscussion(this.formDiscussion, {
        note: noteBody,
        position: this.formDiscussion.position,
      });
    },
  },
};
</script>

<template>
  <div data-testid="file-discussions">
    <diff-file-discussion-expansion
      v-if="collapsedDiscussions.length"
      :discussions="collapsedDiscussions"
      @toggle="store.expandFileDiscussions(oldPath, newPath)"
    />
    <diff-discussions v-if="expandedDiscussions.length" :discussions="expandedDiscussions" />
    <div
      v-if="formDiscussion"
      class="gl-rounded-[var(--content-border-radius)] gl-bg-subtle gl-px-5 gl-py-4"
      :data-discussion-id="formDiscussion.id"
    >
      <note-form
        :autosave-key="autosaveKey"
        :autofocus="formDiscussion.shouldFocus"
        :note-body="formDiscussion.noteBody"
        :save-button-title="__('Comment')"
        :save-note="saveNote"
        restore-from-autosave
        @input="store.setDiscussionFormText(formDiscussion, $event)"
        @cancel="cancelReplyForm"
      />
    </div>
  </div>
</template>
