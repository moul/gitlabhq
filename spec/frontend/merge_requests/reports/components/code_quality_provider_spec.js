import MockAdapter from 'axios-mock-adapter';
import { mount } from '@vue/test-utils';
import waitForPromises from 'helpers/wait_for_promises';
import axios from '~/lib/utils/axios_utils';
import {
  HTTP_STATUS_OK,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from '~/lib/utils/http_status';
import Poll from '~/lib/utils/poll';
import CodeQualityProvider from '~/merge_requests/reports/components/code_quality_provider.vue';
import {
  responseNewFindings,
  responseResolvedFindings,
  responseNoFindings,
} from 'jest/vue_merge_request_widget/widgets/code_quality/mock_data';

describe('CodeQualityProvider', () => {
  let wrapper;
  let mock;

  const DEFAULT_MR_PROPS = {
    codequalityReportsPath: '/codequality_reports',
  };

  const InjectedChild = {
    inject: [
      'isCodeQualityLoading',
      'errorMessage',
      'statusMessage',
      'newErrorsCount',
      'resolvedErrorsCount',
      'statusIconName',
    ],
    template: `
      <div data-testid="child">
        <span data-testid="is-loading">{{ isCodeQualityLoading }}</span>
        <span data-testid="error-message">{{ errorMessage }}</span>
        <span data-testid="status-message">{{ statusMessage }}</span>
        <span data-testid="new-errors-count">{{ newErrorsCount }}</span>
        <span data-testid="resolved-errors-count">{{ resolvedErrorsCount }}</span>
        <span data-testid="status-icon-name">{{ statusIconName }}</span>
      </div>
    `,
  };

  const mockApi = (statusCode, data) => {
    mock.onGet(DEFAULT_MR_PROPS.codequalityReportsPath).reply(statusCode, data, {});
  };

  const createComponent = ({ mr = DEFAULT_MR_PROPS } = {}) => {
    wrapper = mount(CodeQualityProvider, {
      propsData: { mr },
      slots: {
        default: InjectedChild,
      },
    });
  };

  const findByTestId = (testId) => wrapper.find(`[data-testid="${testId}"]`);
  const getTextByTestId = (testId) => findByTestId(testId).text();
  const findIsLoading = () => getTextByTestId('is-loading');
  const findErrorMessage = () => getTextByTestId('error-message');
  const findStatusMessage = () => getTextByTestId('status-message');
  const findStatusIconName = () => getTextByTestId('status-icon-name');
  const findNewErrorsCount = () => getTextByTestId('new-errors-count');
  const findResolvedErrorsCount = () => getTextByTestId('resolved-errors-count');

  beforeEach(() => {
    mock = new MockAdapter(axios);
    mockApi(HTTP_STATUS_OK, responseNewFindings);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('rendering', () => {
    it('renders slot content', async () => {
      createComponent();
      await waitForPromises();

      expect(findByTestId('child').exists()).toBe(true);
    });
  });

  describe('data fetching', () => {
    it('does not fetch when code quality endpoint is missing', async () => {
      createComponent({ mr: {} });
      await waitForPromises();

      expect(mock.history.get).toHaveLength(0);
      expect(findStatusMessage()).toBe('Code quality results are not available');
      expect(findErrorMessage()).toBe('');
      expect(findStatusIconName()).toBe('warning');
      expect(findIsLoading()).toBe('false');
    });

    describe('loading', () => {
      it('is true while the request is in progress', () => {
        createComponent();

        expect(findIsLoading()).toBe('true');
      });

      it('is false after the request completes', async () => {
        createComponent();
        await waitForPromises();

        expect(findIsLoading()).toBe('false');
      });

      it('is false when the request fails', async () => {
        mockApi(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        createComponent();
        await waitForPromises();

        expect(findIsLoading()).toBe('false');
      });
    });

    describe('response data', () => {
      it('provides new errors count from response', async () => {
        createComponent();
        await waitForPromises();

        expect(findNewErrorsCount()).toBe(String(responseNewFindings.new_errors.length));
      });

      it('provides zero count when no new errors', async () => {
        mockApi(HTTP_STATUS_OK, responseNoFindings);
        createComponent();
        await waitForPromises();

        expect(findNewErrorsCount()).toBe('0');
      });

      it('provides resolved errors count from response', async () => {
        mockApi(HTTP_STATUS_OK, responseResolvedFindings);
        createComponent();
        await waitForPromises();

        expect(findResolvedErrorsCount()).toBe(
          String(responseResolvedFindings.resolved_errors.length),
        );
      });

      it('provides zero resolved count when no resolved errors', async () => {
        mockApi(HTTP_STATUS_OK, responseNoFindings);
        createComponent();
        await waitForPromises();

        expect(findResolvedErrorsCount()).toBe('0');
      });
    });

    describe('error handling', () => {
      it('sets error message when fetch fails without status_reason', async () => {
        mockApi(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        createComponent();
        await waitForPromises();

        expect(findErrorMessage()).toBe('Code quality failed loading results');
        expect(findStatusMessage()).toBe('');
      });

      it('sets status message when fetch fails with status_reason', async () => {
        const statusReason = 'This merge request does not have codequality reports';

        mockApi(HTTP_STATUS_BAD_REQUEST, { status_reason: statusReason });
        createComponent();
        await waitForPromises();

        expect(findStatusMessage()).toBe(statusReason);
        expect(findErrorMessage()).toBe('');
      });

      it('has no error or status message on success', async () => {
        createComponent();
        await waitForPromises();

        expect(findErrorMessage()).toBe('');
        expect(findStatusMessage()).toBe('');
      });
    });

    describe('statusIconName', () => {
      it('returns error when fetch fails without status_reason', async () => {
        mockApi(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        createComponent();
        await waitForPromises();

        expect(findStatusIconName()).toBe('error');
      });

      it('returns warning when fetch fails with status_reason', async () => {
        mockApi(HTTP_STATUS_BAD_REQUEST, { status_reason: 'Some status reason' });
        createComponent();
        await waitForPromises();

        expect(findStatusIconName()).toBe('warning');
      });

      it('returns warning when new errors exist', async () => {
        createComponent();
        await waitForPromises();

        expect(findStatusIconName()).toBe('warning');
      });

      it('returns success when no new errors', async () => {
        mockApi(HTTP_STATUS_OK, responseNoFindings);
        createComponent();
        await waitForPromises();

        expect(findStatusIconName()).toBe('success');
      });
    });

    describe('polling', () => {
      it('stops the poll when data is resolved', async () => {
        const stopSpy = jest.spyOn(Poll.prototype, 'stop');

        createComponent();
        await waitForPromises();

        expect(stopSpy).toHaveBeenCalled();
      });
    });
  });
});
