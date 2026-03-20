import { getCoveringElementSync } from '~/lib/utils/viewport';
import { getScrollingElement } from '~/lib/utils/panels';

/**
 * Scrolls the panel so that the provided element is not covered by sticky elements
 *
 * @param {HTMLElement} element Element that should not be covered by sticky elements
 * @param {Number} maxIterations Limit scroll attempts for performance
 */
export const scrollPastCoveringElements = (element, maxIterations = 10) => {
  for (let i = 0; i < maxIterations; i += 1) {
    const coveringElement = getCoveringElementSync(element);
    if (!coveringElement) return;

    const coveringRect = coveringElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scrollAmount = coveringRect.bottom - elementRect.top;

    if (scrollAmount <= 0) return;

    getScrollingElement(element).scrollBy({ top: -scrollAmount, behavior: 'instant' });
  }
};
