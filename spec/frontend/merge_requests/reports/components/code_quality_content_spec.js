import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import CodeQualityContent from '~/merge_requests/reports/components/code_quality_content.vue';
import ReportSection from '~/merge_requests/reports/components/report_section.vue';
import { codeQualitySummary } from '~/vue_merge_request_widget/widgets/code_quality/utils';

jest.mock('~/vue_merge_request_widget/widgets/code_quality/utils');

describe('CodeQualityContent', () => {
  let wrapper;

  const DEFAULT_PROVIDE = {
    isCodeQualityLoading: false,
    errorMessage: '',
    newErrorsCount: 2,
    resolvedErrorsCount: 1,
    statusIconName: 'warning',
  };

  const findReportSection = () => wrapper.findComponent(ReportSection);

  const createComponent = ({ provide = {} } = {}) => {
    wrapper = shallowMountExtended(CodeQualityContent, {
      provide: {
        ...DEFAULT_PROVIDE,
        ...provide,
      },
    });
  };

  describe('rendering', () => {
    it('renders ReportSection', () => {
      createComponent();

      expect(findReportSection().exists()).toBe(true);
    });
  });

  describe('loading', () => {
    it('passes isLoading to ReportSection', () => {
      createComponent({ provide: { isCodeQualityLoading: true } });

      expect(findReportSection().props('isLoading')).toBe(true);
    });

    it('passes loading text to ReportSection', () => {
      createComponent();

      expect(findReportSection().props('loadingText')).toBe('Code quality is loading');
    });
  });

  describe('summary text', () => {
    it('calls codeQualitySummary with newErrorsCount and resolvedErrorsCount', () => {
      createComponent({ provide: { newErrorsCount: 2, resolvedErrorsCount: 1 } });

      expect(codeQualitySummary).toHaveBeenCalledWith({ newCount: 2, resolvedCount: 1 });
    });

    it('uses errorMessage as summary title when set', () => {
      const errorMessage = 'Code Quality failed to load results';

      createComponent({ provide: { errorMessage } });

      expect(codeQualitySummary).not.toHaveBeenCalled();
      expect(findReportSection().props('summary').title).toBe(errorMessage);
    });
  });

  describe('status icon', () => {
    it('passes statusIconName from provider', () => {
      createComponent({ provide: { statusIconName: 'success' } });

      expect(findReportSection().props('statusIconName')).toBe('success');
    });
  });
});
