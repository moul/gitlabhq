import { shallowMount } from '@vue/test-utils';
import { GlModal, GlSprintf } from '@gitlab/ui';
import { nextTick } from 'vue';
import ReconciliationModal from '~/organizations/index/components/reconciliation/modal.vue';
import Step1 from '~/organizations/index/components/reconciliation/steps/step_1.vue';
import Step2 from '~/organizations/index/components/reconciliation/steps/step_2.vue';
import Step3 from '~/organizations/index/components/reconciliation/steps/step_3.vue';

describe('OrganizationReconciliationModal', () => {
  let wrapper;

  const createComponent = ({ props = {} } = {}) => {
    wrapper = shallowMount(ReconciliationModal, {
      propsData: {
        ...props,
      },
      stubs: {
        GlSprintf,
      },
    });
  };

  const findModal = () => wrapper.findComponent(GlModal);
  const findStep1 = () => wrapper.findComponent(Step1);
  const findStep2 = () => wrapper.findComponent(Step2);
  const findStep3 = () => wrapper.findComponent(Step3);

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

  describe('step components', () => {
    describe('step 1', () => {
      beforeEach(() => {
        createComponent();
      });

      it('renders step 1 component', () => {
        expect(findStep1().exists()).toBe(true);
      });

      it('displays step progress text', () => {
        expect(findModal().text()).toContain('Step 1 / 3');
      });

      it('next event advances to step 2', async () => {
        findStep1().vm.$emit('next');
        await nextTick();

        expect(findStep2().exists()).toBe(true);
      });

      it('prev event closes modal', async () => {
        findStep1().vm.$emit('prev');
        await nextTick();

        expect(wrapper.emitted('change')).toEqual([[false]]);
      });
    });

    describe('step 2', () => {
      beforeEach(async () => {
        createComponent();

        findStep1().vm.$emit('next');
        await nextTick();
      });

      it('renders step 2 component', () => {
        expect(findStep2().exists()).toBe(true);
      });

      it('displays step progress text', () => {
        expect(findModal().text()).toContain('Step 2 / 3');
      });

      it('next event advances to step 3', async () => {
        findStep2().vm.$emit('next');
        await nextTick();

        expect(wrapper.findComponent(Step3).exists()).toBe(true);
      });

      it('prev event returns to step 1', async () => {
        findStep2().vm.$emit('prev');
        await nextTick();

        expect(wrapper.findComponent(Step1).exists()).toBe(true);
      });
    });

    describe('step 3', () => {
      beforeEach(async () => {
        createComponent();

        findStep1().vm.$emit('next');
        await nextTick();

        findStep2().vm.$emit('next');
        await nextTick();
      });

      it('renders step 3 component', () => {
        expect(findStep3().exists()).toBe(true);
      });

      it('displays step progress text', () => {
        expect(findModal().text()).toContain('Step 3 / 3');
      });

      it('next event does nothing and stays on step 3', async () => {
        findStep3().vm.$emit('next');
        await nextTick();

        expect(wrapper.findComponent(Step3).exists()).toBe(true);
      });

      it('prev event returns to step 2', async () => {
        findStep3().vm.$emit('prev');
        await nextTick();

        expect(wrapper.findComponent(Step2).exists()).toBe(true);
      });
    });
  });
});
