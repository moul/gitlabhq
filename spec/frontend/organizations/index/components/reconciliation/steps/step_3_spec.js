import { shallowMount } from '@vue/test-utils';
import Step3 from '~/organizations/index/components/reconciliation/steps/step_3.vue';
import BaseStep from '~/organizations/index/components/reconciliation/steps/base_step.vue';

describe('ReconciliationStep3', () => {
  let wrapper;

  const createComponent = () => {
    wrapper = shallowMount(Step3);
  };

  it('renders BaseStep', () => {
    createComponent();

    expect(wrapper.findComponent(BaseStep).exists()).toBe(true);
  });

  it('renders placeholder text', () => {
    createComponent();

    expect(wrapper.text()).toContain('Step 3 placeholder');
  });
});
