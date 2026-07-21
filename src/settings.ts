export type KanbanStyleMatch = 'all' | 'any';
export type KanbanStyleOperator =
  | 'is'
  | '!is'
  | 'contains'
  | '!contains'
  | 'starts'
  | '!starts'
  | 'ends'
  | '!ends'
  | 'exists'
  | '!exists';

export interface KanbanStyleCondition {
  field: string;
  operator: KanbanStyleOperator;
  value: string;
}

export interface KanbanStyleRule {
  id?: string;
  label?: string;
  active?: boolean;
  match?: KanbanStyleMatch;
  conditions: KanbanStyleCondition[];
  color?: string;
  icon?: string;
  textStyle?: string;
}

export const DEFAULT_PRIORITY_CARD_STYLE_RULES: KanbanStyleRule[] = [
  {
    id: 'priority-high',
    label: 'Priority: high',
    active: true,
    match: 'all',
    conditions: [{ field: 'priority', operator: 'is', value: 'high' }],
    color: '#ef4444',
  },
  {
    id: 'priority-medium',
    label: 'Priority: medium',
    active: true,
    match: 'all',
    conditions: [{ field: 'priority', operator: 'is', value: 'medium' }],
    color: '#eab308',
  },
  {
    id: 'priority-low',
    label: 'Priority: low',
    active: true,
    match: 'all',
    conditions: [{ field: 'priority', operator: 'is', value: 'low' }],
    color: '#6b7280',
  },
  {
    id: 'priority-normal',
    label: 'Priority: normal',
    active: true,
    match: 'all',
    conditions: [{ field: 'priority', operator: 'is', value: 'normal' }],
    color: '#3b82f6',
  },
  {
    id: 'priority-default',
    label: 'Default',
    active: true,
    match: 'all',
    conditions: [{ field: 'priority', operator: '!exists', value: '' }],
    color: '#3b82f6',
  },
];

export interface KanbanSettings {
  /** Enable concise development logs in the developer console */
  enableLogging: boolean;
  /** Frontmatter key that holds a Lucide icon name (e.g. "icon") */
  iconKey: string;
  /** Frontmatter key that holds a CSS color value (e.g. "color") */
  colorKey: string;
  /** Where frontmatter color should apply */
  frontmatterColorTarget: "card" | "icon" | "both" | "off";
  /** Rules that map arbitrary frontmatter values to visual card styling */
  cardStyleRules: KanbanStyleRule[];
  /** Where to render the ungrouped lane relative to keyed lanes */
  ungroupedPosition: 'first' | 'last';
  /** Persisted manual lane order keyed by "<basePath>::<viewName>" */
  laneOrderByView: Record<string, string[]>;
  /** Global visual scale for the kanban board */
  scale: number;
  /** Per-view layout mode: board (columns) or list (stacked lanes) */
  layoutModeByView: Record<string, 'board' | 'list'>;
  /** Per-view completed task visibility */
  showCompletedTasksByView: Record<string, boolean>;
  /** In board mode, shrink empty lanes to a narrower width */
  dynamicEmptyLaneWidth: boolean;
  /** Per-view lane label overrides keyed by lane id */
  laneLabelAliasesByView: Record<string, Record<string, string>>;
  /** What a normal card click should do */
  cardActivationMode: 'preview' | 'open';
  /** What the card add button should create */
  cardAddButtonDefault: 'note' | 'task';
  /** Default note path for root task creation when no task.path filter is present */
  defaultRootTaskPath: string;
  /** Open the note that receives a newly created root task */
  openTaskDestinationAfterCreate: boolean;
  /** How many open body tasks to show on each card */
  openTaskPreviewLimit: number;
  /** Show an overflow row when a card has more open tasks than the preview limit */
  showTaskOverflowCount: boolean;
}

export const DEFAULT_SETTINGS: KanbanSettings = {
  enableLogging: false,
  iconKey: 'icon',
  colorKey: 'color',
  frontmatterColorTarget: 'card',
  cardStyleRules: DEFAULT_PRIORITY_CARD_STYLE_RULES,
  ungroupedPosition: 'last',
  laneOrderByView: {},
  scale: 1,
  layoutModeByView: {},
  showCompletedTasksByView: {},
  dynamicEmptyLaneWidth: false,
  laneLabelAliasesByView: {},
  cardActivationMode: 'open',
  cardAddButtonDefault: 'note',
  defaultRootTaskPath: '',
  openTaskDestinationAfterCreate: true,
  openTaskPreviewLimit: 5,
  showTaskOverflowCount: true,
};

export function normalizeFrontmatterColorTarget(value: unknown): KanbanSettings['frontmatterColorTarget'] {
  return value === 'card' || value === 'icon' || value === 'both' || value === 'off'
    ? value
    : DEFAULT_SETTINGS.frontmatterColorTarget;
}

export function normalizeCardStyleRules(value: unknown): KanbanStyleRule[] {
  const stored = Array.isArray(value) ? value : DEFAULT_SETTINGS.cardStyleRules;
  return stored
    .filter((rule: any) => rule && typeof rule === 'object')
    .map((rule: any) => ({
      id: typeof rule.id === 'string' ? rule.id : undefined,
      label: typeof rule.label === 'string' ? rule.label : '',
      active: rule.active !== false,
      match: rule.match === 'any' ? 'any' : 'all',
      conditions: Array.isArray(rule.conditions) && rule.conditions.length
        ? rule.conditions.map((condition: any) => ({
          field: typeof condition?.field === 'string' && condition.field.trim() ? condition.field.trim() : 'status',
          operator: ['is', '!is', 'contains', '!contains', 'starts', '!starts', 'ends', '!ends', 'exists', '!exists'].includes(condition?.operator)
            ? condition.operator
            : 'is',
          value: condition?.value == null ? '' : String(condition.value),
        }))
        : [{ field: 'status', operator: 'is', value: '' }],
      color: typeof rule.color === 'string' ? rule.color : '',
      icon: typeof rule.icon === 'string' ? rule.icon : '',
      textStyle: typeof rule.textStyle === 'string' ? rule.textStyle : '',
    }));
}
