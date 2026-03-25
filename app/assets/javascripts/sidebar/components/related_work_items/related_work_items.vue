<script>
import { isNil } from 'lodash';
import {
  GlButton,
  GlCollapse,
  GlIcon,
  GlLink,
  GlPopover,
  GlTooltipDirective,
  GlSprintf,
} from '@gitlab/ui';
import { __ } from '~/locale';
import WorkItemDrawer from '~/work_items/components/work_item_drawer.vue';
import { convertToGraphQLId, getIdFromGraphQLId } from '~/graphql_shared/utils';
import { DETAIL_VIEW_QUERY_PARAM_NAME, VIEW_CONTEXT } from '~/work_items/constants';
import { getParameterByName, removeParams, updateHistory } from '~/lib/utils/url_utility';

export default {
  name: 'MRRelatedWorkItems',
  components: { GlButton, GlCollapse, GlIcon, GlLink, GlPopover, GlSprintf, WorkItemDrawer },
  viewContext: VIEW_CONTEXT.drawerMergeRequest,
  directives: {
    GlTooltip: GlTooltipDirective,
  },
  data() {
    const issuesLinks = window.gl?.mrWidgetData?.issues_links || {};
    return {
      closingIssues: this.extractItemsFromHtml(issuesLinks.closing),
      mentionedIssues: this.extractItemsFromHtml(issuesLinks.mentioned_but_not_closing),
      activeItem: null,
      isCollapsed: true,
      params: null,
    };
  },
  computed: {
    allItems() {
      return [...this.closingIssues, ...this.mentionedIssues];
    },
    showCollapsedState() {
      return this.allItems.length > 2;
    },
    collapsedSummary() {
      const parts = [];
      if (this.closingIssues.length > 0) {
        parts.push(`${__('Closing')} ${this.closingIssues.length}`);
      }
      if (this.mentionedIssues.length > 0) {
        parts.push(`${__('Mentioned')} ${this.mentionedIssues.length}`);
      }
      return parts.join(', ');
    },
  },
  watch: {
    params(newParams) {
      const item = this.allItems.find((i) => getIdFromGraphQLId(i.id) === newParams.id);
      if (item) {
        this.activeItem = item;
      } else {
        updateHistory({
          url: removeParams([DETAIL_VIEW_QUERY_PARAM_NAME]),
        });
      }
    },
  },
  created() {
    this.checkDrawerParams();
    window.addEventListener('popstate', this.checkDrawerParams);
  },
  beforeDestroy() {
    window.removeEventListener('popstate', this.checkDrawerParams);
  },
  methods: {
    extractItemsFromHtml(html) {
      if (isNil(html)) {
        return [];
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return Array.from(doc.querySelectorAll('[data-issue]')).map((el) => ({
        id: convertToGraphQLId('WorkItem', el.dataset.issue),
        iid: el.dataset.iid,
        title: el.getAttribute('title'),
        fullPath: el.dataset.projectPath,
      }));
    },
    openDrawer(item) {
      this.activeItem = item;
    },
    checkDrawerParams() {
      const queryParam = getParameterByName(DETAIL_VIEW_QUERY_PARAM_NAME);

      if (!queryParam) {
        this.activeItem = null;
        return;
      }

      this.parseDrawerParams(queryParam);
    },
    parseDrawerParams(queryParam) {
      try {
        this.params = JSON.parse(atob(queryParam));
      } catch {
        updateHistory({
          url: removeParams([DETAIL_VIEW_QUERY_PARAM_NAME]),
        });
      }
    },
  },
};
</script>

<template>
  <div class="gl-leading-20 gl-text-default">
    <div class="gl-flex gl-items-center gl-font-bold gl-leading-24 gl-text-default">
      <span data-testid="title" class="hide-collapsed">{{ __('Work Items') }}</span>
      <gl-button
        v-if="showCollapsedState"
        v-show="!isCollapsed"
        v-gl-tooltip
        :title="__('Collapse work items')"
        category="tertiary"
        icon="chevron-down"
        size="small"
        class="-gl-mr-2 gl-ml-auto !gl-p-0"
        @click="isCollapsed = true"
      />
      <gl-icon
        v-if="allItems.length === 0"
        id="related-work-items-info"
        name="information-o"
        class="gl-ml-auto gl-cursor-pointer gl-text-subtle"
      />
    </div>
    <template v-if="allItems.length > 0">
      <div v-if="showCollapsedState" v-show="isCollapsed" class="hide-collapsed gl-mt-2">
        <gl-link class="gl-text-sm !gl-text-link" @click="isCollapsed = false">
          {{ collapsedSummary }}
        </gl-link>
      </div>
      <gl-collapse :visible="!showCollapsedState || !isCollapsed" class="hide-collapsed">
        <div v-if="closingIssues.length > 0" class="gl-mt-2">
          <span class="gl-text-sm gl-font-bold gl-text-subtle">{{ __('Closing') }}</span>
          <ul class="gl-m-0 gl-list-none gl-p-0">
            <li v-for="item in closingIssues" :key="item.id" class="gl-mt-1">
              <gl-link
                class="has-popover gl-block gl-truncate"
                data-reference-type="work_item"
                data-placement="top"
                :data-iid="item.iid"
                :data-project-path="item.fullPath"
                @click.prevent="openDrawer(item)"
              >
                {{ item.title }}
              </gl-link>
            </li>
          </ul>
        </div>
        <div v-if="mentionedIssues.length > 0" class="gl-mt-3">
          <span class="gl-text-sm gl-font-bold gl-text-subtle">{{ __('Mentioned') }}</span>
          <ul class="gl-m-0 gl-list-none gl-p-0">
            <li v-for="item in mentionedIssues" :key="item.id" class="gl-mt-1">
              <gl-link
                class="has-popover gl-block gl-truncate"
                data-reference-type="work_item"
                data-placement="top"
                :data-iid="item.iid"
                :data-project-path="item.fullPath"
                @click.prevent="openDrawer(item)"
              >
                {{ item.title }}
              </gl-link>
            </li>
          </ul>
        </div>
      </gl-collapse>
    </template>
    <template v-else>
      <span class="hide-collapsed gl-text-subtle">{{ __('None') }}</span>
      <gl-popover target="related-work-items-info" placement="top">
        <template #title>{{ __('Work item links') }}</template>
        <gl-sprintf
          :message="
            __(
              'To link work items, you can add %{linkStart}closing patterns%{linkEnd} to the description.',
            )
          "
        >
          <template #link="{ content }">
            <gl-link
              href="https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically"
              target="_blank"
            >
              {{ content }}
            </gl-link>
          </template>
        </gl-sprintf>
      </gl-popover>
    </template>
    <work-item-drawer
      :active-item="activeItem"
      :view-context="$options.viewContext"
      :open="activeItem !== null"
      issuable-type="Issue"
      @close="activeItem = null"
    />
  </div>
</template>
