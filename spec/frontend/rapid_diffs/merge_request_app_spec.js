import { createTestingPinia } from '@pinia/testing';
import { createMergeRequestRapidDiffsApp } from '~/rapid_diffs/merge_request_app';
import { setHTMLFixture } from 'helpers/fixtures';
import { useDiffsView } from '~/rapid_diffs/stores/diffs_view';
import { initFileBrowser } from '~/rapid_diffs/app/file_browser';
import { useDiffsList } from '~/rapid_diffs/stores/diffs_list';
import { useCodeReview } from '~/diffs/stores/code_review';
import { useLegacyDiffs } from '~/diffs/stores/legacy_diffs';
import { useMergeRequestDiscussions } from '~/merge_request/stores/merge_request_discussions';
import { initCompareVersions } from '~/rapid_diffs/app/init_compare_versions';
import { initNewDiscussionToggle } from '~/rapid_diffs/app/init_new_discussions_toggle';
import { initLineRangeSelection } from '~/rapid_diffs/app/init_line_range_selection';

jest.mock('~/lib/graphql');
jest.mock('~/rapid_diffs/app/view_settings');
jest.mock('~/rapid_diffs/app/init_hidden_files_warning');
jest.mock('~/rapid_diffs/app/file_browser');
jest.mock('~/rapid_diffs/app/quirks/safari_fix');
jest.mock('~/rapid_diffs/app/quirks/content_visibility_fix');
jest.mock('~/rapid_diffs/app/init_compare_versions');
jest.mock('~/rapid_diffs/app/init_new_discussions_toggle');
jest.mock('~/rapid_diffs/app/init_line_range_selection');
jest.mock('~/merge_request/stores/merge_request_draft_notes', () => ({
  useMergeRequestDraftNotes: jest.fn(() => ({
    drafts: [],
    isPublishing: false,
    hasDrafts: false,
    draftsCount: 0,
    fetchDrafts: jest.fn().mockResolvedValue(),
    findDraftsForDiscussion: jest.fn().mockReturnValue({}),
    findDraftsAsDiscussionsForFile: jest.fn().mockReturnValue([]),
    findDraftsAsLineDiscussionsForFile: jest.fn().mockReturnValue([]),
    findDraftsAsFileDiscussionsForFile: jest.fn().mockReturnValue([]),
    findDraftsAsImageDiscussionsForFile: jest.fn().mockReturnValue([]),
    findDraftsForPosition: jest.fn().mockReturnValue([]),
  })),
}));

describe('Merge Request Rapid Diffs app', () => {
  let app;

  const appData = {
    diffsStreamUrl: '/stream',
    reloadStreamUrl: '/reload',
    diffsStatsEndpoint: '/stats',
    diffFilesEndpoint: '/diff-files-metadata',
    shouldSortMetadataFiles: true,
    lazy: false,
  };

  const buildApp = (data = {}) => {
    setHTMLFixture(
      `
      <main>
        <div class="container-fluid" data-diffs-container>
        <div
            data-rapid-diffs
            data-app-data='${JSON.stringify({ ...appData, ...data })}'
          >
            <diff-file>
              <button>Click me!</button>
            </diff-file>
            <div data-view-settings></div>
            <div data-list-loading></div>
            <div data-file-browser></div>
            <div data-file-browser-toggle></div>
            <div data-hidden-files-warning></div>
            <div data-stream-remaining-diffs></div>
            <div data-after-browser-toggle></div>
          </div>
       </div>
      </main>
      `,
    );
    app = createMergeRequestRapidDiffsApp();
  };

  beforeAll(() => {
    Object.defineProperty(window, 'customElements', {
      value: { define: jest.fn() },
      writable: true,
    });
  });

  beforeEach(() => {
    window.gon = { current_user_id: 1 };
    createTestingPinia();
    useDiffsView().loadDiffsStats.mockResolvedValue();
    useDiffsList().reloadDiffs.mockResolvedValue();
    useDiffsList().streamRemainingDiffs.mockResolvedValue();
    useMergeRequestDiscussions().fetchNotesAndDrafts.mockResolvedValue();
    initFileBrowser.mockResolvedValue();
  });

  afterEach(() => {
    window.gon = {};
  });

  it('initializes app', async () => {
    buildApp();
    await app.init();
    expect(app.root).toBeDefined();
  });

  it('initializes file browser', async () => {
    buildApp();
    await app.init();
    expect(initFileBrowser).toHaveBeenCalled();
  });

  it('initializes code review store with mrPath', async () => {
    buildApp({ mr_path: '/namespace/project/-/merge_requests/1' });
    await app.init();
    expect(useCodeReview().setMrPath).toHaveBeenCalledWith('/namespace/project/-/merge_requests/1');
    expect(useCodeReview().restoreFromAutosave).toHaveBeenCalled();
    expect(useCodeReview().restoreFromLegacyMrReviews).toHaveBeenCalled();
  });

  it('skips code review initialization when mrPath is not provided', async () => {
    buildApp();
    await app.init();
    expect(useCodeReview().setMrPath).not.toHaveBeenCalled();
  });

  it('skips code review initialization when user is not authenticated', async () => {
    window.gon = {};
    buildApp({ mr_path: '/namespace/project/-/merge_requests/1' });
    await app.init();
    expect(useCodeReview().setMrPath).not.toHaveBeenCalled();
  });

  it('sets projectPath on legacyDiffs store', async () => {
    buildApp({ project_path: 'gitlab-org/gitlab' });
    await app.init();
    expect(useLegacyDiffs().projectPath).toBe('gitlab-org/gitlab');
  });

  it('fetches notes and drafts on init', async () => {
    buildApp();
    await app.init();
    expect(useMergeRequestDiscussions().fetchNotesAndDrafts).toHaveBeenCalled();
  });

  it('initializes compare versions on init', async () => {
    const versions = {
      source_versions: [{ id: 1, version_index: 1, selected: true }],
      target_versions: [{ id: 'head', head: true, selected: true }],
    };
    buildApp({ versions });
    await app.init();

    expect(initCompareVersions).toHaveBeenCalledWith(
      document.querySelector('[data-after-browser-toggle]'),
      expect.objectContaining({ versions }),
    );
  });

  it('initializes new discussion toggle with allowExpandedLines', async () => {
    buildApp();
    await app.init();
    expect(initNewDiscussionToggle).toHaveBeenCalledWith(app.root, { allowExpandedLines: true });
  });

  it('initializes line range selection', async () => {
    buildApp();
    await app.init();
    expect(initLineRangeSelection).toHaveBeenCalledWith(app.root);
  });
});
