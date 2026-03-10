<script>
import DiffLineDiscussions from './diff_line_discussions.vue';

export default {
  name: 'DiffDiscussionRow',
  components: {
    DiffLineDiscussions,
  },
  inject: {
    store: { type: Object },
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
    oldLine: {
      type: Number,
      required: false,
      default: null,
    },
    newLine: {
      type: Number,
      required: false,
      default: null,
    },
    parallel: {
      type: Boolean,
      required: true,
    },
    changed: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ['empty', 'highlight', 'clear-highlight'],
  computed: {
    positions() {
      if (!this.parallel || (this.oldLine && this.newLine && !this.changed)) {
        return [this.pos(this.oldLine, this.newLine)];
      }
      return [this.pos(this.oldLine, null), this.pos(null, this.newLine)];
    },
    colspan() {
      if (!this.parallel) return 3;
      return this.positions.length === 1 ? 4 : 2;
    },
    collapsed() {
      return this.positions.every(
        (p) => !this.store.findDiscussionsForPosition(p).some((d) => !d.hidden),
      );
    },
    empty() {
      return this.positions.every((p) => this.store.findDiscussionsForPosition(p).length === 0);
    },
  },
  watch: {
    empty(value) {
      if (value) this.$emit('empty');
    },
  },
  methods: {
    pos(oldLine, newLine) {
      return { oldPath: this.oldPath, newPath: this.newPath, oldLine, newLine };
    },
    visibleDiscussions(position) {
      return this.store.findDiscussionsForPosition(position).filter((d) => !d.hidden);
    },
    startThread(position) {
      this.store.addNewLineDiscussionForm(position);
    },
  },
};
</script>

<template>
  <tr
    data-discussion-row="true"
    class="rd-discussion-row"
    :data-collapsed="collapsed ? '' : undefined"
  >
    <td v-for="(position, index) in positions" :key="index" :colspan="colspan">
      <diff-line-discussions
        v-if="visibleDiscussions(position).length"
        :discussions="visibleDiscussions(position)"
        @start-thread="startThread(position)"
        @highlight="$emit('highlight', $event)"
        @clear-highlight="$emit('clear-highlight')"
      />
    </td>
  </tr>
</template>
