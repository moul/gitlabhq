import Vue from 'vue';
import VueApollo from 'vue-apollo';
import { waitFor } from '@testing-library/dom';
import { mount } from '@vue/test-utils';
import { getIdFromGraphQLId } from '~/graphql_shared/utils';
import WorkItemsRoot from '~/work_items/components/app.vue';
import { createRouter } from '~/work_items/router';
import { apolloProvider } from '~/graphql_shared/issuable_client';
import {
  labelsResponse,
  autocompleteUsersResponse,
  milestonesResponse,
  baseUpdateResponse,
} from '../handlers/work_items';
import { waitForElement, getText } from '../test_helpers';

jest.mock('~/lib/utils/common_utils', () => ({
  ...jest.requireActual('~/lib/utils/common_utils'),
  isLoggedIn: jest.fn().mockReturnValue(true),
}));

const firstLabel = labelsResponse.data.namespace.labels.nodes[0];
const firstUser = autocompleteUsersResponse.data.namespace.users[0];
const firstMilestone = milestonesResponse.data.namespace.attributes.nodes[0];
const workItemId = baseUpdateResponse.data.workItemUpdate.workItem.id;

function getListboxTestId(item) {
  return `listbox-item-${item.id}`;
}

Vue.use(VueApollo);

describe('WorkItem integration test', () => {
  let wrapper;
  const router = createRouter({ fullPath: 'gitlab-org/gitlab' });

  const findInDrawer = (testId) => {
    const portalEl = document.getElementById('contextual-panel-portal');
    return portalEl?.querySelector(`[data-testid="${testId}"]`) ?? null;
  };

  const findIssueToEdit = () => {
    const issueId = getIdFromGraphQLId(workItemId);
    return document.querySelector(`#issuable_${issueId}`);
  };

  const findWorkItemDetail = () => findInDrawer('work-item-detail');
  const findEditFormButton = () => findInDrawer('work-item-edit-form-button');
  const findTitleInput = () => findInDrawer('work-item-title-input');
  const findWorkItemTitle = () => findInDrawer('work-item-title');
  const findDescriptionWrapper = () => findInDrawer('work-item-description-wrapper');
  const findAssigneesWidget = () => findInDrawer('work-item-assignees');
  const findLabelsWidget = () => findInDrawer('work-item-labels');
  const findActionsDropdown = () => findInDrawer('work-item-actions-dropdown');
  const findConfidentialityAction = () => findInDrawer('confidentiality-toggle-action');
  const findMilestoneWidget = () => findInDrawer('work-item-milestone');
  const findSubscribeButton = () => findInDrawer('subscribe-button');
  const findDatesWidget = () => findInDrawer('work-item-due-dates');
  const findConfirmButton = () => findInDrawer('confirm-button');
  const findApplyButton = () => findInDrawer('apply-button');
  const findStartDateValue = () => findInDrawer('start-date-value');
  const findDueDateValue = () => findInDrawer('due-date-value');
  const findUserListboxItem = () => findInDrawer(getListboxTestId(firstUser));
  const findLabelListboxItem = () => findInDrawer(getListboxTestId(firstLabel));
  const findMilestoneListboxItem = () => findInDrawer(getListboxTestId(firstMilestone));
  const findIssuableTitleLink = () =>
    findIssueToEdit().querySelector('[data-testid="issuable-title-link"]');
  const findAssigneeLink = () => findIssueToEdit().querySelector('[data-testid="assignee-link"]');
  const findConfidentialIcon = () =>
    findIssueToEdit().querySelector('[data-testid="confidential-icon-container"]');
  const findIssuableComments = () =>
    findIssueToEdit().querySelector('[data-testid="issuable-comments"]');
  const findIssuableDueDate = () =>
    findIssueToEdit().querySelector('[data-testid="issuable-due-date"]');

  const clickIssue = () => {
    findIssueToEdit().click();
  };

  const selectIssue = async () => {
    clickIssue();
    await waitForElement(findWorkItemDetail);
  };

  const startEditing = async (finder) => {
    const widget = await waitForElement(finder);
    widget.querySelector('[data-testid="edit-button"]').click();
    await waitFor(() => {
      expect(finder().querySelector('[role="listbox"]')).not.toBe(null);
    });
  };

  const closeListbox = (finder) => {
    finder().querySelector('[data-testid="base-dropdown-toggle"]').click();
  };

  const createComponent = () => {
    wrapper = mount(WorkItemsRoot, {
      router,
      attachTo: document.body,
      propsData: {
        rootPageFullPath: 'gitlab-org/gitlab',
      },
      apolloProvider,
      provide: {
        isGroup: false,
        isProject: true,
        isGroupIssuesList: false,
        fullPath: 'gitlab-org/gitlab',
        groupPath: 'gitlab-org',
        workItemType: 'Issue',
        isSignedIn: true,
        initialSort: 'created_desc',
        isServiceDeskSupported: false,
        workItemPlanningViewEnabled: false,
        workItemsSavedViewsEnabled: false,
        glFeatures: {
          workItemViewForIssues: true,
          notificationsTodosButtons: true,
        },
      },
    });
  };

  const mountAndWaitForList = async () => {
    createComponent();
    await waitForElement(findIssueToEdit);
  };

  beforeAll(() => {
    const portalEl = document.createElement('div');
    portalEl.id = 'contextual-panel-portal';
    document.body.appendChild(portalEl);
  });

  beforeEach(async () => {
    window.gon = { ...window.gon, current_user_id: 16 };
    await apolloProvider.defaultClient.cache.reset();
  });

  afterEach(() => {
    wrapper?.destroy();
    apolloProvider.defaultClient.stop();
  });

  it('renders the work item issues list', async () => {
    await router.push('/work_items');

    createComponent();

    await waitFor(() => {
      expect(findIssueToEdit()).not.toBe(null);
    });
  });

  describe('with mounted list', () => {
    beforeEach(async () => {
      await mountAndWaitForList();
    });

    describe('when navigating to a work item', () => {
      beforeEach(async () => {
        await selectIssue();
      });

      it('opens the work item detail in the drawer', async () => {
        await waitForElement(findWorkItemDetail);
      });
    });

    describe('when clicking the same issue again', () => {
      beforeEach(async () => {
        await selectIssue();
        clickIssue();
      });

      it('closes the drawer', async () => {
        await waitFor(() => {
          expect(findWorkItemDetail()).toBe(null);
        });
      });
    });

    describe('when user adds a comment from the drawer', () => {
      beforeEach(async () => {
        await selectIssue();

        const portalEl = document.getElementById('contextual-panel-portal');

        await waitFor(() => {
          expect(portalEl.querySelector('textarea')).not.toBe(null);
        });

        const textarea = portalEl.querySelector('textarea');
        textarea.value = 'Test comment from drawer';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        await waitFor(() => {
          expect(textarea.value).toBe('Test comment from drawer');
        });

        findConfirmButton().click();
      });

      it('updates comment count', async () => {
        await waitFor(() => {
          expect(getText(findIssuableComments())).toContain('1');
        });
      });
    });

    describe('with selected issue', () => {
      beforeEach(async () => {
        await selectIssue();
      });

      describe('when title is edited in the drawer', () => {
        const newTitle = 'New title';

        beforeEach(async () => {
          const editButton = await waitForElement(findEditFormButton);
          editButton.click();
          await waitForElement(findTitleInput);

          const titleInput = findTitleInput();
          titleInput.value = newTitle;
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));

          findDescriptionWrapper()
            .querySelector('form')
            .dispatchEvent(new Event('submit', { bubbles: true }));
        });

        it('updates work item title in the list', async () => {
          await waitFor(() => {
            expect(getText(findWorkItemTitle())).toBe(newTitle);
            expect(getText(findIssuableTitleLink())).toBe(newTitle);
          });
        });
      });

      describe('when assignee is changed in the drawer', () => {
        beforeEach(async () => {
          await startEditing(findAssigneesWidget);

          const assignee = await waitForElement(findUserListboxItem);
          assignee.click();
          await waitFor(() => {
            expect(findUserListboxItem().getAttribute('aria-selected')).toBe('true');
          });

          closeListbox(findAssigneesWidget);
        });

        it('updates assignee in the list', async () => {
          await waitFor(() => {
            expect(getText(findAssigneesWidget())).toContain(firstUser.name);
            expect(findAssigneeLink().getAttribute('href')).toBe(firstUser.webPath);
          });
        });
      });

      describe('when a label is added in the drawer', () => {
        beforeEach(async () => {
          await startEditing(findLabelsWidget);

          const label = await waitForElement(findLabelListboxItem);
          label.click();
          await waitFor(() => {
            expect(findLabelListboxItem().getAttribute('aria-selected')).toBe('true');
          });

          closeListbox(findLabelsWidget);
        });

        it('updates labels in the list', async () => {
          await waitFor(() => {
            expect(getText(findLabelsWidget())).toContain(firstLabel.title);
            expect(getText(findIssueToEdit())).toContain(firstLabel.title);
          });
        });
      });

      describe('when confidentiality is toggled in the drawer', () => {
        beforeEach(async () => {
          const actionsDropdown = await waitForElement(findActionsDropdown);
          actionsDropdown.querySelector('button').click();
          const confidentialityAction = await waitForElement(findConfidentialityAction);
          confidentialityAction.querySelector('button').click();
        });

        it('shows the confidential icon on the list', async () => {
          await waitFor(() => {
            expect(findConfidentialIcon()).not.toBe(null);
          });
        });
      });

      describe('when milestone is changed in the drawer', () => {
        beforeEach(async () => {
          await startEditing(findMilestoneWidget);
          const milestone = await waitForElement(findMilestoneListboxItem);
          milestone.click();
        });

        it('updates milestone in the list', async () => {
          await waitFor(() => {
            expect(getText(findMilestoneWidget())).toContain(firstMilestone.title);
            expect(getText(findIssueToEdit())).toContain(firstMilestone.title);
          });
        });
      });

      describe('when notifications subscription is toggled', () => {
        beforeEach(async () => {
          await waitForElement(findSubscribeButton);
        });

        it('toggles subscription off and back on', async () => {
          await waitFor(() => {
            expect(findSubscribeButton().dataset.subscribed).toBe('true');
          });

          findSubscribeButton().click();

          await waitFor(() => {
            expect(findSubscribeButton().dataset.subscribed).toBe('false');
          });

          findSubscribeButton().click();

          await waitFor(() => {
            expect(findSubscribeButton().dataset.subscribed).toBe('true');
          });
        });
      });

      describe('when dates are changed in the drawer', () => {
        beforeEach(async () => {
          const portalEl = document.getElementById('contextual-panel-portal');

          const datesWidget = await waitForElement(findDatesWidget);
          datesWidget.querySelector('[data-testid="edit-button"]').click();
          await waitFor(() => {
            expect(portalEl.querySelector('#start-date-input')).not.toBe(null);
          });

          const startInput = portalEl.querySelector('#start-date-input');
          const dueInput = portalEl.querySelector('#due-date-input');

          startInput.value = '2025-01-01';
          startInput.dispatchEvent(new Event('change', { bubbles: true }));

          await waitFor(() => {
            expect(startInput.value).toBe('2025-01-01');
          });

          dueInput.value = '2025-12-31';
          dueInput.dispatchEvent(new Event('change', { bubbles: true }));

          await waitFor(() => {
            expect(dueInput.value).toBe('2025-12-31');
          });

          findApplyButton().click();
        });

        it('updates start and due date on the list', async () => {
          await waitFor(() => {
            expect(getText(findStartDateValue())).not.toBe('None');
            expect(getText(findDueDateValue())).not.toBe('None');
            expect(findIssuableDueDate()).not.toBe(null);
          });
        });
      });
    });
  });
});
