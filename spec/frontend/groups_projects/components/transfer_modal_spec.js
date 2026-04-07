import { GlModal } from '@gitlab/ui';
import { nextTick } from 'vue';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import waitForPromises from 'helpers/wait_for_promises';
import GroupsProjectsTransferModal from '~/groups_projects/components/transfer_modal.vue';
import TransferLocations from '~/groups_projects/components/transfer_locations.vue';

describe('GroupsProjectsTransferModal', () => {
  let wrapper;

  const resourceId = '1';
  const resourcePath = 'test-group';
  const resourceFullPath = 'parent/test-group';

  const groupTransferLocationsApiMethod = jest.fn();
  const transferApiMethod = jest.fn();

  const defaultProvide = {
    resourceId,
    resourcePath,
    resourceFullPath,
  };

  const defaultPropsData = {
    visible: false,
    title: 'Transfer resource',
    groupTransferLocationsApiMethod,
    transferApiMethod,
  };

  const createComponent = (propsData = {}) => {
    wrapper = shallowMountExtended(GroupsProjectsTransferModal, {
      provide: defaultProvide,
      propsData: {
        ...defaultPropsData,
        ...propsData,
      },
    });
  };

  const findModal = () => wrapper.findComponent(GlModal);
  const findTransferLocations = () => wrapper.findComponent(TransferLocations);

  const selectLocation = async (location) => {
    findTransferLocations().vm.$emit('input', location);
    await nextTick();
  };

  describe('default', () => {
    beforeEach(() => {
      createComponent();
    });

    it('renders modal with correct props', () => {
      expect(findModal().props()).toMatchObject({
        visible: false,
        title: 'Transfer resource',
      });
    });

    it('renders TransferLocations component with correct props', () => {
      expect(findTransferLocations().props()).toMatchObject({
        value: null,
        showUserTransferLocations: true,
        additionalDropdownItems: [],
        groupTransferLocationsApiMethod,
      });
    });

    describe('when no location is selected', () => {
      it('disables transfer button', () => {
        const primaryAction = findModal().props('actionPrimary');

        expect(primaryAction.attributes.disabled).toBe(true);
      });
    });
  });

  describe('when location is selected', () => {
    const selectedLocation = {
      id: 2,
      humanName: 'New Parent',
      newPath: 'new-parent/test-group',
    };

    beforeEach(async () => {
      createComponent();
      await selectLocation(selectedLocation);
    });

    it('enables transfer button', () => {
      const primaryAction = findModal().props('actionPrimary');

      expect(primaryAction.attributes.disabled).toBe(false);
    });

    it('sets transfer button text and variant', () => {
      const primaryAction = findModal().props('actionPrimary');

      expect(primaryAction.text).toBe('Transfer');
      expect(primaryAction.attributes.variant).toBe('danger');
    });
  });

  describe('when transfer is submitted', () => {
    const selectedLocation = {
      id: 2,
      humanName: 'New Parent',
      newPath: 'new-parent/test-group',
    };

    beforeEach(async () => {
      transferApiMethod.mockResolvedValue({});
      createComponent();
      await selectLocation(selectedLocation);
    });

    it('calls transfer API method with correct parameters', async () => {
      findModal().vm.$emit('primary', { preventDefault: jest.fn() });
      await nextTick();

      expect(transferApiMethod).toHaveBeenCalledWith(resourceId, selectedLocation.id);
    });

    describe('when transfer is in progress', () => {
      it('shows loading state', async () => {
        transferApiMethod.mockImplementation(() => new Promise(() => {}));

        findModal().vm.$emit('primary', { preventDefault: jest.fn() });
        await nextTick();

        const primaryAction = findModal().props('actionPrimary');
        expect(primaryAction.attributes.loading).toBe(true);
      });
    });

    describe('when transfer succeeds', () => {
      beforeEach(async () => {
        findModal().vm.$emit('primary', { preventDefault: jest.fn() });
        await waitForPromises();
      });

      it('emits success and change events', () => {
        expect(wrapper.emitted('success')).toHaveLength(1);
        expect(wrapper.emitted('change')).toEqual([[false]]);
      });

      it('resets loading state', () => {
        const primaryAction = findModal().props('actionPrimary');
        expect(primaryAction.attributes.loading).toBe(false);
      });
    });

    describe('when transfer fails', () => {
      const errorMessage = 'Transfer failed';

      beforeEach(async () => {
        transferApiMethod.mockRejectedValue({
          response: { data: { message: errorMessage } },
        });
        findModal().vm.$emit('primary', { preventDefault: jest.fn() });
        await waitForPromises();
      });

      it('emits error event with message and closes modal', () => {
        expect(wrapper.emitted('error')).toEqual([[errorMessage]]);
        expect(wrapper.emitted('change')).toEqual([[false]]);
      });

      it('resets loading state', () => {
        const primaryAction = findModal().props('actionPrimary');
        expect(primaryAction.attributes.loading).toBe(false);
      });
    });
  });

  describe('when modal visibility changes', () => {
    it('emits change event', async () => {
      createComponent();

      findModal().vm.$emit('change', true);
      await nextTick();

      expect(wrapper.emitted('change')).toEqual([[true]]);
    });

    describe('when modal is closed', () => {
      const selectedLocation = {
        id: 2,
        humanName: 'New Parent',
        newPath: 'new-parent/test-group',
      };

      beforeEach(async () => {
        createComponent({ visible: true });
        await selectLocation(selectedLocation);
      });

      it('resets the form', async () => {
        findModal().vm.$emit('change', false);
        await nextTick();

        expect(findTransferLocations().props('value')).toBeNull();
      });
    });
  });

  describe('when showUserTransferLocations prop is false', () => {
    it('passes showUserTransferLocations to TransferLocations', () => {
      createComponent({ showUserTransferLocations: false });

      expect(findTransferLocations().props('showUserTransferLocations')).toBe(false);
    });
  });

  describe('when additionalDropdownItems prop is provided', () => {
    const additionalItems = [
      { id: -1, humanName: 'No parent' },
      { id: -2, humanName: 'Special option' },
    ];

    it('passes additionalDropdownItems to TransferLocations', () => {
      createComponent({ additionalDropdownItems: additionalItems });

      expect(findTransferLocations().props('additionalDropdownItems')).toEqual(additionalItems);
    });
  });
});
