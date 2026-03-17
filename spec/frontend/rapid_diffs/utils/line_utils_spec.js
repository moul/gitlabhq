import { setHTMLFixture, resetHTMLFixture } from 'helpers/fixtures';
import {
  getLineNumbers,
  getLineChange,
  getLineCode,
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
    it('returns change info from the closest [data-position] ancestor when no position given', () => {
      setHTMLFixture(`
        <table><tbody><tr>
          <td data-position="old" data-change="removed">
            <button></button>
          </td>
        </tr></tbody></table>
      `);
      const button = document.querySelector('button');
      expect(getLineChange(button)).toEqual({ change: 'removed', position: 'old' });
    });

    it('returns change info from a child cell matching the given position', () => {
      setHTMLFixture(`
        <table><tbody>
          <tr>
            <td data-position="old" data-change="removed"></td>
            <td data-position="new" data-change="added"></td>
          </tr>
        </tbody></table>
      `);
      const row = document.querySelector('tr');
      expect(getLineChange(row, 'new')).toEqual({ change: 'added', position: 'new' });
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
