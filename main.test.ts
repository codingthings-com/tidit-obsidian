import { describe, it, expect } from 'vitest';
// Import regex constants and functions from main.ts
import { LIST_BULLET_REGEX, LIST_TASK_REGEX, isCursorInListLine, isListLineTask, getInsertPositionAfterBullet, getInsertPositionInLineFromText } from './utils';

// Helper: test cases for list bullets
const bulletCases = [
  { line: '- item', match: true },
  { line: '* item', match: true },
  { line: '+ item', match: true },
  { line: '1. item', match: true },
  { line: '2) item', match: true },
  { line: '  3. item', match: true },
  { line: 'no bullet', match: false },
  { line: ' -notalist', match: false },
];

// Helper: test cases for task list items
const taskCases = [
  { line: '- [ ] task', match: true },
  { line: '* [x] done', match: true },
  { line: '+ [custom] custom', match: true },
  { line: '1. [ ] numbered', match: true },
  { line: '2) [x] numbered done', match: true },
  { line: '3. not a task', match: false },
  { line: '- not a task', match: false },
];

describe('LIST_BULLET_REGEX', () => {
  bulletCases.forEach(({ line, match }) => {
    it(`should${match ? '' : ' not'} match: "${line}"`, () => {
      expect(LIST_BULLET_REGEX.test(line)).toBe(match);
    });
  });
});

describe('LIST_TASK_REGEX', () => {
  taskCases.forEach(({ line, match }) => {
    it(`should${match ? '' : ' not'} match: "${line}"`, () => {
      expect(LIST_TASK_REGEX.test(line)).toBe(match);
    });
  });
});

describe('isCursorInListLine', () => {
  it('matches unordered list bullets', () => {
    expect(isCursorInListLine('- item')).toBe(true);
    expect(isCursorInListLine('* item')).toBe(true);
    expect(isCursorInListLine('+ item')).toBe(true);
  });
  it('matches ordered list bullets', () => {
    expect(isCursorInListLine('1. item')).toBe(true);
    expect(isCursorInListLine('2) item')).toBe(true);
    expect(isCursorInListLine('  3. item')).toBe(true);
  });
  it('does not match non-list lines', () => {
    expect(isCursorInListLine('no bullet')).toBe(false);
    expect(isCursorInListLine(' -notalist')).toBe(false);
  });
});

describe('isListLineTask', () => {
  it('matches unordered task list items', () => {
    expect(isListLineTask('- [ ] task')).toBe(true);
    expect(isListLineTask('* [x] done')).toBe(true);
    expect(isListLineTask('+ [custom] custom')).toBe(true);
  });
  it('matches ordered task list items', () => {
    expect(isListLineTask('1. [ ] numbered')).toBe(true);
    expect(isListLineTask('2) [x] numbered done')).toBe(true);
  });
  it('does not match non-task list lines', () => {
    expect(isListLineTask('3. not a task')).toBe(false);
    expect(isListLineTask('- not a task')).toBe(false);
    expect(isListLineTask('plain text')).toBe(false);
  });
});

describe('getInsertPositionAfterBullet', () => {
  it('returns correct position for unordered list bullets', () => {
    expect(getInsertPositionAfterBullet('- item')).toBe(2);
    expect(getInsertPositionAfterBullet('* item')).toBe(2);
    expect(getInsertPositionAfterBullet('+ item')).toBe(2);
  });
  it('returns correct position for ordered list bullets', () => {
    expect(getInsertPositionAfterBullet('1. item')).toBe(3);
    expect(getInsertPositionAfterBullet('2) item')).toBe(3);
    expect(getInsertPositionAfterBullet('  3. item')).toBe(5);
  });
  it('returns -1 for non-list lines', () => {
    expect(getInsertPositionAfterBullet('no bullet')).toBe(-1);
    expect(getInsertPositionAfterBullet(' -notalist')).toBe(-1);
  });
});

describe('getInsertPositionInLineFromText', () => {
  const timestampFormat = 'YYYY-MM-DD HH:mm:ssZ';
  const isCodeBlockStartEnd = (line: string) => line.startsWith('`') || line.endsWith('```');

  it('returns -1 for task list lines', () => {
    expect(getInsertPositionInLineFromText('- [ ] task', true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
    expect(getInsertPositionInLineFromText('1. [x] done', true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
  });

  it('returns correct position for unordered list bullets when addTimestampToListLines is true', () => {
    expect(getInsertPositionInLineFromText('- item', true, timestampFormat, isCodeBlockStartEnd)).toBe(2);
    expect(getInsertPositionInLineFromText('* item', true, timestampFormat, isCodeBlockStartEnd)).toBe(2);
  });

  it('returns correct position for ordered list bullets when addTimestampToListLines is true', () => {
    expect(getInsertPositionInLineFromText('1. item', true, timestampFormat, isCodeBlockStartEnd)).toBe(3);
    expect(getInsertPositionInLineFromText('2) item', true, timestampFormat, isCodeBlockStartEnd)).toBe(3);
  });

  it('returns -1 for list lines when addTimestampToListLines is false', () => {
    expect(getInsertPositionInLineFromText('- item', false, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
    expect(getInsertPositionInLineFromText('1. item', false, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
  });

  it('returns -1 for code block lines', () => {
    expect(getInsertPositionInLineFromText('```', true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
    expect(getInsertPositionInLineFromText('`code', true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
  });

  it('returns 0 for normal lines', () => {
    expect(getInsertPositionInLineFromText('plain text', true, timestampFormat, isCodeBlockStartEnd)).toBe(0);
    expect(getInsertPositionInLineFromText('plain text', false, timestampFormat, isCodeBlockStartEnd)).toBe(0);
  });

  it('returns -1 if line starts with a timestamp', () => {
    const ts = '2025-08-31 12:00:00+00:00';
    expect(getInsertPositionInLineFromText(ts + ' something', true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
  });

  it('returns -1 for list bullet lines that already start with a timestamp', () => {
    const ts = '2025-08-31 12:00:00+00:00';
    expect(getInsertPositionInLineFromText(`- ${ts} something`, true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
    expect(getInsertPositionInLineFromText(`1. ${ts} something`, true, timestampFormat, isCodeBlockStartEnd)).toBe(-1);
  });
});
