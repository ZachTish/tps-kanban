const STRUCTURAL_KIND_VALUES = new Set([
  'task',
  'tasks',
  'bullet',
  'bullets',
  'note',
  'notes',
  'all',
  'mixed',
]);

export function isKanbanStructuralKindValue(value: unknown): boolean {
  return STRUCTURAL_KIND_VALUES.has(String(value ?? '').trim().toLowerCase());
}

export function isBareSemanticKindFilter(property: unknown, values: unknown[]): boolean {
  if (String(property ?? '').trim().toLowerCase() !== 'kind') return false;
  const normalized = values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  return normalized.length > 0 && normalized.some((value) => !isKanbanStructuralKindValue(value));
}

export function parseBareSemanticKindExpression(expression: unknown): string | null {
  const raw = String(expression ?? '').trim().replace(/^!+\s*/u, '');
  const match = raw.match(/^kind\s*(?:==|=|!=|!==|is|equals?)\s*(?:"([^"]+)"|'([^']+)'|([^\s].*?))\s*$/i);
  const value = String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  return value && !isKanbanStructuralKindValue(value) ? value : null;
}
