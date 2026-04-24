import { shallowMount } from '@vue/test-utils';
import Step1 from '~/organizations/index/components/reconciliation/steps/step_1.vue';
import BaseStep from '~/organizations/index/components/reconciliation/steps/base_step.vue';

describe('ReconciliationStep1', () => {
  let wrapper;

  const createComponent = () => {
    wrapper = shallowMount(Step1);
  };

  it('renders BaseStep', () => {
    createComponent();

    expect(wrapper.findComponent(BaseStep).exists()).toBe(true);
  });

  it('renders placeholder text', () => {
    createComponent();

    expect(wrapper.text()).toContain('Step 1 placeholder');
  });
});
