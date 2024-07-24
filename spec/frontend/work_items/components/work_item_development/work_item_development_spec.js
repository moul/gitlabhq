import Vue from 'vue';
import { GlLoadingIcon, GlIcon } from '@gitlab/ui';
import VueApollo from 'vue-apollo';
import { shallowMountExtended } from 'helpers/vue_test_utils_helper';
import createMockApollo from 'helpers/mock_apollo_helper';
import { createMockDirective } from 'helpers/vue_mock_directive';
import workItemByIidQuery from '~/work_items/graphql/work_item_by_iid.query.graphql';
import waitForPromises from 'helpers/wait_for_promises';
import { STATE_CLOSED, STATE_OPEN } from '~/work_items/constants';

import {
  workItemResponseFactory,
  workItemDevelopmentFragmentResponse,
  workItemDevelopmentNodes,
} from 'jest/work_items/mock_data';

import WorkItemDevelopment from '~/work_items/components/work_item_development/work_item_development.vue';
import WorkItemDevelopmentRelationshipList from '~/work_items/components/work_item_development/work_item_development_relationship_list.vue';

describe('WorkItemDevelopment CE', () => {
  Vue.use(VueApollo);

  let wrapper;
  let mockApollo;

  const workItem = workItemResponseFactory({ developmentWidgetPresent: true });
  const workItemWithOneMR = workItemResponseFactory({
    developmentWidgetPresent: true,
    developmentItems: workItemDevelopmentFragmentResponse([workItemDevelopmentNodes[0]], true),
  });
  const workItemWithMRList = workItemResponseFactory({
    developmentWidgetPresent: true,
    developmentItems: workItemDevelopmentFragmentResponse(workItemDevelopmentNodes, true),
  });

  const projectWorkItemResponseWithMRList = {
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: workItem.data.workItem,
      },
    },
  };

  const closedWorkItemWithAutoCloseFlagEnabled = {
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: {
          ...workItemWithMRList.data.workItem,
          state: STATE_CLOSED,
        },
      },
    },
  };

  const openWorkItemWithAutoCloseFlagEnabledAndOneMR = {
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: workItemWithOneMR.data.workItem,
      },
    },
  };

  const openWorkItemWithAutoCloseFlagEnabledAndMRList = {
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: workItemWithMRList.data.workItem,
      },
    },
  };

  const successQueryHandler = jest.fn().mockResolvedValue(projectWorkItemResponseWithMRList);
  const workItemWithEmptyMRList = workItemResponseFactory({
    developmentWidgetPresent: true,
    developmentItems: workItemDevelopmentFragmentResponse([]),
  });
  const workItemWithAutoCloseFlagEnabled = workItemResponseFactory({
    developmentWidgetPresent: true,
    developmentItems: workItemDevelopmentFragmentResponse(workItemDevelopmentNodes, true),
  });

  const successQueryHandlerWithEmptyMRList = jest.fn().mockResolvedValue({
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: workItemWithEmptyMRList.data.workItem,
      },
    },
  });

  const successQueryHandlerWorkItemWithAutoCloseFlagEnabled = jest.fn().mockResolvedValue({
    data: {
      workspace: {
        __typename: 'Project',
        id: 'gid://gitlab/Project/1',
        workItem: workItemWithAutoCloseFlagEnabled.data.workItem,
      },
    },
  });

  const successQueryHandlerWithOneMR = jest
    .fn()
    .mockResolvedValue(openWorkItemWithAutoCloseFlagEnabledAndOneMR);
  const successQueryHandlerWithMRList = jest
    .fn()
    .mockResolvedValue(openWorkItemWithAutoCloseFlagEnabledAndMRList);
  const successQueryHandlerWithClosedWorkItem = jest
    .fn()
    .mockResolvedValue(closedWorkItemWithAutoCloseFlagEnabled);

  const createComponent = ({
    isGroup = false,
    canUpdate = true,
    workItemIid = '1',
    workItemFullPath = 'full-path',
    workItemQueryHandler = successQueryHandler,
  } = {}) => {
    mockApollo = createMockApollo([[workItemByIidQuery, workItemQueryHandler]]);

    wrapper = shallowMountExtended(WorkItemDevelopment, {
      apolloProvider: mockApollo,
      directives: {
        GlModal: createMockDirective('gl-modal'),
        GlTooltip: createMockDirective('gl-tooltip'),
      },
      propsData: {
        canUpdate,
        workItemIid,
        workItemFullPath,
      },
      provide: {
        isGroup,
      },
    });
  };

  const findLabel = () => wrapper.findByTestId('dev-widget-label');
  const findAddButton = () => wrapper.findByTestId('add-item');
  const findLoadingIcon = () => wrapper.findComponent(GlLoadingIcon);
  const findAddMoreIcon = () => wrapper.findComponent(GlIcon);
  const findCreateMRButton = () => wrapper.findByTestId('create-mr-button');
  const findCreateBranchButton = () => wrapper.findByTestId('create-branch-button');
  const findMoreInformation = () => wrapper.findByTestId('more-information');
  const findRelationshipList = () => wrapper.findComponent(WorkItemDevelopmentRelationshipList);

  describe('Default', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should show the widget label', () => {
      expect(findLabel().exists()).toBe(true);
    });

    it('should render the add button when `canUpdate` is true', () => {
      expect(findAddButton().exists()).toBe(true);
      expect(findAddMoreIcon().exists()).toBe(true);
    });

    it('should not render the add button when `canUpdate` is false', () => {
      createComponent({ canUpdate: false });

      expect(findAddButton().exists()).toBe(false);
    });
  });

  describe('when the query is loading', () => {
    it('should show the loading icon', () => {
      createComponent();
      expect(findLoadingIcon().exists()).toBe(true);
    });
  });

  describe('when the response is successful', () => {
    describe('when there are no MR`s linked', () => {
      beforeEach(async () => {
        createComponent({ workItemQueryHandler: successQueryHandlerWithEmptyMRList });
        await waitForPromises();
      });

      it('should show the `Create MR` button', () => {
        expect(findCreateMRButton().exists()).toBe(true);
      });

      it('should show the `Create branch` button', () => {
        expect(findCreateBranchButton().exists()).toBe(true);
      });
    });

    describe('when there is a list of MR`s', () => {
      beforeEach(async () => {
        createComponent();
        await waitForPromises();
      });

      it('should show the relationship list', () => {
        expect(findRelationshipList().exists()).toBe(true);
      });
    });

    it('when auto close flag is disabled, should not show the "i" indicator', async () => {
      createComponent();
      await waitForPromises();

      expect(findMoreInformation().exists()).toBe(false);
    });

    it('when auto close flag is enabled, should show the "i" indicator', async () => {
      createComponent({
        workItemQueryHandler: successQueryHandlerWorkItemWithAutoCloseFlagEnabled,
      });

      await waitForPromises();

      expect(findMoreInformation().exists()).toBe(true);
    });

    it.each`
      queryHandler                             | message                                                            | workItemState   | linkedMRsNumber
      ${successQueryHandlerWithOneMR}          | ${'This task will be closed when the following is merged.'}        | ${STATE_OPEN}   | ${1}
      ${successQueryHandlerWithMRList}         | ${'This task will be closed when any of the following is merged.'} | ${STATE_OPEN}   | ${workItemDevelopmentNodes.length}
      ${successQueryHandlerWithClosedWorkItem} | ${'The task was closed automatically when a branch was merged.'}   | ${STATE_CLOSED} | ${workItemDevelopmentNodes.length}
    `(
      'when the workItemState is `$workItemState` and number of linked MRs is `$linkedMRsNumber` shows message `$message`',
      async ({ queryHandler, message }) => {
        createComponent({
          workItemQueryHandler: queryHandler,
        });

        await waitForPromises();

        expect(findMoreInformation().attributes('aria-label')).toBe(message);
      },
    );
  });
});
