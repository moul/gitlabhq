export default function renderStickyTableHeaders(els) {
  if (!window.gon?.features?.editorStickyTableHeaders) return;

  els.forEach((table) => {
    if (table.closest('[data-sticky-header], .gl-table-shadow, .ProseMirror, .tableWrapper')) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.stickyHeader = '';
    wrapper.classList.add(
      'gl-overflow-x-auto',
      'gl-overflow-y-auto',
      'gl-max-h-[70vh]',
      'print:gl-max-h-none',
      'gl-my-5',
    );
    table.classList.add('!gl-my-0');
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}
