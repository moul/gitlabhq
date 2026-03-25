import MockAdapter from 'axios-mock-adapter';
import * as Sentry from '~/sentry/sentry_browser_wrapper';
import { mountExtended } from 'helpers/vue_test_utils_helper';
import waitForPromises from 'helpers/wait_for_promises';
import axios from '~/lib/utils/axios_utils';
import Widget from '~/vue_merge_request_widget/components/widget/widget.vue';
import { EXTENSION_ICONS } from '~/vue_merge_request_widget/constants';

import codeQualityWidget from '~/vue_merge_request_widget/widgets/code_quality/index.vue';
import * as utils from '~/vue_merge_request_widget/widgets/code_quality/utils';
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_OK,
} from '~/lib/utils/http_status';
import {
  newFinding,
  resolvedFinding,
  responseNewFindings,
  responseResolvedFindings,
  responseNewAndResolvedFindings,
  responseNoFindings,
} from './mock_data';

jest.mock('~/sentry/sentry_browser_wrapper');

describe('Code Quality widget', () => {
  let wrapper;
  let mock;

  const DEFAULT_MR_PROPS = {
    codequalityReportsPath: '/project/-/merge_requests/1/codequality_reports',
    reportsTabPath: '/project/-/merge_requests/1/reports',
  };

  const mockApi = (statusCode, data) => {
    mock.onGet(DEFAULT_MR_PROPS.codequalityReportsPath).reply(statusCode, data, {});
  };

  const findWidget = () => wrapper.findComponent(Widget);
  const findSummary = () => wrapper.findByTestId('widget-extension-top-level-summary');
  const findToggleCollapsedButton = () => wrapper.findByTestId('toggle-button');

  const createComponent = ({ provide = {} } = {}) => {
    wrapper = mountExtended(codeQualityWidget, {
      provide: {
        glFeatures: { mrReportsTab: true },
        ...provide,
      },
      propsData: {
        mr: {
          ...DEFAULT_MR_PROPS,
        },
      },
    });
  };

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('summary', () => {
    it('displays loading text', () => {
      mockApi(HTTP_STATUS_NO_CONTENT, {});

      createComponent();

      expect(findSummary().text()).toBe('Code Quality is loading');
    });

    describe('when request fails', () => {
      beforeEach(async () => {
        mockApi(HTTP_STATUS_INTERNAL_SERVER_ERROR);

        createComponent();

        await waitForPromises();
      });

      it('displays error text', () => {
        expect(findSummary().text()).toBe('Code Quality failed to load results');
      });

      it('is not collapsible', () => {
        expect(findToggleCollapsedButton().exists()).toBe(false);
      });
    });

    describe('when request succeeds', () => {
      it.each`
        scenario               | response                          | message                                                          | statusIcon
        ${'no findings'}       | ${responseNoFindings}             | ${"Code Quality hasn't changed."}                                | ${'neutral'}
        ${'new findings'}      | ${responseNewFindings}            | ${'Code Quality scans found 1 new finding.'}                     | ${'warning'}
        ${'resolved findings'} | ${responseResolvedFindings}       | ${'Code Quality scans found 1 fixed finding.'}                   | ${'success'}
        ${'new and resolved'}  | ${responseNewAndResolvedFindings} | ${'Code Quality scans found 1 new finding and 1 fixed finding.'} | ${'warning'}
      `('displays correct summary for $scenario', async ({ response, message, statusIcon }) => {
        mockApi(HTTP_STATUS_OK, response);

        createComponent();

        await waitForPromises();

        expect(findSummary().text()).toBe(message);
        expect(findWidget().props('statusIconName')).toBe(EXTENSION_ICONS[statusIcon]);
      });
    });
  });

  describe('data fetching', () => {
    it('emits loaded event with new error count', async () => {
      mockApi(HTTP_STATUS_OK, responseNewFindings);

      createComponent();

      await waitForPromises();

      expect(wrapper.emitted('loaded')).toEqual([[1]]);
    });

    it('reports errors to Sentry', async () => {
      mockApi(HTTP_STATUS_INTERNAL_SERVER_ERROR);

      createComponent();

      await waitForPromises();

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('action buttons', () => {
    afterEach(() => {
      delete window.mrTabs;
    });

    it('displays the "View report" button', async () => {
      mockApi(HTTP_STATUS_OK, responseNewFindings);

      createComponent();

      await waitForPromises();

      const actionButtons = findWidget().props('actionButtons');
      expect(actionButtons).toHaveLength(1);
      expect(actionButtons[0]).toMatchObject({
        href: `${DEFAULT_MR_PROPS.reportsTabPath}/code-quality`,
        text: 'View report',
      });
    });

    it('onClick navigates to the reports tab without page reload', async () => {
      mockApi(HTTP_STATUS_OK, responseNewFindings);

      createComponent();

      await waitForPromises();

      const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
      window.mrTabs = { tabShown: jest.fn() };

      const actionButtons = findWidget().props('actionButtons');
      const event = { preventDefault: jest.fn() };
      actionButtons[0].onClick(actionButtons[0], event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        null,
        `${DEFAULT_MR_PROPS.reportsTabPath}/code-quality`,
      );
      expect(window.mrTabs.tabShown).toHaveBeenCalledWith('reports');
    });

    it('should not be collapsible', async () => {
      mockApi(HTTP_STATUS_OK, responseNewFindings);

      createComponent();

      await waitForPromises();

      expect(findWidget().props('isCollapsible')).toBe(false);
    });
  });

  describe('when mrReportsTab feature flag is disabled', () => {
    const createComponentWithFeatureFlagDisabled = () => {
      createComponent({ provide: { glFeatures: { mrReportsTab: false } } });
    };

    describe('expanded data', () => {
      it('calls transformNewCodeQualityFinding with each new finding', async () => {
        jest.spyOn(utils, 'transformNewCodeQualityFinding');
        mockApi(HTTP_STATUS_OK, responseNewFindings);

        createComponentWithFeatureFlagDisabled();

        await waitForPromises();

        expect(utils.transformNewCodeQualityFinding).toHaveBeenCalledWith(newFinding, 0, [
          newFinding,
        ]);
      });

      it('calls transformResolvedCodeQualityFinding with each resolved finding', async () => {
        jest.spyOn(utils, 'transformResolvedCodeQualityFinding');
        mockApi(HTTP_STATUS_OK, responseResolvedFindings);

        createComponentWithFeatureFlagDisabled();

        await waitForPromises();

        expect(utils.transformResolvedCodeQualityFinding).toHaveBeenCalledWith(resolvedFinding, 0, [
          resolvedFinding,
        ]);
      });
    });
  });
});
