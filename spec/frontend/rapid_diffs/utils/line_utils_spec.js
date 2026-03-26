import { setHTMLFixture, resetHTMLFixture } from 'helpers/fixtures';
import {
  getLineNumbers,
  getLineChange,
  getLineCode,
  getLinePosition,
  getChangeType,
  getRowPosition,
  findLineRow,
} from '~/rapid_diffs/utils/line_utils';

describe('line_utils', () => {
  afterEach(() => {
    resetHTMLFixture();
  });

  describe('getLineNumbers', () => {
    it('returns [oldLine, newLine] from a row', () => {
      setHTMLFixture(`
        <table><tbody>
          <tr>
            <td data-position="old"><a data-line-number="3"></a></td>
            <td data-position="new"><a data-line-number="5"></a></td>
          </tr>
        </tbody></table>
      `);
      const row = document.querySelector('tr');
      expect(getLineNumbers(row)).toEqual([3, 5]);
    });

    it('returns null for a missing side', () => {
      setHTMLFixture(`
        <table><tbody>
          <tr>
            <td data-position="old"><a data-line-number="3"></a></td>
          </tr>
        </tbody></table>
      `);
      const row = document.querySelector('tr');
      expect(getLineNumbers(row)).toEqual([3, null]);
    });
  });

  describe('getLineChange', () => {
    it('returns change and position from a cell element', () => {
      setHTMLFixture(
        `<table><tbody><tr><td data-position="old" data-change="removed"></td></tr></tbody></table>`,
      );
      const cell = document.querySelector('td');
      expect(getLineChange(cell)).toEqual({ change: 'removed', position: 'old' });
    });
  });

  describe('getLineCode', () => {
    it('builds a code from id and explicit line numbers', () => {
      setHTMLFixture('<table><tbody><tr id="target"></tr></tbody></table>');
      const row = document.querySelector('tr');
      expect(getLineCode({ id: 'abc', row, oldLine: 2, newLine: 4 })).toBe('abc_2_4');
    });

    it('walks siblings to find closest line numbers when lines are null', () => {
      setHTMLFixture(`
        <table><tbody>
          <tr id="target"></tr>
          <tr>
            <td data-position="old"><a data-line-number="7"></a></td>
            <td data-position="new"><a data-line-number="9"></a></td>
          </tr>
        </tbody></table>
      `);
      const row = document.querySelector('#target');
      expect(getLineCode({ id: 'x', row, oldLine: null, newLine: null })).toBe('x_7_9');
    });
  });

  describe('getLinePosition', () => {
    beforeEach(() => {
      setHTMLFixture(`
        <table><tbody>
          <tr>
            <td data-position="old"><a data-line-number="3"></a></td>
            <td data-position="new"><a data-line-number="5"></a></td>
          </tr>
        </tbody></table>
      `);
    });

    it('returns both lines when no side given', () => {
      const row = document.querySelector('tr');
      expect(getLinePosition(row, undefined)).toEqual({ old_line: 3, new_line: 5 });
    });

    it('returns only old_line when side is old', () => {
      const row = document.querySelector('tr');
      expect(getLinePosition(row, 'old')).toEqual({ old_line: 3, new_line: null });
    });

    it('returns only new_line when side is new', () => {
      const row = document.querySelector('tr');
      expect(getLinePosition(row, 'new')).toEqual({ old_line: null, new_line: 5 });
    });
  });

  describe('getChangeType', () => {
    it('returns "new" for a row with an added cell', () => {
      setHTMLFixture(`<table><tbody><tr><td data-change="added"></td></tr></tbody></table>`);
      expect(getChangeType(document.querySelector('tr'))).toBe('new');
    });

    it('returns "old" for a row with a removed cell', () => {
      setHTMLFixture(`<table><tbody><tr><td data-change="removed"></td></tr></tbody></table>`);
      expect(getChangeType(document.querySelector('tr'))).toBe('old');
    });

    it('returns null for an unchanged row', () => {
      setHTMLFixture(`<table><tbody><tr><td></td></tr></tbody></table>`);
      expect(getChangeType(document.querySelector('tr'))).toBeNull();
    });

    it('returns type for the given side only when both sides are changed', () => {
      setHTMLFixture(`
        <table><tbody><tr>
          <td data-position="old" data-change="removed"></td>
          <td data-position="new" data-change="added"></td>
        </tr></tbody></table>
      `);
      const row = document.querySelector('tr');
      expect(getChangeType(row, 'old')).toBe('old');
      expect(getChangeType(row, 'new')).toBe('new');
    });

    it('returns null for a side with no change even when the other side is changed', () => {
      setHTMLFixture(`
        <table><tbody><tr>
          <td data-position="old" data-change="removed"></td>
          <td data-position="new"></td>
        </tr></tbody></table>
      `);
      expect(getChangeType(document.querySelector('tr'), 'new')).toBeNull();
    });
  });

  describe('getRowPosition', () => {
    it('returns both line numbers and null type for an unchanged row', () => {
      setHTMLFixture(`
        <table><tbody><tr>
          <td data-position="old"><a data-line-number="3"></a></td>
          <td data-position="new"><a data-line-number="5"></a></td>
        </tr></tbody></table>
      `);
      expect(getRowPosition(document.querySelector('tr'), undefined)).toEqual({
        old_line: 3,
        new_line: 5,
        type: null,
      });
    });

    it('returns only the side line number and type for a changed row', () => {
      setHTMLFixture(`
        <table><tbody><tr>
          <td data-position="old" data-change="removed"><a data-line-number="3"></a></td>
          <td data-position="new" data-change="added"><a data-line-number="5"></a></td>
        </tr></tbody></table>
      `);
      expect(getRowPosition(document.querySelector('tr'), 'old')).toEqual({
        old_line: 3,
        new_line: null,
        type: 'old',
      });
    });
  });

  describe('findLineRow', () => {
    beforeEach(() => {
      setHTMLFixture(`
        <table>
          <tbody>
            <tr id="old-row">
              <td data-position="old"><a data-line-number="3"></a></td>
            </tr>
            <tr id="new-row">
              <td data-position="new"><a data-line-number="5"></a></td>
            </tr>
          </tbody>
        </table>
      `);
    });

    it('finds a row by old line number', () => {
      const table = document.querySelector('table');
      expect(findLineRow(table, 3, null)).toBe(document.querySelector('#old-row'));
    });

    it('finds a row by new line number when oldLine is null', () => {
      const table = document.querySelector('table');
      expect(findLineRow(table, null, 5)).toBe(document.querySelector('#new-row'));
    });
  });
});
