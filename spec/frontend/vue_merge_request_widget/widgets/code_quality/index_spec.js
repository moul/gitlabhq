import MockAdapter from 'axios-mock-adapter';
import * as Sentry from '~/sentry/sentry_browser_wrapper';
import { mountExtended } from 'helpers/vue_test_utils_helper';
import waitForPromises from 'helpers/wait_for_promises';
import axios from '~/lib/utils/axios_utils';
import { capitalizeFirstCharacter } from '~/lib/utils/text_utility';
import Widget from '~/vue_merge_request_widget/components/widget/widget.vue';
import { EXTENSION_ICONS } from '~/vue_merge_request_widget/constants';

import codeQualityWidget from '~/vue_merge_request_widget/widgets/code_quality/index.vue';
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

  const createComponent = ({ provide } = {}) => {
    wrapper = mountExtended(codeQualityWidget, {
      provide: {
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
        scenario               | response                          | message                                                          | isCollapsible | statusIcon
        ${'no findings'}       | ${responseNoFindings}             | ${"Code Quality hasn't changed."}                                | ${false}      | ${'neutral'}
        ${'new findings'}      | ${responseNewFindings}            | ${'Code Quality scans found 1 new finding.'}                     | ${true}       | ${'warning'}
        ${'resolved findings'} | ${responseResolvedFindings}       | ${'Code Quality scans found 1 fixed finding.'}                   | ${true}       | ${'success'}
        ${'new and resolved'}  | ${responseNewAndResolvedFindings} | ${'Code Quality scans found 1 new finding and 1 fixed finding.'} | ${true}       | ${'warning'}
      `(
        'displays correct summary for $scenario',
        async ({ response, message, isCollapsible, statusIcon }) => {
          mockApi(HTTP_STATUS_OK, response);

          createComponent();

          await waitForPromises();

          expect(findSummary().text()).toBe(message);
          expect(findToggleCollapsedButton().exists()).toBe(isCollapsible);
          expect(findWidget().props('statusIconName')).toBe(EXTENSION_ICONS[statusIcon]);
        },
      );
    });
  });

  describe('expanded data', () => {
    it('formats new findings with severity, engine name, and description', async () => {
      mockApi(HTTP_STATUS_OK, responseNewFindings);

      createComponent();

      await waitForPromises();

      const content = findWidget().props('content');
      expect(content[0]).toMatchObject({
        text: `${capitalizeFirstCharacter(newFinding.severity)} - ${newFinding.engine_name} - ${newFinding.description}`,
        link: {
          href: newFinding.web_url,
          text: `in ${newFinding.file_path}:${newFinding.line}`,
        },
      });
    });

    it('formats resolved findings with a Fixed badge', async () => {
      mockApi(HTTP_STATUS_OK, responseResolvedFindings);

      createComponent();

      await waitForPromises();

      const content = findWidget().props('content');
      expect(content[0]).toMatchObject({
        text: `${capitalizeFirstCharacter(resolvedFinding.severity)} - ${resolvedFinding.engine_name} - ${resolvedFinding.description}`,
        supportingText: `in ${resolvedFinding.file_path}:${resolvedFinding.line}`,
        badge: {
          variant: 'neutral',
          text: 'Fixed',
        },
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
});
