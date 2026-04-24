import { shallowMount } from '@vue/test-utils';
import { GlButton, GlIcon } from '@gitlab/ui';
import BaseStep from '~/organizations/index/components/reconciliation/steps/base_step.vue';

describe('ReconciliationBaseStep', () => {
  let wrapper;

  const createComponent = ({ props = {}, slots = {} } = {}) => {
    wrapper = shallowMount(BaseStep, {
      propsData: {
        ...props,
      },
      slots: {
        default: '<p>Slot content</p>',
        ...slots,
      },
    });
  };

  const findPrevButton = () => wrapper.findAllComponents(GlButton).at(0);
  const findNextButton = () => wrapper.findAllComponents(GlButton).at(1);
  const findIcon = () => wrapper.findComponent(GlIcon);

  it('renders default slot content', () => {
    createComponent();

    expect(wrapper.text()).toContain('Slot content');
  });

  it('renders default button text', () => {
    createComponent();

    expect(findPrevButton().text()).toBe('Cancel');
    expect(findNextButton().text()).toBe('Continue');
  });

  it('renders custom button text', () => {
    createComponent({
      props: { prevButtonText: 'Back', nextButtonText: 'Next' },
    });

    expect(findPrevButton().text()).toBe('Back');
    expect(findNextButton().text()).toBe('Next');
  });

  it('renders icon when provided', () => {
    createComponent({ props: { icon: 'search' } });

    expect(findIcon().props('name')).toBe('search');
  });

  it('does not render icon when not provided', () => {
    createComponent();

    expect(findIcon().exists()).toBe(false);
  });

  it('renders title when provided', () => {
    createComponent({ props: { title: 'Step title' } });

    expect(wrapper.find('h4').text()).toBe('Step title');
  });

  it('does not render title when not provided', () => {
    createComponent();

    expect(wrapper.find('h4').exists()).toBe(false);
  });

  it('emits prev when prev button is clicked', () => {
    createComponent();

    findPrevButton().vm.$emit('click');

    expect(wrapper.emitted('prev')).toHaveLength(1);
  });

  it('emits next when next button is clicked', () => {
    createComponent();

    findNextButton().vm.$emit('click');

    expect(wrapper.emitted('next')).toHaveLength(1);
  });
});
