import moment from "moment";

// Combined regex for Markdown list bullets (unordered and ordered)
export const LIST_BULLET_REGEX = /^\s*([-*+]|\d+[\.\)])\s+/;
// Combined regex for Markdown task list items (unordered and ordered)
export const LIST_TASK_REGEX = /^\s*([-*+]|\d+[\.\)])\s+\[[^\]]*\]\s/;

// Returns true if the line is a Markdown list item (unordered or ordered)
export function isCursorInListLine(line: string): boolean {
    return LIST_BULLET_REGEX.test(line);
}

// Returns true if the line is a Markdown task list item (unordered or ordered)
export function isListLineTask(line: string): boolean {
    return LIST_TASK_REGEX.test(line);
}

// Returns the position after the list bullet (unordered or ordered), or -1 if not a list line
export function getInsertPositionAfterBullet(line: string): number {
    const bulletMatch = line.match(LIST_BULLET_REGEX);
    if (bulletMatch) {
        return bulletMatch.index! + bulletMatch[0].length;
    }
    return -1;
}

export function getInsertPositionInLineFromText(
  lineText: string,
  addTimestampToListLines: boolean,
  timestampFormat: string,
  isCodeBlockStartEnd: (line: string) => boolean
): number {
  let insertPosition = 0;

  if (isListLineTask(lineText)) {
    return -1;
  }

  if (isCursorInListLine(lineText)) {
    if (addTimestampToListLines) {
      insertPosition = getInsertPositionAfterBullet(lineText);
    } else {
      return -1;
    }
  }

  if (isCodeBlockStartEnd(lineText)) {
    return -1;
  }

  const formattedTimestampLength = moment().format(timestampFormat).length;

  try {
    // Check for timestamp at the correct position (after bullet if present)
    const matchTimeStamp = moment(
      lineText.substring(insertPosition, insertPosition + formattedTimestampLength),
      timestampFormat,
      true
    );
    if (matchTimeStamp.isValid()) {
      return -1;
    }
  } catch {
    return -1;
  }

  return insertPosition;
}
