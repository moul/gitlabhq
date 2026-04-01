import { pinia } from '~/pinia/instance';
import { createAlert } from '~/alert';
import { __ } from '~/locale';
import { RapidDiffsFacade } from '~/rapid_diffs/app';
import { adapters } from '~/rapid_diffs/app/adapter_configs/merge_request';
import { useCodeReview } from '~/diffs/stores/code_review';
import { useLegacyDiffs } from '~/diffs/stores/legacy_diffs';
import { useMergeRequestDiscussions } from '~/merge_request/stores/merge_request_discussions';
import { initCompareVersions } from '~/rapid_diffs/app/init_compare_versions';
import { initNewDiscussionToggle } from '~/rapid_diffs/app/init_new_discussions_toggle';
import { initLineRangeSelection } from '~/rapid_diffs/app/init_line_range_selection';

class MergeRequestRapidDiffsApp extends RapidDiffsFacade {
  adapterConfig = adapters;

  async init() {
    this.#initCodeReview();
    super.init();
    this.#initProjectPath();
    this.#initCompareVersions();
    await this.#initDiscussions();
    initNewDiscussionToggle(this.root, { allowExpandedLines: true });
    initLineRangeSelection(this.root);
  }

  // eslint-disable-next-line class-methods-use-this
  #initDiscussions() {
    return useMergeRequestDiscussions()
      .fetchNotesAndDrafts()
      .catch((error) => {
        createAlert({
          message: __('An error occurred while loading comments'),
          captureError: true,
          error,
        });
      });
  }

  #initCodeReview() {
    if (!gon.current_user_id) return;
    const { mr_path: mrPath } = JSON.parse(this.root.dataset.appData);
    if (!mrPath) return;

    const store = useCodeReview(pinia);

    store.setMrPath(mrPath);
    store.restoreFromAutosave();
    store.restoreFromLegacyMrReviews();
  }

  #initProjectPath() {
    // The review drawer reads projectPath from the legacyDiffs store
    // to make GraphQL queries for approval permissions.
    useLegacyDiffs(pinia).$patch({ projectPath: this.appData.projectPath });
  }

  #initCompareVersions() {
    initCompareVersions(this.root.querySelector('[data-after-browser-toggle]'), this.appData);
  }
}

export const createMergeRequestRapidDiffsApp = (options) => {
  return new MergeRequestRapidDiffsApp(options);
};
