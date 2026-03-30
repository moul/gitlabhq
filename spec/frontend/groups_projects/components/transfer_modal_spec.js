import { GlModal } from '@gitlab/ui';
import { nextTick } from 'vue';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import GroupsProjectsTransferModal from '~/groups_projects/components/transfer_modal.vue';

describe('GroupsProjectsTransferModal', () => {
  let wrapper;

  const defaultPropsData = {
    visible: false,
    title: 'Transfer resource',
  };

  const createComponent = (propsData = {}) => {
    wrapper = shallowMountExtended(GroupsProjectsTransferModal, {
      propsData: {
        ...defaultPropsData,
        ...propsData,
      },
    });
  };

  const findModal = () => wrapper.findComponent(GlModal);

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

    it('sets transfer button text and variant', () => {
      const primaryAction = findModal().props('actionPrimary');

      expect(primaryAction.text).toBe('Transfer');
      expect(primaryAction.attributes.variant).toBe('danger');
    });
  });

  describe('when modal visibility changes', () => {
    it('emits change event', async () => {
      createComponent();

      findModal().vm.$emit('change', true);
      await nextTick();

      expect(wrapper.emitted('change')).toEqual([[true]]);
    });
  });
});
