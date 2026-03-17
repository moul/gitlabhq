export function getLineNumbers(row) {
  return [
    row.querySelector('[data-position="old"] [data-line-number]'),
    row.querySelector('[data-position="new"] [data-line-number]'),
  ].map((cell) => (cell ? Number(cell.dataset.lineNumber) : null));
}

export function getLineChange(element, position) {
  const cell = position
    ? element.querySelector(`[data-position="${position}"][data-change]`)
    : element.closest('[data-position]');
  return { change: cell.dataset.change, position: cell.dataset.position };
}

function getClosestLineNumber(row, position) {
  let current = row;
  while (current) {
    const el = current.querySelector(`[data-position="${position}"] [data-line-number]`);
    if (el) return Number(el.dataset.lineNumber);
    current = current.nextElementSibling;
  }
  return 0;
}

export function getLineCode({ id, row, oldLine, newLine }) {
  const left = oldLine ?? getClosestLineNumber(row, 'old');
  const right = newLine ?? getClosestLineNumber(row, 'new');
  return `${id}_${left}_${right}`;
}

export function findLineRow(element, oldLine, newLine) {
  return element
    .querySelector(
      `[data-position="${oldLine ? 'old' : 'new'}"] [data-line-number="${oldLine || newLine}"]`,
    )
    .closest('tr');
}
