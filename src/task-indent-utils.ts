export function getMarkdownIndentColumns(line: string): number {
  const leadingWhitespace = String(line ?? '').match(/^[\t ]*/u)?.[0] ?? '';
  let columns = 0;
  for (const character of leadingWhitespace) {
    columns = character === '\t' ? columns + (4 - (columns % 4)) : columns + 1;
  }
  return columns;
}
