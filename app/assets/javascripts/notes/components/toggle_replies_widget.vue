<script>
import { GlButton, GlLink, GlSprintf, GlAvatarLink, GlAvatar, GlAvatarsInline } from '@gitlab/ui';
import { uniqBy } from 'lodash';
import { s__ } from '~/locale';
import TimeAgoTooltip from '~/vue_shared/components/time_ago_tooltip.vue';

export default {
  i18n: {
    collapseReplies: s__('Notes|Collapse replies'),
    expandReplies: s__('Notes|Expand replies'),
    lastReplyBy: s__('Notes|Last reply by %{name}'),
  },
  components: {
    GlButton,
    GlLink,
    GlSprintf,
    GlAvatarLink,
    GlAvatar,
    GlAvatarsInline,
    TimeAgoTooltip,
  },
  props: {
    collapsed: {
      type: Boolean,
      required: true,
    },
    replies: {
      type: Array,
      required: true,
    },
  },
  computed: {
    lastReply() {
      return this.replies[this.replies.length - 1];
    },
    uniqueAuthors() {
      const authors = this.replies.map((reply) => reply.author || {});

      return uniqBy(authors, 'username');
    },
    liClasses() {
      return this.collapsed
        ? 'gl-text-gray-500 gl-rounded-bottom-left-base! gl-rounded-bottom-right-base!'
        : 'gl-border-b';
    },
    buttonIcon() {
      return this.collapsed ? 'chevron-right' : 'chevron-down';
    },
    buttonLabel() {
      return this.collapsed ? this.$options.i18n.expandReplies : this.$options.i18n.collapseReplies;
    },
  },
  methods: {
    toggle() {
      this.$refs.toggle.$el.focus();
      this.$emit('toggle');
    },
  },
};
</script>

<template>
  <li
    :class="liClasses"
    class="toggle-replies-widget gl-display-flex! gl-align-items-center gl-flex-wrap gl-bg-gray-10 gl-py-3 gl-px-5 gl-border"
  >
    <gl-button
      ref="toggle"
      class="gl-my-2 gl-mr-3 gl-p-0!"
      category="tertiary"
      :icon="buttonIcon"
      :aria-label="buttonLabel"
      @click="toggle"
    />
    <template v-if="collapsed">
      <gl-avatars-inline
        :avatars="uniqueAuthors"
        :avatar-size="24"
        :max-visible="5"
        badge-sr-only-text=""
        class="gl-mr-3"
      >
        <template #avatar="{ avatar }">
          <gl-avatar-link
            target="_blank"
            :href="avatar.path || avatar.webUrl"
            :data-user-id="avatar.id"
            :data-username="avatar.username"
            class="js-user-link"
          >
            <gl-avatar :size="24" :src="avatar.avatar_url || avatar.avatarUrl" :alt="avatar.name" />
          </gl-avatar-link>
        </template>
      </gl-avatars-inline>
      <gl-button class="gl-mr-2" variant="link" data-testid="expand-replies-button" @click="toggle">
        {{ n__('%d reply', '%d replies', replies.length) }}
      </gl-button>
      <gl-sprintf :message="$options.i18n.lastReplyBy">
        <template #name>
          <gl-link
            :href="lastReply.author.path || lastReply.author.webUrl"
            class="gl-text-body! gl-text-decoration-none! gl-mx-2"
          >
            {{ lastReply.author.name }}
          </gl-link>
        </template>
      </gl-sprintf>
      <time-ago-tooltip
        :time="lastReply.created_at || lastReply.createdAt"
        tooltip-placement="bottom"
      />
    </template>
    <gl-button
      v-else
      class="gl-text-body! gl-text-decoration-none!"
      variant="link"
      data-testid="collapse-replies-button"
      @click="toggle"
    >
      {{ $options.i18n.collapseReplies }}
    </gl-button>
  </li>
</template>
