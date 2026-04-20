import { waitFor } from '@testing-library/dom';
import { mount } from '@vue/test-utils';

export const assignRouter = (routerFn, args) => {
  const router = routerFn(args);

  // We inject the router metadata globally so that our test setup can
  // pick it up and do the router setup and cleanup
  global.metadata.router = router;
  return router;
};

export const fullMount = (component, params) => {
  return mount(component, { attachTo: document.body, ...params });
};

export const waitForElement = (finder) =>
  waitFor(() => {
    const element = finder();
    expect(element).not.toBe(null);
    return element;
  });

/**
 * Returns the text content of a DOM element with normalized whitespace.
 * Equivalent to VTU's `.text()` method — collapses all whitespace runs
 * into a single space and trims leading/trailing whitespace.
 * @param {HTMLElement} el
 * @returns {string}
 */
export function getText(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}
