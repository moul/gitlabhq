import GroupsProjectsTransferModal from './transfer_modal.vue';

const Template = (args, { argTypes }) => ({
  components: { GroupsProjectsTransferModal },
  props: Object.keys(argTypes),
  data() {
    return {
      isVisible: args.visible,
    };
  },
  template: `
    <div>
      <button @click="isVisible = true">Open Transfer Modal</button>
      <groups-projects-transfer-modal
        v-bind="$props"
        :visible="isVisible"
        @change="isVisible = $event"
      >
        <template #body>
          <p>Transfer this group to a different namespace.</p>
        </template>
      </groups-projects-transfer-modal>
    </div>
  `,
});

export default {
  component: GroupsProjectsTransferModal,
  title: 'groups_projects/transfer_modal',
};

export const Default = Template.bind({});
Default.args = {
  visible: false,
  title: 'Transfer group',
};
