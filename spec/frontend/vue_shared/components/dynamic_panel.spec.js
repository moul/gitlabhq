import { mount } from '@vue/test-utils';
import DynamicPanel from '~/vue_shared/components/dynamic_panel.vue';

describe('DynamicPanel', () => {
  let wrapper;

  const findCloseButton = () => wrapper.find('button');

  const createComponent = (options = {}) => {
    wrapper = mount(DynamicPanel, options);
  };

  it('renders the header prop text', () => {
    createComponent({ propsData: { header: 'My panel' } });
    expect(wrapper.text()).toContain('My panel');
  });

  it('renders the header slot content instead of the header prop', () => {
    createComponent({
      propsData: { header: 'Prop header' },
      slots: { header: 'Slot header' },
    });
    expect(wrapper.text()).toContain('Slot header');
    expect(wrapper.text()).not.toContain('Prop header');
  });

  it('renders default slot content', () => {
    createComponent({ slots: { default: 'Panel body' } });
    expect(wrapper.text()).toContain('Panel body');
  });

  it('emits close when the close button is clicked', async () => {
    createComponent();
    await findCloseButton().trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('close button has the correct aria-label', () => {
    createComponent();
    expect(findCloseButton().attributes('aria-label')).toBe('Close panel');
  });
});
