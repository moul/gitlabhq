import { shallowMount } from '@vue/test-utils';
import Step2 from '~/organizations/index/components/reconciliation/steps/step_2.vue';
import BaseStep from '~/organizations/index/components/reconciliation/steps/base_step.vue';

describe('ReconciliationStep2', () => {
  let wrapper;

  const createComponent = () => {
    wrapper = shallowMount(Step2);
  };

  it('renders BaseStep', () => {
    createComponent();

    expect(wrapper.findComponent(BaseStep).exists()).toBe(true);
  });

  it('renders placeholder text', () => {
    createComponent();

    expect(wrapper.text()).toContain('Step 2 placeholder');
  });
});
