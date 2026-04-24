import { shallowMount } from '@vue/test-utils';
import { GlModal } from '@gitlab/ui';
import ReconciliationModal from '~/organizations/index/components/reconciliation/modal.vue';

describe('OrganizationReconciliationModal', () => {
  let wrapper;

  const createComponent = ({ props = {} } = {}) => {
    wrapper = shallowMount(ReconciliationModal, {
      propsData: {
        ...props,
      },
    });
  };

  const findModal = () => wrapper.findComponent(GlModal);

  it('renders GlModal', () => {
    createComponent();

    expect(findModal().exists()).toBe(true);
  });

  it('passes visible prop to GlModal', () => {
    createComponent({ props: { visible: true } });

    expect(findModal().props('visible')).toBe(true);
  });

  it('defaults visible prop to false', () => {
    createComponent();

    expect(findModal().props('visible')).toBe(false);
  });

  it('emits change event when modal visibility changes', async () => {
    createComponent();

    await findModal().vm.$emit('change', true);

    expect(wrapper.emitted('change')).toEqual([[true]]);
  });
});
