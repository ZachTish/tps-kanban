export function normalizeKanbanCheckboxState(rawState: string): string {
  const raw = String(rawState ?? '').trim();
  const tokenMatch = raw.match(/^\[([^\]\r\n])\]$/u);
  if (tokenMatch && tokenMatch[1].length === 1) {
    return `[${tokenMatch[1] === 'X' ? 'x' : tokenMatch[1]}]`;
  }
  if (!raw) return '';
  if (raw.length !== 1) return '';
  return `[${raw === 'X' ? 'x' : raw}]`;
}

export function replaceKanbanTaskLineCheckboxState(line: string, checkboxState: string): string {
  const nextState = normalizeKanbanCheckboxState(checkboxState);
  if (!nextState) return String(line ?? '');
  return String(line ?? '').replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+)\[[^\]]*\](\s+)/u,
    `$1${nextState}$2`,
  );
}
