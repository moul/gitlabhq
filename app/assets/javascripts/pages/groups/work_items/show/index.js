import { NAMESPACE_GROUP } from '~/issues/constants';
import { initWorkItemsRoot } from '~/work_items';

(async () => {
  if (gon.features?.vue3MigrateWorkItems) {
    try {
      const { initWorkItemsRoot: initVue3WorkItemsRoot } = await import('~/work_items?vue3');
      initVue3WorkItemsRoot({ namespaceType: NAMESPACE_GROUP });
      return;
    } catch {
      // Fall back to Vue 2 if the Vue 3 bundle fails to load
    }
  }

  initWorkItemsRoot({ namespaceType: NAMESPACE_GROUP });
})();
