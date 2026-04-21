import { findByTestId } from '../test_helpers';

/**
 * Work item specific test helpers for MSW integration tests.
 * These helpers are specific to work item drawer/panel interactions.
 */

/**
 * Finds an element within the contextual panel portal by data-testid.
 * @param {string} testId - The data-testid value to search for
 * @returns {HTMLElement|null}
 */
export function findInDrawer(testId) {
  const portalEl = document.getElementById('contextual-panel-portal');
  if (!portalEl) return null;
  return findByTestId(testId, portalEl);
}

/**
 * Creates a portal element for testing drawer/modal interactions.
 * Should be called in beforeAll hook.
 * @param {string} [id='contextual-panel-portal'] - The ID for the portal element
 * @returns {HTMLElement}
 */
export function createPortalElement(id = 'contextual-panel-portal') {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const portalEl = document.createElement('div');
  portalEl.id = id;
  document.body.appendChild(portalEl);
  return portalEl;
}
