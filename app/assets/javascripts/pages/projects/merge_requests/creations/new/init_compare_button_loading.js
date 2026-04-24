import { loadingIconForLegacyJS } from '~/loading_icon_for_legacy_js';

/**
 * Adds a loading spinner to the "Compare branches and continue" submit button
 * when the form is submitted. Since this is a Rails form submission, the page
 * navigation or reload handles removing the loading state.
 */
export function initCompareButtonLoading() {
  const form = document.querySelector('.merge-request-form');
  if (!form) return;

  const submitButton = form.querySelector('.js-compare-branches-button');
  if (!submitButton) return;

  form.addEventListener('submit', () => {
    if (submitButton.disabled) return;

    const loader = loadingIconForLegacyJS({
      inline: true,
      size: 'sm',
      classes: ['gl-mr-3'],
    });

    submitButton.setAttribute('disabled', 'disabled');
    submitButton.prepend(loader);
  });
}
