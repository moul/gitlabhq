import { GlTable, GlButton, GlSkeletonLoader } from '@gitlab/ui';
import { mountExtended, shallowMountExtended } from 'helpers/vue_test_utils_helper';
import ScanProfileTable from '~/security_configuration/components/scan_profiles/scan_profile_table.vue';
import {
  SCAN_PROFILE_PROMO_ITEMS,
  SCAN_PROFILE_SCANNER_HEALTH_ACTIVE,
  SCAN_PROFILE_SCANNER_HEALTH_FAILED,
  SCAN_PROFILE_SCANNER_HEALTH_PENDING,
  SCAN_PROFILE_SCANNER_HEALTH_STALE,
  SCAN_PROFILE_SCANNER_HEALTH_UNCONFIGURED,
  SCAN_PROFILE_SCANNER_HEALTH_WARNING,
} from '~/security_configuration/constants';

describe('ScanProfileTable', () => {
  let wrapper;

  const createComponent = ({ props } = {}) => {
    wrapper = mountExtended(ScanProfileTable, {
      propsData: {
        loading: false,
        tableItems: SCAN_PROFILE_PROMO_ITEMS,
        ...props,
      },
    });

    return wrapper;
  };

  const findTable = () => wrapper.findComponent(GlTable);
  const findAllButtons = () => wrapper.findAllComponents(GlButton);
  const findApplyButton = () => findAllButtons().at(0);
  const findPreviewButton = () => findAllButtons().at(1);
  const findSkeletonLoader = () => wrapper.findComponent(GlSkeletonLoader);

  it('shows a skeleton loader when loading', () => {
    wrapper = mountExtended(ScanProfileTable, {
      propsData: {
        loading: true,
        tableItems: [],
      },
    });

    expect(findSkeletonLoader().exists()).toBe(true);
  });

  describe('table rendering', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders table with correct fields', () => {
      const table = findTable();
      expect(table.exists()).toBe(true);
      expect(table.props('fields')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'scanType', label: 'Scanner' }),
          expect.objectContaining({ key: 'name', label: 'Profile' }),
          expect.objectContaining({ key: 'status', label: 'Scanner health' }),
          expect.objectContaining({ key: 'lastScan', label: 'Last scan' }),
          expect.objectContaining({ key: 'actions', label: '' }),
        ]),
      );
    });

    it('passes table items to the table', () => {
      expect(findTable().props('items')).toEqual(SCAN_PROFILE_PROMO_ITEMS);
    });

    it('renders scanner type from promo item', () => {
      expect(wrapper.text()).toContain('SD');
      expect(wrapper.text()).toContain('Secret Detection');
    });

    it('renders Dependency Scanning scanner type', () => {
      expect(wrapper.text()).toContain('DS');
      expect(wrapper.text()).toContain('Dependency Scanning');
    });

    it('renders "No profile applied"', () => {
      expect(wrapper.text()).toContain('No profile applied');
    });

    it('renders last scan as —', () => {
      expect(wrapper.text()).toContain('—');
    });

    it('renders disabled apply button', () => {
      expect(findApplyButton().props('disabled')).toBe(true);
    });

    it('renders disabled preview button', () => {
      expect(findPreviewButton().props('disabled')).toBe(true);
    });
  });

  describe('scanTypeBadgeClass', () => {
    const createWrapperForStatus = (status) =>
      shallowMountExtended(ScanProfileTable, {
        propsData: {
          loading: false,
          tableItems: [{ scanType: 'SECRET_DETECTION', status }],
        },
      });

    it.each`
      status                                      | expectedClasses
      ${SCAN_PROFILE_SCANNER_HEALTH_ACTIVE}       | ${'gl-border-feedback-success gl-bg-status-success gl-text-status-success'}
      ${SCAN_PROFILE_SCANNER_HEALTH_WARNING}      | ${'gl-border-feedback-warning gl-bg-status-warning gl-text-status-warning'}
      ${SCAN_PROFILE_SCANNER_HEALTH_FAILED}       | ${'gl-border-feedback-danger gl-bg-status-danger gl-text-status-danger'}
      ${SCAN_PROFILE_SCANNER_HEALTH_PENDING}      | ${'gl-border-strong gl-bg-status-neutral gl-text-strong'}
      ${SCAN_PROFILE_SCANNER_HEALTH_STALE}        | ${'gl-border-strong gl-bg-status-neutral gl-text-strong'}
      ${SCAN_PROFILE_SCANNER_HEALTH_UNCONFIGURED} | ${'gl-border-dashed gl-border-strong gl-bg-default gl-text-strong'}
      ${null}                                     | ${'gl-border-dashed gl-border-strong gl-bg-default gl-text-strong'}
    `('returns correct classes for "$status" status', ({ status, expectedClasses }) => {
      wrapper = createWrapperForStatus(status);
      expect(wrapper.vm.scanTypeBadgeClass(status)).toBe(expectedClasses);
    });
  });

  describe.each(['name', 'status', 'actions'])('%s slot', (slotName) => {
    it('renders custom status slot content when provided', () => {
      wrapper = mountExtended(ScanProfileTable, {
        propsData: {
          loading: false,
          tableItems: SCAN_PROFILE_PROMO_ITEMS,
        },
        scopedSlots: {
          [`cell(${slotName})`]: `<div class="custom-status">Custom ${slotName} content</div>`,
        },
      });

      expect(wrapper.find('.custom-status').exists()).toBe(true);
      expect(wrapper.text()).toContain(`Custom ${slotName} content`);
    });
  });
});
