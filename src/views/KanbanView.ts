
import { BasesView, QueryController, Menu, BasesEntry, BasesEntryGroup, setIcon, TFile, debounce, normalizePath, Modal, Setting, getAllTags, WorkspaceLeaf, parseYaml, Notice, Platform } from 'obsidian';
import type { KanbanStyleCondition, KanbanStyleRule } from '../settings';
import { openNativeNotePreview } from '../preview';
import {
  extractGroupValues as extractKanbanGroupValues,
  getFrontmatterPropNameFromId as getKanbanFrontmatterPropNameFromId,
} from '../kanban-utils';
import {
  buildKanbanRootTaskLine,
  normalizeKanbanTaskTargetPath,
  resolveKanbanLaneAddPresentation,
  resolveKanbanRootTaskTargetPath,
} from '../task-creation-utils';
import {
  getKanbanCheckboxStateForStatus,
  getKanbanStatusForCheckboxState,
  getKanbanToggleCheckboxState,
  normalizeKanbanCheckboxState,
  replaceKanbanTaskLineCheckboxState,
} from '../task-checkbox-utils';
import {
  applyKanbanTaskDropPlan,
  buildKanbanTaskDropLine,
  normalizeKanbanWritableTaskTag,
  parseKanbanLineItem,
} from '../task-drop-utils';
import { emitFilesUpdated, shouldForceBaseLinkPreview } from '../tps-gcm-api';
import { flow, flowError, flowWarn } from '../logger';
import { isBareSemanticKindFilter, parseBareSemanticKindExpression } from '../filter-kind-utils';
import { composeEffectiveFilterRoots, extractPersistedFilterRoots } from '../base-filter-roots';
import { getMarkdownIndentColumns } from '../task-indent-utils';

export const KANBAN_VIEW_TYPE = 'tps-kanban';

type LaneRenderItem = {
  entry: BasesEntry;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  children: LaneRenderItem[];
};

type TaskRenderItem = {
  file: TFile;
  task: OpenTaskSubitem;
  laneId: string;
};

type TpsSortDescriptor = {
  prop: string;
  direction: 'asc' | 'desc';
};

type TaskPropertyDisplay = {
  text: string;
  title?: string;
  kind?: string;
  editable?: boolean;
  propName?: string;
  rawValue?: string;
};

type ActiveTaskPointerDrag = {
  pointerId: number;
  itemKind?: 'task' | 'bullet';
  path: string;
  line: number;
  rawLine?: string;
  checkboxState?: string;
  text?: string;
  sourceLaneValues: string[];
  propName: string | null;
  displayLane: DisplayLaneGroup;
  startX: number;
  startY: number;
  moved: boolean;
  cardEl: HTMLElement;
};

type KanbanRenderScrollState = {
  top: number;
  left: number;
  laneCards: Record<string, number>;
};

type KanbanTaskRootFilter = {
  mode: 'mixed' | 'notes' | 'tasks' | 'bullets';
  hasTaskDirective: boolean;
  includeDone: boolean;
  statuses: Set<string>;
  excludeStatuses: Set<string>;
  tags: Set<string>;
  excludeTags: Set<string>;
};

type DisplayLaneGroup = {
  id: string;
  label: string;
  groups: BasesEntryGroup[];
  laneIds: string[];
};

type OpenTaskSubitem = {
  itemKind?: 'task' | 'bullet';
  internalId?: string;
  line: number;
  indent?: number;
  parentLine?: number;
  checkboxState?: string;
  text: string;
  displayText?: string;
  inlineFields?: Array<{ key: string; value: string }>;
};

type TaskDropPayload = {
  itemKind?: 'task' | 'bullet';
  path?: string;
  line?: number;
  rawLine?: string;
  checkboxState?: string;
  text?: string;
  sourceLaneValues?: string[];
};

type TaskDropPlan = {
  changes: string[];
  filterTags: string[];
  filterStatus: string | null;
  currentContent: string;
  currentLine: string;
  nextLine: string;
  itemKind: 'task' | 'bullet';
};

type TaskCreationDefaults = {
  mode?: 'mixed' | 'notes' | 'tasks' | 'bullets';
  includeDone?: boolean;
  status?: string | null;
  targetPath?: string | null;
  inlineFields: Map<string, { key: string; value: string }>;
  tags: Set<string>;
  excludedStatuses: Set<string>;
  excludedTags: Set<string>;
};

type NoteCreationDefaults = {
  frontmatter: Record<string, unknown>;
  baseFileName?: string | null;
  blockedReason?: string | null;
};

const TPS_TASK_LINE_MIME = 'application/x-tps-task-line';
const KANBAN_TASK_MIME = 'application/x-kanban-task';
const TPS_TASK_LINE_POINTER_DROP_EVENT = 'tps-task-line-pointer-drop';

const MOBILE_UI_KEYBOARD_HIDDEN_CLASS = 'tps-tps-mobile-ui-keyboard-hidden';
const MOBILE_UI_GESTURE_HIDDEN_CLASS = 'tps-tps-mobile-ui-gesture-hidden';
const MOBILE_KEYBOARD_COLLAPSE_THRESHOLD_PX = 140;

const FALLBACK_ICON_PATHS: Record<string, string[]> = {
  plus: ['M12 5v14', 'M5 12h14'],
  pencil: ['M18 2l4 4L8 20l-5 1 1-5L18 2z'],
  columns: ['M4 5h16v14H4z', 'M12 5v14'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  'panel-left-close': ['M4 5h16v14H4z', 'M9 5v14', 'M15 9l-3 3 3 3'],
  'panel-left-open': ['M4 5h16v14H4z', 'M9 5v14', 'M12 9l3 3-3 3'],
  'eye-off': ['M3 3l18 18', 'M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 5 9 5a16 16 0 0 1-3.1 3.8', 'M6.6 6.6C4.3 8.1 3 10 3 10s4 5 9 5c1.1 0 2.1-.2 3-.5'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'grip-vertical': ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  square: ['M5 5h14v14H5z'],
  'square-check-big': ['M5 5h14v14H5z', 'M9 12l2 2 4-5'],
  'square-minus': ['M5 5h14v14H5z', 'M9 12h6'],
  'square-play': ['M5 5h14v14H5z', 'M10 8l6 4-6 4z'],
  'square-help': ['M5 5h14v14H5z', 'M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4', 'M12 17h.01'],
  'square-dot': ['M5 5h14v14H5z', 'M12 12h.01'],
};

function setIconWithFallback(el: HTMLElement, iconId: string): void {
  el.empty();
  try {
    setIcon(el, iconId);
  } catch {
    // Fall back below.
  }
  if (el.querySelector('svg')) return;

  const paths = FALLBACK_ICON_PATHS[iconId];
  if (!paths) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  el.appendChild(svg);
}

class LaneRenameModal extends Modal {
  private resolve: (value: string | null) => void;
  private submitted = false;
  private inputEl: HTMLInputElement | null = null;
  private readonly baseLabel: string;
  private readonly currentLabel: string;

  constructor(app: any, baseLabel: string, currentLabel: string, resolve: (value: string | null) => void) {
    super(app);
    this.baseLabel = baseLabel;
    this.currentLabel = currentLabel;
    this.resolve = resolve;
  }

  onOpen(): void {
    this.modalEl.addClass("tps-keyboard-aware-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: `Rename lane: ${this.baseLabel}` });

    new Setting(contentEl)
      .setName('Display label')
      .setDesc('Leave empty to reset to the original lane value.')
      .addText((text) => {
        text.setValue(this.currentLabel || this.baseLabel);
        this.inputEl = text.inputEl;
        text.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            this.submit();
          } else if (evt.key === 'Escape') {
            evt.preventDefault();
            this.cancel();
          }
        });
      });

    const actions = contentEl.createDiv({ cls: 'tps-kanban-lane-rename-actions' });
    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.cancel());
    const saveBtn = actions.createEl('button', { text: 'Save', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => this.submit());

    window.setTimeout(() => {
      this.inputEl?.focus();
      this.inputEl?.select();
    }, 0);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) {
      this.resolve(null);
    }
  }

  private submit(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.resolve(String(this.inputEl?.value ?? '').trim());
    this.close();
  }

  private cancel(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.resolve(null);
    this.close();
  }
}

class TaskDropConfirmModal extends Modal {
  private resolved = false;

  constructor(
    app: any,
    private readonly title: string,
    private readonly changes: string[],
    private readonly onResolve: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("tps-keyboard-aware-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: this.title });
    contentEl.createEl('p', {
      text: 'This will update the task line itself, not any note linked from the task title.',
    });
    const currentLine = this.changes.find((change) => change.startsWith('Current line: '));
    const resultLine = this.changes.find((change) => change.startsWith('Result line: '));
    if (currentLine || resultLine) {
      const preview = contentEl.createDiv({ cls: 'tps-kanban-task-drop-preview' });
      if (currentLine) {
        preview.createEl('div', { cls: 'tps-kanban-task-drop-preview-label', text: 'Current line' });
        preview.createEl('code', { cls: 'tps-kanban-task-drop-preview-line', text: currentLine.replace(/^Current line:\s*/u, '') });
      }
      if (resultLine) {
        preview.createEl('div', { cls: 'tps-kanban-task-drop-preview-label', text: 'Result line' });
        preview.createEl('code', { cls: 'tps-kanban-task-drop-preview-line', text: resultLine.replace(/^Result line:\s*/u, '') });
      }
    }
    const list = contentEl.createEl('ul');
    for (const change of this.changes.filter((item) => !/^(?:Current|Result) line: /u.test(item))) {
      list.createEl('li', { text: change });
    }
    const buttonRow = contentEl.createDiv({ cls: 'tps-kanban-confirm-buttons' });
    buttonRow.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.finish(false));
    buttonRow.createEl('button', { text: 'Apply changes', cls: 'mod-cta' }).addEventListener('click', () => this.finish(true));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) this.onResolve(false);
  }

  private finish(confirmed: boolean): void {
    this.resolved = true;
    this.close();
    this.onResolve(confirmed);
  }
}

class LaneValueSelectModal extends Modal {
  private readonly titleText: string;
  private readonly options: Array<{ label: string; value: string | null }>;
  private readonly resolve: (value: string | null | undefined) => void;
  private submitted = false;

  constructor(
    app: any,
    titleText: string,
    options: Array<{ label: string; value: string | null }>,
    resolve: (value: string | null | undefined) => void,
  ) {
    super(app);
    this.titleText = titleText;
    this.options = options;
    this.resolve = resolve;
  }

  onOpen(): void {
    this.modalEl.addClass("tps-keyboard-aware-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: this.titleText });
    contentEl.createEl('p', { text: 'Choose which underlying value to apply:' });

    const list = contentEl.createDiv({ cls: 'tps-kanban-lane-value-picker' });
    this.options.forEach((option) => {
      const button = list.createEl('button', {
        cls: 'mod-cta',
        text: option.label,
      });
      button.addEventListener('click', () => this.submit(option.value));
    });

    const cancel = contentEl.createEl('button', { text: 'Cancel' });
    cancel.addEventListener('click', () => this.cancel());
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) this.resolve(undefined);
  }

  private submit(value: string | null): void {
    if (this.submitted) return;
    this.submitted = true;
    this.resolve(value);
    this.close();
  }

  private cancel(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.resolve(undefined);
    this.close();
  }
}

class TaskTitleModal extends Modal {
  private submitted = false;
  private inputEl: HTMLInputElement | null = null;

  constructor(
    app: any,
    private readonly cardTitle: string,
    private readonly resolve: (value: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("tps-keyboard-aware-modal");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: `Add task to ${this.cardTitle}` });

    new Setting(contentEl)
      .setName('Task title')
      .addText((text) => {
        this.inputEl = text.inputEl;
        text.setPlaceholder('Task title');
        text.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            this.submit();
          } else if (evt.key === 'Escape') {
            evt.preventDefault();
            this.cancel();
          }
        });
      });

    const actions = contentEl.createDiv({ cls: 'tps-kanban-lane-rename-actions' });
    actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.cancel());
    actions.createEl('button', { text: 'Add task', cls: 'mod-cta' }).addEventListener('click', () => this.submit());

    window.setTimeout(() => this.inputEl?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) this.resolve(null);
  }

  private submit(): void {
    if (this.submitted) return;
    const value = String(this.inputEl?.value ?? '').trim();
    if (!value) return;
    this.submitted = true;
    this.resolve(value);
    this.close();
  }

  private cancel(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.resolve(null);
    this.close();
  }
}

export class KanbanView extends BasesView {
  type = KANBAN_VIEW_TYPE;
  private plugin: any;
  private scrollEl: HTMLElement;
  private containerEl: HTMLElement;
  private refreshDebounced: () => void;
  private selectedPaths = new Set<string>();
  private activeNotePath: string | null = null;
  private selectionAnchorPath: string | null = null;
  private renderedFileOrder: string[] = [];
  private renderedTaskItemCount = 0;
  private renderedResultCount = 0;
  private hasRenderedResultCount = false;
  private expandedSubtreePaths = new Set<string>();
  private collapsedListLaneIds = new Set<string>();
  private openTasksByPath = new Map<string, OpenTaskSubitem[]>();
  private allTasksByPath = new Map<string, OpenTaskSubitem[]>();
  private openTaskOverflowByPath = new Map<string, number>();
  private openTasksLoading = new Set<string>();
  private baseFileFilterCache: { path: string; mtime: number; viewName: string; viewNames: string[]; filters: unknown[] | null } | null = null;
  private baseFileFiltersLoadingKey: string | null = null;
  private embeddedBaseFilterCache: { path: string; mtime: number; viewName: string; filters: unknown[] | null } | null = null;
  private embeddedBaseFiltersLoadingKey: string | null = null;
  private baseFilterSignature = '';
  private baseFilterPollInterval: ReturnType<typeof window.setInterval> | null = null;
  private renderGeneration = 0;
  private wheelHandlerTarget: HTMLElement | null = null;
  private onWheelBound: ((event: WheelEvent) => void) | null = null;
  private touchHandlerTarget: HTMLElement | null = null;
  private onTouchStartBound: ((event: TouchEvent) => void) | null = null;
  private onTouchMoveBound: ((event: TouchEvent) => void) | null = null;
  private onTouchEndBound: ((event: TouchEvent) => void) | null = null;
  private mobileKeyboardSuppressed = false;
  private mobileGestureSuppressed = false;
  private mobileKeyboardResizeBaseHeight = 0;
  private mobileKeyboardTimeout: ReturnType<typeof setTimeout> | null = null;
  private mobileGestureRevealTimeout: ReturnType<typeof setTimeout> | null = null;
  private activeTaskPointerDrag: ActiveTaskPointerDrag | null = null;
  private suppressTaskCardClickUntil = 0;
  private touchScrollState: {
    startX: number;
    startY: number;
    startBoardScrollLeft: number;
    laneCards: HTMLElement | null;
    axis: 'horizontal' | 'vertical' | null;
  } | null = null;

  constructor(controller: QueryController, scrollEl: HTMLElement, plugin: any) {
    super(controller);
    this.plugin = plugin;
    this.scrollEl = scrollEl;
    scrollEl.addClass('tps-kanban-scroll');
    this.containerEl = scrollEl.createDiv({ cls: 'tps-kanban-container' });
    this.refreshDebounced = debounce(() => this.render(), 120, false);
    this.applyLayoutSettings();
  }

  async createFileForView(
    baseFileName?: string,
    frontmatterProcessor?: (frontmatter: Record<string, unknown>) => void,
  ): Promise<void> {
    if (this.runCreateCommandOverride()) return;
    const taskFilter = this.getTaskRootFilterFromBaseFilters();
    flow('CreateFile', 'start', {
      baseFileName: baseFileName || '',
      taskFilterMode: taskFilter.mode,
      viewType: this.type,
      viewName: this.getConfiguredBaseViewName(),
    });
    if (this.getPriorityResolvedCreationMode(taskFilter) === 'tasks') {
      flow('CreateFile', 'route-root-task', {
        reason: 'task-filter-mode',
        viewName: this.getConfiguredBaseViewName(),
      });
      await this.createRootTaskForLane(null, { id: 'ungrouped', label: 'Ungrouped', groups: [], laneIds: ['ungrouped'] }, taskFilter);
      return;
    }

    const creationDefaults = this.getNoteCreationDefaultsFromBaseFilters();
    if (!baseFileName && creationDefaults.blockedReason) {
      flowWarn('CreateFile', 'blocked', { reason: creationDefaults.blockedReason });
      new Notice(creationDefaults.blockedReason);
      return;
    }
    const mergedProcessor = (frontmatter: Record<string, unknown>) => {
      Object.assign(frontmatter, creationDefaults.frontmatter);
      frontmatterProcessor?.(frontmatter);
    };
    flow('CreateFile', 'route-note', {
      baseFileName: baseFileName ?? creationDefaults.baseFileName ?? '',
      defaultKeys: Object.keys(creationDefaults.frontmatter || {}),
    });
    await super.createFileForView(baseFileName ?? creationDefaults.baseFileName ?? undefined, mergedProcessor);
  }

  private resolveCardAddMode(taskFilter: KanbanTaskRootFilter = this.getTaskRootFilterFromBaseFilters()): 'note' | 'task' {
    const priorityMode = this.getPriorityResolvedCreationMode(taskFilter);
    const forcedMode = priorityMode === 'tasks'
      ? 'task'
      : priorityMode === 'notes'
        ? 'note'
        : null;
    return forcedMode ?? (this.plugin.settings?.cardAddButtonDefault ?? 'note');
  }

  private getPriorityResolvedCreationMode(taskFilter: KanbanTaskRootFilter): TaskCreationDefaults['mode'] {
    for (const root of this.getBaseFilterRoots()) {
      const mode = this.inferPriorityCreationModeFromFilterNode(root);
      if (mode) return mode;
    }
    return taskFilter.mode;
  }

  private inferPriorityCreationModeFromFilterNode(node: unknown): TaskCreationDefaults['mode'] | null {
    if (!node) return null;
    if (typeof node === 'string') {
      if (parseBareSemanticKindExpression(node)) return 'notes';
      const match = node.trim().match(/^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=|is|equals?)\s*["']?(task|tasks|bullet|bullets|note|notes|all|mixed)["']?$/i);
      const value = String(match?.[1] || '').toLowerCase();
      return value.startsWith('task') ? 'tasks'
        : value.startsWith('bullet') ? 'bullets'
          : value.startsWith('note') ? 'notes'
            : value ? 'mixed' : null;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        const mode = this.inferPriorityCreationModeFromFilterNode(child);
        if (mode) return mode;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    const record = node as Record<string, unknown>;
    for (const branchKey of ['or', 'any']) {
      if (!Object.prototype.hasOwnProperty.call(record, branchKey)) continue;
      for (const child of this.asArray(record[branchKey])) {
        const mode = this.inferPriorityCreationModeFromFilterNode(child);
        if (mode) return mode;
      }
      return null;
    }
    for (const groupKey of ['and', 'all', 'filters', 'children', 'data']) {
      if (!Object.prototype.hasOwnProperty.call(record, groupKey)) continue;
      const mode = this.inferPriorityCreationModeFromFilterNode(record[groupKey]);
      if (mode) return mode;
    }
    const propRaw = String(record.property ?? record.field ?? '').trim();
    const values = this.readFilterObjectValues(record);
    if (isBareSemanticKindFilter(propRaw, values)) return 'notes';
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^(?:tps|kanban)\./i, ''));
    if (!['itemtype', 'itemkind', 'kind'].includes(normalizedProp)) return null;
    const value = String(values[0] || '').trim().toLowerCase();
    return value.startsWith('task') ? 'tasks'
      : value.startsWith('bullet') ? 'bullets'
        : value.startsWith('note') ? 'notes'
          : ['all', 'mixed'].includes(value) ? 'mixed' : null;
  }

  private getCreateCommandOverride(): { id: string; name: string } | null {
    const rawAction = this.getConfigValue('createAction') ?? (this.getConfigValue('create') as any)?.action;
    if (String(rawAction || '').trim().toLowerCase() !== 'command') return null;
    const commandId = String(this.getConfigValue('createCommandId') ?? (this.getConfigValue('create') as any)?.commandId ?? '').trim();
    if (!commandId) return null;
    const commands = (this.app as any)?.commands;
    const command = commands?.findCommand?.(commandId);
    return { id: commandId, name: String(command?.name || commandId) };
  }

  private getConfigValue(key: string): unknown {
    const getterValue = this.config?.get?.(key);
    if (getterValue != null) return getterValue;
    return (this.config as any)?.[key];
  }

  private runCreateCommandOverride(): boolean {
    const command = this.getCreateCommandOverride();
    if (!command) return false;
    const commands = (this.app as any)?.commands;
    if (typeof commands?.executeCommandById !== 'function') return false;
    const executed = commands.executeCommandById(command.id);
    if (!executed) new Notice(`Command not found: ${command.id}`);
    flow('CreateCommandOverride', 'run', {
      commandId: command.id,
      executed: !!executed,
      viewType: this.type,
      viewName: this.getConfiguredBaseViewName(),
    });
    return true;
  }

  private getGcmApi(): any {
    return this.getGcmPlugin()?.api || this.getGcmPlugin() || null;
  }

  private getGcmPlugin(): any {
    if (this.plugin?.gcmPlugin) return this.plugin.gcmPlugin;
    const plugins = (this.app as any)?.plugins;
    return (
      plugins?.getPlugin?.('tps-global-context-menu') ||
      plugins?.plugins?.['tps-global-context-menu'] ||
      plugins?.getPlugin?.('TPS-Global-Context-Menu (Dev)') ||
      plugins?.plugins?.['TPS-Global-Context-Menu (Dev)'] ||
      null
    );
  }

  private getGcmServices(): any {
    const gcm = this.getGcmApi();
    return gcm?.services || gcm?.sharedServices || null;
  }

  private openTaskLineContextMenu(evt: MouseEvent, fallbackPath?: string | null, fallbackLine?: number | null): boolean {
    const plugin = this.getGcmPlugin();
    const contextTargetService = plugin?.contextTargetService || this.getGcmApi()?.contextTargetService;
    const taskLineContextMenuService = plugin?.taskLineContextMenuService || this.getGcmApi()?.taskLineContextMenuService;
    if (typeof taskLineContextMenuService?.handleContextMenu !== 'function') {
      return false;
    }

    if (!evt) {
      return false;
    }

    const rawTarget = evt.target instanceof HTMLElement
      ? evt.target
      : evt.currentTarget instanceof HTMLElement
        ? evt.currentTarget
        : null;

    const rootTarget = rawTarget
      ? rawTarget.closest<HTMLElement>([
          '.tps-kanban-card-task[data-task-path][data-task-line]',
          '.tps-kanban-task-card[data-task-path][data-task-line]',
          '[data-task-path][data-task-line][data-tps-gcm-context="kanban-task"]',
          '[data-tps-gcm-context="kanban-task"]',
        ].join(', '))
      : null;

    if (typeof contextTargetService?.recordContextTarget === 'function') {
      if (rootTarget) {
        contextTargetService.recordContextTarget(rootTarget);
      } else if (typeof fallbackLine === 'number' && fallbackPath) {
        const line = Number(fallbackLine);
        const expectedLine = String(Math.max(1, Math.floor(line) + 1));
        const escapedPath = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
          ? CSS.escape(fallbackPath)
          : fallbackPath.replace(/"/g, '\\"');
        const selector = [
          `.tps-kanban-card-task[data-task-path="${escapedPath}"][data-task-line="${expectedLine}"]`,
          `.tps-kanban-task-card[data-task-path="${escapedPath}"][data-task-line="${expectedLine}"]`,
          `[data-task-path="${escapedPath}"][data-task-line="${expectedLine}"][data-tps-gcm-context="kanban-task"]`,
          `[data-task-path="${escapedPath}"][data-task-line="${expectedLine}"]`,
        ].join(', ');
        const fallbackTarget = this.containerEl.querySelector<HTMLElement>(selector);
        if (fallbackTarget) {
          contextTargetService.recordContextTarget(fallbackTarget);
        }
      }
    }

    return taskLineContextMenuService.handleContextMenu(evt);
  }

  private openTaskQuickEditor(event: Event, taskEl: HTMLElement, sourceEl: HTMLElement | null = taskEl): boolean {
    const plugin = this.getGcmPlugin();
    const service = plugin?.taskLineContextMenuService || this.getGcmApi()?.taskLineContextMenuService;
    if (typeof service?.openQuickEditorForElement !== 'function') return false;
    event.preventDefault();
    event.stopPropagation();
    if ('stopImmediatePropagation' in event && typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    void service.openQuickEditorForElement(taskEl, sourceEl);
    return true;
  }

  private getGcmSettings(): any {
    const plugin = this.getGcmPlugin();
    return plugin?.settings || this.getGcmApi()?.settings || null;
  }

  private recordGcmContextTarget(target: EventTarget | null): void {
    const targetEl = target instanceof HTMLElement ? target : null;
    if (!targetEl) return;
    const plugin = this.getGcmPlugin();
    const service = plugin?.contextTargetService || this.getGcmApi()?.contextTargetService;
    if (typeof service?.recordContextTarget === 'function') {
      service.recordContextTarget(targetEl);
    }
  }

  private getDefaultCheckboxMappings(): Array<{ checkboxState: string; statuses: string[]; toggleTargetStatus?: string; icon?: string; label?: string }> {
    return [
      { checkboxState: '[ ]', statuses: ['todo'], toggleTargetStatus: 'complete', icon: 'square', label: 'Todo' },
      { checkboxState: '[x]', statuses: ['complete'], toggleTargetStatus: 'todo', icon: 'check', label: 'Complete' },
      { checkboxState: '[\\]', statuses: ['working'], toggleTargetStatus: 'complete', icon: 'slash', label: 'Working' },
      { checkboxState: '[?]', statuses: ['holding'], toggleTargetStatus: 'todo', icon: 'help-circle', label: 'Holding' },
      { checkboxState: '[-]', statuses: ['wont-do'], toggleTargetStatus: 'todo', icon: 'minus', label: 'Wont do' },
    ];
  }

  private getGcmCheckboxMappings(): Array<{ checkboxState: string; statuses: string[]; toggleTargetStatus?: string; icon?: string; label?: string }> {
    const configured = this.getGcmSettings()?.linkedSubitemCheckboxMappings;
    const source = Array.isArray(configured) && configured.length > 0
      ? configured
      : this.getDefaultCheckboxMappings();
    return source
      .map((entry: any) => ({
        checkboxState: this.normalizeCheckboxState(String(entry?.checkboxState || '[ ]')),
        statuses: Array.isArray(entry?.statuses)
          ? entry.statuses.map((status: unknown) => String(status ?? '').trim().toLowerCase()).filter(Boolean)
          : [],
        toggleTargetStatus: String(entry?.toggleTargetStatus || '').trim() || undefined,
        icon: String(entry?.icon || '').trim() || undefined,
        label: String(entry?.label || '').trim() || undefined,
      }))
      .filter((entry) => entry.checkboxState && entry.statuses.length > 0);
  }

  private normalizeCheckboxState(rawState: string): string {
    return normalizeKanbanCheckboxState(rawState);
  }

  private getStatusForCheckboxState(rawState: string): string {
    return getKanbanStatusForCheckboxState(rawState, this.getGcmCheckboxMappings());
  }

  private getLaneIdForStatus(status: string | null): string {
    const normalized = String(status ?? '').trim().toLowerCase();
    return normalized ? `key:${normalized}` : 'ungrouped';
  }

  private getCheckboxStateForStatus(rawStatus: string | null): string | null {
    return getKanbanCheckboxStateForStatus(rawStatus, this.getGcmCheckboxMappings());
  }

  private getToggleCheckboxStateForTask(task: OpenTaskSubitem): string {
    return getKanbanToggleCheckboxState(task.checkboxState || '[ ]', this.getGcmCheckboxMappings(), this.getDoneStatuses());
  }

  private async ensureParentSelfLink(parentFile: TFile): Promise<void> {
    const parentsApi = this.getGcmServices()?.parents;
    if (typeof parentsApi?.ensureSelfLinkForParent === 'function') {
      await parentsApi.ensureSelfLinkForParent(parentFile);
    }
  }

  private openCardPreview(event: MouseEvent | PointerEvent, targetEl: HTMLElement, file: TFile): void {
    const sourcePath = this.getBaseSourcePath() ?? file.path;
    window.setTimeout(() => {
      const hoverParent = this.app.workspace.activeLeaf || this.app.workspace.getMostRecentLeaf() || this;
      openNativeNotePreview(this.app, event, targetEl, file, hoverParent, sourcePath);
    }, 80);
  }

  private shouldPreviewCardClicks(): boolean {
    return shouldForceBaseLinkPreview(this.app);
  }

  private getBaseSourcePath(): string | null {
    const directFile = this.getRuntimeBaseFile();
    if (directFile) return directFile.path;

    const activeFile = this.app.workspace.getActiveFile?.();
    if (this.isEmbeddedKanbanContext() && activeFile instanceof TFile && activeFile.extension === 'md') {
      return activeFile.path;
    }

    const embeddedMarkdownContext = this.getWorkspaceLeafMarkdownContextPath();
    if (embeddedMarkdownContext) return embeddedMarkdownContext;

    const controller: any = (this as any)?.controller;
    const queryController: any = (this as any)?.queryController;
    const sourcePath = [
      controller?.file?.path,
      controller?.baseFile?.path,
      controller?.source?.path,
      queryController?.query?.file?.path,
      queryController?.currentFile?.path,
      (this as any)?.file?.path,
      this.getWorkspaceLeafBasePath(),
      this.getActiveWorkspaceBasePath(),
    ].find((value) => typeof value === 'string' && value.length > 0);
    return sourcePath ?? null;
  }

  private getBaseFile(): TFile | null {
    const sourcePath = this.getBaseSourcePath();
    if (!sourcePath || !sourcePath.endsWith('.base')) return null;
    const file = this.app.vault.getFileByPath(sourcePath);
    return file instanceof TFile ? file : null;
  }

  private getBaseContextFile(): TFile | null {
    const markdownContextPath = this.getWorkspaceLeafMarkdownContextPath();
    if (markdownContextPath) {
      const markdownContextFile = this.app.vault.getFileByPath(markdownContextPath);
      if (markdownContextFile instanceof TFile) return markdownContextFile;
    }

    const sourcePath = this.getBaseSourcePath();
    if (!sourcePath || sourcePath.endsWith('.base')) return null;
    const file = this.app.vault.getFileByPath(sourcePath);
    return file instanceof TFile ? file : null;
  }

  private getBaseContextFrontmatterValue(key: string): string | null {
    const domContextValue = this.getDomBaseContextValue(key);
    if (domContextValue) return domContextValue;

    const file = this.getBaseContextFile();
    if (!file) return null;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const normalizedKey = this.normalizeInlinePropertyKey(key);
    const actualKey = Object.keys(frontmatter ?? {}).find((candidate) => this.normalizeInlinePropertyKey(candidate) === normalizedKey);
    const value = actualKey ? frontmatter?.[actualKey] : undefined;
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).trim() || null;
  }

  private getDomBaseContextValue(key: string): string | null {
    const normalizedKey = this.normalizeInlinePropertyKey(key);
    if (normalizedKey !== 'scheduled') return null;
    const host = this.containerEl?.closest('[data-tps-context-scheduled], [data-tps-context-date]') as HTMLElement | null;
    const value = host?.dataset?.tpsContextScheduled || host?.dataset?.tpsContextDate || '';
    return String(value || '').trim() || null;
  }

  private resolveBaseContextToken(rawValue: unknown): string | null {
    const value = String(rawValue ?? '').trim().replace(/^["']|["']$/g, '');
    if (!value) return null;
    const contextFile = this.getBaseContextFile();
    if (/^this\.file\.path$/i.test(value)) return contextFile?.path ?? null;
    if (/^this\.file\.name$/i.test(value)) return contextFile?.name ?? null;
    if (/^this\.file\.basename$/i.test(value)) return contextFile?.basename ?? null;
    const frontmatterMatch = value.match(/^this\.([A-Za-z][\w -]{0,40})$/i);
    if (frontmatterMatch?.[1]) return this.getBaseContextFrontmatterValue(frontmatterMatch[1]);
    return value;
  }

  private getRuntimeBaseFile(): TFile | null {
    const embeddedBasePath = this.getEmbeddedBasePathFromDom();
    if (embeddedBasePath) {
      const embeddedBaseFile = this.app.vault.getFileByPath(embeddedBasePath);
      if (embeddedBaseFile instanceof TFile) return embeddedBaseFile;
    }

    const controller: any = (this as any)?.controller;
    const queryController: any = (this as any)?.queryController;
    const candidates = [
      controller?.file,
      controller?.baseFile,
      controller?.source,
      queryController?.query?.file,
      queryController?.currentFile,
      (this as any)?.file,
    ];
    for (const candidate of candidates) {
      if (candidate instanceof TFile && (candidate.extension === 'base' || candidate.path.endsWith('.base'))) {
        return candidate;
      }
    }

    const leafEl = this.containerEl?.closest('.workspace-leaf');
    if (!leafEl) return null;
    let found: TFile | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const leafContainer = (leaf as any).containerEl as HTMLElement | undefined;
      if (!leafContainer) return;
      if (leafContainer !== leafEl && !leafContainer.contains(leafEl) && !leafEl.contains(leafContainer)) return;
      const file = (leaf.view as any)?.file;
      if (file instanceof TFile && (file.extension === 'base' || file.path.endsWith('.base'))) {
        found = file;
      }
    });
    return found;
  }

  private getEmbeddedBasePathFromDom(): string | null {
    const embedEl = this.containerEl?.closest(
      '.internal-embed[src$=".base"], .internal-embed[data-src$=".base"], .markdown-embed[src$=".base"], .markdown-embed[data-src$=".base"], [data-path$=".base"]',
    ) as HTMLElement | null;
    if (!embedEl) return null;
    const rawPath = embedEl.getAttribute('src')
      || embedEl.getAttribute('data-src')
      || embedEl.getAttribute('data-path')
      || embedEl.getAttribute('alt')
      || '';
    return this.resolveBasePathFromName(rawPath);
  }

  private getWorkspaceLeafBasePath(): string | null {
    const leafEl = this.containerEl?.closest('.workspace-leaf');
    let found: string | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const leafContainer = (leaf as any).containerEl as HTMLElement | undefined;
      if (leafEl && leafContainer && leafContainer !== leafEl && !leafContainer.contains(leafEl) && !leafEl.contains(leafContainer)) return;
      const state = typeof (leaf as any).getViewState === 'function' ? (leaf as any).getViewState() : null;
      const path = [
        (leaf.view as any)?.file?.path,
        (leaf.view as any)?.getState?.()?.file,
        state?.state?.file,
        state?.file,
        this.resolveBasePathFromName((leaf as any)?.getDisplayText?.()),
        this.resolveBasePathFromName((leaf.view as any)?.getDisplayText?.()),
      ].find((value) => typeof value === 'string' && value.endsWith('.base'));
      if (path) found = path;
    });
    return found;
  }

  private getWorkspaceLeafMarkdownContextPath(): string | null {
    const markdownContextEl = this.containerEl?.closest('.markdown-reading-view, .markdown-source-view, .markdown-preview-view, .markdown-embed, .internal-embed, .cm-embed-block, .sync-embed, .sync-container');
    if (!markdownContextEl) return null;
    const leafEl = this.containerEl?.closest('.workspace-leaf');
    if (!leafEl) return null;
    let found: string | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const leafContainer = (leaf as any).containerEl as HTMLElement | undefined;
      if (!leafContainer || (leafContainer !== leafEl && !leafContainer.contains(leafEl) && !leafEl.contains(leafContainer))) return;
      const file = (leaf.view as any)?.file;
      if (file instanceof TFile && file.extension === 'md') {
        found = file.path;
        return;
      }
      const state = typeof (leaf as any).getViewState === 'function' ? (leaf as any).getViewState() : null;
      const path = [
        (leaf.view as any)?.getState?.()?.file,
        state?.state?.file,
        state?.file,
      ].find((value) => typeof value === 'string' && value.endsWith('.md'));
      if (path) found = path;
    });
    return found;
  }

  private getActiveWorkspaceBasePath(): string | null {
    const activeFile = this.app.workspace.getActiveFile?.();
    if (activeFile instanceof TFile && (activeFile.extension === 'base' || activeFile.path.endsWith('.base'))) return activeFile.path;
    const activeLeaf: any = this.app.workspace.activeLeaf || this.app.workspace.getMostRecentLeaf?.();
    const candidates = [
      activeLeaf?.view?.file?.path,
      activeLeaf?.getViewState?.()?.state?.file,
      activeLeaf?.getViewState?.()?.file,
      this.resolveBasePathFromName(activeLeaf?.getDisplayText?.()),
      this.resolveBasePathFromName(activeLeaf?.view?.getDisplayText?.()),
      this.resolveBasePathFromDomTitle(),
      this.resolveBasePathFromDocumentTitle(),
    ];
    return candidates.find((value) => typeof value === 'string' && value.endsWith('.base')) ?? null;
  }

  private resolveBasePathFromDomTitle(): string | null {
    const leafEl = this.containerEl?.closest('.workspace-leaf') as HTMLElement | null;
    if (!leafEl) return null;
    const selectors = [
      '.view-header-title',
      '.workspace-tab-header.is-active .workspace-tab-header-inner-title',
      '.workspace-tab-header-inner-title',
      '[data-path$=".base"]',
      'input',
      '[contenteditable="true"]',
    ];
    for (const selector of selectors) {
      for (const el of Array.from(leafEl.querySelectorAll<HTMLElement>(selector))) {
        const text = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.value
          : el.getAttribute('data-path') || el.textContent || '';
        const path = this.resolveBasePathFromName(text);
        if (path) return path;
      }
    }
    return null;
  }

  private resolveBasePathFromDocumentTitle(): string | null {
    const title = String(this.containerEl?.ownerDocument?.title || '').trim();
    if (!title) return null;
    return this.resolveBasePathFromName(title.split(' - ')[0]);
  }

  private resolveBasePathFromName(rawName: unknown): string | null {
    const name = String(rawName ?? '').trim();
    if (!name) return null;
    const withoutExtension = name.replace(/\.base$/i, '').trim();
    if (!withoutExtension) return null;
    const directPath = name.endsWith('.base') ? name : `${withoutExtension}.base`;
    const directFile = this.app.vault.getFileByPath(directPath);
    if (directFile instanceof TFile && (directFile.extension === 'base' || directFile.path.endsWith('.base'))) return directFile.path;
    const matches = this.app.vault.getFiles()
      .filter((file) => (file.extension === 'base' || file.path.endsWith('.base')) && file.basename === withoutExtension);
    return matches.length === 1 ? matches[0].path : null;
  }

  private getBaseFileFilterRoot(): unknown[] | null {
    const file = this.getBaseFile();
    if (!file) return null;
    const mtime = Number(file.stat?.mtime || 0);
    const viewName = this.getConfiguredBaseViewName();
    if (
      this.baseFileFilterCache?.path === file.path
      && this.baseFileFilterCache.mtime === mtime
      && (!viewName || this.baseFileFilterCache.viewName === viewName)
    ) {
      return this.baseFileFilterCache.filters;
    }

    void this.loadBaseFileFilters(file, mtime, viewName);
    return this.baseFileFilterCache?.path === file.path && (!viewName || this.baseFileFilterCache.viewName === viewName)
      ? this.baseFileFilterCache.filters
      : null;
  }

  private async loadBaseFileFilters(file: TFile, mtime = Number(file.stat?.mtime || 0), viewName = this.getCurrentBaseViewName()): Promise<void> {
    const loadingKey = `${file.path}:${mtime}:${viewName}`;
    if (this.baseFileFiltersLoadingKey === loadingKey) return;
    this.baseFileFiltersLoadingKey = loadingKey;
    try {
      const content = await this.app.vault.cachedRead(file);
      const parsed = parseYaml(content) as Record<string, unknown> | null | undefined;
      const extracted = this.extractBaseFileFilterRoots(parsed, viewName);
      const previous = this.baseFileFilterCache;
      this.baseFileFilterCache = {
        path: file.path,
        mtime,
        viewName: extracted.viewName,
        viewNames: extracted.viewNames,
        filters: extracted.filters,
      };
      if (previous?.path !== file.path || previous?.mtime !== mtime || previous?.viewName !== extracted.viewName || previous?.filters !== extracted.filters) {
        flow('BaseFilters', 'loaded', {
          path: file.path,
          viewName: extracted.viewName,
          viewCount: extracted.viewNames.length,
          filterRoots: extracted.filters?.length || 0,
        });
        this.refreshDebounced();
      }
    } catch (error) {
      flowError('BaseFilters', 'read-failed', error, { path: file.path, viewName });
      this.baseFileFilterCache = { path: file.path, mtime, viewName, viewNames: [], filters: null };
    } finally {
      if (this.baseFileFiltersLoadingKey === loadingKey) this.baseFileFiltersLoadingKey = null;
    }
  }

  private extractBaseFileFilterRoots(
    parsed: Record<string, unknown> | null | undefined,
    fallbackViewName = this.getCurrentBaseViewName(),
  ): { viewName: string; viewNames: string[]; filters: unknown[] | null } {
    return extractPersistedFilterRoots(parsed, fallbackViewName, new Set([KANBAN_VIEW_TYPE, 'tps-kanban']));
  }

  private getCurrentBaseViewName(knownViewNames?: Set<string>): string {
    const visible = this.getVisibleBaseViewName(knownViewNames);
    if (visible) return visible;
    return this.getConfiguredBaseViewName();
  }

  private getConfiguredBaseViewName(): string {
    const candidates = [
      this.config?.name,
      this.config?.get?.('name'),
      (this as any)?.view?.name,
      (this as any)?.controller?.viewConfig?.name,
      (this as any)?.controller?.config?.name,
      (this as any)?.queryController?.query?.name,
      (this as any)?.queryController?.view?.name,
    ];
    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (value) return value;
    }
    return '';
  }

  private getVisibleBaseViewName(knownViewNames?: Set<string>): string {
    if (!knownViewNames?.size) return '';
    const root = this.containerEl.ownerDocument.body;
    const visibleText = String(root.innerText || '');
    const visibleKnownNames = Array.from(knownViewNames).filter((name) => visibleText.includes(name));
    if (visibleKnownNames.length === 1) return visibleKnownNames[0];
    const visibleMatches: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (!el.offsetParent) continue;
      const text = String(el.textContent || '').trim();
      if (!text || text.length > 120) continue;
      if (knownViewNames.has(text)) visibleMatches.push(text);
    }
    if (visibleMatches.length) return visibleMatches[0];
    for (const name of knownViewNames) {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (!el.offsetParent) continue;
        const text = String(el.textContent || '').trim();
        if (text.startsWith(name)) return name;
      }
    }
    return '';
  }

  onload(): void {
    this.ensureContainer();
    this.activeNotePath = this.getActiveMarkdownPath();

    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (!(file instanceof TFile)) return;
      if (!this.isVisibleFile(file.path)) return;
      this.refreshDebounced();
    }));

    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (!(file instanceof TFile)) return;
      if (file.path === this.getBaseSourcePath()) {
        this.baseFileFilterCache = null;
        this.embeddedBaseFilterCache = null;
        this.refreshDebounced();
        return;
      }
      this.clearTaskCachesForPath(file.path);
      const taskFilter = this.getTaskRootFilterFromBaseFilters();
      if (taskFilter.mode === 'tasks' || taskFilter.mode === 'bullets' || taskFilter.hasTaskDirective) {
        this.refreshDebounced();
        return;
      }
      if (!this.isVisibleFile(file.path)) return;
      this.refreshDebounced();
    }));

    this.registerEvent(this.app.vault.on('create', (file) => {
      if (!(file instanceof TFile)) return;
      this.refreshDebounced();
      this.queuePostCreateRefresh();
    }));

    // Keep board stable through file lifecycle changes while this view is open.
    this.registerEvent(this.app.vault.on('rename', () => this.refreshDebounced()));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (!(file instanceof TFile)) return;
      if (!this.isVisibleFile(file.path)) return;
      this.refreshDebounced();
    }));

    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      const nextPath = file instanceof TFile ? file.path : null;
      if (nextPath === this.activeNotePath) return;
      this.activeNotePath = nextPath;
      this.syncSelectionClasses();
    }));

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      const nextPath = this.getActiveMarkdownPath();
      if (nextPath === this.activeNotePath) return;
      this.activeNotePath = nextPath;
      this.syncSelectionClasses();
    }));
    this.baseFilterSignature = this.getBaseFilterSignature();
    this.baseFilterPollInterval = window.setInterval(() => {
      const nextSignature = this.getBaseFilterSignature();
      if (nextSignature === this.baseFilterSignature) return;
      this.baseFilterSignature = nextSignature;
      this.refreshDebounced();
    }, 400);
    this.register(() => {
      if (this.baseFilterPollInterval) {
        window.clearInterval(this.baseFilterPollInterval);
        this.baseFilterPollInterval = null;
      }
    });
    if (Platform.isMobile) {
      this.setupMobileKeyboardSuppression();

      this.registerDomEvent(this.containerEl, 'focusin', (evt: FocusEvent) => {
        if (!this.isInteractiveInputEventTarget(evt.target)) return;
        this.setMobileKeyboardHidden(true);
      });

      this.registerDomEvent(this.containerEl, 'focusout', () => {
        window.setTimeout(() => {
          const activeElement = document.activeElement;
          const isInside = !!(activeElement && this.containerEl.contains(activeElement));
          if (!isInside) {
            this.setMobileKeyboardHidden(false);
          }
        }, 0);
      });
    }
    this.registerDomEvent(document, TPS_TASK_LINE_POINTER_DROP_EVENT as any, (evt: Event) => {
      void this.handleTaskPointerDropEvent(evt as CustomEvent);
    }, { capture: true });
    this.registerDomEvent(document, 'pointermove', (evt: PointerEvent) => {
      this.handleTaskPointerMove(evt);
    }, { capture: true });
    this.registerDomEvent(document, 'pointerup', (evt: PointerEvent) => {
      void this.handleTaskPointerUp(evt);
    }, { capture: true });
    this.registerDomEvent(document, 'pointercancel', (evt: PointerEvent) => {
      this.cancelTaskPointerDrag(evt);
    }, { capture: true });
    this.render();
    window.setTimeout(() => this.render(), 300);
  }

  onunload(): void {
    this.detachWheelHandler();
    this.detachTouchHandlers();
    this.setMobileKeyboardHidden(false);
    this.setMobileGestureHidden(false);
    if (this.mobileKeyboardTimeout) {
      window.clearTimeout(this.mobileKeyboardTimeout);
      this.mobileKeyboardTimeout = null;
    }
    if (this.mobileGestureRevealTimeout) {
      window.clearTimeout(this.mobileGestureRevealTimeout);
      this.mobileGestureRevealTimeout = null;
    }
    if (this.baseFilterPollInterval) {
      window.clearInterval(this.baseFilterPollInterval);
      this.baseFilterPollInterval = null;
    }
    // Do not clear the root scroll element; Bases controls this container's lifecycle.
    // Clearing it here can leave the view blank when switching away and back.
    this.containerEl?.empty();
  }
  onResize(): void {}

  private setMobileUiHiddenClass(className: string, hidden: boolean): void {
    if (!Platform.isMobile) return;
    const body = document.body;
    if (!body) return;
    body.classList.toggle(className, hidden);
  }

  private setMobileKeyboardHidden(hidden: boolean): void {
    if (this.mobileKeyboardSuppressed === hidden) return;
    this.mobileKeyboardSuppressed = hidden;
    this.setMobileUiHiddenClass(MOBILE_UI_KEYBOARD_HIDDEN_CLASS, hidden);
    if (hidden) {
      this.setMobileGestureHidden(false);
      if (this.mobileKeyboardTimeout) {
        window.clearTimeout(this.mobileKeyboardTimeout);
        this.mobileKeyboardTimeout = null;
      }
    }
  }

  private setMobileGestureHidden(hidden: boolean): void {
    if (this.mobileGestureSuppressed === hidden) return;
    this.mobileGestureSuppressed = hidden;
    this.setMobileUiHiddenClass(MOBILE_UI_GESTURE_HIDDEN_CLASS, hidden);
  }

  private isInteractiveInputEventTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest('input, textarea, [contenteditable="true"], [contenteditable]')) {
      return true;
    }
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.contentEditable === 'true';
  }

  private setupMobileKeyboardSuppression(): void {
    const getViewportHeight = () => window.visualViewport?.height || window.innerHeight;
    if (!window.visualViewport) {
      return;
    }

    this.mobileKeyboardResizeBaseHeight = getViewportHeight();

    const evaluateKeyboard = () => {
      const currentHeight = getViewportHeight();
      if (currentHeight > this.mobileKeyboardResizeBaseHeight) {
        this.mobileKeyboardResizeBaseHeight = currentHeight;
      }

      const delta = this.mobileKeyboardResizeBaseHeight - currentHeight;
      const shouldHide = delta > MOBILE_KEYBOARD_COLLAPSE_THRESHOLD_PX;

      this.setMobileKeyboardHidden(shouldHide);
    };

    const viewport = window.visualViewport;
    viewport.addEventListener('resize', evaluateKeyboard);
    viewport.addEventListener('scroll', evaluateKeyboard);
    this.register(() => {
      viewport.removeEventListener('resize', evaluateKeyboard);
      viewport.removeEventListener('scroll', evaluateKeyboard);
    });
  }
  focus(): void { this.scrollEl.focus({ preventScroll: true }); }

  onDataUpdated(): void {
    this.ensureContainer();
    this.render();
    this.syncNativeResultsCountSoon();
  }

  private queuePostCreateRefresh(): void {
    this.refreshDebounced();
    [150, 500, 1200].forEach((delay) => {
      window.setTimeout(() => {
        this.ensureContainer();
        this.render();
        this.syncNativeResultsCountSoon();
      }, delay);
    });
  }

  private ensureContainer(): void {
    if (this.containerEl && this.containerEl.parentElement === this.scrollEl) return;
    this.containerEl = this.scrollEl.createDiv({ cls: 'tps-kanban-container' });
    this.applyLayoutSettings();
  }

  private shouldRenderView(): boolean {
    if (!this.containerEl?.isConnected) return false;
    if (this.containerEl.isShown()) return true;

    const activeContainer = (this.app.workspace.activeLeaf?.view as any)?.containerEl as HTMLElement | undefined;
    return !!activeContainer?.contains(this.containerEl);
  }

  private syncNativeResultsCountSoon(): void {
    this.syncNativeResultsCount();
    window.setTimeout(() => this.syncNativeResultsCount(), 0);
    window.setTimeout(() => this.syncNativeResultsCount(), 180);
  }

  private syncNativeResultsCount(): void {
    const header = this.getNearestBasesHeader();
    if (!header) return;
    this.syncEmbeddedHeaderChrome(header);
    const resultCount = this.getDisplayedResultCount();
    const text = `${resultCount} result${resultCount === 1 ? '' : 's'}`;
    const countEl =
      header.querySelector<HTMLElement>('.view-header-count') ??
      header.querySelector<HTMLElement>('.bases-view-results-count') ??
      header.querySelector<HTMLElement>('.bases-results-count') ??
      header.querySelector<HTMLElement>('.bases-view-result-count') ??
      header.querySelector<HTMLElement>('.bases-result-count') ??
      header.querySelector<HTMLElement>('[class*="results-count"]') ??
      header.querySelector<HTMLElement>('[class*="result-count"]') ??
      header.querySelector<HTMLElement>('.bases-view-results') ??
      header.querySelector<HTMLElement>('.bases-results') ??
      this.findResultsCountElementByText(header);
    if (countEl && countEl.textContent?.trim() !== text) {
      countEl.textContent = text;
    }
  }

  private findResultsCountElementByText(root: HTMLElement): HTMLElement | null {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .filter((el) => /^\d+\s+results?$/i.test((el.textContent ?? '').trim()));
    if (!candidates.length) return null;
    return candidates
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] ?? null;
  }

  private getDisplayedResultCount(): number {
    if (this.hasRenderedResultCount) return this.renderedResultCount;
    const taskFilter = this.getTaskRootFilterFromBaseFilters();
    if (taskFilter.mode === 'tasks') return this.renderedTaskItemCount;
    const dataRows = (this.data as any)?.data;
    if (Array.isArray(dataRows)) return dataRows.length + (taskFilter.hasTaskDirective ? this.renderedTaskItemCount : 0);
    const unique = new Set<string>();
    const groups: BasesEntryGroup[] = this.data?.groupedData ?? [];
    for (const group of groups) {
      for (const entry of group.entries) unique.add(entry.file.path);
    }
    return unique.size + (taskFilter.hasTaskDirective ? this.renderedTaskItemCount : 0);
  }

  private getNearestBasesHeader(): HTMLElement | null {
    const selectors = '.bases-view-header, .base-view-header, .bases-toolbar, .bases-header, .view-header';
    const embedRoot = this.containerEl.closest(
      '.tps-auto-base-embed__panel, .block-language-bases, .cm-preview-code-block, .internal-embed, .markdown-embed, .cm-embed-block, .sync-embed, .sync-container',
    ) as HTMLElement | null;
    const searchRoot = embedRoot ?? (this.containerEl.closest('.workspace-leaf') as HTMLElement | null);
    if (!searchRoot) return null;
    const headers = Array.from(searchRoot.querySelectorAll<HTMLElement>(selectors));
    if (!headers.length) return null;
    const preceding = headers.filter((header) => {
      if (header === this.containerEl) return false;
      const relation = header.compareDocumentPosition(this.containerEl);
      return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (preceding.length > 0) return preceding[preceding.length - 1];
    const fallbackHeaders = Array.from(searchRoot.querySelectorAll<HTMLElement>('div, header, section')).filter((el) => {
      if (el === this.containerEl || el.contains(this.containerEl)) return false;
      const relation = el.compareDocumentPosition(this.containerEl);
      if (!Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      return text.length > 0
        && text.length <= 180
        && /\bSort\b/.test(text)
        && /\bFilter\b/.test(text)
        && /\bProperties\b/.test(text);
    });
    if (fallbackHeaders.length > 0) return fallbackHeaders[fallbackHeaders.length - 1];
    return headers[headers.length - 1];
  }

  private getContainingWorkspaceLeaf(): WorkspaceLeaf | null {
    const leafEl = this.containerEl?.closest('.workspace-leaf') as HTMLElement | null;
    if (!leafEl) return null;
    let found: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const leafContainer = (leaf as any).containerEl as HTMLElement | undefined;
      if (!leafContainer) return;
      if (leafContainer === leafEl || leafContainer.contains(leafEl) || leafEl.contains(leafContainer)) {
        found = leaf;
      }
    });
    return found;
  }

  private isEmbeddedKanbanContext(): boolean {
    if (this.containerEl.closest(
      '.tps-auto-base-embed__panel, .block-language-bases, .cm-preview-code-block, .internal-embed, .markdown-embed, .cm-embed-block, .sync-embed, .sync-container',
    )) {
      return true;
    }

    const leaf = this.getContainingWorkspaceLeaf();
    const viewType = typeof leaf?.view?.getViewType === 'function' ? leaf.view.getViewType() : null;
    return viewType === 'markdown';
  }

  private isReadingEmbeddedKanbanContext(): boolean {
    if (!this.isEmbeddedKanbanContext()) return false;
    if (this.containerEl.closest('.markdown-source-view, .cm-editor, .cm-content, .cm-preview-code-block')) return false;
    if (this.containerEl.closest('.markdown-reading-view, .markdown-rendered')) return true;
    const leaf = this.getContainingWorkspaceLeaf();
    const state = typeof (leaf as any)?.getViewState === 'function' ? (leaf as any).getViewState() : null;
    const viewState = (leaf?.view as any)?.getState?.();
    const mode = state?.state?.mode
      ?? state?.mode
      ?? viewState?.mode
      ?? (leaf?.view as any)?.getMode?.()
      ?? (leaf?.view as any)?.mode
      ?? (leaf?.view as any)?.currentMode?.type;
    if (typeof mode === 'string') return mode === 'preview' || mode === 'reading';
    return false;
  }

  private syncEmbeddedHeaderChrome(header: HTMLElement): void {
    header.classList.toggle('tps-kanban-embedded-hidden-header', this.isReadingEmbeddedKanbanContext());
  }

  private syncEmbeddedBaseChrome(): void {
    const embedRoot = this.containerEl.closest(
      '.tps-auto-base-embed__panel, .block-language-bases, .cm-preview-code-block, .internal-embed, .markdown-embed, .cm-embed-block, .sync-embed, .sync-container',
    ) as HTMLElement | null;
    if (!embedRoot) return;

    const shouldHide = this.isReadingEmbeddedKanbanContext();
    embedRoot.classList.toggle('tps-kanban-reading-embed-root', shouldHide);
    embedRoot.parentElement?.classList.toggle('tps-kanban-reading-embed-block', shouldHide);
    embedRoot.parentElement?.parentElement?.classList.toggle('tps-kanban-reading-embed-section', shouldHide);
    const selectorChrome = embedRoot.querySelectorAll<HTMLElement>(
      '.bases-view-header, .base-view-header, .bases-toolbar, .bases-header, .view-header',
    );
    selectorChrome.forEach((el) => el.classList.toggle('tps-kanban-embedded-hidden-chrome', shouldHide));

    const fallbackChrome = Array.from(embedRoot.querySelectorAll<HTMLElement>('div, header, section')).filter((el) => {
      if (el === this.containerEl || el.contains(this.containerEl)) return false;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length === 0 || text.length > 220) return false;
      return /\bSort\b/.test(text)
        && /\bFilter\b/.test(text)
        && /\bProperties\b/.test(text)
        && /\bSearch\b/.test(text);
    });
    fallbackChrome.forEach((el) => el.classList.toggle('tps-kanban-embedded-hidden-chrome', shouldHide));
  }

  applyLayoutSettings(): void {
    const raw = Number(this.plugin?.settings?.scale ?? 1);
    const scale = Number.isFinite(raw) ? Math.max(0.5, Math.min(1.4, raw)) : 1;
    const layoutMode = this.getLayoutMode();
    this.containerEl?.style.setProperty('--tps-kanban-scale', String(scale));
    this.containerEl?.setAttr('data-kanban-view-id', this.getLaneOrderViewId());
    this.containerEl?.setAttr('data-kanban-view-type', this.type);
    this.containerEl?.classList.toggle('tps-kanban-container--list', layoutMode === 'list');
    const isEmbedded = this.isEmbeddedKanbanContext();
    const isReadingEmbed = this.isReadingEmbeddedKanbanContext();
    this.containerEl?.classList.toggle('tps-kanban-container--embedded', isEmbedded);
    this.containerEl?.classList.toggle('tps-kanban-container--live-embed', isEmbedded && !isReadingEmbed);
    this.containerEl?.classList.toggle('tps-kanban-container--reading-embed', isReadingEmbed);
    this.syncEmbeddedBaseChrome();
    this.bindWheelHandler();
    this.bindTouchHandlers();
  }

  private getBoardScale(): number {
    const raw = Number(this.plugin?.settings?.scale ?? 1);
    return Number.isFinite(raw) ? Math.max(0.5, Math.min(1.4, raw)) : 1;
  }

  private shouldCompressEmptyLanes(
    displayLanes: DisplayLaneGroup[],
    renderItemsByDisplayLane: Map<string, LaneRenderItem[]>,
    taskItemsByDisplayLane?: Map<string, TaskRenderItem[]>,
  ): boolean {
    if (!this.plugin.settings.dynamicEmptyLaneWidth) return false;
    if (this.getLayoutMode() !== 'board') return false;

    const laneCount = displayLanes.length;
    if (laneCount <= 0) return false;

    let emptyLaneCount = 0;
    for (const displayLane of displayLanes) {
      const itemCount = (renderItemsByDisplayLane.get(displayLane.id) ?? []).length +
        (taskItemsByDisplayLane?.get(displayLane.id) ?? []).length;
      if (itemCount === 0) emptyLaneCount += 1;
    }
    if (emptyLaneCount === 0) return false;

    const availableWidth = this.containerEl?.clientWidth ?? 0;
    if (availableWidth <= 0) return false;

    const scale = this.getBoardScale();
    const regularLaneWidth = 260 * scale;
    const compactLaneWidth = 96 * scale;
    const laneGap = 12 * scale;
    const gapTotal = Math.max(0, laneCount - 1) * laneGap;
    const fullExpandedWidth = laneCount * regularLaneWidth + gapTotal;
    if (fullExpandedWidth <= availableWidth) return false;

    const compressedWidth =
      (laneCount - emptyLaneCount) * regularLaneWidth +
      emptyLaneCount * compactLaneWidth +
      gapTotal;

    return compressedWidth < fullExpandedWidth;
  }

  private async applyCompanionRulesToFile(file: TFile): Promise<void> {
    try {
      const companion = (this.app as any)?.plugins?.plugins?.['tps-notebook-navigator-companion'];
      const apply = companion?.api?.applyRulesToFile;
      if (typeof apply === 'function') {
        await apply(file);
      }
    } catch {
      // Ignore optional companion integration failures.
    }
  }

  private bindWheelHandler(): void {
    if (!this.containerEl) return;
    if (this.wheelHandlerTarget === this.containerEl) return;
    this.detachWheelHandler();
    this.onWheelBound = (event: WheelEvent) => this.handleWheelRouting(event);
    this.containerEl.addEventListener('wheel', this.onWheelBound, { passive: false });
    this.wheelHandlerTarget = this.containerEl;
  }

  private detachWheelHandler(): void {
    if (!this.wheelHandlerTarget || !this.onWheelBound) return;
    this.wheelHandlerTarget.removeEventListener('wheel', this.onWheelBound);
    this.wheelHandlerTarget = null;
    this.onWheelBound = null;
  }

  private bindTouchHandlers(): void {
    if (!this.containerEl) return;
    if (this.touchHandlerTarget === this.containerEl) return;
    this.detachTouchHandlers();
    this.onTouchStartBound = (event: TouchEvent) => this.handleTouchStart(event);
    this.onTouchMoveBound = (event: TouchEvent) => this.handleTouchMove(event);
    this.onTouchEndBound = () => this.handleTouchEnd();
    this.containerEl.addEventListener('touchstart', this.onTouchStartBound, { passive: true });
    this.containerEl.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    this.containerEl.addEventListener('touchend', this.onTouchEndBound, { passive: true });
    this.containerEl.addEventListener('touchcancel', this.onTouchEndBound, { passive: true });
    this.touchHandlerTarget = this.containerEl;
  }

  private detachTouchHandlers(): void {
    if (!this.touchHandlerTarget) return;
    if (this.onTouchStartBound) {
      this.touchHandlerTarget.removeEventListener('touchstart', this.onTouchStartBound);
    }
    if (this.onTouchMoveBound) {
      this.touchHandlerTarget.removeEventListener('touchmove', this.onTouchMoveBound);
    }
    if (this.onTouchEndBound) {
      this.touchHandlerTarget.removeEventListener('touchend', this.onTouchEndBound);
      this.touchHandlerTarget.removeEventListener('touchcancel', this.onTouchEndBound);
    }
    this.touchHandlerTarget = null;
    this.onTouchStartBound = null;
    this.onTouchMoveBound = null;
    this.onTouchEndBound = null;
    this.touchScrollState = null;
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!Platform.isMobile) return;
    if (event.touches.length !== 1) {
      this.touchScrollState = null;
      return;
    }
    const target = event.target as HTMLElement | null;
    const touch = event.touches[0];
    this.touchScrollState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startBoardScrollLeft: this.containerEl.scrollLeft,
      laneCards: target?.closest('.tps-kanban-cards') as HTMLElement | null,
      axis: null,
    };

    if (this.mobileGestureRevealTimeout) {
      window.clearTimeout(this.mobileGestureRevealTimeout);
      this.mobileGestureRevealTimeout = null;
    }
    this.setMobileGestureHidden(false);
  }

  private handleTouchMove(event: TouchEvent): void {
    const state = this.touchScrollState;
    if (!state || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!state.axis) {
      if (Math.max(absX, absY) < 8) return;
      state.axis = absX > absY * 1.15 ? 'horizontal' : 'vertical';
      this.setMobileGestureHidden(true);
      if (this.mobileGestureRevealTimeout) {
        window.clearTimeout(this.mobileGestureRevealTimeout);
        this.mobileGestureRevealTimeout = null;
      }
    }

    if (state.axis === 'horizontal') {
      const previous = this.containerEl.scrollLeft;
      this.containerEl.scrollLeft = state.startBoardScrollLeft - deltaX;
      if (this.containerEl.scrollLeft !== previous || absX > absY) {
        event.preventDefault();
      }
    }
  }

  private handleTouchEnd(): void {
    if (Platform.isMobile) {
      if (this.mobileGestureRevealTimeout) {
        window.clearTimeout(this.mobileGestureRevealTimeout);
      }
      this.mobileGestureRevealTimeout = window.setTimeout(() => {
        this.setMobileGestureHidden(false);
        this.mobileGestureRevealTimeout = null;
      }, 260);
    }
    this.touchScrollState = null;
  }

  private handleWheelRouting(event: WheelEvent): void {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const laneCards = target.closest('.tps-kanban-cards') as HTMLElement | null;
    if (laneCards) {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (this.getLayoutMode() === 'board' && absX > absY * 1.1) {
        const previous = this.containerEl.scrollLeft;
        this.containerEl.scrollLeft += event.deltaX;
        if (this.containerEl.scrollLeft !== previous) event.preventDefault();
        return;
      }
      if (event.deltaY !== 0) {
        const previous = laneCards.scrollTop;
        laneCards.scrollTop += event.deltaY;
        if (laneCards.scrollTop !== previous) event.preventDefault();
      }
      return;
    }

    if (this.getLayoutMode() === 'list') {
      const verticalDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (verticalDelta === 0) return;
      const previous = this.containerEl.scrollTop;
      this.containerEl.scrollTop += verticalDelta;
      if (this.containerEl.scrollTop !== previous) event.preventDefault();
      return;
    }

    const horizontalDelta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
    if (horizontalDelta === 0) return;
    const previous = this.containerEl.scrollLeft;
    this.containerEl.scrollLeft += horizontalDelta;
    if (this.containerEl.scrollLeft !== previous) event.preventDefault();
  }

  private captureRenderScrollState(): KanbanRenderScrollState {
    const laneCards: Record<string, number> = {};
    if (this.containerEl) {
      this.containerEl.querySelectorAll<HTMLElement>('.tps-kanban-lane[data-display-lane-id] .tps-kanban-cards').forEach((cardsEl) => {
        const laneEl = cardsEl.closest<HTMLElement>('.tps-kanban-lane[data-display-lane-id]');
        const laneId = laneEl?.dataset.displayLaneId || '';
        if (laneId) laneCards[laneId] = cardsEl.scrollTop;
      });
    }
    return {
      top: this.containerEl?.scrollTop || 0,
      left: this.containerEl?.scrollLeft || 0,
      laneCards,
    };
  }

  private restoreRenderScrollState(state: KanbanRenderScrollState | null): void {
    if (!state || !this.containerEl) return;
    const restore = () => {
      if (!this.containerEl) return;
      this.containerEl.scrollTop = state.top;
      this.containerEl.scrollLeft = state.left;
      this.containerEl.querySelectorAll<HTMLElement>('.tps-kanban-lane[data-display-lane-id] .tps-kanban-cards').forEach((cardsEl) => {
        const laneEl = cardsEl.closest<HTMLElement>('.tps-kanban-lane[data-display-lane-id]');
        const laneId = laneEl?.dataset.displayLaneId || '';
        if (!laneId || state.laneCards[laneId] == null) return;
        cardsEl.scrollTop = state.laneCards[laneId];
      });
    };
    restore();
    window.requestAnimationFrame(restore);
  }

  private isVisibleFile(path: string): boolean {
    const groups: BasesEntryGroup[] = this.data?.groupedData ?? [];
    for (const group of groups) {
      for (const entry of group.entries) {
        if (entry.file.path === path) return true;
      }
    }
    return false;
  }

  private getOpenTasksForFile(file: TFile): OpenTaskSubitem[] {
    const cached = this.openTasksByPath.get(file.path);
    if (cached) return cached;
    this.loadOpenTasksForFile(file);
    return [];
  }

  private getAllTasksForFile(file: TFile): OpenTaskSubitem[] {
    const cached = this.allTasksByPath.get(file.path);
    if (cached) return cached;
    this.loadOpenTasksForFile(file);
    return [];
  }

  private getPreviewTasksForFile(file: TFile): { tasks: OpenTaskSubitem[]; overflowCount: number } {
    if (!this.shouldShowCompletedTasks()) {
      return {
        tasks: this.getOpenTasksForFile(file),
        overflowCount: Math.max(0, this.openTaskOverflowByPath.get(file.path) || 0),
      };
    }
    const allTasks = this.getAllTasksForFile(file);
    const limit = this.getOpenTaskPreviewLimit();
    const normalizedLimit = Math.max(0, Math.min(allTasks.length, Math.floor(Number(limit) || 0)));
    return {
      tasks: allTasks.slice(0, normalizedLimit),
      overflowCount: Math.max(0, allTasks.length - normalizedLimit),
    };
  }

  private isDoneTask(task: OpenTaskSubitem): boolean {
    if (task.itemKind === 'bullet') return false;
    return this.getDoneStatuses().has(this.getStatusForCheckboxState(task.checkboxState || '[ ]'));
  }

  private clearTaskCachesForPath(path: string): void {
    this.openTasksByPath.delete(path);
    this.allTasksByPath.delete(path);
    this.allTasksByPath.delete(`${path}:bullets`);
    this.openTaskOverflowByPath.delete(path);
  }

  private loadOpenTasksForFile(file: TFile): void {
    if (this.openTasksLoading.has(file.path)) return;
    const generation = this.renderGeneration;
    this.openTasksLoading.add(file.path);
    void this.app.vault.cachedRead(file)
      .then((content) => {
        const taskFilter = this.getTaskRootFilterFromBaseFilters();
        if (generation !== this.renderGeneration && !this.isVisibleFile(file.path) && !this.isTaskSourceFile(file, taskFilter)) return;
        const contentApi = this.getGcmServices()?.cardContent || this.getGcmApi()?.cardContent;
        const limit = this.getOpenTaskPreviewLimit();
        const fallback = this.parseOpenTasks(content, file.path, limit);
        const parsed = typeof contentApi?.extractOpenTasksFromMarkdown === 'function'
          ? contentApi.extractOpenTasksFromMarkdown(file.path, content, { openTaskLimit: limit })
          : fallback;
        const allTasks = this.parseOpenTasks(content, file.path, Number.MAX_SAFE_INTEGER, true).openTasks;
        const gcmTasksByLine = new Map<number, OpenTaskSubitem>(
          (Array.isArray(parsed?.openTasks) ? parsed.openTasks : [])
            .filter((task: OpenTaskSubitem) => Number.isFinite(Number(task.line)))
            .map((task: OpenTaskSubitem) => [Number(task.line), task])
        );
        const openTasks = fallback.openTasks.map((task: OpenTaskSubitem) => {
          const enriched = gcmTasksByLine.get(task.line);
          const merged = {
            ...task,
            checkboxState: task.checkboxState || enriched?.checkboxState || '[ ]',
            inlineFields: task.inlineFields?.length ? task.inlineFields : enriched?.inlineFields,
          };
          return {
            ...merged,
            displayText: this.getTaskVisibleTitle(merged),
          };
        });
        const openByLine = new Map<number, OpenTaskSubitem>(openTasks.map((task: OpenTaskSubitem) => [task.line, task]));
        const enrichedAllTasks = allTasks.map((task: OpenTaskSubitem) => {
          const openTask = openByLine.get(task.line);
          const merged = {
            ...task,
            ...(openTask ?? {}),
            checkboxState: task.checkboxState || openTask?.checkboxState || '[ ]',
            inlineFields: task.inlineFields?.length ? task.inlineFields : openTask?.inlineFields,
          };
          return {
            ...merged,
            displayText: this.getTaskVisibleTitle(merged),
          };
        });
        const overflowCount = Number(parsed?.overflowCount ?? fallback.overflowCount);
        this.openTasksByPath.set(file.path, openTasks);
        this.allTasksByPath.set(file.path, enrichedAllTasks);
        this.openTaskOverflowByPath.set(file.path, Number.isFinite(overflowCount) ? Math.max(0, overflowCount) : fallback.overflowCount);
      })
      .catch(() => {
        this.openTasksByPath.set(file.path, []);
        this.allTasksByPath.set(file.path, []);
        this.openTaskOverflowByPath.set(file.path, 0);
      })
      .finally(() => {
        this.openTasksLoading.delete(file.path);
        // Vault-wide task views can read hundreds of source files at once.
        // Repaint once when the batch settles instead of once per file.
        if (this.openTasksLoading.size === 0) this.refreshDebounced();
      });
  }

  private parseOpenTasks(
    content: string,
    filePath = '',
    limit = this.getOpenTaskPreviewLimit(),
    includeDone = false,
    includeBullets = false,
  ): { openTasks: OpenTaskSubitem[]; overflowCount: number } {
    const tasks: OpenTaskSubitem[] = [];
    const lines = content.split(/\r?\n/);
    const doneStatuses = this.getDoneStatuses();
    const hierarchyStack: Array<{ line: number; indent: number }> = [];
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const structuralItem = this.parseLineItem(line, true);
      const indent = getMarkdownIndentColumns(line);
      let parentLine: number | undefined;
      if (structuralItem) {
        while (hierarchyStack.length && hierarchyStack[hierarchyStack.length - 1].indent >= indent) hierarchyStack.pop();
        parentLine = hierarchyStack[hierarchyStack.length - 1]?.line;
        hierarchyStack.push({ line: lineNumber, indent });
      } else if (line.trim() && indent === 0) {
        hierarchyStack.length = 0;
      }
      const parsed = this.parseLineItem(line, includeBullets);
      if (!parsed) return;
      const checkboxState = parsed.checkboxState;
      const mappedStatus = parsed.itemKind === 'task' ? this.getStatusForCheckboxState(checkboxState || '[ ]') : '';
      if (parsed.itemKind === 'task' && !includeDone && doneStatuses.has(mappedStatus)) return;
      const text = this.cleanTaskText(parsed.text);
      if (!text) return;
      const inlineFields = this.extractTaskInlineFields(text);
      tasks.push({
        itemKind: parsed.itemKind,
        internalId: `${filePath}:${lineNumber}`,
        line: lineNumber,
        indent,
        parentLine,
        checkboxState,
        text,
        displayText: this.cleanTaskDisplayText(this.stripTaskInlineFields(text)),
        inlineFields,
      });
    });
    const finiteLimit = Number.isFinite(Number(limit)) ? Number(limit) : tasks.length;
    const normalizedLimit = Math.max(0, Math.min(tasks.length, Math.floor(finiteLimit || 0)));
    const openTasks = tasks.slice(0, normalizedLimit);
    return { openTasks, overflowCount: Math.max(0, tasks.length - openTasks.length) };
  }

  private parseLineItem(line: string, includeBullets = true): { itemKind: 'task' | 'bullet'; checkboxState?: string; text: string } | null {
    return parseKanbanLineItem(line, includeBullets);
  }

  private cleanTaskText(text: string): string {
    return this.stripTaskHiddenMetadata(text)
      .replace(/\s+\^[A-Za-z0-9-]+$/u, '')
      .replace(/<!--.*?-->/gu, '')
      .trim();
  }

  private cleanTaskDisplayText(text: string): string {
    return this.cleanTaskText(text)
      .replace(/(^|\s)#[\p{L}\p{N}/_-]+/gu, ' ')
      .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/gu, '$1')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, '$2')
      .replace(/\[\[([^\]]+)\]\]/gu, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/gu, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
      .replace(/`([^`]+)`/gu, '$1')
      .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/gu, '$1')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  private stripTaskHiddenMetadata(text: string): string {
    return String(text || '')
      .replace(/<span\b[^>]*data-tps-inline-props="[^"]*"[^>]*>\s*<\/span>/giu, ' ')
      .replace(/<!--\s*tps-inline-props:[\s\S]*?-->/giu, ' ')
      .replace(/\s*%%\s*tps-inline-props:[\s\S]*?%%/giu, ' ')
      .replace(/\[\^\s*tps-inline:[^\]]+\](?::\s*\S+)?/giu, ' ');
  }

  private getTaskVisibleTitle(task: Pick<OpenTaskSubitem, 'displayText' | 'text'>): string {
    const display = this.cleanTaskDisplayText(this.stripTaskInlineFields(task.displayText || ''));
    if (display) return display;
    const text = this.cleanTaskDisplayText(this.stripTaskInlineFields(task.text || ''));
    return text || 'Untitled task';
  }

  private extractTaskInlineFields(text: string): Array<{ key: string; value: string }> {
    const fields: Array<{ key: string; value: string }> = [];
    for (const field of this.getTaskInlineFieldRanges(text)) {
      if (field.key && field.value) fields.push({ key: field.key, value: field.value });
    }
    const tagMatches = text.match(/(^|\s)#[\p{L}\p{N}/_-]+/gu) || [];
    for (const rawTag of tagMatches) {
      const value = rawTag.trim();
      if (value) fields.push({ key: 'tag', value });
    }
    return fields.slice(0, 6);
  }

  private stripTaskInlineFields(text: string): string {
    const source = String(text || '');
    const ranges = this.getTaskInlineFieldRanges(source);
    if (!ranges.length) return source.replace(/\s+/gu, ' ').trim();
    let output = '';
    let cursor = 0;
    for (const range of ranges) {
      output += source.slice(cursor, range.start);
      cursor = range.end;
    }
    output += source.slice(cursor);
    return output
      .replace(/\s+/gu, ' ')
      .trim();
  }

  private getTaskInlineFieldRanges(text: string): Array<{ start: number; end: number; key: string; value: string }> {
    const source = String(text || '');
    const ranges: Array<{ start: number; end: number; key: string; value: string }> = [];
    const openerPattern = /[\[(]([A-Za-z][\w -]{0,40})::\s*/gu;
    let match: RegExpExecArray | null;
    while ((match = openerPattern.exec(source)) !== null) {
      const opener = source[match.index];
      const closer = opener === '[' ? ']' : ')';
      const valueStart = openerPattern.lastIndex;
      const end = source.indexOf(closer, valueStart);
      if (end === -1) continue;
      const key = String(match[1] || '').trim();
      const value = source.slice(valueStart, end).trim();
      if (key && value) {
        ranges.push({ start: match.index, end: end + 1, key, value });
      }
      openerPattern.lastIndex = end + 1;
    }
    return ranges;
  }

  private getOpenTaskPreviewLimit(): number {
    const value = Number(this.plugin.settings?.openTaskPreviewLimit ?? 5);
    return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value))) : 5;
  }

  /**
   * Returns the raw frontmatter key name for the view's groupBy property.
   *
   * The .base file stores groupBy.property as either a plain name ("status")
   * or a BasesPropertyId ("note.status"). Only 'note' (user/frontmatter) props
   * support write-back; 'file' and 'formula' props are read-only.
   *
   * Falls back to scanning allProperties vs. entry values if config is opaque.
   */
  private getGroupByPropName(): string | null {
    // Primary: read from the internal config (works when Bases exposes groupBy)
    const raw = (this.config as any)?.groupBy?.property as string | undefined;
    if (raw) {
      if (raw.toLowerCase() === 'file.tags') return 'tags';
      const dot = raw.indexOf('.');
      if (dot === -1) return raw;                    // plain "status"
      const prefix = raw.slice(0, dot);
      if (prefix === 'note') return raw.slice(dot + 1); // "note.status" → "status"
      return null; // 'file.*' or 'formula.*' — not writable via frontmatter
    }

    // Fallback: find which allProperty's value matches .key for the first real group
    const groups = this.data?.groupedData ?? [];
    const allProps: string[] = Array.isArray((this as any).allProperties)
      ? (this as any).allProperties
      : [];
    for (const g of groups) {
      if (!g.hasKey() || g.key == null || g.entries.length === 0) continue;
      const keyStr = g.key.toString();
      const entry = g.entries[0];
      for (const propId of allProps) {
        if (typeof propId !== 'string' || propId.length === 0) continue;
        const val = entry.getValue(propId as any);
        if (val != null && val.toString() === keyStr) {
          const dot = propId.indexOf('.');
          const prefix = dot !== -1 ? propId.slice(0, dot) : '';
          if (propId.toLowerCase() === 'file.tags') return 'tags';
          if (prefix === 'file' || prefix === 'formula') return null;
          return dot !== -1 ? propId.slice(dot + 1) : propId;
        }
      }
      break;
    }
    return null;
  }

  private getGroupByPropId(propName: string | null): string | null {
    if (!propName) return null;

    const raw = (this.config as any)?.groupBy?.property as string | undefined;
    if (raw) {
      if (raw.includes('.')) return raw;
      return `note.${raw}`;
    }

    const allProps: string[] = Array.isArray((this as any).allProperties)
      ? (this as any).allProperties
      : [];
    const lower = propName.toLowerCase();
    const exact = allProps.find((p) => p.toLowerCase() === lower || p.toLowerCase() === `note.${lower}`);
    if (exact) return exact;

    const suffix = allProps.find((p) => p.toLowerCase().endsWith(`.${lower}`));
    return suffix || null;
  }

  private getFrontmatterPropNameFromId(propId: unknown): string | null {
    return getKanbanFrontmatterPropNameFromId(propId);
  }

  private isLikelyListGroupingProperty(propName: string | null, propId: string | null): boolean {
    const name = String(propName || '').trim().toLowerCase();
    const id = String(propId || '').trim().toLowerCase();
    if (!propId || !id) return false;
    if (name === 'tags' || id.endsWith('.tags') || id === 'tags') return true;

    const entries: BasesEntry[] = this.data?.data ?? [];
    for (const entry of entries) {
      const values = this.extractGroupValues(entry.getValue(propId as any));
      if (values.length > 1) return true;
    }
    return false;
  }

  private buildMultiValueGroups(propId: string): BasesEntryGroup[] {
    const entries: BasesEntry[] = this.data?.data ?? [];
    return this.groupEntriesByProperty(entries, propId);
  }

  private getSourceGroupsForRender(propId: string | null, listGrouping: boolean): BasesEntryGroup[] {
    const nativeGroups: BasesEntryGroup[] = (listGrouping && propId)
      ? this.buildMultiValueGroups(propId)
      : (this.data?.groupedData ?? []);

    const groupedEntries = nativeGroups.flatMap((group) => group.entries ?? []);
    const nativeEntries: BasesEntry[] = groupedEntries.length ? groupedEntries : (this.data?.data ?? []);
    const fallbackEntries = this.getFallbackNoteEntriesFromBaseFilters();
    if (!fallbackEntries.length && this.groupsContainEntries(nativeGroups)) return nativeGroups;

    const entriesByPath = new Map<string, BasesEntry>();
    for (const entry of nativeEntries) {
      if (entry?.file?.path) entriesByPath.set(entry.file.path, entry);
    }
    for (const entry of fallbackEntries) {
      if (entry?.file?.path && !entriesByPath.has(entry.file.path)) entriesByPath.set(entry.file.path, entry);
    }
    if (entriesByPath.size) {
      return this.includeNativeEmptyGroups(
        this.groupEntriesByProperty(Array.from(entriesByPath.values()), propId),
        nativeGroups,
      );
    }
    return nativeGroups;
  }

  private groupsContainEntries(groups: BasesEntryGroup[]): boolean {
    return groups.some((group) => group.entries.length > 0);
  }

  private includeNativeEmptyGroups(groups: BasesEntryGroup[], nativeGroups: BasesEntryGroup[]): BasesEntryGroup[] {
    if (!nativeGroups.length) return groups;
    const existingLaneIds = new Set(groups.map((group) => this.getLaneId(group)));
    const nextGroups = [...groups];
    for (const nativeGroup of nativeGroups) {
      if ((nativeGroup.entries ?? []).length > 0) continue;
      const laneId = this.getLaneId(nativeGroup);
      if (existingLaneIds.has(laneId)) continue;
      nextGroups.push(nativeGroup);
      existingLaneIds.add(laneId);
    }
    return nextGroups;
  }

  private shouldRenderNoteEntriesForGroups(groups: BasesEntryGroup[], taskFilter: KanbanTaskRootFilter): boolean {
    if (taskFilter.mode !== 'tasks') return true;
    return this.groupsContainEntries(groups);
  }

  private getFallbackNoteEntriesFromBaseFilters(): BasesEntry[] {
    const searchQuery = this.getActiveBasesSearchQuery();
    const entries: BasesEntry[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!this.noteMatchesStructuredBaseFilters(file)) continue;
      if (!this.noteMatchesSearchQuery(file, searchQuery)) continue;
      entries.push(this.createFallbackBasesEntry(file));
    }
    return this.sortEntriesForView(entries);
  }

  private createFallbackBasesEntry(file: TFile): BasesEntry {
    return {
      file,
      getValue: (propId: string) => this.getFallbackNoteValue(file, propId),
    } as unknown as BasesEntry;
  }

  private getFallbackNoteValue(file: TFile, propId: string): unknown {
    const raw = String(propId || '').trim();
    const lower = raw.toLowerCase();
    if (lower === 'file.name' || lower === 'name') return file.name;
    if (lower === 'file.basename' || lower === 'basename' || lower === 'title') return file.basename;
    if (lower === 'file.path' || lower === 'path' || this.normalizeInlinePropertyKey(raw) === 'filepath') return file.path;
    if (lower === 'file.extension' || lower === 'file.ext' || lower === 'extension' || lower === 'ext') return file.extension;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    if (!fm) return undefined;
    const frontmatterKey = raw.startsWith('note.') ? raw.slice(5) : raw;
    return this.getFrontmatterValueCaseInsensitive(fm, frontmatterKey);
  }

  private noteMatchesSearchQuery(file: TFile, query: string): boolean {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const haystack = [
      file.basename,
      file.name,
      file.path,
      ...(fm ? Object.entries(fm).flatMap(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : String(value ?? '')]) : []),
    ].join('\n').toLowerCase();
    return normalizedQuery
      .split(/\s+/g)
      .filter(Boolean)
      .every((part) => haystack.includes(part));
  }

  private noteMatchesStructuredBaseFilters(file: TFile): boolean {
    let hasKnownFilter = false;
    for (const root of this.getBaseFilterRoots()) {
      const result = this.evaluateNoteFilterNode(root, file);
      if (result == null) continue;
      hasKnownFilter = true;
      if (!result) return false;
    }
    return hasKnownFilter;
  }

  private evaluateNoteFilterNode(node: unknown, file: TFile): boolean | null {
    if (!node) return null;
    if (typeof node === 'string') return this.evaluateNoteFilterString(node, file);
    if (Array.isArray(node)) return this.combineTaskFilterResults(node.map((child) => this.evaluateNoteFilterNode(child, file)), 'and');
    if (typeof node !== 'object') return null;
    const record = node as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'and') || Object.prototype.hasOwnProperty.call(record, 'all')) {
      const children = Object.prototype.hasOwnProperty.call(record, 'and') ? record.and : record.all;
      return this.combineTaskFilterResults(this.asArray(children).map((child) => this.evaluateNoteFilterNode(child, file)), 'and');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'or') || Object.prototype.hasOwnProperty.call(record, 'any')) {
      const children = Object.prototype.hasOwnProperty.call(record, 'or') ? record.or : record.any;
      return this.combineTaskFilterResults(this.asArray(children).map((child) => this.evaluateNoteFilterNode(child, file)), 'or');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'not')) {
      const result = this.evaluateNoteFilterNode(record.not, file);
      return result == null ? null : !result;
    }
    return this.evaluateNoteFilterObject(record, file);
  }

  private evaluateNoteFilterString(rawExpr: string, file: TFile): boolean | null {
    const raw = String(rawExpr || '').trim();
    const isNegated = raw.startsWith('!');
    const expr = (isNegated ? raw.slice(1) : raw).trim();
    let result: boolean | null = null;
    const kindMatch = expr.match(/^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=|is|equals?)\s*["']?(task|tasks|bullet|bullets|note|notes|all|mixed)["']?$/i);
    if (kindMatch?.[1]) {
      const value = kindMatch[1].toLowerCase();
      result = value.startsWith('task') || value.startsWith('bullet') ? false : value.startsWith('note') || value === 'all' || value === 'mixed';
    } else {
      result = this.evaluateNoteValueFilterExpression(expr, file);
    }
    return result == null ? null : isNegated ? !result : result;
  }

  private evaluateNoteFilterObject(node: Record<string, unknown>, file: TFile): boolean | null {
    const propRaw = this.readFilterObjectProperty(node);
    if (!propRaw) return null;
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^note\./i, ''));
    const operator = this.readFilterObjectOperator(node);
    const values = this.readFilterObjectValues(node);
    const isNegated = this.isNegatedFilterOperator(operator);
    let result: boolean | null = null;

    if (isBareSemanticKindFilter(propRaw, values)) {
      const currentValues = this.getNoteComparableValues(file, propRaw);
      result = values.some((value) => currentValues.includes(value.toLowerCase()));
    } else if (['itemtype', 'itemkind', 'kind'].includes(normalizedProp)) {
      result = values.some((value) => {
        const normalized = value.toLowerCase();
        return normalized.startsWith('note') || normalized === 'all' || normalized === 'mixed';
      });
    } else if (propRaw.toLowerCase().startsWith('task.')) {
      result = false;
    } else if (['extension', 'ext', 'fileextension', 'fileext'].includes(normalizedProp) || propRaw.toLowerCase() === 'file.extension' || propRaw.toLowerCase() === 'file.ext') {
      result = values.some((value) => value.toLowerCase().replace(/^\./, '') === file.extension.toLowerCase());
    } else if (['path', 'file', 'filepath'].includes(normalizedProp) || propRaw.toLowerCase() === 'file.path') {
      if (!this.isPathComparisonOperator(operator)) return null;
      result = this.isStartsWithFilterOperator(operator)
        ? values.some((value) => this.taskFilePathStartsWith(file, value))
        : values.some((value) => this.taskFilePathMatches(file, value));
    } else {
      const currentValues = this.getNoteComparableValues(file, propRaw);
      if (this.isImplicitEmptyValueFilter(operator, values)) {
        result = currentValues.length === 0;
      } else if (this.isImplicitNotEmptyValueFilter(operator, values)) {
        result = currentValues.length > 0;
      } else if (this.isEmptyFilterOperator(operator)) {
        result = currentValues.length === 0;
      } else if (this.isExistsFilterOperator(operator)) {
        result = currentValues.length > 0;
      } else if (this.isContainsFilterOperator(operator)) {
        result = values.some((value) => currentValues.some((current) => current.includes(value.toLowerCase()) || current === this.normalizeTaskTag(value)));
      } else {
        result = values.some((value) => currentValues.includes(value.toLowerCase()));
      }
    }

    return result == null ? null : isNegated ? !result : result;
  }

  private evaluateNoteValueFilterExpression(expr: string, file: TFile): boolean | null {
    const callMatch = expr.match(/^([\w.\s-]+)\.(contains|containsAny|equals)\((.*)\)$/i);
    if (callMatch?.[1]) {
      const prop = callMatch[1].trim();
      if (prop.toLowerCase().startsWith('task.')) return false;
      const values = this.getNoteComparableValues(file, prop);
      const tokens = this.extractFilterTokens(callMatch[3] || '').map((value) => (this.resolveBaseContextToken(value) || value).toLowerCase());
      if (callMatch[2].toLowerCase().includes('contains')) {
        return tokens.some((token) => values.some((value) => value.includes(token)));
      }
      return tokens.some((token) => values.includes(token));
    }
    const emptyMatch = expr.match(/^([\w.\s-]+)\.(isEmpty|empty|exists|isNotEmpty)\(\)$/i);
    if (emptyMatch?.[1]) {
      const values = this.getNoteComparableValues(file, emptyMatch[1].trim());
      const op = emptyMatch[2].toLowerCase();
      return op.includes('empty') && !op.includes('not') ? values.length === 0 : values.length > 0;
    }
    const wordOperatorMatch = expr.match(/^([\w.\s-]+)\s+(contains|has|is not empty|is empty|isNotEmpty|exists|empty|is|equals?)\s*(.*)$/i);
    if (wordOperatorMatch?.[1]) {
      const prop = wordOperatorMatch[1].trim();
      if (prop.toLowerCase().startsWith('task.')) return false;
      const op = wordOperatorMatch[2].trim().toLowerCase().replace(/\s+/g, '');
      const values = this.getNoteComparableValues(file, prop);
      if (op === 'isempty' || op === 'empty') return values.length === 0;
      if (op === 'isnotempty' || op === 'exists') return values.length > 0;
      const tokens = this.extractFilterTokens(wordOperatorMatch[3] || '').map((token) => (this.resolveBaseContextToken(token) || token).toLowerCase());
      if (op === 'contains' || op === 'has') return tokens.some((token) => values.some((value) => value.includes(token) || value === this.normalizeTaskTag(token)));
      return tokens.some((token) => values.includes(token));
    }
    const comparisonMatch = expr.match(/^([\w.\s-]+)\s*(==|=|!=|!==|is|equals?)\s*["']?([^"']+)["']?$/i);
    if (comparisonMatch?.[1]) {
      const prop = comparisonMatch[1].trim();
      if (prop.toLowerCase().startsWith('task.')) return false;
      const matched = this.getNoteComparableValues(file, prop).includes(comparisonMatch[3].trim().toLowerCase());
      const op = String(comparisonMatch[2] || '').toLowerCase();
      return op.startsWith('!') ? !matched : matched;
    }
    return null;
  }

  private getNoteComparableValues(file: TFile, propRaw: string): string[] {
    const raw = String(propRaw || '').trim();
    const normalized = this.normalizeInlinePropertyKey(raw.replace(/^note\./i, ''));
    if (['path', 'file', 'filepath'].includes(normalized) || raw.toLowerCase() === 'file.path') {
      return [file.path, file.basename, file.name, file.path.replace(/\.md$/i, '')].map((value) => value.toLowerCase());
    }
    if (['extension', 'ext', 'fileextension', 'fileext'].includes(normalized) || raw.toLowerCase() === 'file.extension' || raw.toLowerCase() === 'file.ext') {
      return [file.extension.toLowerCase()];
    }
    if (['tag', 'tags', 'filetags'].includes(normalized) || raw.toLowerCase() === 'file.tags') {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      const rawTags = [
        ...this.asArray(fm?.tags),
        ...(this.app.metadataCache.getFileCache(file)?.tags ?? []).map((tag) => tag.tag),
      ];
      const tags = new Set<string>();
      for (const rawTag of rawTags) {
        const normalizedTag = this.normalizeTaskTag(String(rawTag || ''));
        if (normalizedTag) {
          tags.add(normalizedTag);
          tags.add(normalizedTag.replace(/^#/, ''));
        }
      }
      return Array.from(tags);
    }
    const value = this.getFallbackNoteValue(file, raw);
    const values = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
    return values.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean);
  }

  private groupEntriesByProperty(entries: BasesEntry[], propId: string | null): BasesEntryGroup[] {
    if (!propId) {
      return [{
        key: null,
        entries,
        hasKey: () => false,
      } as unknown as BasesEntryGroup];
    }

    const byKey = new Map<string, BasesEntry[]>();
    const keyLabel = new Map<string, string>();
    const ungrouped: BasesEntry[] = [];

    for (const entry of entries) {
      const values = this.extractGroupValues(entry.getValue(propId as any));
      if (!values.length) {
        ungrouped.push(entry);
        continue;
      }

      const unique = new Set(values.map((v) => v.trim()).filter(Boolean));
      if (!unique.size) {
        ungrouped.push(entry);
        continue;
      }

      for (const label of unique) {
        const norm = label.toLowerCase();
        const lane = byKey.get(norm) ?? [];
        lane.push(entry);
        byKey.set(norm, lane);
        if (!keyLabel.has(norm)) keyLabel.set(norm, label);
      }
    }

    const groups: BasesEntryGroup[] = [];
    for (const [norm, laneEntries] of byKey.entries()) {
      const label = keyLabel.get(norm) || norm;
      groups.push({
        key: label,
        entries: laneEntries,
        hasKey: () => true,
      } as unknown as BasesEntryGroup);
    }

    if (ungrouped.length) {
      groups.push({
        key: null,
        entries: ungrouped,
        hasKey: () => false,
      } as unknown as BasesEntryGroup);
    }

    return groups;
  }

  private getSortDescriptors(): TpsSortDescriptor[] {
    const rawSort = (this.config as any)?.sort
      ?? (this.config as any)?.getSort?.()
      ?? this.getConfigValue('sortBy')
      ?? [];
    const values = Array.isArray(rawSort) ? rawSort : rawSort ? [rawSort] : [];
    return values
      .map((item: any) => {
        const prop = typeof item === 'string'
          ? item.trim()
          : String(item?.property ?? item?.field ?? item?.key ?? '').trim();
        if (!prop) return null;
        const rawDirection = String(item?.direction ?? item?.dir ?? item?.order ?? '').trim().toLowerCase();
        const direction = rawDirection === 'desc' || rawDirection === 'descending' ? 'desc' : 'asc';
        return { prop, direction } satisfies TpsSortDescriptor;
      })
      .filter((item): item is TpsSortDescriptor => !!item);
  }

  private getCardPropertyIds(groupPropName: string | null): string[] {
    const rawOrder = (this.config as any)?.order ?? [];
    const values = Array.isArray(rawOrder) ? rawOrder : rawOrder ? [rawOrder] : [];
    const excluded = new Set([
      'file.name',
      'file.basename',
      'file.fullname',
      'name',
      'title',
      this.normalizeInlinePropertyKey(groupPropName || ''),
      this.normalizeInlinePropertyKey(this.plugin.settings?.iconKey || 'icon'),
      this.normalizeInlinePropertyKey(this.plugin.settings?.colorKey || 'color'),
      'icon',
      'color',
      'sort',
    ].filter(Boolean));
    const seen = new Set<string>();
    const props: string[] = [];
    for (const item of values) {
      const prop = typeof item === 'string'
        ? item.trim()
        : String(item?.property ?? item?.field ?? item?.key ?? '').trim();
      if (!prop) continue;
      const normalized = this.normalizeInlinePropertyKey(this.getFrontmatterPropNameFromId(prop) ?? prop);
      const lower = prop.toLowerCase();
      if (excluded.has(lower) || excluded.has(normalized)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      props.push(prop);
    }
    return props.slice(0, 4);
  }

  private sortEntriesForView(entries: BasesEntry[]): BasesEntry[] {
    const sortDescriptors = this.getSortDescriptors();
    if (!sortDescriptors.length) return entries;

    return [...entries].sort((a, b) => {
      for (const { prop, direction } of sortDescriptors) {
        const av = this.sortValue(a, prop);
        const bv = this.sortValue(b, prop);
        if (av < bv) return direction === 'desc' ? 1 : -1;
        if (av > bv) return direction === 'desc' ? -1 : 1;
      }
      return a.file.path.localeCompare(b.file.path);
    });
  }

  private sortValue(entry: BasesEntry, propId: string): string {
    const lower = String(propId || '').trim().toLowerCase();
    if (lower === 'file.name' || lower === 'name' || lower === 'title') return String(entry.file?.basename || entry.file?.name || '').toLowerCase();
    if (lower === 'file.path' || lower === 'path') return String(entry.file?.path || '').toLowerCase();
    const raw = entry.getValue(propId.includes('.') ? propId as any : `note.${propId}` as any);
    if (Array.isArray(raw)) return raw.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean).join('\u0000');
    if (raw instanceof Date) return raw.toISOString();
    return String(raw ?? '').trim().toLowerCase();
  }

  private extractGroupValues(raw: unknown): string[] {
    return extractKanbanGroupValues(raw);
  }

  private keyLabel(group: BasesEntryGroup): string {
    if (!group.hasKey() || group.key == null) return 'No value';
    const s = String(group.key ?? '').trim();
    const normalized = s.toLowerCase();
    if (!s || normalized === 'null' || normalized === 'undefined') return 'No value';
    return s;
  }

  private getLaneLabelAlias(laneId: string): string | null {
    const viewId = this.getLaneOrderViewId();
    const all = this.plugin.settings?.laneLabelAliasesByView as Record<string, Record<string, string>> | undefined;
    const aliases = all?.[viewId] ?? all?.[this.getLegacyUnknownBaseViewId()];
    if (!aliases || typeof aliases !== 'object') return null;
    const alias = String(aliases[laneId] ?? '').trim();
    return alias || null;
  }

  private getLaneDisplayLabel(group: BasesEntryGroup): string {
    const laneId = this.getLaneId(group);
    const alias = this.getLaneLabelAlias(laneId);
    if (alias) return alias;
    const scheduledTemplateLabel = this.getScheduledTemplateLaneLabel(group);
    if (scheduledTemplateLabel) return scheduledTemplateLabel;
    return this.keyLabel(group);
  }

  private getScheduledTemplateLaneLabel(group: BasesEntryGroup): string | null {
    const groupPropName = this.getGroupByPropName();
    if (this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(groupPropName)) !== 'scheduled') return null;

    const scheduled = this.getBaseContextFrontmatterValue('scheduled');
    if (!scheduled) return null;
    if (!group.hasKey() || group.key == null) return 'Unscheduled';

    const groupKey = String(group.key ?? '').trim();
    if (!groupKey) return 'Unscheduled';
    const scheduledDay = scheduled.slice(0, 10);
    const groupDay = groupKey.slice(0, 10);
    return scheduledDay && groupDay === scheduledDay ? 'Scheduled today' : null;
  }

  private buildDisplayLaneGroups(groups: BasesEntryGroup[]): DisplayLaneGroup[] {
    const byLabel = new Map<string, DisplayLaneGroup>();
    const ordered: DisplayLaneGroup[] = [];

    for (const group of groups) {
      const label = this.getLaneDisplayLabel(group);
      const normalized = label.trim().toLowerCase() || 'no value';
      let display = byLabel.get(normalized);
      if (!display) {
        display = {
          id: `display:${normalized}`,
          label,
          groups: [],
          laneIds: [],
        };
        byLabel.set(normalized, display);
        ordered.push(display);
      }
      display.groups.push(group);
      display.laneIds.push(this.getLaneId(group));
    }

    return ordered;
  }

  private getRenderItemsForDisplayLane(
    displayLane: DisplayLaneGroup,
    laneRenderItemsByLane: Map<string, LaneRenderItem[]>,
  ): LaneRenderItem[] {
    const items: LaneRenderItem[] = [];
    const seen = new Set<string>();
    const cloneVisibleTree = (item: LaneRenderItem): LaneRenderItem | null => {
      const path = item.entry.file.path;
      if (seen.has(path)) return null;
      seen.add(path);
      return {
        ...item,
        children: item.children.map(cloneVisibleTree).filter((child): child is LaneRenderItem => !!child),
      };
    };
    for (const laneId of displayLane.laneIds) {
      const laneItems = laneRenderItemsByLane.get(laneId) ?? [];
      for (const item of laneItems) {
        const cloned = cloneVisibleTree(item);
        if (cloned) items.push(cloned);
      }
    }
    return items;
  }

  private async resolveDropValueForDisplayLane(
    displayLane: DisplayLaneGroup,
  ): Promise<{ selected: boolean; value: string | null }> {
    const options = displayLane.groups.map((group) => {
      if (group.hasKey() && group.key != null) {
        const value = String(group.key ?? '').trim();
        return { label: value || 'No value', value: value || null };
      }
      return { label: 'No value', value: null };
    });

    // De-duplicate while preserving lane order.
    const deduped: Array<{ label: string; value: string | null }> = [];
    const seen = new Set<string>();
    for (const option of options) {
      const key = option.value === null ? '__null__' : option.value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(option);
    }

    if (displayLane.groups.length <= 1 || deduped.length <= 1) {
      return { selected: true, value: deduped[0]?.value ?? null };
    }

    const selection = await new Promise<string | null | undefined>((resolve) => {
      const modal = new LaneValueSelectModal(
        this.app,
        `Apply value in "${displayLane.label}"`,
        deduped,
        resolve,
      );
      modal.open();
    });
    if (selection === undefined) return { selected: false, value: null };
    return { selected: true, value: selection };
  }

  private async renameLaneLabel(group: BasesEntryGroup): Promise<void> {
    const laneId = this.getLaneId(group);
    const viewId = this.getLaneOrderViewId();
    const baseLabel = this.keyLabel(group);
    const current = this.getLaneLabelAlias(laneId) || '';
    const entered = await new Promise<string | null>((resolve) => {
      const modal = new LaneRenameModal(this.app, baseLabel, current, resolve);
      modal.open();
    });
    if (entered == null) return;
    const nextLabel = entered.trim();

    const existingAll = this.plugin.settings?.laneLabelAliasesByView;
    const all: Record<string, Record<string, string>> = (existingAll && typeof existingAll === 'object')
      ? { ...existingAll }
      : {};
    const viewAliases: Record<string, string> = { ...(all[viewId] || {}) };

    if (!nextLabel || nextLabel === baseLabel) {
      delete viewAliases[laneId];
    } else {
      viewAliases[laneId] = nextLabel;
    }

    all[viewId] = viewAliases;
    this.plugin.settings.laneLabelAliasesByView = all;
    await this.plugin.saveSettings();
    this.render();
  }

  private normalizeInlinePropertyKey(key: string): string {
    return String(key || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private getTaskInlinePropertyName(propName: string | null | undefined): string {
    return String(propName || '').trim().replace(/^(?:task|note)\./i, '');
  }

  private isStatusPropertyName(propName: string | null | undefined): boolean {
    const normalized = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propName));
    if (!normalized) return false;
    if (normalized === 'status' || normalized === 'checkboxstatus') return true;
    const configuredKey = this.getGcmServices()?.status?.getStatusPropertyKey?.()
      ?? this.getGcmSettings()?.properties?.find?.((property: any) => {
        const id = String(property?.id || '').trim().toLowerCase();
        const key = String(property?.key || '').trim().toLowerCase();
        return id === 'status' || key === 'status';
      })?.key;
    return normalized === this.normalizeInlinePropertyKey(String(configuredKey || ''));
  }

  private async openOrFocusFile(file: TFile): Promise<WorkspaceLeaf | null> {
    const existingLeaf = this.findMainWorkspaceLeafForFile(file);
    if (existingLeaf) {
      flow('OpenTarget', 'focus-existing', { path: file.path });
      this.app.workspace.setActiveLeaf(existingLeaf, { focus: true } as any);
      this.app.workspace.revealLeaf(existingLeaf);
      return existingLeaf;
    }

    const leaf = this.getTargetLeafForOpen();
    if (!leaf) {
      flowWarn('OpenTarget', 'blocked', { reason: 'no-target-leaf', path: file.path });
      return null;
    }
    flow('OpenTarget', 'open-new', { path: file.path });
    await leaf.openFile(file, { active: true } as any);
    this.app.workspace.setActiveLeaf(leaf, { focus: true } as any);
    this.app.workspace.revealLeaf(leaf);
    flow('OpenTarget', 'open-done', { path: file.path });
    return leaf;
  }

  private async openTaskLine(file: TFile, line: number): Promise<void> {
    const leaf = await this.openOrFocusFile(file);
    const view = leaf?.view as any;
    const editor = view?.editor;
    const targetLine = Math.max(0, Number(line || 1) - 1);
    if (!editor || typeof editor.setCursor !== 'function') {
      flowWarn('OpenTaskLine', 'blocked', {
        reason: 'missing-editor',
        path: file.path,
        line: targetLine + 1,
      });
      return;
    }
    flow('OpenTaskLine', 'scroll:start', {
      path: file.path,
      line: targetLine + 1,
    });
    editor.setCursor({ line: targetLine, ch: 0 });
    if (typeof editor.scrollIntoView === 'function') {
      editor.scrollIntoView({ from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } }, true);
    }
    if (typeof editor.focus === 'function') editor.focus();
    flow('OpenTaskLine', 'scroll:done', {
      path: file.path,
      line: targetLine + 1,
    });
  }

  private findMainWorkspaceLeafForFile(file: TFile): WorkspaceLeaf | null {
    let match: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (match || !this.isMainWorkspaceOpenTarget(leaf)) return;
      const viewFile = (leaf.view as any)?.file;
      if (viewFile instanceof TFile && viewFile.path === file.path) {
        match = leaf;
      }
    });
    return match;
  }

  private getTargetLeafForOpen(): WorkspaceLeaf | null {
    return this.app.workspace.getLeaf('tab');
  }

  private isMainWorkspaceOpenTarget(leaf: WorkspaceLeaf | null | undefined): leaf is WorkspaceLeaf {
    if (!leaf) return false;
    const containerEl = (leaf as any).containerEl as HTMLElement | undefined;
    if (containerEl?.closest('.workspace-split.mod-left-split, .workspace-split.mod-right-split')) return false;
    const viewType = leaf.view?.getViewType?.();
    return viewType !== KANBAN_VIEW_TYPE;
  }

  private getEntryValue(entry: BasesEntry, propName: string): unknown {
    try {
      return entry.getValue(propName as any);
    } catch {
      return undefined;
    }
  }

  private getEntryStringValue(entry: BasesEntry, propName: string): string {
    const value = this.getEntryValue(entry, propName);
    return value == null ? '' : String(value).trim();
  }

  private getOrderedVisiblePaths(
    displayLanes: DisplayLaneGroup[],
    renderItemsByDisplayLane: Map<string, LaneRenderItem[]>,
  ): string[] {
    const ordered: string[] = [];
    const appendItem = (item: LaneRenderItem) => {
      ordered.push(item.entry.file.path);
      for (const child of item.children) appendItem(child);
    };
    for (const displayLane of displayLanes) {
      const items = renderItemsByDisplayLane.get(displayLane.id) ?? [];
      for (const item of items) appendItem(item);
    }
    return ordered;
  }

  private buildLaneRenderItemsByLane(
    groups: BasesEntryGroup[],
    parentByChild: Map<string, string>,
  ): Map<string, LaneRenderItem[]> {
    const laneRenderItemsByLane = new Map<string, LaneRenderItem[]>();
    const markCollapsedDescendantsHandled = (
      parentPath: string,
      lineage: Set<string>,
      renderedInLane: Set<string>,
      laneChildrenByParent: Map<string, BasesEntry[]>,
    ) => {
      const children = laneChildrenByParent.get(parentPath) ?? [];
      for (const child of children) {
        const childPath = child.file.path;
        if (renderedInLane.has(childPath) || lineage.has(childPath)) continue;
        renderedInLane.add(childPath);
        const nextLineage = new Set(lineage);
        nextLineage.add(childPath);
        markCollapsedDescendantsHandled(childPath, nextLineage, renderedInLane, laneChildrenByParent);
      }
    };

    const walk = (
      entry: BasesEntry,
      depth: number,
      lineage: Set<string>,
      renderedInLane: Set<string>,
      laneChildrenByParent: Map<string, BasesEntry[]>,
    ): LaneRenderItem | null => {
      const path = entry.file.path;
      if (renderedInLane.has(path) || lineage.has(path)) return null;

      renderedInLane.add(path);
      const childCount = (laneChildrenByParent.get(path) ?? []).length;
      const hasChildren = childCount > 0;
      const item: LaneRenderItem = { entry, depth, hasChildren, childCount, children: [] };

      if (hasChildren && !this.expandedSubtreePaths.has(path)) {
        const nextLineage = new Set(lineage);
        nextLineage.add(path);
        markCollapsedDescendantsHandled(path, nextLineage, renderedInLane, laneChildrenByParent);
        return item;
      }

      const nextLineage = new Set(lineage);
      nextLineage.add(path);
      const children = laneChildrenByParent.get(path) ?? [];
      for (const child of children) {
        const childItem = walk(child, depth + 1, nextLineage, renderedInLane, laneChildrenByParent);
        if (childItem) item.children.push(childItem);
      }
      return item;
    };

    for (const group of groups) {
      const laneId = this.getLaneId(group);
      const laneEntryByPath = new Map<string, BasesEntry>();
      for (const entry of group.entries) {
        if (!laneEntryByPath.has(entry.file.path)) {
          laneEntryByPath.set(entry.file.path, entry);
        }
      }

      const laneChildrenByParent = new Map<string, BasesEntry[]>();
      for (const entry of laneEntryByPath.values()) {
        const parentPath = parentByChild.get(entry.file.path);
        if (!parentPath || parentPath === entry.file.path) continue;
        if (!laneEntryByPath.has(parentPath)) continue;
        const children = laneChildrenByParent.get(parentPath) ?? [];
        children.push(entry);
        laneChildrenByParent.set(parentPath, children);
      }

      const topLevel: BasesEntry[] = [];
      for (const entry of laneEntryByPath.values()) {
        const parentPath = parentByChild.get(entry.file.path);
        const hasVisibleParentInLane = !!parentPath && parentPath !== entry.file.path && laneEntryByPath.has(parentPath);
        if (!hasVisibleParentInLane) topLevel.push(entry);
      }

      laneRenderItemsByLane.set(laneId, []);
      const renderedInLane = new Set<string>();
      for (const entry of topLevel) {
        const item = walk(entry, 0, new Set(), renderedInLane, laneChildrenByParent);
        if (item) laneRenderItemsByLane.get(laneId)?.push(item);
      }

      // Defensive fallback for malformed parent chains/cycles.
      for (const entry of laneEntryByPath.values()) {
        if (!renderedInLane.has(entry.file.path)) {
          const item = walk(entry, 0, new Set(), renderedInLane, laneChildrenByParent);
          if (item) laneRenderItemsByLane.get(laneId)?.push(item);
        }
      }
    }

    return laneRenderItemsByLane;
  }

  private buildTaskRenderItemsByLane(
    groups: BasesEntryGroup[],
    propName: string | null,
    visibleNotePaths = this.getVisibleNotePaths(groups),
    taskFilter = this.getTaskRootFilterFromBaseFilters(),
  ): Map<string, TaskRenderItem[]> {
    const tasksByLane = new Map<string, TaskRenderItem[]>();
    if (taskFilter.mode === 'notes') return tasksByLane;
    if (!this.isBaseFileFilterReady()) {
      this.scheduleBaseFileFilterLoad();
      return tasksByLane;
    }
    const searchQuery = this.getActiveBasesSearchQuery();
    const explicitTaskSourceFiles = this.getExplicitTaskSourceFiles(taskFilter);
    const explicitTaskSourcePaths = new Set(explicitTaskSourceFiles.map((file) => file.path));

    const sourceFiles = new Map<string, TFile>();
    for (const group of groups) {
      for (const entry of group.entries) {
        if (!sourceFiles.has(entry.file.path)) sourceFiles.set(entry.file.path, entry.file);
      }
    }
    for (const file of explicitTaskSourceFiles) {
      if (!sourceFiles.has(file.path)) sourceFiles.set(file.path, file);
    }
    if (taskFilter.mode === 'tasks' || taskFilter.mode === 'bullets' || this.shouldScanVaultForTaskFilters(taskFilter)) {
      for (const file of this.app.vault.getMarkdownFiles()) {
        if (!sourceFiles.has(file.path)) sourceFiles.set(file.path, file);
      }
    }

    for (const file of sourceFiles.values()) {
      if (
        taskFilter.mode !== 'tasks'
        && !taskFilter.hasTaskDirective
        && !explicitTaskSourcePaths.has(file.path)
        && !visibleNotePaths.has(file.path)
      ) continue;
      for (const task of this.getAllLineItemsForFile(file, taskFilter)) {
        if (!this.taskMatchesRootFilter(task, taskFilter, file)) continue;
        if (!this.taskMatchesSearchQuery(file, task, searchQuery)) continue;
        for (const laneId of this.getTaskLaneIds(task, propName)) {
          const laneTasks = tasksByLane.get(laneId) ?? [];
          laneTasks.push({ file, task, laneId });
          tasksByLane.set(laneId, laneTasks);
        }
      }
    }

    return tasksByLane;
  }

  private getExplicitTaskSourceFiles(taskFilter = this.getTaskRootFilterFromBaseFilters()): TFile[] {
    const paths = new Set<string>();
    const defaults = this.getRootTaskCreationDefaults(taskFilter);
    const targetPath = this.normalizeTaskTargetPath(defaults.targetPath || '');
    if (targetPath) paths.add(targetPath);
    for (const root of this.getBaseFilterRoots()) {
      this.collectTaskPathFilters(root, paths);
    }
    return Array.from(paths)
      .map((path) => this.app.vault.getFileByPath(path))
      .filter((file): file is TFile => file instanceof TFile);
  }

  private isExplicitTaskSourceFile(file: TFile, taskFilter = this.getTaskRootFilterFromBaseFilters()): boolean {
    return this.getExplicitTaskSourceFiles(taskFilter).some((source) => source.path === file.path);
  }

  private isTaskSourceFile(file: TFile, taskFilter = this.getTaskRootFilterFromBaseFilters()): boolean {
    return this.shouldScanVaultForTaskFilters(taskFilter) || this.isExplicitTaskSourceFile(file, taskFilter);
  }

  private shouldScanVaultForTaskFilters(taskFilter = this.getTaskRootFilterFromBaseFilters()): boolean {
    if (taskFilter.mode === 'tasks' || taskFilter.mode === 'bullets') return true;
    if (this.isEmbeddedScheduledDailyTaskBoard()) return true;
    if (!taskFilter.hasTaskDirective) return false;
    return this.getBaseFilterRoots().some((root) => this.hasGlobalTaskMatchFilter(root));
  }

  private hasGlobalTaskMatchFilter(node: unknown): boolean {
    if (!node) return false;
    if (Array.isArray(node)) return node.some((child) => this.hasGlobalTaskMatchFilter(child));
    if (typeof node === 'string') {
      const expr = node.trim().replace(/^!+\s*/u, '');
      if (parseBareSemanticKindExpression(expr)) return false;
      return /^(?:task\.)?(?:tags?|status|open|isopen|done|isdone|completed|complete)\b/i.test(expr)
        || /^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=|is|equals?)\s*["']?(?:task|tasks)["']?$/i.test(expr)
        || this.isSharedTaskValueFilterExpression(expr);
    }
    if (typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    const propRaw = this.readFilterObjectProperty(record).toLowerCase();
    if (isBareSemanticKindFilter(propRaw, this.readFilterObjectValues(record))) return false;
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^(?:task|tps|kanban)\./i, ''));
    if (propRaw.startsWith('task.') && !['path', 'file', 'filepath', 'fileextension', 'fileext'].includes(normalizedProp)) return true;
    if (['itemtype', 'itemkind', 'kind', 'tags', 'tag', 'status', 'open', 'isopen', 'done', 'isdone', 'completed', 'complete'].includes(normalizedProp)) return true;
    if (propRaw && !propRaw.startsWith('note.') && !propRaw.startsWith('file.') && !['path', 'file', 'filepath', 'fileextension', 'fileext'].includes(normalizedProp)) return true;
    return Object.values(record).some((value) => this.hasGlobalTaskMatchFilter(value));
  }

  private isSharedTaskValueFilterExpression(expr: string): boolean {
    const prop = this.readFilterExpressionProperty(expr);
    if (!prop) return false;
    const lower = prop.toLowerCase();
    if (lower.startsWith('note.') || lower.startsWith('file.')) return false;
    if (parseBareSemanticKindExpression(expr)) return false;
    const normalized = this.normalizeInlinePropertyKey(lower.replace(/^(?:task|tps|kanban)\./i, ''));
    return !['path', 'file', 'filepath', 'fileextension', 'fileext', 'extension', 'ext'].includes(normalized);
  }

  private collectTaskPathFilters(node: unknown, paths: Set<string>): void {
    if (!node) return;
    if (typeof node === 'string') {
      const extracted = this.extractTaskPathFilterFromString(node);
      if (extracted) paths.add(extracted);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) this.collectTaskPathFilters(child, paths);
      return;
    }
    if (typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const pathFromObject = this.extractTaskPathFilterFromObject(record);
    if (pathFromObject) paths.add(pathFromObject);
    for (const value of Object.values(record)) this.collectTaskPathFilters(value, paths);
  }

  private extractTaskPathFilterFromString(rawExpr: string): string | null {
    const expr = String(rawExpr || '').trim().replace(/^!+\s*/u, '');
    const match = expr.match(/^(?:task\.)?(?:path|file|file\.path)\s*(?:==|=|is|equals?)\s*(?:"([^"]+)"|'([^']+)'|(.+))$/i);
    const value = match?.[1] || match?.[2] || match?.[3];
    return value ? this.normalizeTaskTargetPath(value) : null;
  }

  private extractTaskPathFilterFromObject(record: Record<string, unknown>): string | null {
    const propRaw = this.readFilterObjectProperty(record);
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^task\./i, '').replace(/^tps\./i, ''));
    if (!(['path', 'file', 'filepath'].includes(normalizedProp) || propRaw.toLowerCase() === 'file.path' || propRaw.toLowerCase() === 'task.file.path')) return null;
    const operator = this.readFilterObjectOperator(record);
    if (!this.isPathComparisonOperator(operator) || operator.includes('contains') || operator.startsWith('!')) return null;
    const value = this.readFilterObjectValues(record).find(Boolean);
    return value ? this.normalizeTaskTargetPath(value) : null;
  }

  private getActiveBasesSearchQuery(): string {
    const roots = [
      this.containerEl.closest('.internal-embed, .markdown-embed, .cm-embed-block, .sync-embed, .sync-container') as HTMLElement | null,
      this.containerEl.closest('.workspace-leaf') as HTMLElement | null,
    ].filter((root): root is HTMLElement => !!root);

    for (const root of roots) {
      const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]'));
      for (const input of inputs) {
        const value = String(input.value || '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  private taskMatchesSearchQuery(file: TFile, task: OpenTaskSubitem, query: string): boolean {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;
    const haystack = [
      file.basename,
      file.name,
      file.path,
      task.text,
      task.displayText,
      task.checkboxState,
      ...(task.inlineFields ?? []).flatMap((field) => [field.key, field.value]),
    ]
      .map((value) => String(value ?? '').toLowerCase())
      .join('\n');
    return normalizedQuery
      .split(/\s+/g)
      .filter(Boolean)
      .every((part) => haystack.includes(part));
  }

  private getVisibleNotePaths(groups: BasesEntryGroup[]): Set<string> {
    const visible = new Set<string>();
    for (const group of groups) {
      for (const entry of group.entries) visible.add(entry.file.path);
    }
    return visible;
  }

  private getAllLineItemsForFile(file: TFile, filter: KanbanTaskRootFilter): OpenTaskSubitem[] {
    if (filter.mode !== 'bullets') return this.getAllTasksForFile(file);
    const cached = this.allTasksByPath.get(`${file.path}:bullets`);
    if (cached) return cached;
    let items: OpenTaskSubitem[] = [];
    void this.app.vault.cachedRead(file).then((content) => {
      items = this.parseOpenTasks(content, file.path, Number.MAX_SAFE_INTEGER, true, true).openTasks;
      this.allTasksByPath.set(`${file.path}:bullets`, items);
      this.refreshDebounced();
    });
    return items;
  }

  private taskMatchesRootFilter(task: OpenTaskSubitem, filter: KanbanTaskRootFilter, file: TFile | null = null): boolean {
    const structuredMatch = this.taskMatchesStructuredBaseFilters(task, file);
    if (structuredMatch === false) return false;
    if (structuredMatch == null && this.isEmbeddedScheduledDailyTaskBoard()) {
      if (!this.taskMatchesEmbeddedScheduledDailyBoard(task)) return false;
    }

    if (filter.mode === 'tasks' && task.itemKind === 'bullet') return false;
    if (filter.mode === 'bullets' && task.itemKind !== 'bullet') return false;
    if (task.itemKind === 'bullet' && structuredMatch !== true) return false;

    if (task.itemKind === 'bullet') {
      const taskTags = new Set(this.getTaskInlineValues(task, 'tags').map((tag) => tag.toLowerCase()));
      for (const tag of filter.excludeTags) {
        if (taskTags.has(tag)) return false;
      }
      if (filter.tags.size) {
        let matched = false;
        for (const tag of filter.tags) {
          if (taskTags.has(tag)) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }

    const status = this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
    if (!filter.includeDone && this.getDoneStatuses().has(status)) return false;
    if (filter.excludeStatuses.has(status)) return false;
    if (filter.statuses.size && !filter.statuses.has(status)) return false;
    const taskTags = new Set(this.getTaskInlineValues(task, 'tags').map((tag) => tag.toLowerCase()));
    for (const tag of filter.excludeTags) {
      if (taskTags.has(tag)) return false;
    }
    if (filter.tags.size) {
      let matched = false;
      for (const tag of filter.tags) {
        if (taskTags.has(tag)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  private isEmbeddedScheduledDailyTaskBoard(): boolean {
    const groupPropName = this.getGroupByPropName();
    if (this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(groupPropName)) !== 'scheduled') return false;
    if (!this.getBaseContextFrontmatterValue('scheduled')) return false;
    return this.isEmbeddedScheduledDailyTaskFallbackFilter();
  }

  private isEmbeddedScheduledDailyTaskFallbackFilter(): boolean {
    const roots = this.getBaseFilterRoots();
    if (!roots.length) return false;
    return roots.some((root) => this.filterTreeHasDailyTaskFallback(root));
  }

  private filterTreeHasDailyTaskFallback(root: unknown): boolean {
    const conditions = this.collectFilterTextConditions(root);
    return conditions.some((condition) => this.isTaskKindCondition(condition))
      && conditions.some((condition) => this.isScheduledTodayCondition(condition))
      && conditions.some((condition) => this.isScheduledEmptyCondition(condition));
  }

  private collectFilterTextConditions(root: unknown, seen = new WeakSet<object>()): string[] {
    if (!root) return [];
    if (typeof root === 'string') return [this.normalizeFilterConditionText(root)];
    if (typeof root !== 'object') return [];
    if (seen.has(root)) return [];
    seen.add(root);

    if (Array.isArray(root)) {
      return root.flatMap((item) => this.collectFilterTextConditions(item, seen));
    }

    const record = root as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ['and', 'or', 'all', 'any', 'not', 'children', 'filters']) {
      parts.push(...this.collectFilterTextConditions(record[key], seen));
    }

    const prop = String(record.property ?? record.field ?? record.key ?? '').trim();
    const operator = String(record.operator ?? record.op ?? record.comparison ?? '').trim();
    const value = record.value ?? record.values ?? record.expected;
    if (prop || operator || value != null) {
      parts.push(this.normalizeFilterConditionText(`${prop} ${operator} ${Array.isArray(value) ? value.join(',') : String(value ?? '')}`));
    }

    return parts.filter(Boolean);
  }

  private normalizeFilterConditionText(condition: string): string {
    return condition
      .toLowerCase()
      .replace(/\\?["'`]/g, '')
      .replace(/\s+/g, '');
  }

  private isTaskKindCondition(condition: string): boolean {
    return /(?:^|[^\w.])kind(?:==|=|is|:)?task(?:$|[^\w.])/.test(condition);
  }

  private isScheduledTodayCondition(condition: string): boolean {
    return condition.includes('scheduled==this.scheduled')
      || condition.includes('scheduled=this.scheduled')
      || condition.includes('scheduledisthis.scheduled')
      || condition.includes('scheduled:this.scheduled');
  }

  private isScheduledEmptyCondition(condition: string): boolean {
    return condition.includes('scheduled.isempty()')
      || condition.includes('scheduled.empty()')
      || condition.includes('scheduledisempty')
      || condition.includes('scheduledempty');
  }

  private taskMatchesEmbeddedScheduledDailyBoard(task: OpenTaskSubitem): boolean {
    if (task.itemKind === 'bullet') return false;
    const scheduled = this.getBaseContextFrontmatterValue('scheduled');
    const scheduledDay = this.extractDateDay(scheduled || '');
    if (!scheduledDay) return false;
    const values = this.getTaskInlineValues(task, 'scheduled');
    if (!values.length) return true;
    return values.some((value) => this.extractDateDay(value) === scheduledDay);
  }

  private taskMatchesStructuredBaseFilters(task: OpenTaskSubitem, file: TFile | null = null): boolean | null {
    let hasStructuredTaskFilter = false;
    for (const root of this.getBaseFilterRoots()) {
      const result = this.evaluateTaskFilterNode(root, task, file);
      if (result == null) continue;
      hasStructuredTaskFilter = true;
      if (!result) return false;
    }
    return hasStructuredTaskFilter ? true : null;
  }

  private evaluateTaskFilterNode(node: unknown, task: OpenTaskSubitem, file: TFile | null = null): boolean | null {
    if (!node) return null;
    if (typeof node === 'string') return this.evaluateTaskFilterString(node, task, file);
    if (Array.isArray(node)) return this.combineTaskFilterResults(node.map((child) => this.evaluateTaskFilterNode(child, task, file)), 'and');
    if (typeof node !== 'object') return null;

    const record = node as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'and') || Object.prototype.hasOwnProperty.call(record, 'all')) {
      const children = Object.prototype.hasOwnProperty.call(record, 'and') ? record.and : record.all;
      return this.combineTaskFilterResults(this.asArray(children).map((child) => this.evaluateTaskFilterNode(child, task, file)), 'and');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'or') || Object.prototype.hasOwnProperty.call(record, 'any')) {
      const children = Object.prototype.hasOwnProperty.call(record, 'or') ? record.or : record.any;
      return this.combineTaskFilterResults(this.asArray(children).map((child) => this.evaluateTaskFilterNode(child, task, file)), 'or');
    }
    if (Object.prototype.hasOwnProperty.call(record, 'not')) {
      const result = this.evaluateTaskFilterNode(record.not, task, file);
      return result == null ? null : !result;
    }

    return this.evaluateTaskFilterObject(record, task, file);
  }

  private combineTaskFilterResults(results: Array<boolean | null>, mode: 'and' | 'or'): boolean | null {
    const known = results.filter((result): result is boolean => result != null);
    if (!known.length) return null;
    return mode === 'and'
      ? known.every(Boolean)
      : known.some(Boolean);
  }

  private evaluateTaskFilterString(rawExpr: string, task: OpenTaskSubitem, file: TFile | null = null): boolean | null {
    const raw = String(rawExpr || '').trim();
    if (parseBareSemanticKindExpression(raw)) return false;
    const isNegated = raw.startsWith('!');
    const expr = (isNegated ? raw.slice(1) : raw).trim();
    const result = this.evaluatePositiveTaskFilterString(expr, task, file);
    return result == null ? null : isNegated ? !result : result;
  }

  private evaluatePositiveTaskFilterString(expr: string, task: OpenTaskSubitem, file: TFile | null = null): boolean | null {
    if (parseBareSemanticKindExpression(expr)) return false;
    const kindMatch = expr.match(/^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=|is|equals?)\s*["']?(task|tasks|bullet|bullets|note|notes|all|mixed)["']?$/i);
    if (kindMatch?.[1]) {
      const value = kindMatch[1].toLowerCase();
      if (value.startsWith('bullet')) return task.itemKind === 'bullet';
      if (value.startsWith('task')) return task.itemKind !== 'bullet';
      if (value.startsWith('note')) return null;
      return value === 'all' || value === 'mixed';
    }

    const status = this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
    if (/^(?:task\.)?(?:open|isopen)\s*(?:==|=)\s*(true|1)$/i.test(expr)) return !this.getDoneStatuses().has(status);
    if (/^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(false|0)$/i.test(expr)) return !this.getDoneStatuses().has(status);
    if (/^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(true|1)$/i.test(expr)) return this.getDoneStatuses().has(status);

    const statusResult = this.evaluateTaskValueFilterExpression(expr, 'status', [status], false);
    if (statusResult != null) return statusResult;
    const tagsResult = this.evaluateTaskValueFilterExpression(expr, 'tags', this.getTaskInlineValues(task, 'tags'), false);
    if (tagsResult != null) return tagsResult;
    const fileResult = this.evaluateTaskFileFilterExpression(expr, file);
    if (fileResult != null) return fileResult;
    return this.evaluateGenericTaskValueFilterExpression(expr, task);
  }

  private evaluateTaskValueFilterExpression(expr: string, propName: 'status' | 'tags', rawValues: string[], requireTaskPrefix = false): boolean | null {
    const propPattern = `${requireTaskPrefix ? 'task\\.' : '(?:task\\.)?'}${propName === 'tags' ? '(?:tags|tag)' : 'status'}`;
    const values = new Set(rawValues.map((value) => propName === 'tags' ? this.normalizeTaskTag(value) : String(value || '').trim().toLowerCase()).filter(Boolean));
    const normalizeToken = (token: string) => {
      const resolved = this.resolveBaseContextToken(token) || token;
      return propName === 'tags' ? this.normalizeTaskTag(resolved) : resolved.trim().toLowerCase();
    };
    const containsAnyMatch = expr.match(new RegExp(`^${propPattern}\\.containsAny\\((.*)\\)$`, 'i'));
    if (containsAnyMatch) return this.extractFilterTokens(containsAnyMatch[1] || '').some((token) => values.has(normalizeToken(token)));
    const containsMatch = expr.match(new RegExp(`^${propPattern}\\.contains\\((.*)\\)$`, 'i'));
    if (containsMatch) return this.extractFilterTokens(containsMatch[1] || '').some((token) => values.has(normalizeToken(token)));
    const equalsCallMatch = expr.match(new RegExp(`^${propPattern}\\.equals\\((.*)\\)$`, 'i'));
    if (equalsCallMatch) return this.extractFilterTokens(equalsCallMatch[1] || '').some((token) => values.has(normalizeToken(token)));
    if (new RegExp(`^${propPattern}\\.(?:isEmpty|empty)\\(\\)$`, 'i').test(expr)) return values.size === 0;
    const existsMatch = expr.match(new RegExp(`^${propPattern}\\.(?:exists|isNotEmpty)\\(\\)$`, 'i'));
    if (existsMatch) return values.size > 0;
    const wordOperatorMatch = expr.match(new RegExp(`^${propPattern}\\s+(contains|has|is not empty|is empty|isNotEmpty|exists|empty|is|equals?)\\s*(.*)$`, 'i'));
    if (wordOperatorMatch) {
      const op = wordOperatorMatch[1].trim().toLowerCase().replace(/\s+/g, '');
      if (op === 'isempty' || op === 'empty') return values.size === 0;
      if (op === 'isnotempty' || op === 'exists') return values.size > 0;
      const tokens = this.extractFilterTokens(wordOperatorMatch[2] || '');
      if (op === 'contains' || op === 'has') return tokens.some((token) => values.has(normalizeToken(token)));
      return tokens.some((token) => values.has(normalizeToken(token)));
    }
    const comparisonMatch = expr.match(new RegExp(`^${propPattern}\\s*(==|=|!=|!==|is|equals?)\\s*(?:"([^"]+)"|'([^']+)'|(.+))$`, 'i'));
    if (comparisonMatch?.[2] || comparisonMatch?.[3] || comparisonMatch?.[4]) {
      const matched = values.has(normalizeToken(comparisonMatch[2] || comparisonMatch[3] || comparisonMatch[4]));
      return String(comparisonMatch[1] || '').startsWith('!') ? !matched : matched;
    }
    return null;
  }

  private evaluateGenericTaskValueFilterExpression(expr: string, task: OpenTaskSubitem): boolean | null {
    const callMatch = expr.match(/^([\w.\s-]+)\.(contains|containsAny|equals)\((.*)\)$/i);
    if (callMatch?.[1]) {
      const values = this.getGenericTaskComparableValues(task, callMatch[1].trim());
      if (values == null) return false;
      const tokens = this.extractFilterTokens(callMatch[3] || '').map((value) => value.toLowerCase());
      if (callMatch[2].toLowerCase().includes('contains')) {
        return tokens.some((token) => this.taskValuesContain(callMatch[1].trim(), values, token));
      }
      return tokens.some((token) => this.taskValuesMatch(callMatch[1].trim(), values, token));
    }

    const emptyMatch = expr.match(/^([\w.\s-]+)\.(isEmpty|empty|exists|isNotEmpty)\(\)$/i);
    if (emptyMatch?.[1]) {
      const values = this.getGenericTaskComparableValues(task, emptyMatch[1].trim());
      if (values == null) return false;
      const op = emptyMatch[2].toLowerCase();
      return op.includes('empty') && !op.includes('not') ? values.length === 0 : values.length > 0;
    }

    const wordOperatorMatch = expr.match(/^([\w.\s-]+)\s+(contains|has|is not empty|is empty|isNotEmpty|exists|empty|is|equals?)\s*(.*)$/i);
    if (wordOperatorMatch?.[1]) {
      const values = this.getGenericTaskComparableValues(task, wordOperatorMatch[1].trim());
      if (values == null) return false;
      const op = wordOperatorMatch[2].trim().toLowerCase().replace(/\s+/g, '');
      if (op === 'isempty' || op === 'empty') return values.length === 0;
      if (op === 'isnotempty' || op === 'exists') return values.length > 0;
      const tokens = this.extractFilterTokens(wordOperatorMatch[3] || '').map((token) => token.toLowerCase());
      if (op === 'contains' || op === 'has') return tokens.some((token) => this.taskValuesContain(wordOperatorMatch[1].trim(), values, token));
      return tokens.some((token) => this.taskValuesMatch(wordOperatorMatch[1].trim(), values, token));
    }

    const comparisonMatch = expr.match(/^([\w.\s-]+)\s*(==|=|!=|!==|is|equals?)\s*["']?([^"']+)["']?$/i);
    if (comparisonMatch?.[1]) {
      const values = this.getGenericTaskComparableValues(task, comparisonMatch[1].trim());
      if (values == null) return false;
      const token = this.resolveBaseContextToken(comparisonMatch[3]) || comparisonMatch[3];
      const matched = this.taskValuesMatch(comparisonMatch[1].trim(), values, token);
      const op = String(comparisonMatch[2] || '').toLowerCase();
      return op.startsWith('!') ? !matched : matched;
    }

    return null;
  }

  private getGenericTaskComparableValues(task: OpenTaskSubitem, propRaw: string): string[] | null {
    const raw = String(propRaw || '').trim();
    const lower = raw.toLowerCase();
    if (!raw || lower.startsWith('note.') || lower.startsWith('file.')) return null;
    const prop = raw.replace(/^(?:task|tps|kanban)\./i, '');
    const normalized = this.normalizeInlinePropertyKey(prop);
    if (['itemtype', 'itemkind', 'kind', 'open', 'isopen', 'done', 'isdone', 'completed', 'complete'].includes(normalized)) return null;
    if (['status', 'checkboxstatus'].includes(normalized)) {
      return [this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo'];
    }
    if (['tag', 'tags'].includes(normalized)) {
      return this.getTaskInlineValues(task, 'tags').map((tag) => tag.toLowerCase());
    }
    return this.getTaskInlineValues(task, normalized).map((value) => value.toLowerCase());
  }

  private evaluateTaskFileFilterExpression(expr: string, file: TFile | null): boolean | null {
    const folderComparison = expr.match(/^file\.folder\s*(==|=|!=|!==|is|equals?)\s*(?:"([^"]*)"|'([^']*)'|(.+))$/i);
    if (folderComparison) {
      const expected = String(folderComparison[2] ?? folderComparison[3] ?? folderComparison[4] ?? '').trim();
      const isNegated = String(folderComparison[1] || '').startsWith('!');
      const matched = this.taskFileFolderMatches(file, expected, isNegated);
      return isNegated ? !matched : matched;
    }
    if (/^file\.links?\.(?:isEmpty|empty)\(\)$/i.test(expr)) return true;
    if (/^file\.links?\.(?:isNotEmpty|exists)\(\)$/i.test(expr)) return false;
    const propPattern = `(?:task\\.)?(?:path|file|file\\.path)`;
    const quoted = (text: string) => this.extractQuotedStrings(text).map((value) => value.trim().toLowerCase()).filter(Boolean);
    const pathCallMatch = expr.match(new RegExp(`^${propPattern}\\.(contains|startsWith|equals)\\((.*)\\)$`, 'i'));
    if (pathCallMatch) {
      const operator = pathCallMatch[1].toLowerCase();
      const tokens = quoted(pathCallMatch[2] || '').map((token) => this.resolveBaseContextToken(token) || token);
      if (operator === 'startswith') return tokens.some((token) => this.taskFilePathStartsWith(file, token));
      if (operator === 'equals') return tokens.some((token) => this.taskFilePathMatches(file, token));
      const values = file ? [file.path, file.basename, file.name, file.path.replace(/\.md$/i, '')].map((value) => value.toLowerCase()) : [];
      return tokens.some((token) => {
        const normalized = String(token || '').replace(/\.md$/i, '').toLowerCase();
        return values.some((value) => value.includes(String(token || '').toLowerCase()) || value.includes(normalized));
      });
    }
    const comparisonMatch = expr.match(new RegExp(`^${propPattern}\\s*(==|=|!=|!==|is|equals?)\\s*(?:"([^"]+)"|'([^']+)'|(.+))$`, 'i'));
    if (comparisonMatch?.[2] || comparisonMatch?.[3] || comparisonMatch?.[4]) {
      const matched = this.taskFilePathMatches(file, this.resolveBaseContextToken(comparisonMatch[2] || comparisonMatch[3] || comparisonMatch[4]) || '');
      const op = String(comparisonMatch[1] || '').toLowerCase();
      return op.startsWith('!') ? !matched : matched;
    }
    const extensionValues = file ? [file.extension.toLowerCase()] : [];
    const taskFileExtensionPattern = `task\\.file[.\\s-]*(?:extension|ext)`;
    const itemExtensionPattern = `(?:extension|ext|file[.\\s-]*(?:extension|ext)|file[\\s-]+(?:extension|ext))`;
    const extensionCallMatch = expr.match(new RegExp(`^${taskFileExtensionPattern}\\.(contains|equals)\\((.*)\\)$`, 'i'));
    if (extensionCallMatch) {
      const tokens = quoted(extensionCallMatch[2] || '').map((token) => token.replace(/^\./, ''));
      return tokens.some((token) => extensionValues.some((value) => extensionCallMatch[1].toLowerCase() === 'contains' ? value.includes(token) : value === token));
    }
    const fileExtensionComparison = expr.match(new RegExp(`^${taskFileExtensionPattern}\\s*(==|=|!=|!==|is|equals?)\\s*["']?([^"']+)["']?$`, 'i'));
    if (fileExtensionComparison?.[2]) {
      const token = fileExtensionComparison[2].trim().toLowerCase().replace(/^\./, '');
      const matched = extensionValues.includes(token);
      const op = String(fileExtensionComparison[1] || '').toLowerCase();
      return op.startsWith('!') ? !matched : matched;
    }
    const itemExtensionCallMatch = expr.match(new RegExp(`^${itemExtensionPattern}\\.(contains|equals)\\((.*)\\)$`, 'i'));
    if (itemExtensionCallMatch) return false;
    const itemExtensionComparison = expr.match(new RegExp(`^${itemExtensionPattern}\\s*(==|=|!=|!==|is|equals?)\\s*["']?([^"']+)["']?$`, 'i'));
    if (itemExtensionComparison?.[2]) {
      const op = String(itemExtensionComparison[1] || '').toLowerCase();
      return op.startsWith('!');
    }
    return null;
  }

  private taskFilePathMatches(file: TFile | null, rawValue: string): boolean {
    if (!file) return false;
    const needle = String(rawValue || '').trim().replace(/\\/g, '/').toLowerCase();
    if (!needle) return false;
    const withoutExt = needle.replace(/\.md$/i, '');
    return [
      file.path,
      file.basename,
      file.name,
      file.path.replace(/\.md$/i, ''),
    ].some((candidate) => {
      const normalized = String(candidate || '').replace(/\\/g, '/').toLowerCase();
      return normalized === needle || normalized === withoutExt || normalized.endsWith(`/${needle}`) || normalized.endsWith(`/${withoutExt}`);
    });
  }

  private taskFilePathStartsWith(file: TFile | null, rawValue: string): boolean {
    if (!file) return false;
    const needle = String(rawValue || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    if (!needle) return false;
    return String(file.path || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase().startsWith(needle);
  }

  private isPathComparisonOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return !op || op === '=' || op === '==' || op === '!=' || op === '!==' || op === 'is' || op === 'equals' || op === 'equal' || op.includes('contains') || op.includes('startswith') || op === 'starts';
  }

  private isStartsWithFilterOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return op.includes('startswith') || op === 'starts' || op === '!starts';
  }

  private readFilterObjectProperty(node: Record<string, unknown>): string {
    return String(
      node.property ??
      node.field ??
      node.key ??
      node.column ??
      node.left ??
      node.lhs ??
      node.operand ??
      '',
    ).trim();
  }

  private readFilterObjectOperator(node: Record<string, unknown>): string {
    return String(node.operator ?? node.op ?? node.comparison ?? node.type ?? node.condition ?? '').trim().toLowerCase();
  }

  private readFilterObjectValues(node: Record<string, unknown>): string[] {
    const value =
      node.values ??
      node.value ??
      node.pattern ??
      node.match ??
      node.right ??
      node.rhs ??
      node.target ??
      node.expected ??
      [];
    return this.asArray(value)
      .flatMap((item) => this.extractFilterTokens(String(item ?? '')))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private isNegatedFilterOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase();
    return op.startsWith('!') || op.includes('not') || op === '!=' || op === '!==';
  }

  private isContainsFilterOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return op.includes('contains') || op === 'has';
  }

  private isEmptyFilterOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return op === 'empty' || op === 'isempty';
  }

  private isExistsFilterOperator(operator: string): boolean {
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return op === 'exists' || op === 'isnotempty' || op.includes('exist');
  }

  private isImplicitEmptyValueFilter(operator: string, values: string[]): boolean {
    if (values.length > 0) return false;
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return !op || op === '=' || op === '==' || op === 'is' || op === 'equals' || op === 'equal';
  }

  private isImplicitNotEmptyValueFilter(operator: string, values: string[]): boolean {
    if (values.length > 0) return false;
    const op = String(operator || '').trim().toLowerCase().replace(/\s+/g, '');
    return op === '!=' || op === '!==' || op === 'isnot' || op === 'not' || op === 'isnotempty';
  }

  private evaluateTaskFilterObject(node: Record<string, unknown>, task: OpenTaskSubitem, file: TFile | null = null): boolean | null {
    const propRaw = this.readFilterObjectProperty(node);
    if (!propRaw) return null;
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^task\./i, '').replace(/^tps\./i, ''));
    const operator = this.readFilterObjectOperator(node);
    const values = this.readFilterObjectValues(node).map((value) => this.resolveBaseContextToken(value) || value);
    const isNegated = this.isNegatedFilterOperator(operator);
    let result: boolean | null = null;

    if (isBareSemanticKindFilter(propRaw, values)) return false;
    if (['itemtype', 'itemkind', 'kind'].includes(normalizedProp)) {
      result = values.some((value) => {
        const normalized = value.toLowerCase();
        if (normalized.startsWith('bullet')) return task.itemKind === 'bullet';
        if (normalized.startsWith('task')) return task.itemKind !== 'bullet';
        if (normalized.startsWith('note')) return false;
        return normalized === 'all' || normalized === 'mixed';
      });
    } else if (['open', 'isopen'].includes(normalizedProp)) {
      const status = this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
      const isOpen = !this.getDoneStatuses().has(status);
      result = values.some((value) => value.toLowerCase() === 'true' || value === '1') ? isOpen : null;
    } else if ((propRaw.toLowerCase().startsWith('task.') || normalizedProp === 'status' || normalizedProp === 'checkboxstatus') && ['status', 'checkboxstatus'].includes(normalizedProp)) {
      const status = this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
      if (this.isImplicitEmptyValueFilter(operator, values)) {
        result = false;
      } else if (this.isImplicitNotEmptyValueFilter(operator, values)) {
        result = true;
      } else {
        result = values.some((value) => value.toLowerCase() === status);
      }
    } else if (!propRaw.toLowerCase().startsWith('note.') && ['tag', 'tags'].includes(normalizedProp)) {
      const tags = new Set(this.getTaskInlineValues(task, 'tags').map((tag) => this.normalizeTaskTag(tag)));
      if (this.isImplicitEmptyValueFilter(operator, values)) {
        result = tags.size === 0;
      } else if (this.isImplicitNotEmptyValueFilter(operator, values)) {
        result = tags.size > 0;
      } else if (this.isEmptyFilterOperator(operator) || this.isExistsFilterOperator(operator)) {
        result = this.isEmptyFilterOperator(operator) ? tags.size === 0 : tags.size > 0;
      } else {
        result = values.some((value) => tags.has(this.normalizeTaskTag(value)));
      }
    } else if (propRaw.toLowerCase() === 'task.file.extension' || propRaw.toLowerCase() === 'task.file.ext') {
      result = values.some((value) => !!file && value.toLowerCase().replace(/^\./, '') === file.extension.toLowerCase());
    } else if (['extension', 'ext', 'fileextension', 'fileext'].includes(normalizedProp) || propRaw.toLowerCase() === 'file.extension' || propRaw.toLowerCase() === 'file.ext') {
      result = false;
    } else if (['path', 'file', 'filepath'].includes(normalizedProp) || propRaw.toLowerCase() === 'file.path' || propRaw.toLowerCase() === 'task.file.path') {
      if (!this.isPathComparisonOperator(operator)) return null;
      if (this.isStartsWithFilterOperator(operator)) {
        result = values.some((value) => this.taskFilePathStartsWith(file, value));
      } else if (this.isContainsFilterOperator(operator)) {
        result = values.some((value) => {
          const token = String(value || '').trim().toLowerCase();
          return !!file && [file.path, file.basename, file.name].some((candidate) => String(candidate || '').toLowerCase().includes(token));
        });
      } else {
        result = values.some((value) => this.taskFilePathMatches(file, value));
      }
    } else if (propRaw.toLowerCase().startsWith('file.') || ['folder', 'folderpath', 'name', 'basename'].includes(normalizedProp)) {
      const currentValues = this.getTaskFileComparableValues(file, propRaw);
      if (this.isImplicitEmptyValueFilter(operator, values) || this.isEmptyFilterOperator(operator)) {
        result = currentValues.length === 0;
      } else if (this.isImplicitNotEmptyValueFilter(operator, values) || this.isExistsFilterOperator(operator)) {
        result = currentValues.length > 0;
      } else if (this.isContainsFilterOperator(operator)) {
        result = values.some((value) => this.taskValuesContain(propRaw, currentValues, value));
      } else if (
        (propRaw.toLowerCase() === 'file.folder' || ['folder', 'folderpath'].includes(normalizedProp))
        && ['!=', '!==', 'isnot', 'notequal', 'notequals', 'doesnotequal'].includes(operator.replace(/\s+/g, ''))
      ) {
        result = values.some((value) => this.taskFileFolderMatches(file, value, true));
      } else {
        result = values.some((value) => this.taskValuesMatch(propRaw, currentValues, value));
      }
    } else {
      const currentValues = this.getGenericTaskComparableValues(task, propRaw);
      if (currentValues == null) {
        result = null;
      } else if (this.isImplicitEmptyValueFilter(operator, values)) {
        result = currentValues.length === 0;
      } else if (this.isImplicitNotEmptyValueFilter(operator, values)) {
        result = currentValues.length > 0;
      } else if (this.isEmptyFilterOperator(operator)) {
        result = currentValues.length === 0;
      } else if (this.isExistsFilterOperator(operator)) {
        result = currentValues.length > 0;
      } else if (this.isContainsFilterOperator(operator)) {
        result = values.some((value) => this.taskValuesContain(propRaw, currentValues, value));
      } else {
        result = values.some((value) => this.taskValuesMatch(propRaw, currentValues, value));
      }
    }

    return result == null ? null : isNegated ? !result : result;
  }

  private getTaskFileComparableValues(file: TFile | null, propRaw: string): string[] {
    if (!file) return [];
    const prop = String(propRaw || '').trim().toLowerCase().replace(/^file\./, '');
    if (prop === 'folder' || prop === 'folderpath') return file.parent?.path ? [file.parent.path.toLowerCase()] : [];
    if (prop === 'name') return [file.name.toLowerCase()];
    if (prop === 'basename') return [file.basename.toLowerCase()];
    if (prop === 'path') return [file.path.toLowerCase()];
    if (prop === 'extension' || prop === 'ext') return [file.extension.toLowerCase()];
    if (prop === 'links' || prop === 'link') {
      // TPS task rows are synthesized Base records. Their source note is
      // exposed separately through file.name/path/folder, but the task record
      // itself has no file-links collection.
      return [];
    }
    const cache = this.app.metadataCache.getFileCache(file) as any;
    const rawValue = cache?.frontmatter?.[propRaw.slice(5)] ?? cache?.frontmatter?.[prop];
    return this.asArray(rawValue).map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
  }

  private taskFileFolderMatches(file: TFile | null, rawValue: string, includeDescendants = false): boolean {
    if (!file) return false;
    const expected = String(rawValue || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!expected) return false;
    const actual = String(file.parent?.path || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
    return actual === expected || (includeDescendants && actual.startsWith(`${expected}/`));
  }

  private getTaskLaneIds(task: OpenTaskSubitem, propName: string | null): string[] {
    const normalized = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propName));
    if (this.isStatusPropertyName(propName)) {
      if (task.itemKind === 'bullet') return ['ungrouped'];
      return [this.getLaneIdForStatus(this.getStatusForCheckboxState(task.checkboxState || '[ ]'))];
    }
    const values = this.getTaskInlineValues(task, normalized)
      .map((value) => normalized === 'scheduled' ? this.normalizeScheduledLaneValue(value) : value);
    if (!values.length) return ['ungrouped'];
    return Array.from(new Set(values.map((value) => `key:${value}`)));
  }

  private normalizeScheduledLaneValue(value: string): string {
    const raw = String(value || '').trim();
    const day = this.extractDateDay(raw);
    if (!day) return raw;
    const contextScheduled = this.getBaseContextFrontmatterValue('scheduled');
    const contextDay = this.extractDateDay(contextScheduled || '');
    if (contextDay && contextDay === day && contextScheduled) return contextScheduled;
    return `${day} 00:00:00`;
  }

  private extractDateDay(value: string): string | null {
    const raw = String(value || '').trim();
    const match = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/u);
    return match?.[1] ?? null;
  }

  private taskValuesMatch(propRaw: string, currentValues: string[], expectedValue: string): boolean {
    const normalizedProp = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propRaw));
    const expected = String(expectedValue || '').trim().toLowerCase();
    if (normalizedProp === 'scheduled') {
      const expectedDay = this.extractDateDay(expected);
      if (expectedDay) {
        return currentValues.some((current) => this.extractDateDay(current) === expectedDay);
      }
    }
    return currentValues.some((current) => String(current || '').trim().toLowerCase() === expected);
  }

  private taskValuesContain(propRaw: string, currentValues: string[], expectedValue: string): boolean {
    const normalizedProp = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propRaw));
    const expected = String(expectedValue || '').trim().toLowerCase();
    if (normalizedProp === 'scheduled') return this.taskValuesMatch(propRaw, currentValues, expected);
    return currentValues.some((current) => String(current || '').trim().toLowerCase().includes(expected));
  }

  private getTaskInlineValues(task: OpenTaskSubitem, propName: string): string[] {
    const normalized = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propName));
    const values: string[] = [];
    for (const field of task.inlineFields ?? []) {
      const key = this.normalizeInlinePropertyKey(field.key);
      if (normalized === 'tags') {
        if (key === 'tag' || key === 'tags') values.push(this.normalizeTaskTag(field.value));
      } else if (key === normalized) {
        values.push(String(field.value || '').trim());
      }
    }
    return values.map((value) => value.trim()).filter(Boolean);
  }

  private normalizeTaskTag(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
  }

  private toggleSubtreeExpanded(path: string): void {
    if (!path) return;
    if (this.expandedSubtreePaths.has(path)) {
      this.expandedSubtreePaths.delete(path);
    } else {
      this.expandedSubtreePaths.add(path);
    }
    this.render();
  }

  private toggleListLaneCollapsed(laneId: string): void {
    if (!laneId) return;
    if (this.collapsedListLaneIds.has(laneId)) {
      this.collapsedListLaneIds.delete(laneId);
    } else {
      this.collapsedListLaneIds.add(laneId);
    }
    this.render();
  }

  private getParentLinkKeys(): string[] {
    const gcmKeys = this.getGcmServices()?.parents?.getParentKeys?.();
    if (Array.isArray(gcmKeys) && gcmKeys.length > 0) {
      return gcmKeys.map((key: unknown) => String(key || '').trim()).filter(Boolean);
    }

    const keys = new Set<string>();
    for (const settings of this.getRelationshipSettingsSources()) {
      const configured = String(
        settings?.parentLinkFrontmatterKey
        ?? settings?.parentLinkKey
        ?? '',
      ).trim();
      if (configured) keys.add(configured);
    }
    keys.add('childOf');
    keys.add('parent');
    return Array.from(keys);
  }

  /** Returns the set of "done" status values from GCM settings (or defaults). */
  private getDoneStatuses(): Set<string> {
    const gcmDoneStatuses = this.getGcmServices()?.status?.getDoneStatuses?.();
    if (Array.isArray(gcmDoneStatuses) && gcmDoneStatuses.length > 0) {
      return new Set(gcmDoneStatuses.map((s: unknown) => String(s || '').trim().toLowerCase()).filter(Boolean));
    }

    const firstWithDoneStatuses = this.getRelationshipSettingsSources().find(
      (settings) => Array.isArray(settings?.recurrenceCompletionStatuses) && settings.recurrenceCompletionStatuses.length > 0,
    );
    const raw: string[] = firstWithDoneStatuses?.recurrenceCompletionStatuses?.length
      ? firstWithDoneStatuses.recurrenceCompletionStatuses
      : ['complete', 'wont-do'];
    return new Set(raw.map((s: string) => String(s || '').trim().toLowerCase()));
  }

  /**
   * Write a property update to a file's frontmatter.
   * When propName is 'status', also manages completedDate automatically.
   * Fires legacy and namespaced TPS file-update events so all listening views refresh immediately.
   */
  private async applyFrontmatterProperty(
    file: TFile,
    propName: string,
    value: string | null,
    sourceLaneValues: string[] = [],
  ): Promise<void> {
    flow('CardMove', 'frontmatter:start', {
      path: file.path,
      propName,
      value,
      sourceLaneValues,
    });
    const isStatusProp = this.isStatusPropertyName(propName);
    if (this.normalizeInlinePropertyKey(propName) === 'tags') {
      await this.applyFrontmatterTags(file, propName, value, sourceLaneValues);
      flow('CardMove', 'frontmatter:done', {
        path: file.path,
        propName,
        value,
        route: 'tags',
      });
      return;
    }
    const gcmServices = this.getGcmServices();
    if (isStatusProp && typeof gcmServices?.status?.setFileStatus === 'function') {
      await gcmServices.status.setFileStatus(file, value);
      flow('CardMove', 'frontmatter:done', {
        path: file.path,
        propName,
        value,
        route: 'gcm-status',
      });
      return;
    }
    if (typeof gcmServices?.frontmatter?.setValues === 'function') {
      await gcmServices.frontmatter.setValues([file], { [propName]: value });
      emitFilesUpdated(this.app, [file.path], 'tps-kanban');
      flow('CardMove', 'frontmatter:done', {
        path: file.path,
        propName,
        value,
        route: 'gcm-frontmatter',
      });
      return;
    }

    const doneStatuses = isStatusProp ? this.getDoneStatuses() : null;
    const nowStamp = (): string =>
      typeof (window as any).moment === 'function'
        ? (window as any).moment().format('YYYY-MM-DD HH:mm:ss')
        : new Date().toISOString().replace('T', ' ').slice(0, 19);

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (value == null) {
        delete fm[propName];
      } else {
        fm[propName] = value;
      }
      if (isStatusProp && doneStatuses) {
        const normalized = String(value ?? '').trim().toLowerCase();
        if (value != null && doneStatuses.has(normalized)) {
          fm['completedDate'] = nowStamp();
        } else {
          const cdKey = Object.keys(fm).find((k) => k.toLowerCase() === 'completeddate');
          if (cdKey) delete fm[cdKey];
        }
      }
    });
    emitFilesUpdated(this.app, [file.path], 'tps-kanban');
    flow('CardMove', 'frontmatter:done', {
      path: file.path,
      propName,
      value,
      route: 'native-frontmatter',
    });
  }

  private async applyFrontmatterTags(
    file: TFile,
    propName: string,
    value: string | null,
    sourceLaneValues: string[] = [],
  ): Promise<void> {
    const targetTag = this.normalizeWritableTaskTag(String(value ?? ''));
    const sourceTags = sourceLaneValues
      .map((sourceValue) => this.normalizeWritableTaskTag(sourceValue))
      .filter((sourceTag) => sourceTag && sourceTag.toLowerCase() !== targetTag.toLowerCase());

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const actualKey = this.findFrontmatterKeyCaseInsensitive(fm, propName) ?? propName;
      const currentTags = this.normalizeFrontmatterTags(fm[actualKey]);
      const nextTags = currentTags.filter((tag) => !sourceTags.some((sourceTag) => sourceTag.toLowerCase() === tag.toLowerCase()));
      if (targetTag && !nextTags.some((tag) => tag.toLowerCase() === targetTag.toLowerCase())) {
        nextTags.push(targetTag);
      }
      if (nextTags.length) {
        fm[actualKey] = nextTags;
      } else {
        delete fm[actualKey];
      }
    });
    emitFilesUpdated(this.app, [file.path], 'tps-kanban');
  }

  private normalizeFrontmatterTags(raw: unknown): string[] {
    const values = Array.isArray(raw)
      ? raw
      : raw == null
        ? []
        : String(raw).split(/[,;\s]+/u);
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const tag = this.normalizeWritableTaskTag(String(value ?? ''));
      const normalized = tag.toLowerCase();
      if (!tag || seen.has(normalized)) continue;
      tags.push(tag);
      seen.add(normalized);
    }
    return tags;
  }

  private async confirmAndApplyInlineTaskDrop(
    file: TFile,
    line: number,
    propName: string,
    value: string | null,
    sourceLaneValues: string[] = [],
  ): Promise<boolean> {
    const plan = await this.buildTaskDropPlan(file, line, propName, value, sourceLaneValues);
    if (!plan.changes.length) {
      flowWarn('TaskDrop', 'no-change', {
        reason: 'empty-plan',
        path: file.path,
        line,
        propName,
        value,
      });
      new Notice('No line-item changes were inferred for this drop.');
      return false;
    }
    if (plan.nextLine === plan.currentLine) {
      flowWarn('TaskDrop', 'no-change', {
        reason: 'same-line',
        path: file.path,
        line,
        propName,
        value,
        itemKind: plan.itemKind,
      });
      new Notice(`No ${plan.itemKind} changes were inferred for this drop.`);
      return false;
    }
    flow('TaskDrop', 'confirm:start', {
      path: file.path,
      line,
      propName,
      value,
      itemKind: plan.itemKind,
      changeCount: plan.changes.length,
    });
    const confirmed = await this.confirmTaskDrop(plan.changes);
    if (!confirmed) {
      flow('TaskDrop', 'confirm:cancelled', {
        path: file.path,
        line,
        propName,
        value,
        itemKind: plan.itemKind,
      });
      return false;
    }
    return this.applyInlineTaskDropPlan(file, line, propName, value, sourceLaneValues, plan);
  }

  private async buildTaskDropPlan(
    file: TFile,
    line: number,
    propName: string,
    value: string | null,
    sourceLaneValues: string[] = [],
  ): Promise<TaskDropPlan> {
    const filter = this.getTaskRootFilterFromBaseFilters();
    const filterTags = Array.from(filter.tags).filter((tag) => !filter.excludeTags.has(tag));
    const normalizedProp = this.normalizeInlinePropertyKey(propName);
    const filterStatus = !this.isStatusPropertyName(propName) && filter.statuses.size === 1
      ? Array.from(filter.statuses)[0] ?? null
      : null;
    const changes: string[] = [];
    const displayValue = value == null || value === '' ? '(empty)' : String(value);
    const targetLine = Math.max(1, Math.floor(Number(line || 1)));
    const content = await this.app.vault.read(file);
    const currentLine = content.split(/\r\n|\n|\r/u)[targetLine - 1] ?? '';
    const parsedLine = this.parseLineItem(currentLine, true);
    const itemKind = parsedLine?.itemKind ?? 'task';
    let nextLine = currentLine;

    if (this.isStatusPropertyName(propName)) {
      if (itemKind === 'bullet') {
        changes.push('Leave status unchanged because bullets do not have checkbox status.');
      } else {
        const checkbox = this.getCheckboxStateForStatus(value);
        changes.push(`Set checkbox state for status "${displayValue}"${checkbox ? ` to ${checkbox}` : ''}.`);
      }
    } else if (normalizedProp === 'tags') {
      changes.push(`Move task tag lane to #${this.normalizeWritableTaskTag(String(value ?? '')) || displayValue}.`);
      const removed = sourceLaneValues
        .map((sourceValue) => this.normalizeWritableTaskTag(sourceValue))
        .filter(Boolean);
      if (removed.length) changes.push(`Remove previous lane tag(s): ${removed.map((tag) => `#${tag}`).join(', ')}.`);
    } else {
      changes.push(`Set inline field [${propName}:: ${displayValue}].`);
    }

    for (const tag of filterTags) {
      if (normalizedProp === 'tags' && this.normalizeTaskTag(String(value ?? '')) === tag) continue;
      const displayTag = tag.startsWith('#') ? tag : `#${tag}`;
      changes.push(`Add Base filter tag ${displayTag}.`);
    }
    if (filterStatus && itemKind !== 'bullet') {
      const checkbox = this.getCheckboxStateForStatus(filterStatus);
      changes.push(`Set checkbox state for Base status filter "${filterStatus}"${checkbox ? ` to ${checkbox}` : ''}.`);
    } else if (filterStatus && itemKind === 'bullet') {
      changes.push(`Base status filter "${filterStatus}" applies to tasks only; bullet status will remain empty.`);
    } else if (!this.isStatusPropertyName(propName) && filter.statuses.size > 1) {
      changes.push(`Base allows multiple statuses (${Array.from(filter.statuses).join(', ')}), so status will not be guessed.`);
    }
    nextLine = buildKanbanTaskDropLine({
      line: currentLine,
      propName,
      value,
      sourceLaneValues,
      filterTags,
      filterStatus,
      getCheckboxStateForStatus: (status) => this.getCheckboxStateForStatus(status),
      isStatusPropertyName: (name) => this.isStatusPropertyName(name),
    });

    changes.unshift(`${itemKind === 'bullet' ? 'Bullet' : 'Task'}: ${file.path}:${targetLine}`);
    changes.push(`Current line: ${currentLine}`);
    changes.push(`Result line: ${nextLine}`);
    return {
      changes,
      filterTags,
      filterStatus: itemKind === 'bullet' ? null : filterStatus,
      currentContent: content,
      currentLine,
      nextLine,
      itemKind,
    };
  }

  private confirmTaskDrop(changes: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      new TaskDropConfirmModal(this.app, 'Apply task drop changes?', changes, resolve).open();
    });
  }

  private async applyInlineTaskDropPlan(
    file: TFile,
    line: number,
    propName: string,
    value: string | null,
    sourceLaneValues: string[] = [],
    plan: Pick<TaskDropPlan, 'filterTags' | 'filterStatus' | 'currentContent' | 'currentLine' | 'nextLine'>,
  ): Promise<boolean> {
    const targetLine = Math.max(1, Math.floor(Number(line || 1)));
    let changed = false;
    let stale = false;
    flow('TaskDrop', 'apply:start', {
      path: file.path,
      line: targetLine,
      propName,
      value,
      sourceLaneValues,
      filterTags: plan.filterTags,
      filterStatus: plan.filterStatus,
    });

    await this.app.vault.process(file, (content) => {
      const result = applyKanbanTaskDropPlan({
        content,
        expectedContent: plan.currentContent,
        targetLine,
        expectedLine: plan.currentLine,
        nextLine: plan.nextLine,
      });
      changed = result.outcome === 'changed';
      stale = result.outcome === 'stale';
      return result.content;
    });

    if (stale) {
      flowWarn('TaskDrop', 'apply:blocked', {
        reason: 'stale-plan',
        path: file.path,
        line: targetLine,
        propName,
        value,
      });
      new Notice('The source note changed while this drop was awaiting confirmation. No changes were applied; retry the drop.');
      return false;
    }

    if (changed) {
      this.clearTaskCachesForPath(file.path);
      emitFilesUpdated(this.app, [file.path], 'tps-kanban');
    }
    flow('TaskDrop', changed ? 'apply:done' : 'apply:no-change', {
      path: file.path,
      line: targetLine,
      propName,
      value,
    });
    return changed;
  }

  private getDisplayLaneWritableValues(displayLane: DisplayLaneGroup | null | undefined): string[] {
    if (!displayLane) return [];
    const values: string[] = [];
    const seen = new Set<string>();
    for (const group of displayLane.groups) {
      if (!group.hasKey() || group.key == null) continue;
      const value = String(group.key).trim();
      const normalized = value.toLowerCase();
      if (!value || seen.has(normalized)) continue;
      values.push(value);
      seen.add(normalized);
    }
    return values;
  }

  private hasTaskDropData(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.includes(KANBAN_TASK_MIME) || types.includes(TPS_TASK_LINE_MIME);
  }

  private parseTaskDropPayload(dataTransfer: DataTransfer | null): TaskDropPayload | null {
    if (!dataTransfer) return null;
    const raw = dataTransfer.getData(TPS_TASK_LINE_MIME) || dataTransfer.getData(KANBAN_TASK_MIME);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as TaskDropPayload;
      const path = String(parsed.path || '').trim();
      const line = Math.max(1, Math.floor(Number(parsed.line || 1)));
      if (!path || !line) return null;
      return {
        ...parsed,
        path,
        line,
        sourceLaneValues: Array.isArray(parsed.sourceLaneValues) ? parsed.sourceLaneValues : [],
      };
    } catch {
      return null;
    }
  }

  private parseTaskPointerDropPayload(rawPayload: unknown): TaskDropPayload | null {
    if (!rawPayload || typeof rawPayload !== 'object') return null;
    const parsed = rawPayload as TaskDropPayload;
    const path = String(parsed.path || '').trim();
    const line = Math.max(1, Math.floor(Number(parsed.line || 1)));
    if (!path || !line) return null;
    return {
      ...parsed,
      path,
      line,
      sourceLaneValues: Array.isArray(parsed.sourceLaneValues) ? parsed.sourceLaneValues : [],
    };
  }

  private async handleTaskPointerDropEvent(evt: CustomEvent): Promise<void> {
    const detail = (evt as CustomEvent<{ payload?: unknown; x?: number; y?: number }>).detail || {};
    const x = Number(detail.x);
    const y = Number(detail.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const targetEl = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!targetEl || !this.containerEl.contains(targetEl)) return;
    const laneEl = targetEl.closest('.tps-kanban-lane') as HTMLElement | null;
    if (!laneEl) return;
    const propName = this.getGroupByPropName();
    if (!propName) return;
    const displayLaneId = laneEl.dataset.displayLaneId || '';
    const displayLane = displayLaneId ? this.getCurrentDisplayLaneById(displayLaneId) : null;
    if (!displayLane) return;
    const parsed = this.parseTaskPointerDropPayload(detail.payload);
    const taskFile = parsed?.path ? this.app.vault.getFileByPath(parsed.path) : null;
    if (!parsed || !taskFile || !parsed.line) return;

    evt.preventDefault();
    const targetSelection = await this.resolveDropValueForDisplayLane(displayLane);
    if (!targetSelection.selected) return;
    await this.confirmAndApplyInlineTaskDrop(
      taskFile,
      parsed.line,
      propName,
      targetSelection.value,
      Array.isArray(parsed.sourceLaneValues) ? parsed.sourceLaneValues : [],
    );
    this.render();
  }

  private beginTaskPointerDrag(
    event: PointerEvent,
    file: TFile,
    task: OpenTaskSubitem,
    propName: string | null,
    displayLane: DisplayLaneGroup,
    cardEl: HTMLElement,
  ): void {
    if (event.button !== 0) return;
    this.activeTaskPointerDrag = {
      pointerId: event.pointerId,
      itemKind: task.itemKind || 'task',
      path: file.path,
      line: task.line,
      rawLine: '',
      checkboxState: task.itemKind === 'bullet' ? undefined : task.checkboxState || '[ ]',
      text: this.getTaskVisibleTitle(task),
      sourceLaneValues: this.getDisplayLaneWritableValues(displayLane),
      propName,
      displayLane,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      cardEl,
    };
    try {
      cardEl.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort in embedded Obsidian webviews.
    }
  }

  private handleTaskPointerMove(event: PointerEvent): void {
    const active = this.activeTaskPointerDrag;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - active.startX);
    const deltaY = Math.abs(event.clientY - active.startY);
    if (Math.max(deltaX, deltaY) < 8) return;
    active.moved = true;
    active.cardEl.addClass('tps-kanban-card-task--dragging');
  }

  private async handleTaskPointerUp(event: PointerEvent): Promise<void> {
    const active = this.activeTaskPointerDrag;
    if (!active || active.pointerId !== event.pointerId) return;
    this.activeTaskPointerDrag = null;
    active.cardEl.removeClass('tps-kanban-card-task--dragging');
    try {
      active.cardEl.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore capture cleanup failures.
    }
    if (!active.moved) return;

    event.preventDefault();
    event.stopPropagation();
    this.suppressTaskCardClickUntil = Date.now() + 400;

    const releaseTarget = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const laneEl = releaseTarget?.closest('.tps-kanban-lane') as HTMLElement | null;
    if (!laneEl) {
      const dropEvent = new CustomEvent(TPS_TASK_LINE_POINTER_DROP_EVENT, {
        bubbles: true,
        cancelable: true,
        detail: {
          payload: this.buildPointerTaskDropPayload(active),
          x: event.clientX,
          y: event.clientY,
        },
      });
      document.dispatchEvent(dropEvent);
      return;
    }
    const displayLaneId = laneEl.dataset.displayLaneId || '';
    const targetDisplayLane = displayLaneId
      ? this.getCurrentDisplayLaneById(displayLaneId)
      : null;
    if (!targetDisplayLane || targetDisplayLane.id === active.displayLane.id) return;
    if (!active.propName) return;

    const taskFile = this.app.vault.getFileByPath(active.path);
    if (!taskFile) return;
    const targetSelection = await this.resolveDropValueForDisplayLane(targetDisplayLane);
    if (!targetSelection.selected) return;
    await this.confirmAndApplyInlineTaskDrop(
      taskFile,
      active.line,
      active.propName,
      targetSelection.value,
      active.sourceLaneValues.length ? active.sourceLaneValues : this.getDisplayLaneWritableValues(active.displayLane),
    );
    this.render();
  }

  private cancelTaskPointerDrag(event: PointerEvent): void {
    const active = this.activeTaskPointerDrag;
    if (!active || active.pointerId !== event.pointerId) return;
    this.activeTaskPointerDrag = null;
    active.cardEl.removeClass('tps-kanban-card-task--dragging');
  }

  private buildPointerTaskDropPayload(active: ActiveTaskPointerDrag): TaskDropPayload & { type: 'task-line'; source: 'tps-kanban' } {
    return {
      type: 'task-line',
      source: 'tps-kanban',
      itemKind: active.itemKind || 'task',
      path: active.path,
      line: active.line,
      rawLine: active.rawLine || '',
      checkboxState: active.itemKind === 'bullet' ? undefined : active.checkboxState || '[ ]',
      text: active.text || '',
      sourceLaneValues: active.sourceLaneValues,
    };
  }

  private getCurrentDisplayLaneById(displayLaneId: string): DisplayLaneGroup | null {
    const propName = this.getGroupByPropName();
    const propId = this.getGroupByPropId(propName);
    const listGrouping = this.isLikelyListGroupingProperty(propName, propId);
    const sourceGroups = this.getSourceGroupsForRender(propId, listGrouping);
    const allGroups = this.mergeGroupsByLaneId(sourceGroups);
    const keyed = allGroups.filter((g) => this.getLaneId(g) !== 'ungrouped');
    const ungrouped = allGroups.filter((g) => this.getLaneId(g) === 'ungrouped');
    const forced = this.getForcedLanesFromFilters(propName);
    const keyedWithForced: BasesEntryGroup[] = [...keyed];
    const existingKeys = new Set(keyed.map((g) => String(g.key).trim().toLowerCase()));
    for (const forcedKey of forced.keys) {
      const normalized = forcedKey.trim().toLowerCase();
      if (!normalized || existingKeys.has(normalized)) continue;
      keyedWithForced.push(this.createSyntheticGroup(forcedKey));
      existingKeys.add(normalized);
    }
    const ungroupedWithForced = [...ungrouped];
    if (forced.includeUngrouped && ungroupedWithForced.length === 0) {
      ungroupedWithForced.push(this.createSyntheticGroup(null));
    }
    const mergedGroups = this.plugin.settings.ungroupedPosition === 'first'
      ? [...ungroupedWithForced, ...keyedWithForced]
      : [...keyedWithForced, ...ungroupedWithForced];
    const mergedWithSavedLanes = this.includeSavedLaneGroups(mergedGroups);
    const groups = this.applyManualLaneOrder(mergedWithSavedLanes.length ? mergedWithSavedLanes : [this.createSyntheticGroup(null)]);
    return this.buildDisplayLaneGroups(groups).find((lane) => lane.id === displayLaneId) ?? null;
  }

  private async updateTaskCheckboxState(file: TFile, line: number, checkboxState: string): Promise<void> {
    const targetLine = Math.max(1, Math.floor(Number(line || 1)));
    const nextState = this.normalizeCheckboxState(checkboxState);
    let changed = false;
    let blockedReason = '';
    flow('TaskCheckbox', 'update:start', {
      path: file.path,
      line: targetLine,
      nextState,
    });

    await this.app.vault.process(file, (content) => {
      const lines = content.split(/\r?\n/);
      const index = targetLine - 1;
      if (index < 0 || index >= lines.length) {
        blockedReason = 'line-out-of-range';
        return content;
      }
      const current = lines[index];
      if (!/^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]*\]\s+/.test(current)) {
        blockedReason = 'not-task-line';
        return content;
      }
      const next = replaceKanbanTaskLineCheckboxState(current, nextState);
      if (next === current) {
        blockedReason = 'unchanged';
        return content;
      }
      lines[index] = next;
      changed = true;
      return lines.join('\n');
    });

    if (changed) {
      this.clearTaskCachesForPath(file.path);
      emitFilesUpdated(this.app, [file.path], 'tps-kanban');
    }
    flow('TaskCheckbox', changed ? 'update:done' : 'update:no-change', {
      path: file.path,
      line: targetLine,
      nextState,
      reason: changed ? undefined : blockedReason || 'unknown',
    });
  }

  private normalizeWritableTaskTag(value: string): string {
    return normalizeKanbanWritableTaskTag(value);
  }

  /** Returns true if `ancestorPath` is a direct or transitive ancestor of `childPath`. */
  private isDescendantOf(childPath: string, ancestorPath: string, visited = new Set<string>()): boolean {
    if (visited.has(childPath)) return false; // cycle guard
    visited.add(childPath);
    const file = this.app.vault.getFileByPath(childPath);
    if (!file) return false;
    const parentPath = this.resolveParentPath(file);
    if (!parentPath) return false;
    if (parentPath === ancestorPath) return true;
    return this.isDescendantOf(parentPath, ancestorPath, visited);
  }

  private isCardSubitemDropZone(cardEl: HTMLElement, event: DragEvent): boolean {
    const rect = cardEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const zoneHeight = Math.min(30, Math.max(18, rect.height * 0.38));
    const sideInset = Math.min(34, Math.max(10, rect.width * 0.1));

    return x >= sideInset && x <= rect.width - sideInset && y >= 0 && y <= zoneHeight;
  }

  private getChildLinkKeys(): string[] {
    const keys = new Set<string>();
    for (const settings of this.getRelationshipSettingsSources()) {
      const configured = String(
        settings?.childLinkFrontmatterKey
        ?? settings?.childLinkKey
        ?? '',
      ).trim();
      if (configured) keys.add(configured);
    }
    keys.add('parentOf');
    keys.add('children');
    keys.add('meetings');
    return Array.from(keys);
  }

  private getRelationshipSettingsSources(): Array<Record<string, any>> {
    const out: Array<Record<string, any>> = [];
    const pushIfObject = (candidate: unknown) => {
      if (candidate && typeof candidate === 'object') out.push(candidate as Record<string, any>);
    };

    // Local plugin settings (if present in this build variant).
    pushIfObject((this.plugin as any)?.settings);

    const plugins = (this.app as any)?.plugins?.plugins;
    if (plugins && typeof plugins === 'object') {
      // Dedicated GCM plugin variants.
      pushIfObject(plugins['tps-global-context-menu']?.settings);
      pushIfObject(plugins['TPS-Global-Context-Menu (Dev)']?.settings);
      // Consolidated TPS plugin variants.
      pushIfObject(plugins['tps']?.settings);
      pushIfObject(plugins['TPS (Dev)']?.settings);
    }

    return out;
  }

  private findFrontmatterKeyCaseInsensitive(frontmatter: Record<string, unknown>, target: string): string | null {
    const normalizedTarget = String(target || '').trim().toLowerCase();
    if (!normalizedTarget) return null;
    for (const key of Object.keys(frontmatter || {})) {
      if (String(key || '').trim().toLowerCase() === normalizedTarget) return key;
    }
    return null;
  }

  private getFrontmatterValueCaseInsensitive(frontmatter: Record<string, unknown>, key: string): unknown {
    const actual = this.findFrontmatterKeyCaseInsensitive(frontmatter, key);
    return actual ? frontmatter[actual] : undefined;
  }

  private getNotebookNavigatorCompanion(): any {
    const plugins = (this.app as any)?.plugins?.plugins;
    if (!plugins || typeof plugins !== 'object') return null;
    return (
      plugins['tps-notebook-navigator-companion']
      ?? plugins['TPS-Notebook-Navigator-Companion (Dev)']
      ?? null
    );
  }

  private isCompanionWriteExcluded(file: TFile): boolean {
    const companion = this.getNotebookNavigatorCompanion();
    const exclusionService: any = companion?.exclusionService;
    if (!exclusionService || typeof exclusionService.shouldIgnore !== 'function') return false;
    try {
      return !!exclusionService.shouldIgnore(file, { bypassCreationGrace: true });
    } catch {
      return false;
    }
  }

  private collectNormalizedEntryTags(file: TFile, frontmatter?: Record<string, unknown> | null): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const rawValues = [
      ...(cache ? (getAllTags(cache) || []) : []),
      this.getFrontmatterValueCaseInsensitive(frontmatter || {}, 'tags'),
      this.getFrontmatterValueCaseInsensitive(frontmatter || {}, 'tag'),
    ];

    return Array.from(new Set(
      rawValues
        .flatMap((value) => Array.isArray(value) ? value : value == null ? [] : [value])
        .map((value) => String(value || '').replace(/^#+/, '').trim().toLowerCase())
        .filter(Boolean),
    ));
  }

  private resolveCompanionIconValue(file: TFile, frontmatter?: Record<string, unknown> | null): string {
    const gcmIcon = this.getGcmServices()?.visualMetadata?.getIconValue?.(frontmatter || {});
    if (gcmIcon) return String(gcmIcon);

    const companion = this.getNotebookNavigatorCompanion();
    const pickString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

    const configuredIconField = pickString(companion?.settings?.frontmatterIconField);
    if (configuredIconField) {
      const configuredValue = pickString(this.getFrontmatterValueCaseInsensitive(frontmatter || {}, configuredIconField));
      if (configuredValue) return configuredValue;
    }

    if (this.isCompanionWriteExcluded(file)) {
      return '';
    }

    const ruleEngine = companion?.ruleEngine;
    if (!companion?.settings?.enabled || typeof ruleEngine?.resolveVisualOutputs !== 'function') {
      return '';
    }

    try {
      const visual = ruleEngine.resolveVisualOutputs(companion.settings.rules || [], {
        file: {
          path: file.path,
          name: file.name,
          basename: file.basename,
          extension: file.extension,
        },
        frontmatter: frontmatter || {},
        tags: this.collectNormalizedEntryTags(file, frontmatter),
      });
      return pickString(visual?.icon?.value);
    } catch {
      return '';
    }
  }

  private evaluateStyleCondition(data: Record<string, unknown>, condition: KanbanStyleCondition): boolean {
    const field = String(condition.field || '').trim();
    const rawValue = field ? data[field] ?? data[field.toLowerCase()] : '';
    const value = String(rawValue ?? '').toLowerCase();
    const target = String(condition.value ?? '').toLowerCase();
    switch (condition.operator) {
      case 'is': return value === target;
      case '!is': return value !== target;
      case 'contains': return value.includes(target);
      case '!contains': return !value.includes(target);
      case 'starts': return value.startsWith(target);
      case '!starts': return !value.startsWith(target);
      case 'ends': return value.endsWith(target);
      case '!ends': return !value.endsWith(target);
      case 'exists': return value.length > 0;
      case '!exists': return value.length === 0;
      default: return false;
    }
  }

  private resolveCardStyleRule(
    frontmatter: Record<string, unknown> | undefined,
    entry: BasesEntry,
    groupPropName: string | null,
  ): KanbanStyleRule | null {
    const rules = this.plugin.settings.cardStyleRules || [];
    if (!rules.length) return null;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter || {})) {
      data[key] = value;
      data[String(key).trim().toLowerCase()] = value;
    }
    if (groupPropName) {
      const groupValue = this.getEntryStringValue(entry, groupPropName)
        || String(this.getFrontmatterValueCaseInsensitive(frontmatter || {}, groupPropName) ?? '').trim();
      data[groupPropName] = groupValue;
      data[groupPropName.toLowerCase()] = groupValue;
    }

    for (const rule of rules) {
      if (rule.active === false) continue;
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
      if (!conditions.length) continue;
      const results = conditions.map((condition: KanbanStyleCondition) => this.evaluateStyleCondition(data, condition));
      const matches = rule.match === 'any' ? results.some(Boolean) : results.every(Boolean);
      if (matches) return rule;
    }
    return null;
  }

  private resolveTaskCardStyleRule(file: TFile, task: OpenTaskSubitem, groupPropName: string | null): KanbanStyleRule | null {
    const rules = this.plugin.settings.cardStyleRules || [];
    if (!rules.length) return null;

    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter || {})) {
      data[key] = value;
      data[String(key).trim().toLowerCase()] = value;
    }
    for (const field of task.inlineFields ?? []) {
      data[field.key] = field.value;
      data[String(field.key).trim().toLowerCase()] = field.value;
    }
    const taskStatus = task.itemKind === 'bullet' ? 'bullet' : this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
    data.status = taskStatus;
    data['task.status'] = taskStatus;
    data.kind = task.itemKind === 'bullet' ? 'bullet' : 'task';
    data.itemtype = data.kind;
    data.itemkind = data.kind;
    if (groupPropName) {
      const normalizedGroup = this.normalizeInlinePropertyKey(groupPropName);
      const groupValue = this.getTaskInlineValues(task, normalizedGroup).join(', ');
      data[groupPropName] = groupValue;
      data[groupPropName.toLowerCase()] = groupValue;
    }

    for (const rule of rules) {
      if (rule.active === false) continue;
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
      if (!conditions.length) continue;
      const results = conditions.map((condition: KanbanStyleCondition) => this.evaluateStyleCondition(data, condition));
      const matches = rule.match === 'any' ? results.some(Boolean) : results.every(Boolean);
      if (matches) return rule;
    }
    return null;
  }

  private addTextStyleClasses(cardEl: HTMLElement, textStyle: string | undefined): void {
    String(textStyle || '')
      .split(',')
      .map(style => style.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'))
      .filter(Boolean)
      .forEach(style => cardEl.classList.add(`tps-kanban-card--${style}`));
  }

  private normalizeLucideIconValue(iconName: string): string {
    const raw = String(iconName || '').trim();
    if (!raw) return '';
    if (raw.startsWith('lucide:')) return raw.slice('lucide:'.length).trim();
    if (raw.startsWith('lucide-')) return raw.slice('lucide-'.length).trim();
    const colonIdx = raw.indexOf(':');
    return colonIdx !== -1 ? raw.slice(colonIdx + 1).trim() : raw;
  }

  private renderCardProperties(containerEl: HTMLElement, entry: BasesEntry, groupPropName: string | null): void {
    const propIds = this.getCardPropertyIds(groupPropName);
    if (!propIds.length) return;

    const wrap = containerEl.createDiv({ cls: 'tps-kanban-card-properties' });
    for (const propId of propIds) {
      const value = this.getEntryValue(entry, propId);
      const label = this.formatCardPropertyValue(value);
      if (!label) continue;
      const chip = wrap.createDiv({ cls: 'tps-kanban-card-property' });
      chip.createSpan({ cls: 'tps-kanban-card-property-text', text: label });
    }
    if (!wrap.children.length) wrap.remove();
  }

  private getCardSummary(
    entry: BasesEntry,
    frontmatter: Record<string, unknown> | undefined,
  ): string {
    const summaryKeys = ['summary', 'description', 'details', 'notes'];
    for (const key of summaryKeys) {
      const entryValue = this.formatCardPropertyValue(this.getEntryValue(entry, key));
      const frontmatterValue = this.formatCardPropertyValue(this.getFrontmatterValueCaseInsensitive(frontmatter || {}, key));
      const summary = entryValue || frontmatterValue;
      if (summary) return this.truncateCardSummary(summary);
    }
    return '';
  }

  private truncateCardSummary(value: string): string {
    const singleLine = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!singleLine) return '';
    return singleLine.length > 180 ? `${singleLine.slice(0, 177)}...` : singleLine;
  }

  private formatCardPropertyValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? '').replace(/^#/, '').trim())
        .filter((item) => item && item.toLowerCase() !== 'null' && item.toLowerCase() !== 'undefined')
        .slice(0, 3)
        .join(', ');
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const raw = String(value).trim();
    if (!raw) return '';
    if (raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
    const dateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (dateTime) {
      const year = Number(dateTime[1]);
      const month = Number(dateTime[2]) - 1;
      const day = Number(dateTime[3]);
      const hours = dateTime[4] === undefined ? 0 : Number(dateTime[4]);
      const minutes = dateTime[5] === undefined ? 0 : Number(dateTime[5]);
      const date = new Date(year, month, day, hours, minutes);
      if (!Number.isNaN(date.getTime())) {
        const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (dateTime[4] === undefined) return datePart;
        const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        return `${datePart}, ${timePart}`;
      }
    }
    return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
  }

  private normalizeLinkTarget(rawTarget: string): string | null {
    let target = String(rawTarget || '').trim();
    if (!target) return null;
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }
    if (target.includes('|')) {
      target = target.split('|')[0].trim();
    }
    if (target.includes('#')) {
      target = target.split('#')[0].trim();
    }
    target = target.replace(/^\.\/+/, '').trim();
    if (!target) return null;
    try {
      target = decodeURI(target);
    } catch {
      // Keep raw if decode fails.
    }
    return target || null;
  }

  private resolveLinkTargetToPath(rawTarget: string, sourcePath: string): string | null {
    const gcmResolved = this.getGcmServices()?.links?.resolveToPath?.(rawTarget, sourcePath);
    if (gcmResolved) return String(gcmResolved);

    const target = this.normalizeLinkTarget(rawTarget);
    if (!target) return null;

    const noMd = target.replace(/\.md$/i, '');
    const viaCache =
      this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)
      || this.app.metadataCache.getFirstLinkpathDest(noMd, sourcePath);
    if (viaCache instanceof TFile) return viaCache.path;

    const normalized = normalizePath(target);
    const direct = this.app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile) return direct.path;

    const withMd = normalized.endsWith('.md') ? normalized : `${normalized}.md`;
    const directMd = this.app.vault.getAbstractFileByPath(withMd);
    if (directMd instanceof TFile) return directMd.path;

    // Defensive decode of malformed nested markdown link payloads.
    const nestedTargets = this.extractLinkTargetsFromText(target, false);
    for (const nestedTarget of nestedTargets) {
      const nestedResolved = this.resolveLinkTargetToPath(nestedTarget, sourcePath);
      if (nestedResolved) return nestedResolved;
    }

    return null;
  }

  private extractLinkTargetsFromText(rawText: string, allowBareValue: boolean = false): string[] {
    const text = String(rawText || '').trim();
    if (!text) return [];

    const targets: string[] = [];
    const seen = new Set<string>();
    const push = (rawTarget: string) => {
      const normalized = this.normalizeLinkTarget(rawTarget);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      targets.push(normalized);
    };

    let matchedStructuredLink = false;

    const wikiPattern = /!?\[\[([^[\]]+)\]\]/g;
    let wikiMatch: RegExpExecArray | null = null;
    while ((wikiMatch = wikiPattern.exec(text)) !== null) {
      matchedStructuredLink = true;
      push(wikiMatch[1]);
    }

    for (const markdownTarget of this.extractMarkdownLinkTargets(text)) {
      matchedStructuredLink = true;
      push(markdownTarget);
    }

    if (allowBareValue && !matchedStructuredLink) {
      text.split(/[\n,;]/).forEach((chunk) => push(chunk));
    }

    return targets;
  }

  private extractMarkdownLinkTargets(text: string): string[] {
    const targets: string[] = [];
    let i = 0;

    while (i < text.length) {
      const openBracket = text.indexOf('[', i);
      if (openBracket === -1) break;

      let closeBracket = openBracket + 1;
      let escaped = false;
      while (closeBracket < text.length) {
        const ch = text[closeBracket];
        if (!escaped && ch === ']') break;
        escaped = !escaped && ch === '\\';
        closeBracket += 1;
      }
      if (closeBracket >= text.length) break;

      if (text[closeBracket + 1] !== '(') {
        i = closeBracket + 1;
        continue;
      }

      let cursor = closeBracket + 2;
      let depth = 1;
      let inAngle = false;
      escaped = false;

      while (cursor < text.length) {
        const ch = text[cursor];
        if (!escaped) {
          if (ch === '<') inAngle = true;
          if (ch === '>') inAngle = false;
          if (!inAngle) {
            if (ch === '(') depth += 1;
            if (ch === ')') {
              depth -= 1;
              if (depth === 0) break;
            }
          }
        }
        escaped = !escaped && ch === '\\';
        cursor += 1;
      }

      if (depth !== 0 || cursor >= text.length) {
        i = closeBracket + 1;
        continue;
      }

      const destination = text.slice(closeBracket + 2, cursor).trim();
      if (destination) {
        targets.push(destination);
      }
      i = cursor + 1;
    }

    return targets;
  }

  private parseLinksFromFrontmatterValue(value: unknown, sourcePath: string): string[] {
    const gcmFiles = this.getGcmServices()?.links?.parseFrontmatterLinks?.(value, sourcePath);
    if (Array.isArray(gcmFiles)) {
      return gcmFiles
        .map((file: unknown) => file instanceof TFile ? file.path : '')
        .filter(Boolean);
    }

    const output = new Set<string>();
    const visitedObjects = new Set<unknown>();

    const consume = (candidate: unknown) => {
      if (candidate === null || candidate === undefined) return;

      if (Array.isArray(candidate)) {
        if (visitedObjects.has(candidate)) return;
        visitedObjects.add(candidate);
        candidate.forEach((entry) => consume(entry));
        return;
      }

      if (typeof candidate === 'object') {
        if (visitedObjects.has(candidate)) return;
        visitedObjects.add(candidate);
        const record = candidate as Record<string, unknown>;
        const preferredLinkKeys = ['path', 'link', 'target', 'file', 'href', 'value'];
        let consumedPreferred = false;
        for (const key of preferredLinkKeys) {
          if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
          consumedPreferred = true;
          consume(record[key]);
        }
        if (!consumedPreferred) {
          Object.values(record).forEach((entry) => consume(entry));
        }
        return;
      }

      if (typeof candidate === 'string') {
        const targets = this.extractLinkTargetsFromText(candidate, true);
        for (const target of targets) {
          const resolved = this.resolveLinkTargetToPath(target, sourcePath);
          if (resolved) output.add(resolved);
        }
        return;
      }

      if (typeof candidate === 'number' || typeof candidate === 'boolean') {
        const resolved = this.resolveLinkTargetToPath(String(candidate), sourcePath);
        if (resolved) output.add(resolved);
      }
    };

    consume(value);
    return Array.from(output);
  }

  private resolveParentPath(file: TFile): string | null {
    const gcmParent = this.getGcmServices()?.parents?.getParentFile?.(file);
    if (gcmParent instanceof TFile && gcmParent.path !== file.path) return gcmParent.path;

    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    const parentKeys = this.getParentLinkKeys();

    for (const key of parentKeys) {
      const raw = this.getFrontmatterValueCaseInsensitive(fm, key);
      const paths = this.parseLinksFromFrontmatterValue(raw, file.path);
      for (const path of paths) {
        if (path && path !== file.path) return path;
      }
    }

    return null;
  }

  private buildParentByChild(groups: BasesEntryGroup[]): Map<string, string> {
    const parentByChild = new Map<string, string>();
    const visiblePaths = new Set<string>();
    const entries: BasesEntry[] = [];
    const visibleEntryByPath = new Map<string, BasesEntry>();

    for (const group of groups) {
      for (const entry of group.entries) {
        visiblePaths.add(entry.file.path);
        if (!visibleEntryByPath.has(entry.file.path)) {
          visibleEntryByPath.set(entry.file.path, entry);
        }
        entries.push(entry);
      }
    }

    // Forward direction: child -> parent (e.g. childOf)
    for (const entry of entries) {
      if (parentByChild.has(entry.file.path)) continue;
      const parentPath = this.resolveParentPath(entry.file);
      if (!parentPath) continue;
      if (!visiblePaths.has(parentPath)) continue;
      parentByChild.set(entry.file.path, parentPath);
    }

    // Reverse direction: parent -> children (e.g. parentOf)
    const childKeys = this.getChildLinkKeys();
    for (const parentEntry of visibleEntryByPath.values()) {
      const fm = (this.app.metadataCache.getFileCache(parentEntry.file)?.frontmatter || {}) as Record<string, unknown>;
      for (const childKey of childKeys) {
        const raw = this.getFrontmatterValueCaseInsensitive(fm, childKey);
        const childPaths = this.parseLinksFromFrontmatterValue(raw, parentEntry.file.path);
        for (const childPath of childPaths) {
          if (!visiblePaths.has(childPath)) continue;
          if (childPath === parentEntry.file.path) continue;
          if (parentByChild.has(childPath)) continue;
          parentByChild.set(childPath, parentEntry.file.path);
        }
      }
    }

    return parentByChild;
  }

  private createSyntheticGroup(key: string | null): BasesEntryGroup {
    return {
      key,
      entries: [],
      hasKey: () => key != null,
    } as unknown as BasesEntryGroup;
  }

  private ensureGroupsForTaskLanes(
    groups: BasesEntryGroup[],
    taskRenderItemsByLane: Map<string, TaskRenderItem[]>,
  ): BasesEntryGroup[] {
    if (!taskRenderItemsByLane.size) return groups;
    const existingLaneIds = new Set(groups.map((group) => this.getLaneId(group)));
    const nextGroups = [...groups];
    for (const laneId of taskRenderItemsByLane.keys()) {
      if (existingLaneIds.has(laneId)) continue;
      const synthetic = this.createSyntheticGroupFromLaneId(laneId);
      if (!synthetic) continue;
      nextGroups.push(synthetic);
      existingLaneIds.add(laneId);
    }
    return this.applyManualLaneOrder(nextGroups);
  }

  private createSyntheticGroupFromLaneId(laneId: string): BasesEntryGroup | null {
    if (laneId === 'ungrouped') return this.createSyntheticGroup(null);
    if (laneId.startsWith('key:')) return this.createSyntheticGroup(laneId.slice(4));
    return null;
  }

  private getSavedLaneFallbackGroups(): BasesEntryGroup[] {
    const map = (this.plugin.settings?.laneOrderByView || {}) as Record<string, string[]>;
    const viewId = this.getLaneOrderViewId();
    const legacyViewId = this.getLegacyUnknownBaseViewId();
    const saved = Array.isArray(map[viewId]) ? map[viewId] : Array.isArray(map[legacyViewId]) ? map[legacyViewId] : [];
    const groups: BasesEntryGroup[] = [];
    for (const laneIdRaw of saved) {
      const laneId = String(laneIdRaw || '').trim();
      if (!laneId) continue;
      if (laneId === 'ungrouped') {
        groups.push(this.createSyntheticGroup(null));
        continue;
      }
      if (laneId.startsWith('key:')) {
        const key = laneId.slice(4).trim();
        groups.push(this.createSyntheticGroup(key || null));
      }
    }
    return groups;
  }

  private includeSavedLaneGroups(groups: BasesEntryGroup[]): BasesEntryGroup[] {
    const savedGroups = this.getSavedLaneFallbackGroups();
    if (!savedGroups.length) return groups;
    const existingLaneIds = new Set(groups.map((group) => this.getLaneId(group)));
    const nextGroups = [...groups];
    for (const savedGroup of savedGroups) {
      const laneId = this.getLaneId(savedGroup);
      if (existingLaneIds.has(laneId)) continue;
      nextGroups.push(savedGroup);
      existingLaneIds.add(laneId);
    }
    return nextGroups;
  }

  private getForcedLanesFromFilters(propName: string | null): { keys: string[]; includeUngrouped: boolean } {
    if (!propName) return { keys: [], includeUngrouped: false };

    const keys = new Set<string>();
    const includeUngrouped = { value: false };
    for (const root of this.getBaseFilterRoots()) {
      if (!root) continue;
      this.collectForcedLanesFromFilterNode(root, propName, keys, includeUngrouped);
    }
    if (this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propName)) === 'scheduled') {
      const scheduled = this.getBaseContextFrontmatterValue('scheduled');
      if (scheduled) {
        keys.add(scheduled);
        includeUngrouped.value = true;
      }
    }
    return { keys: Array.from(keys), includeUngrouped: includeUngrouped.value };
  }

  private getBaseFilterRoots(): unknown[] {
    // Runtime roots include unsaved edits from Obsidian's Base filter editor. Keep
    // them ahead of persisted roots so the custom view reacts immediately while
    // still inheriting the Base-wide filters stored in the .base file.
    const runtimeRoots = this.extractFilterRootCandidates([
      this.config?.get?.('filters'),
      (this.config as any)?.filters,
      (this as any)?.filters,
      (this as any)?.view?.filters,
      (this as any)?.controller?.viewConfig?.filters,
      (this as any)?.controller?.config?.filters,
      (this as any)?.queryController?.query?.filters,
      (this as any)?.queryController?.queryState,
    ]);
    const baseFile = this.getBaseFile();
    if (baseFile) {
      const fileRoots = this.getBaseFileFilterRoot();
      return composeEffectiveFilterRoots(runtimeRoots, fileRoots || []);
    }

    const embeddedRoots = this.getEmbeddedBaseFilterRoot();
    if (embeddedRoots?.length) return composeEffectiveFilterRoots(runtimeRoots, embeddedRoots);
    return composeEffectiveFilterRoots(runtimeRoots, []);
  }

  private getEmbeddedBaseFilterRoot(): unknown[] | null {
    const file = this.getBaseContextFile();
    if (!file) return null;
    const mtime = Number(file.stat?.mtime || 0);
    const viewName = this.getConfiguredBaseViewName();
    if (
      this.embeddedBaseFilterCache?.path === file.path
      && this.embeddedBaseFilterCache.mtime === mtime
      && (!viewName || this.embeddedBaseFilterCache.viewName === viewName)
    ) {
      return this.embeddedBaseFilterCache.filters;
    }

    void this.loadEmbeddedBaseFilters(file, mtime, viewName);
    return this.embeddedBaseFilterCache?.path === file.path && (!viewName || this.embeddedBaseFilterCache.viewName === viewName)
      ? this.embeddedBaseFilterCache.filters
      : null;
  }

  private async loadEmbeddedBaseFilters(file: TFile, mtime = Number(file.stat?.mtime || 0), viewName = this.getConfiguredBaseViewName()): Promise<void> {
    const loadingKey = `${file.path}:${mtime}:${viewName}`;
    if (this.embeddedBaseFiltersLoadingKey === loadingKey) return;
    this.embeddedBaseFiltersLoadingKey = loadingKey;
    try {
      const content = await this.app.vault.cachedRead(file);
      const exactRoots: unknown[] = [];
      const fallbackRoots: unknown[] = [];
      const viewNames: string[] = [];
      const blockPattern = /```base\s*\n([\s\S]*?)```/gi;
      let match: RegExpExecArray | null = null;
      while ((match = blockPattern.exec(content)) !== null) {
        try {
          const parsed = parseYaml(match[1] || '') as Record<string, unknown> | null | undefined;
          const blockMatch = this.getEmbeddedKanbanBlockMatch(parsed, viewName);
          if (!blockMatch) continue;
          const extracted = this.extractBaseFileFilterRoots(parsed, viewName);
          viewNames.push(...extracted.viewNames);
          if (extracted.filters?.length) {
            const target = blockMatch === 'exact' ? exactRoots : fallbackRoots;
            target.push(...extracted.filters);
          }
        } catch (error) {
          flowError('EmbeddedBaseFilters', 'parse-block-failed', error, { path: file.path, viewName });
        }
      }
      const roots = exactRoots.length ? exactRoots : fallbackRoots;
      const currentViewName = viewName || viewNames[0] || '';
      const previous = this.embeddedBaseFilterCache;
      this.embeddedBaseFilterCache = {
        path: file.path,
        mtime,
        viewName: currentViewName,
        filters: roots.length ? roots : null,
      };
      if (previous?.path !== file.path || previous?.mtime !== mtime || previous?.viewName !== currentViewName || previous?.filters !== this.embeddedBaseFilterCache.filters) {
        flow('EmbeddedBaseFilters', 'loaded', {
          path: file.path,
          viewName: currentViewName,
          filterRoots: roots.length,
        });
        this.refreshDebounced();
      }
    } finally {
      if (this.embeddedBaseFiltersLoadingKey === loadingKey) this.embeddedBaseFiltersLoadingKey = null;
    }
  }

  private getEmbeddedKanbanBlockMatch(parsed: Record<string, unknown> | null | undefined, viewName: string): 'exact' | 'fallback' | null {
    const views = Array.isArray(parsed?.views) ? parsed.views : [];
    if (!views.length) return 'fallback';
    const kanbanViews = views.filter((view) => {
      if (!view || typeof view !== 'object') return false;
      const record = view as Record<string, unknown>;
      const type = String(record.type || '').trim();
      return type === KANBAN_VIEW_TYPE || type === 'tps-kanban';
    }) as Array<Record<string, unknown>>;
    if (!kanbanViews.length) return null;
    if (kanbanViews.some((record) => {
      const name = String(record.name || '').trim();
      return !viewName || !name || name === viewName;
    })) return 'exact';
    return kanbanViews.length === 1 ? 'fallback' : null;
  }

  private scheduleBaseFileFilterLoad(): void {
    const file = this.getBaseFile();
    if (!file) return;
    const mtime = Number(file.stat?.mtime || 0);
    const viewName = this.getConfiguredBaseViewName();
    if (this.baseFileFilterCache?.path === file.path
      && this.baseFileFilterCache.mtime === mtime
      && (!viewName || this.baseFileFilterCache.viewName === viewName)) return;
    void this.loadBaseFileFilters(file, mtime, viewName);
  }

  private isBaseFileFilterReady(): boolean {
    const file = this.getBaseFile();
    if (!file) return true;
    const cache = this.baseFileFilterCache;
    const viewName = this.getConfiguredBaseViewName();
    return cache?.path === file.path
      && cache.mtime === Number(file.stat?.mtime || 0)
      && (!viewName || cache.viewName === viewName);
  }

  private extractFilterRootCandidates(candidates: unknown[]): unknown[] {
    const roots: unknown[] = [];
    for (const candidate of candidates) {
      this.collectFilterRootCandidates(candidate, roots);
    }
    return roots;
  }

  private collectFilterRootCandidates(root: unknown, roots: unknown[]): void {
    if (!root) return;
    if (this.isDirectFilterRoot(root)) {
      roots.push(root);
      return;
    }
    if (Array.isArray(root)) {
      for (const item of root) this.collectFilterRootCandidates(item, roots);
      return;
    }
    if (typeof root !== 'object') return;
    const record = root as Record<string, unknown>;
    for (const key of ['filters', 'children', 'data', 'query', 'queryState']) {
      this.collectFilterRootCandidates(record[key], roots);
    }
  }

  private isDirectFilterRoot(root: unknown): boolean {
    if (!root) return false;
    if (typeof root === 'string') return !!root.trim();
    if (Array.isArray(root)) return root.some((item) => this.isDirectFilterRoot(item));
    if (typeof root !== 'object') return false;
    const record = root as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'and')
      || Object.prototype.hasOwnProperty.call(record, 'or')
      || Object.prototype.hasOwnProperty.call(record, 'all')
      || Object.prototype.hasOwnProperty.call(record, 'any')
      || Object.prototype.hasOwnProperty.call(record, 'not')
      || Object.prototype.hasOwnProperty.call(record, 'property')
      || Object.prototype.hasOwnProperty.call(record, 'field')) {
      return true;
    }
    return false;
  }

  private getBaseFilterSignature(): string {
    return this.stableFilterSignature(this.getBaseFilterRoots());
  }

  private stableFilterSignature(value: unknown, seen = new WeakSet<object>()): string {
    if (value == null) return '';
    if (typeof value === 'function') return '';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableFilterSignature(item, seen)).filter(Boolean).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => {
        const lower = key.toLowerCase();
        return !lower.includes('el') && !lower.includes('dom') && !lower.includes('owner') && typeof record[key] !== 'function';
      })
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${this.stableFilterSignature(record[key], seen)}`).filter((part) => !part.endsWith(':')).join(',')}}`;
  }

  private getNoteCreationDefaultsFromBaseFilters(): NoteCreationDefaults {
    for (const root of this.getBaseFilterRoots()) {
      const frontmatter = this.extractNoteFrontmatterDefaults(root);
      const targetDefault = this.extractNoteCreationTargetDefault(root);
      if (!Object.keys(frontmatter).length && !targetDefault.baseFileName && !targetDefault.blockedReason) continue;
      return { frontmatter, ...targetDefault };
    }
    return { frontmatter: {} };
  }

  private extractNoteCreationTargetDefault(filters: unknown): Pick<NoteCreationDefaults, 'baseFileName' | 'blockedReason'> {
    let folderTarget: string | null = null;
    for (const condition of this.collectPositiveNoteFilterConditions(filters)) {
      const propertyRaw = condition.property.trim();
      if (!propertyRaw) continue;
      const property = propertyRaw.toLowerCase().replace(/^note\./, '');
      const value = this.resolveBaseContextToken(condition.value) ?? this.normalizeNoteFilterDefaultValue(condition.value);
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const text = String(value).trim();
      if (!text) continue;

      if (property === 'file.path' || property === 'path' || property === 'filepath') {
        const targetPath = this.normalizeNoteTargetPath(text);
        if (targetPath) {
          if (this.app.vault.getFileByPath(targetPath) instanceof TFile) {
            return { blockedReason: `Cannot create a matching note because the Base filters require existing file: ${targetPath}` };
          }
          return { baseFileName: targetPath.replace(/\.md$/i, '') };
        }
      }
      if (property === 'file.folder' || property === 'folder' || property === 'folderpath') {
        const folderPath = this.normalizeNoteTargetFolder(text);
        if (!folderPath) continue;
        if (folderTarget && folderTarget.toLowerCase() !== folderPath.toLowerCase()) return {};
        folderTarget = folderPath;
      }
    }
    return folderTarget ? { baseFileName: `${folderTarget}/Untitled` } : {};
  }

  private extractNoteFrontmatterDefaults(filters: unknown): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const condition of this.collectPositiveNoteFilterConditions(filters)) {
      const propertyRaw = condition.property.trim();
      if (!propertyRaw) continue;
      const property = propertyRaw.toLowerCase();
      if (
        property.includes('file.') ||
        property.includes('path') ||
        property.includes('folder') ||
        property.includes('name') ||
        property.includes('title') ||
        property.startsWith('task.') ||
        property.startsWith('line.') ||
        property.startsWith('block.') ||
        property.startsWith('tps.') ||
        property.startsWith('kanban.')
      ) {
        continue;
      }

      const value = this.normalizeNoteFilterDefaultValue(condition.value);
      if (value === null) continue;
      const key = propertyRaw.startsWith('note.')
        ? propertyRaw.slice(5)
        : propertyRaw;
      if (!key.trim()) continue;
      defaults[key.trim()] = value;
    }
    return defaults;
  }

  private collectPositiveNoteFilterConditions(filters: unknown): Array<{ property: string; operator: string; value: unknown }> {
    const conditions: Array<{ property: string; operator: string; value: unknown }> = [];
    const visited = new WeakSet<object>();

    const visit = (node: any, negated = false): boolean => {
      if (!node) return false;
      if (typeof node === 'string') {
        const parsed = this.parseInlineNoteFilterCondition(node);
        if (parsed && !negated && this.isPositiveNoteEqualityOperator(parsed.operator)) {
          conditions.push(parsed);
          return true;
        }
        return false;
      }
      if (Array.isArray(node)) {
        let found = false;
        for (const child of node) {
          found = visit(child, negated) || found;
        }
        return found;
      }
      if (typeof node !== 'object') return false;
      const proto = Object.getPrototypeOf(node);
      if (proto !== Object.prototype && proto !== null) return false;
      if (visited.has(node)) return false;
      visited.add(node);

      const record = node as Record<string, unknown>;
      const orBranches = Object.prototype.hasOwnProperty.call(record, 'or')
        ? record.or
        : Object.prototype.hasOwnProperty.call(record, 'any')
          ? record.any
          : null;
      if (orBranches != null) {
        for (const child of this.asArray(orBranches)) {
          const before = conditions.length;
          const found = visit(child, negated);
          if (found || conditions.length > before) return true;
        }
        return false;
      }
      if (Object.prototype.hasOwnProperty.call(record, 'not')) {
        return visit(record.not, !negated);
      }
      let found = false;
      for (const key of ['and', 'all', 'filters', 'children', 'data']) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          found = visit(record[key], negated) || found;
        }
      }

      const inline = record.expression ?? record.expr ?? record.query ?? record.code ?? record.source ?? record.text ?? record.raw;
      if (typeof inline === 'string') {
        const parsed = this.parseInlineNoteFilterCondition(inline);
        if (parsed && !negated && this.isPositiveNoteEqualityOperator(parsed.operator)) {
          conditions.push(parsed);
          return true;
        }
      }

      const rawProperty =
        record.property ??
        record.field ??
        record.key ??
        record.column ??
        record.left ??
        record.lhs ??
        record.operand ??
        null;
      const property = this.readFilterToken(rawProperty);
      if (!property) return found;
      const rawOperator = record.op ?? record.operator ?? record.comparison ?? record.type ?? record.condition;
      const operator = this.readFilterToken(rawOperator);
      if (negated || !this.isPositiveNoteEqualityOperator(operator)) return found;
      let value =
        record.value ??
        record.pattern ??
        record.match ??
        record.right ??
        record.rhs ??
        record.target ??
        record.literal;
      if (value && typeof value === 'object' && 'value' in value) value = (value as any).value;
      conditions.push({ property, operator, value });
      return true;
    };

    visit(filters);
    return conditions;
  }

  private parseInlineNoteFilterCondition(expression: string): { property: string; operator: string; value: unknown } | null {
    const trimmed = String(expression || '').trim();
    if (!trimmed || trimmed.startsWith('!')) return null;

    const containsMatch = trimmed.match(/^([\w.]+)\.contains\((.+)\)\s*$/i);
    if (containsMatch) {
      return { property: containsMatch[1], operator: 'contains', value: this.stripFilterQuotes(containsMatch[2].trim()) };
    }

    const comparisonMatch = trimmed.match(/^([\w.]+)\s*(==|!=|=)\s*(.+)$/);
    if (comparisonMatch) {
      return { property: comparisonMatch[1], operator: comparisonMatch[2], value: this.stripFilterQuotes(comparisonMatch[3].trim()) };
    }

    const textualMatch = trimmed.match(/^([\w.]+)\s+(is|equals?)\s+(.+)$/i);
    if (textualMatch) {
      return { property: textualMatch[1], operator: textualMatch[2], value: this.stripFilterQuotes(textualMatch[3].trim()) };
    }

    return null;
  }

  private readFilterToken(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    return String(
      record.property ??
      record.name ??
      record.key ??
      record.field ??
      record.id ??
      record.label ??
      record.column ??
      '',
    ).trim();
  }

  private readFilterExpressionProperty(expr: string): string {
    const raw = String(expr || '').trim().replace(/^!+\s*/u, '');
    if (!raw) return '';
    const callMatch = raw.match(/^([\w.\s-]+)\.(?:contains|containsAny|equals|isEmpty|empty|exists|isNotEmpty)\b/i);
    if (callMatch?.[1]) return callMatch[1].trim();
    const wordMatch = raw.match(/^([\w.\s-]+?)\s+(?:contains|has|is not empty|is empty|isNotEmpty|exists|empty|is|equals?)\b/i);
    if (wordMatch?.[1]) return wordMatch[1].trim();
    const comparisonMatch = raw.match(/^([\w.\s-]+?)\s*(?:==|=|!=|!==)\s*/i);
    if (comparisonMatch?.[1]) return comparisonMatch[1].trim();
    return '';
  }

  private isPositiveNoteEqualityOperator(operator: string): boolean {
    const op = String(operator || '').toLowerCase().replace(/\s+/g, '');
    if (!op) return true;
    if (op.includes('not') || op.includes('!=') || op.includes('doesnot')) return false;
    return op === '=' || op === '==' || op.includes('is') || op.includes('equals');
  }

  private normalizeNoteFilterDefaultValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.normalizeNoteFilterDefaultValue(item))
        .filter((item) => item !== null);
      return normalized.length ? normalized : null;
    }
    if (value && typeof value === 'object' && 'value' in value) {
      return this.normalizeNoteFilterDefaultValue((value as any).value);
    }
    if (typeof value === 'string') {
      const trimmed = this.stripFilterQuotes(value.trim());
      if (!trimmed) return null;
      if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
      return trimmed;
    }
    return value ?? null;
  }

  private stripFilterQuotes(value: string): string {
    const trimmed = String(value || '').trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  private getTaskRootFilterFromBaseFilters(): KanbanTaskRootFilter {
    const filter: KanbanTaskRootFilter = {
      mode: 'mixed',
      hasTaskDirective: false,
      includeDone: false,
      statuses: new Set<string>(),
      excludeStatuses: new Set<string>(),
      tags: new Set<string>(),
      excludeTags: new Set<string>(),
    };
    for (const root of this.getBaseFilterRoots()) {
      if (this.hasTaskDirectiveInFilterNode(root)) filter.hasTaskDirective = true;
      this.collectTaskRootFilterNode(root, filter);
    }
    const doneStatuses = this.getDoneStatuses();
    for (const status of filter.statuses) {
      if (doneStatuses.has(status)) filter.includeDone = true;
    }
    if (this.shouldShowCompletedTasks()) filter.includeDone = true;
    return filter;
  }

  private hasTaskDirectiveInFilterNode(node: unknown): boolean {
    if (!node) return false;
    if (Array.isArray(node)) return node.some((child) => this.hasTaskDirectiveInFilterNode(child));
    if (typeof node === 'string') {
      const expr = node.trim().replace(/^!+\s*/u, '');
      if (parseBareSemanticKindExpression(expr)) return false;
      return /^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\b/i.test(expr)
        || /^(?:task\.)?(?:status|tags?|open|isopen|done|isdone|completed|complete)\b/i.test(expr)
        || /^task\.(?:path|file|file\.path|file\.extension|file\.ext)\b/i.test(expr)
        || this.isSharedTaskValueFilterExpression(expr);
    }
    if (typeof node !== 'object') return false;
    const record = node as Record<string, unknown>;
    const propRaw = String(record.property ?? record.field ?? '').trim();
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^(?:task|tps|kanban)\./i, ''));
    const propLower = propRaw.toLowerCase();
    if (isBareSemanticKindFilter(propRaw, this.readFilterObjectValues(record))) return false;
    if (propLower.startsWith('task.')
      || ['itemtype', 'itemkind', 'kind', 'tag', 'tags', 'status', 'checkboxstatus', 'open', 'isopen', 'done', 'isdone', 'completed', 'complete'].includes(normalizedProp)
      || (propRaw && !propLower.startsWith('note.') && !propLower.startsWith('file.') && !['path', 'file', 'filepath', 'fileextension', 'fileext'].includes(normalizedProp))) return true;
    return Object.values(record).some((value) => this.hasTaskDirectiveInFilterNode(value));
  }

  private collectTaskRootFilterNode(node: unknown, filter: KanbanTaskRootFilter, parentNegated = false): void {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) this.collectTaskRootFilterNode(child, filter, parentNegated);
      return;
    }
    if (typeof node === 'string') {
      this.collectTaskRootFilterString(parentNegated ? `!${node}` : node, filter);
      return;
    }
    if (typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'not')) {
      this.collectTaskRootFilterNode(record.not, filter, !parentNegated);
    }
    if (Object.prototype.hasOwnProperty.call(record, 'or') || Object.prototype.hasOwnProperty.call(record, 'any')) {
      return;
    }
    this.collectTaskRootFilterObject(record, filter, parentNegated);
    for (const [key, value] of Object.entries(record)) {
      if (key === 'not') continue;
      this.collectTaskRootFilterNode(value, filter, parentNegated);
    }
  }

  private collectTaskRootFilterString(rawExpr: string, filter: KanbanTaskRootFilter): void {
    const raw = String(rawExpr || '').trim();
    const isNegated = raw.startsWith('!');
    const expr = (isNegated ? raw.slice(1) : raw).trim();
    if (!expr) return;
    const lower = expr.toLowerCase();

    if (parseBareSemanticKindExpression(expr)) {
      filter.mode = 'notes';
      return;
    }

    const kindMatch = lower.match(/^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=)\s*["']?(task|tasks|bullet|bullets|note|notes|all|mixed)["']?$/i);
    if (kindMatch?.[1]) {
      const value = kindMatch[1].toLowerCase();
      filter.hasTaskDirective = true;
      filter.mode = value.startsWith('task') ? 'tasks' : value.startsWith('bullet') ? 'bullets' : value.startsWith('note') ? 'notes' : 'mixed';
    }

    if (/^(?:task\.)?(?:open|isopen)\s*(?:==|=)\s*(true|1)$/i.test(expr)) {
      filter.hasTaskDirective = true;
      filter.includeDone = false;
    }
    if (/^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(false|0)$/i.test(expr)) {
      filter.hasTaskDirective = true;
      filter.includeDone = false;
    }
    if (/^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(true|1)$/i.test(expr)) {
      filter.hasTaskDirective = true;
      filter.includeDone = true;
      filter.statuses.add('complete');
    }

    this.collectTaskValuesFromFilterExpression(expr, 'status', filter.statuses, filter.excludeStatuses, filter, isNegated, false);
    this.collectTaskValuesFromFilterExpression(expr, 'tags', filter.tags, filter.excludeTags, filter, isNegated, false);
  }

  private collectTaskValuesFromFilterExpression(
    expr: string,
    propName: 'status' | 'tags',
    includeTarget: Set<string>,
    excludeTarget: Set<string>,
    filter: KanbanTaskRootFilter,
    isNegated = false,
    requireTaskPrefix = false,
  ): void {
    const propPattern = `${requireTaskPrefix ? 'task\\.' : '(?:task\\.)?'}${propName === 'tags' ? '(?:tags|tag)' : 'status'}`;
    const addToken = (rawToken: string, target: Set<string>) => {
      const token = propName === 'tags' ? this.normalizeTaskTag(rawToken) : rawToken.trim().toLowerCase();
      if (token) target.add(token);
    };
    const callTarget = isNegated ? excludeTarget : includeTarget;
    const containsAnyMatch = expr.match(new RegExp(`^${propPattern}\\.containsAny\\((.*)\\)$`, 'i'));
    if (containsAnyMatch) {
      filter.hasTaskDirective = true;
      for (const token of this.extractFilterTokens(containsAnyMatch[1] || '')) {
        addToken(token, callTarget);
      }
    }
    const containsMatch = expr.match(new RegExp(`^${propPattern}\\.contains\\((.*)\\)$`, 'i'));
    if (containsMatch) {
      filter.hasTaskDirective = true;
      for (const token of this.extractFilterTokens(containsMatch[1] || '')) {
        addToken(token, callTarget);
      }
    }
    const equalsCallMatch = expr.match(new RegExp(`^${propPattern}\\.equals\\((.*)\\)$`, 'i'));
    if (equalsCallMatch) {
      filter.hasTaskDirective = true;
      for (const token of this.extractFilterTokens(equalsCallMatch[1] || '')) {
        addToken(token, callTarget);
      }
    }
    const wordOperatorMatch = expr.match(new RegExp(`^${propPattern}\\s+(contains|has|is|equals?)\\s*(.*)$`, 'i'));
    if (wordOperatorMatch?.[2]) {
      filter.hasTaskDirective = true;
      for (const token of this.extractFilterTokens(wordOperatorMatch[2] || '')) {
        addToken(token, callTarget);
      }
    }
    const comparisonMatch = expr.match(new RegExp(`^${propPattern}\\s*(==|=|!=|!==|is|equals?)\\s*(?:"([^"]+)"|'([^']+)'|(.+))$`, 'i'));
    if (comparisonMatch?.[2] || comparisonMatch?.[3] || comparisonMatch?.[4]) {
      filter.hasTaskDirective = true;
      const target = isNegated || String(comparisonMatch[1] || '').startsWith('!') ? excludeTarget : includeTarget;
      addToken(comparisonMatch[2] || comparisonMatch[3] || comparisonMatch[4], target);
    }
  }

  private collectTaskRootFilterObject(node: Record<string, unknown>, filter: KanbanTaskRootFilter, parentNegated = false): void {
    const propRaw = String(node.property ?? node.field ?? '').trim();
    if (!propRaw) return;
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^task\./i, '').replace(/^tps\./i, ''));
    const rawValues = node.values ?? node.value;
    const values = Array.isArray(rawValues) ? rawValues : rawValues == null ? [] : [rawValues];
    const operator = String(node.operator ?? node.op ?? '').trim().toLowerCase();
    const isNegated = parentNegated || operator.startsWith('!') || operator.includes('not') || operator === '!=' || operator === '!==';

    if (isBareSemanticKindFilter(propRaw, values)) {
      filter.mode = 'notes';
      return;
    }

    if (['itemtype', 'itemkind', 'kind'].includes(normalizedProp)) {
      for (const raw of values) {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) continue;
        filter.hasTaskDirective = true;
        filter.mode = value.startsWith('task') ? 'tasks' : value.startsWith('bullet') ? 'bullets' : value.startsWith('note') ? 'notes' : 'mixed';
      }
      return;
    }

    if (['open', 'isopen'].includes(normalizedProp)) {
      filter.hasTaskDirective = true;
      filter.includeDone = values.some((value) => String(value).toLowerCase() === 'true' || String(value) === '1') ? false : filter.includeDone;
      return;
    }

    if ((propRaw.toLowerCase().startsWith('task.') || normalizedProp === 'status' || normalizedProp === 'checkboxstatus') && ['status', 'checkboxstatus'].includes(normalizedProp)) {
      filter.hasTaskDirective = true;
      const target = isNegated ? filter.excludeStatuses : filter.statuses;
      for (const raw of values) {
        const value = String(raw || '').trim().toLowerCase();
        if (value) target.add(value);
      }
      return;
    }

    if (!propRaw.toLowerCase().startsWith('note.') && ['tag', 'tags'].includes(normalizedProp)) {
      filter.hasTaskDirective = true;
      const target = isNegated ? filter.excludeTags : filter.tags;
      for (const raw of values) {
        const value = this.normalizeTaskTag(String(raw || ''));
        if (value) target.add(value);
      }
    }
  }

  private collectForcedLanesFromFilterNode(
    node: unknown,
    propName: string,
    keys: Set<string>,
    includeUngrouped: { value: boolean },
  ): void {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const child of node) {
        this.collectForcedLanesFromFilterNode(child, propName, keys, includeUngrouped);
      }
      return;
    }

    if (typeof node === 'string') {
      this.collectForcedLanesFromFilterString(node, propName, keys, includeUngrouped);
      return;
    }

    if (typeof node !== 'object') return;
    this.collectForcedLanesFromFilterObject(node as Record<string, unknown>, propName, keys, includeUngrouped);

    for (const value of Object.values(node as Record<string, unknown>)) {
      this.collectForcedLanesFromFilterNode(value, propName, keys, includeUngrouped);
    }
  }

  private collectForcedLanesFromFilterString(
    rawExpr: string,
    propName: string,
    keys: Set<string>,
    includeUngrouped: { value: boolean },
  ): void {
    const expr = String(rawExpr || '').trim();
    if (!expr || expr.startsWith('!')) return;

    const escaped = this.getTaskInlinePropertyName(propName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const propPattern = `(?:note\\.|task\\.)?${escaped}`;

    const containsAnyMatch = expr.match(new RegExp(`^${propPattern}\\.containsAny\\((.*)\\)$`, 'i'));
    if (containsAnyMatch) {
      const args = containsAnyMatch[1] || '';
      for (const token of this.extractQuotedStrings(args)) {
        keys.add(token);
      }
    }

    const equalsCallMatch = expr.match(new RegExp(`^${propPattern}\\.equals\\((.*)\\)$`, 'i'));
    if (equalsCallMatch) {
      const [first] = this.extractFilterTokens(equalsCallMatch[1] || '');
      const resolved = this.resolveBaseContextToken(first);
      if (resolved) keys.add(resolved);
    }

    const comparisonMatch = expr.match(new RegExp(`^${propPattern}\\s*(==|=|is|equals?)\\s*(?:"([^"]+)"|'([^']+)'|([^\\s].*?))$`, 'i'));
    if (comparisonMatch?.[2] || comparisonMatch?.[3] || comparisonMatch?.[4]) {
      const resolved = this.resolveBaseContextToken(comparisonMatch[2] || comparisonMatch[3] || comparisonMatch[4]);
      if (resolved) keys.add(resolved);
    }

    const isEmptyMatch = expr.match(new RegExp(`^${propPattern}\\.isEmpty\\(\\)$`, 'i'));
    if (isEmptyMatch) includeUngrouped.value = true;
  }

  private collectForcedLanesFromFilterObject(
    node: Record<string, unknown>,
    propName: string,
    keys: Set<string>,
    includeUngrouped: { value: boolean },
  ): void {
    const propRaw =
      (typeof node.property === 'string' ? node.property : '') ||
      (typeof node.field === 'string' ? node.field : '');
    if (!propRaw) return;

    const normalizedProp = this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propRaw));
    if (normalizedProp !== this.normalizeInlinePropertyKey(this.getTaskInlinePropertyName(propName))) return;

    const op = String(node.operator ?? node.op ?? '').toLowerCase();
    if (op.includes('empty')) {
      includeUngrouped.value = true;
      return;
    }

    const rawValues = node.values ?? node.value;
    if (Array.isArray(rawValues)) {
      for (const value of rawValues) {
        const resolved = this.resolveBaseContextToken(value);
        if (resolved) keys.add(resolved);
      }
      return;
    }

    const resolved = this.resolveBaseContextToken(rawValues);
    if (resolved) {
      keys.add(resolved);
    }
  }

  private extractQuotedStrings(text: string): string[] {
    const values: string[] = [];
    const regex = /"([^"]+)"|'([^']+)'/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = (match[1] ?? match[2] ?? '').trim();
      if (value) values.push(value);
    }
    return values;
  }

  private extractFilterTokens(text: string): string[] {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const quoted = this.extractQuotedStrings(raw);
    if (quoted.length) return quoted;
    return raw
      .split(/[,;]/gu)
      .map((value) => value.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  private getLaneId(group: BasesEntryGroup): string {
    if (!group.hasKey() || group.key == null) return 'ungrouped';
    const key = String(group.key).trim().toLowerCase();
    if (!key || key === 'null' || key === 'undefined') return 'ungrouped';
    return `key:${key}`;
  }

  private mergeGroupsByLaneId(groups: BasesEntryGroup[]): BasesEntryGroup[] {
    const laneOrder: string[] = [];
    const laneEntries = new Map<string, Map<string, BasesEntry>>();
    const laneLabel = new Map<string, string | null>();

    for (const group of groups) {
      const laneId = this.getLaneId(group);
      if (!laneEntries.has(laneId)) {
        laneOrder.push(laneId);
        laneEntries.set(laneId, new Map<string, BasesEntry>());
        laneLabel.set(
          laneId,
          laneId === 'ungrouped'
            ? null
            : String(group.key ?? '').trim() || null,
        );
      }

      const entriesByPath = laneEntries.get(laneId)!;
      for (const entry of group.entries) {
        if (!entriesByPath.has(entry.file.path)) {
          entriesByPath.set(entry.file.path, entry);
        }
      }
    }

    return laneOrder.map((laneId) => {
      const entries = Array.from((laneEntries.get(laneId) ?? new Map()).values());
      const key = laneId === 'ungrouped' ? null : (laneLabel.get(laneId) ?? null);
      return {
        key,
        entries,
        hasKey: () => key != null,
      } as unknown as BasesEntryGroup;
    });
  }

  private getLaneOrderViewId(): string {
    const sourcePath = this.getBaseSourcePath() || 'unknown-base';
    const viewName = String(this.config?.name || 'kanban').trim() || 'kanban';
    return `${sourcePath}::${viewName}`;
  }

  private getLegacyUnknownBaseViewId(): string {
    const viewName = String(this.config?.name || 'kanban').trim() || 'kanban';
    return `unknown-base::${viewName}`;
  }

  private getLayoutMode(): 'board' | 'list' {
    const viewId = this.getLaneOrderViewId();
    const map = (this.plugin.settings?.layoutModeByView || {}) as Record<string, 'board' | 'list'>;
    const legacyViewId = this.getLegacyUnknownBaseViewId();
    return (map[viewId] ?? map[legacyViewId]) === 'list' ? 'list' : 'board';
  }

  private shouldShowCompletedTasks(): boolean {
    const viewId = this.getLaneOrderViewId();
    const map = (this.plugin.settings?.showCompletedTasksByView || {}) as Record<string, boolean>;
    const legacyViewId = this.getLegacyUnknownBaseViewId();
    return (map[viewId] ?? map[legacyViewId]) === true;
  }

  private async toggleLayoutMode(): Promise<void> {
    const viewId = this.getLaneOrderViewId();
    const current = this.getLayoutMode();
    const next: 'board' | 'list' = current === 'list' ? 'board' : 'list';
    const existing = this.plugin.settings?.layoutModeByView;
    const map: Record<string, 'board' | 'list'> = (existing && typeof existing === 'object') ? { ...existing } : {};
    map[viewId] = next;
    this.plugin.settings.layoutModeByView = map;
    await this.plugin.saveSettings();
    this.applyLayoutSettings();
    this.render();
  }

  private async toggleDynamicEmptyLaneWidth(): Promise<void> {
    const current = !!this.plugin.settings.dynamicEmptyLaneWidth;
    this.plugin.settings.dynamicEmptyLaneWidth = !current;
    await this.plugin.saveSettings();
    this.render();
  }

  private async toggleCompletedTaskVisibility(): Promise<void> {
    const viewId = this.getLaneOrderViewId();
    const existing = this.plugin.settings?.showCompletedTasksByView;
    const map: Record<string, boolean> = (existing && typeof existing === 'object') ? { ...existing } : {};
    map[viewId] = !this.shouldShowCompletedTasks();
    this.plugin.settings.showCompletedTasksByView = map;
    await this.plugin.saveSettings();
    this.render();
  }

  private applyManualLaneOrder(groups: BasesEntryGroup[]): BasesEntryGroup[] {
    const settings = this.plugin.settings;
    const map = (settings?.laneOrderByView || {}) as Record<string, string[]>;
    const viewId = this.getLaneOrderViewId();
    const legacyViewId = this.getLegacyUnknownBaseViewId();
    const saved = Array.isArray(map[viewId]) ? map[viewId] : Array.isArray(map[legacyViewId]) ? map[legacyViewId] : [];
    if (!saved.length) return groups;

    const rank = new Map<string, number>();
    saved.forEach((id, i) => rank.set(String(id), i));

    return groups
      .map((group, index) => ({ group, index, laneId: this.getLaneId(group) }))
      .sort((a, b) => {
        const ar = rank.has(a.laneId) ? (rank.get(a.laneId) as number) : Number.MAX_SAFE_INTEGER;
        const br = rank.has(b.laneId) ? (rank.get(b.laneId) as number) : Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return a.index - b.index;
      })
      .map((item) => item.group);
  }

  private async saveManualLaneOrder(groups: BasesEntryGroup[]): Promise<void> {
    const viewId = this.getLaneOrderViewId();
    const laneIds = groups.map((group) => this.getLaneId(group));
    const existing = this.plugin.settings?.laneOrderByView;
    const next = (existing && typeof existing === 'object') ? { ...existing } : {};
    next[viewId] = laneIds;
    this.plugin.settings.laneOrderByView = next;
    await this.plugin.saveSettings();
  }

  private reorderGroups(
    groups: BasesEntryGroup[],
    draggedLaneId: string,
    targetLaneId: string,
    position: 'before' | 'after' = 'before',
  ): BasesEntryGroup[] {
    if (draggedLaneId === targetLaneId) return groups;
    const ordered = [...groups];
    const from = ordered.findIndex((group) => this.getLaneId(group) === draggedLaneId);
    const to = ordered.findIndex((group) => this.getLaneId(group) === targetLaneId);
    if (from === -1 || to === -1) return groups;

    const [moved] = ordered.splice(from, 1);
    const targetIndex = ordered.findIndex((group) => this.getLaneId(group) === targetLaneId);
    if (targetIndex === -1) return groups;
    ordered.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
    return ordered;
  }

  private getSelectedFiles(): TFile[] {
    const selected: TFile[] = [];
    for (const path of this.renderedFileOrder) {
      if (!this.selectedPaths.has(path)) continue;
      const af = this.app.vault.getAbstractFileByPath(path);
      if (af instanceof TFile) selected.push(af);
    }
    return selected;
  }

  private syncSelectionClasses(): void {
    const cards = this.containerEl.querySelectorAll<HTMLElement>('.tps-kanban-card[data-path]');
    cards.forEach((card) => {
      const path = card.dataset.path;
      card.classList.toggle('tps-kanban-card--selected', !!path && this.selectedPaths.has(path));
      card.classList.toggle('tps-kanban-card--open-note', !!path && !!this.activeNotePath && path === this.activeNotePath);
    });
  }

  private getActiveMarkdownPath(): string | null {
    const active = this.app.workspace.getActiveFile();
    return active instanceof TFile ? active.path : null;
  }

  private clearSelection(): void {
    if (this.selectedPaths.size === 0) return;
    this.selectedPaths.clear();
    this.selectionAnchorPath = null;
    this.syncSelectionClasses();
  }

  private selectOnly(path: string): void {
    this.selectedPaths.clear();
    this.selectedPaths.add(path);
    this.selectionAnchorPath = path;
    this.syncSelectionClasses();
  }

  private toggleSelect(path: string): void {
    if (this.selectedPaths.has(path)) {
      this.selectedPaths.delete(path);
    } else {
      this.selectedPaths.add(path);
    }
    this.selectionAnchorPath = path;
    this.syncSelectionClasses();
  }

  private selectRange(path: string): void {
    if (!this.selectionAnchorPath) {
      this.selectOnly(path);
      return;
    }
    const start = this.renderedFileOrder.indexOf(this.selectionAnchorPath);
    const end = this.renderedFileOrder.indexOf(path);
    if (start === -1 || end === -1) {
      this.selectOnly(path);
      return;
    }
    const [lo, hi] = start < end ? [start, end] : [end, start];
    this.selectedPaths.clear();
    for (let i = lo; i <= hi; i++) this.selectedPaths.add(this.renderedFileOrder[i]);
    this.syncSelectionClasses();
  }

  private createEntryCard(
    entry: BasesEntry,
    groups: BasesEntryGroup[],
    propName: string | null,
    item: LaneRenderItem,
    displayLane: DisplayLaneGroup,
  ): HTMLElement {
    const cardEl = document.createElement('div');
    let suppressNextClick = false;
    let clearSuppressTimer: number | null = null;

    const scheduleSuppressReset = () => {
      if (clearSuppressTimer != null) {
        window.clearTimeout(clearSuppressTimer);
      }
      clearSuppressTimer = window.setTimeout(() => {
        suppressNextClick = false;
        clearSuppressTimer = null;
      }, 250);
    };

    cardEl.className = 'tps-kanban-card';
    cardEl.classList.add('tps-kanban-card--note');
    cardEl.title = entry.file.path;
    cardEl.draggable = true;
    cardEl.dataset.path = entry.file.path;
    cardEl.dataset.href = entry.file.path;
    cardEl.dataset.linkpath = entry.file.path;
    cardEl.dataset.file = entry.file.path;
    cardEl.dataset.tpsGcmContext = 'kanban-card';
    cardEl.dataset.tpsKanbanPath = entry.file.path;
    if (this.selectedPaths.has(entry.file.path)) cardEl.classList.add('tps-kanban-card--selected');
    if (this.activeNotePath && entry.file.path === this.activeNotePath) {
      cardEl.classList.add('tps-kanban-card--open-note');
    }
    const taskPreview = this.getPreviewTasksForFile(entry.file);
    const previewTasks = taskPreview.tasks;
    const openTaskOverflow = this.plugin.settings?.showTaskOverflowCount === false
      ? 0
      : taskPreview.overflowCount;
    const hasTaskPreview = previewTasks.length > 0 || openTaskOverflow > 0;
    const hasCollapsibleContent = item.hasChildren || hasTaskPreview;
    const subtreeCollapsed = item.hasChildren
      ? !this.expandedSubtreePaths.has(entry.file.path)
      : this.expandedSubtreePaths.has(entry.file.path);
    if (item.hasChildren) {
      cardEl.classList.add('tps-kanban-card--has-children');
    }
    if (hasCollapsibleContent) {
      cardEl.classList.add('tps-kanban-card--has-collapsible-content');
      cardEl.classList.toggle('tps-kanban-card--subtree-collapsed', subtreeCollapsed);
    }

    // Read icon and color from the note's frontmatter using configured keys
    const settings = this.plugin.settings;
    const fm = this.app.metadataCache.getFileCache(entry.file)?.frontmatter as Record<string, unknown> | undefined;
    const styleRule = this.resolveCardStyleRule(fm, entry, propName);
    this.addTextStyleClasses(cardEl, styleRule?.textStyle);
    const entryIconName = settings.iconKey ? this.getEntryStringValue(entry, settings.iconKey) : '';
    const iconName = entryIconName || (fm && settings.iconKey
      ? String(this.getFrontmatterValueCaseInsensitive(fm, settings.iconKey) ?? '').trim()
      : '');
    const resolvedIconName = iconName || this.resolveCompanionIconValue(entry.file, fm);
    const entryColorValue = settings.colorKey ? this.getEntryStringValue(entry, settings.colorKey) : '';
    const directColorValue = entryColorValue || ((fm && settings.colorKey)
      ? String(this.getFrontmatterValueCaseInsensitive(fm, settings.colorKey) ?? '').trim()
      : '');
    const colorValue = this.normalizeCssColorValue(directColorValue || styleRule?.color || '');
    const colorTarget = settings.frontmatterColorTarget || 'card';
    const applyColorToCard = colorTarget === 'card' || colorTarget === 'both';

    if (colorValue && applyColorToCard) {
      cardEl.style.setProperty('--tps-card-color', colorValue);
      cardEl.classList.add('tps-kanban-card--colored');
    }

    // Card inner: title row first, metadata/actions below for better scanability.
    const inner = cardEl.createDiv({ cls: 'tps-kanban-card-inner' });
    const useWideListLayout = this.shouldUseWideListCardLayout();
    if (useWideListLayout) {
      inner.style.display = 'grid';
      inner.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(128px, 34%)';
      inner.style.alignItems = 'start';
      inner.style.columnGap = 'max(10px, calc(18px * var(--tps-kanban-scale)))';
      inner.style.rowGap = 'max(3px, calc(6px * var(--tps-kanban-scale)))';
    }
    const titleRow = inner.createDiv({ cls: 'tps-kanban-card-title-row' });
    if (useWideListLayout) {
      titleRow.style.gridColumn = '1';
      titleRow.style.minWidth = '0';
    }
    const iconEl = titleRow.createDiv({ cls: 'tps-kanban-card-icon' });
    if (resolvedIconName) {
      const bareIcon = this.normalizeLucideIconValue(resolvedIconName);
      setIcon(iconEl, bareIcon);
    }
    iconEl.classList.toggle('tps-kanban-card-icon--empty', !iconEl.querySelector('svg'));

    const titleEl = titleRow.createEl('a', {
      text: entry.file.basename,
      cls: 'tps-kanban-card-title internal-link',
      attr: {
        href: entry.file.path,
        'data-href': entry.file.path,
        'data-linkpath': entry.file.path,
        'aria-label': entry.file.path,
        draggable: 'false',
      },
    });
    let lastPreviewOpenAt = 0;
    let lastPreviewClickTimeStamp = 0;
    let lastTapAt = 0;
    let lastTapPath: string | null = null;
    const openCardFromEvent = (e: MouseEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.selectOnly(entry.file.path);
      void this.openOrFocusFile(entry.file);
    };
    const shouldOpenFromRepeatedTap = (e: MouseEvent | PointerEvent) => {
      if ((e as MouseEvent).detail >= 2) return true;
      const now = performance.now();
      const repeated = lastTapPath === entry.file.path && now - lastTapAt < 650;
      lastTapAt = now;
      lastTapPath = entry.file.path;
      return repeated;
    };
    const openPreviewFromCardEvent = (e: MouseEvent | PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      lastPreviewOpenAt = performance.now();
      lastPreviewClickTimeStamp = e.timeStamp || 0;
      this.selectOnly(entry.file.path);
      this.openCardPreview(e, titleEl, entry.file);
    };
    const handleCardClick = (e: MouseEvent) => {
      const isSamePreviewClick = lastPreviewOpenAt > 0
        && performance.now() - lastPreviewOpenAt < 300
        && !!lastPreviewClickTimeStamp
        && e.timeStamp === lastPreviewClickTimeStamp;
      if (isSamePreviewClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (suppressNextClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        suppressNextClick = false;
        if (clearSuppressTimer != null) {
          window.clearTimeout(clearSuppressTimer);
          clearSuppressTimer = null;
        }
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.selectRange(entry.file.path);
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.toggleSelect(entry.file.path);
        return;
      }
      if (!this.shouldPreviewCardClicks() || shouldOpenFromRepeatedTap(e)) {
        openCardFromEvent(e);
        return;
      }
      openPreviewFromCardEvent(e);
    };
    titleEl.addEventListener('click', handleCardClick, { capture: true });
    const metaRow = inner.createDiv({ cls: 'tps-kanban-card-meta-row' });
    if (useWideListLayout) {
      metaRow.style.gridColumn = '2';
      metaRow.style.gridRow = '1';
      metaRow.style.justifyContent = 'flex-end';
      metaRow.style.alignItems = 'flex-start';
      metaRow.style.paddingLeft = '0';
      metaRow.style.minWidth = '0';
    }

    if (hasCollapsibleContent) {
      const taskCount = previewTasks.length + openTaskOverflow;
      const countParts = [
        item.childCount > 0 ? `${item.childCount} note subitem${item.childCount === 1 ? '' : 's'}` : '',
        taskCount > 0 ? `${taskCount} task${taskCount === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      const toggleBtn = metaRow.createEl('button', {
        cls: 'tps-kanban-subtree-toggle',
        attr: {
          type: 'button',
          'aria-label': subtreeCollapsed ? 'Expand subitems' : 'Collapse subitems',
          title: subtreeCollapsed
            ? `Expand ${countParts.join(' and ')}`
            : `Collapse ${countParts.join(' and ')}`,
        },
      });
      toggleBtn.draggable = false;
      setIconWithFallback(toggleBtn, subtreeCollapsed ? 'chevron-right' : 'chevron-down');
      if (item.childCount > 0) {
        toggleBtn.createSpan({
          cls: 'tps-kanban-subtree-count tps-kanban-subtree-count--subitems',
          text: String(item.childCount),
        });
      }
      if (item.childCount > 0 && taskCount > 0) {
        toggleBtn.createSpan({ cls: 'tps-kanban-subtree-count-separator', text: '·' });
      }
      if (taskCount > 0) {
        toggleBtn.createSpan({
          cls: 'tps-kanban-subtree-count tps-kanban-subtree-count--tasks',
          text: String(taskCount),
        });
      }
      toggleBtn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
      });
      toggleBtn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleSubtreeExpanded(entry.file.path);
      });
    }

    this.renderCardProperties(metaRow, entry, propName);

    const addSubitemBtn = metaRow.createEl('button', {
      cls: 'tps-kanban-card-add-subitem',
      attr: {
        type: 'button',
        'aria-label': `Add subitem to ${entry.file.basename}`,
        title: 'Add subitem',
      },
    });
    addSubitemBtn.draggable = false;
    setIconWithFallback(addSubitemBtn, 'plus');
    addSubitemBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
    });
    addSubitemBtn.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const taskFilter = this.getTaskRootFilterFromBaseFilters();
      const mode = this.resolveCardAddMode(taskFilter);
      if (mode === 'task') {
        void this.createTaskForEntry(entry.file, propName, displayLane, taskFilter);
      } else {
        void this.createSubitemForEntry(entry, propName, displayLane);
      }
    });

    const summary = this.getCardSummary(entry, fm);
    if (summary) {
      const summaryEl = inner.createDiv({ cls: 'tps-kanban-card-summary', text: summary });
      if (useWideListLayout) {
        summaryEl.style.gridColumn = '1 / -1';
        summaryEl.style.gridRow = '2';
      }
    }

    if (!subtreeCollapsed && (previewTasks.length > 0 || openTaskOverflow > 0)) {
      const tasksEl = cardEl.createDiv({ cls: 'tps-kanban-card-tasks' });
      tasksEl.draggable = false;
      for (const task of previewTasks) {
        const taskTitle = this.getTaskVisibleTitle(task);
        const taskEl = tasksEl.createDiv({
          cls: 'tps-kanban-card-task',
          attr: {
            draggable: 'false',
            title: `${entry.file.path}:${task.line}`,
          },
        });
        taskEl.classList.toggle('tps-kanban-card-task--completed', this.isDoneTask(task));
        taskEl.dataset.taskPath = entry.file.path;
        taskEl.dataset.taskLine = String(task.line);
        taskEl.dataset.path = entry.file.path;
        taskEl.dataset.tpsGcmContext = 'kanban-task';
        taskEl.dataset.tpsKanbanPath = entry.file.path;
        taskEl.dataset.tpsKanbanLine = String(task.line);
        taskEl.dataset.tpsKanbanCheckboxState = task.itemKind === 'bullet' ? '' : task.checkboxState || '[ ]';
        taskEl.dataset.tpsKanbanTaskText = task.text;
        const buildNestedTaskPayload = () => JSON.stringify({
          type: 'task-line',
          source: 'tps-kanban',
          itemKind: task.itemKind || 'task',
          path: entry.file.path,
          line: task.line,
          rawLine: '',
          checkboxState: task.itemKind === 'bullet' ? undefined : task.checkboxState || '[ ]',
          text: taskTitle,
          sourceLaneValues: this.getDisplayLaneWritableValues(displayLane),
        });
        const handleNestedTaskDragStart = (e: DragEvent) => {
          if (!e.dataTransfer) return;
          const target = e.target as HTMLElement | null;
          if (target?.closest('input, button, textarea, select')) return;
          e.stopPropagation();
          suppressNextClick = true;
          scheduleSuppressReset();
          e.dataTransfer.effectAllowed = 'move';
          const payload = buildNestedTaskPayload();
          e.dataTransfer.setData(KANBAN_TASK_MIME, payload);
          e.dataTransfer.setData(TPS_TASK_LINE_MIME, payload);
          e.dataTransfer.setData('text/plain', `${entry.file.path}:${task.line}`);
          taskEl.addClass('tps-kanban-card-task--dragging');
        };
        taskEl.addEventListener('pointerdown', (e: PointerEvent) => {
          this.beginTaskPointerDrag(e, entry.file, task, propName, displayLane, taskEl);
        });
        taskEl.addEventListener('dragstart', handleNestedTaskDragStart);
        taskEl.addEventListener('dragend', () => {
          taskEl.removeClass('tps-kanban-card-task--dragging');
          scheduleSuppressReset();
        });

        taskEl.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const handled = this.openTaskLineContextMenu(e, entry.file.path, task.line);
          if (handled) return;

          const menu = new Menu();
          if (propName) {
            menu.addItem(it => it.setTitle(`Open ${taskTitle}`).onClick(() => {
              void this.openTaskLine(entry.file, task.line);
            }));
          } else {
            menu.addItem(it => it.setTitle('Open task').onClick(() => {
              void this.openTaskLine(entry.file, task.line);
            }));
          }
          menu.showAtPosition({ x: e.clientX, y: e.clientY });
        });

        const taskDragHandle = taskEl.createSpan({
          cls: 'tps-kanban-task-card-drag-handle',
          attr: {
            role: 'button',
            tabindex: '0',
            draggable: 'true',
            'aria-label': `Drag ${task.itemKind === 'bullet' ? 'bullet' : 'task'}: ${taskTitle}`,
            title: task.itemKind === 'bullet' ? 'Drag bullet' : 'Drag task',
          },
        });
        setIconWithFallback(taskDragHandle, 'grip-vertical');
        taskDragHandle.addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation();
          this.beginTaskPointerDrag(e, entry.file, task, propName, displayLane, taskEl);
        });
        taskDragHandle.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        });
        taskDragHandle.addEventListener('dragstart', handleNestedTaskDragStart);
        taskDragHandle.addEventListener('dragend', () => {
          taskEl.removeClass('tps-kanban-card-task--dragging');
          scheduleSuppressReset();
        });
        taskEl.addEventListener('click', (e: MouseEvent) => {
          if (Date.now() < this.suppressTaskCardClickUntil || suppressNextClick) {
            e.preventDefault();
            e.stopPropagation();
            suppressNextClick = false;
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          void this.openTaskLine(entry.file, task.line);
        });
        const checkboxEl = taskEl.createEl('input', {
          cls: 'tps-kanban-card-task-checkbox',
          attr: {
            type: 'checkbox',
            role: 'checkbox',
            'aria-label': `Toggle task: ${taskTitle}`,
            'data-checkbox-state': task.checkboxState || '[ ]',
            'data-checkbox-marker': this.getCheckboxMarker(task.checkboxState || '[ ]'),
          },
        });
        checkboxEl.checked = this.getDoneStatuses().has(this.getStatusForCheckboxState(task.checkboxState || '[ ]'));
        checkboxEl.draggable = false;
        checkboxEl.addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation();
        });
        checkboxEl.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
        });
        checkboxEl.addEventListener('change', (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          void this.updateTaskCheckboxState(entry.file, task.line, this.getToggleCheckboxStateForTask(task));
        });
        const taskContentEl = taskEl.createDiv({ cls: 'tps-kanban-card-task-content' });
        taskContentEl.createSpan({ cls: 'tps-kanban-card-task-text', text: taskTitle });
        if (task.inlineFields?.length) {
          const fieldsEl = taskContentEl.createDiv({ cls: 'tps-kanban-card-task-fields' });
          task.inlineFields.forEach((field) => {
            fieldsEl.createSpan({
              cls: 'tps-kanban-card-task-field',
              text: field.key === 'tag' ? field.value : `${field.key}: ${field.value}`,
            });
          });
        }
      }
      if (openTaskOverflow > 0) {
        const overflowEl = tasksEl.createDiv({
          cls: 'tps-kanban-card-task tps-kanban-card-task-overflow',
          attr: {
            draggable: 'false',
            title: `${entry.file.path}: ${openTaskOverflow} more task${openTaskOverflow === 1 ? '' : 's'}`,
          },
        });
        overflowEl.createSpan({ cls: 'tps-kanban-card-task-checkbox tps-kanban-card-task-overflow-marker', text: '' });
        const overflowContentEl = overflowEl.createDiv({ cls: 'tps-kanban-card-task-content' });
        overflowContentEl.createSpan({
          cls: 'tps-kanban-card-task-text',
          text: `+${openTaskOverflow} more`,
        });
      }
    }

    if (!subtreeCollapsed && item.children.length > 0) {
      const subitemsEl = cardEl.createDiv({ cls: 'tps-kanban-card-subitems' });
      subitemsEl.draggable = false;
      for (const child of item.children) {
        const childCard = this.createEntryCard(child.entry, groups, propName, child, displayLane);
        childCard.addClass('tps-kanban-card--nested');
        childCard.style.setProperty('--tps-kanban-depth', String(Math.min(Math.max(1, child.depth), 8)));
        subitemsEl.appendChild(childCard);
      }
    }

    cardEl.addEventListener('dragstart', (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.tps-kanban-card') !== cardEl) return;
      if (!e.dataTransfer) return;
      suppressNextClick = true;
      scheduleSuppressReset();
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('application/x-kanban-entry', entry.file.path);
      e.dataTransfer.setData(
        'application/x-kanban-entry-source-values',
        JSON.stringify(this.getDisplayLaneWritableValues(displayLane)),
      );
      e.dataTransfer.setData('obsidian/file', entry.file.path);
      e.dataTransfer.setData('text/plain', entry.file.path);
      cardEl.style.opacity = '0.5';
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.style.opacity = '1';
      scheduleSuppressReset();
    });

    // single click - show native note preview
    cardEl.addEventListener('click', handleCardClick);

    // right-click — trigger native file/files menu so GCM augments this view too.
    cardEl.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.recordGcmContextTarget(e.target);

      // Right-click without modifiers should target this card (standard file list behavior).
      if (!this.selectedPaths.has(entry.file.path) && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
        this.selectOnly(entry.file.path);
      } else if (e.shiftKey) {
        this.selectRange(entry.file.path);
      } else if (e.metaKey || e.ctrlKey) {
        this.toggleSelect(entry.file.path);
      }

      const selectedFiles = this.getSelectedFiles();
      const menu = new Menu();

      if (selectedFiles.length > 1) {
        this.app.workspace.trigger('files-menu', menu as any, selectedFiles as any);
      } else {
        const target = selectedFiles[0] ?? entry.file;
        this.app.workspace.trigger('file-menu', menu as any, target as any);
      }

      // Keep Kanban-specific move actions in this menu.
      if (propName) {
        menu.addSeparator();
        for (const g of groups) {
          if (!g.hasKey() || g.key == null) continue;
          const val = g.key.toString();
          if (!val) continue;
          const label = this.keyLabel(g);
          if (selectedFiles.length > 1) {
            menu.addItem(it => it.setTitle(`Move ${selectedFiles.length} cards → ${label}`).onClick(async () => {
              for (const file of selectedFiles) {
                await this.applyFrontmatterProperty(file, propName, val);
                await this.applyCompanionRulesToFile(file);
              }
              this.render();
            }));
          } else {
            const target = selectedFiles[0] ?? entry.file;
            menu.addItem(it => it.setTitle(`Move → ${label}`).onClick(async () => {
              await this.applyFrontmatterProperty(target, propName, val);
              await this.applyCompanionRulesToFile(target);
              this.render();
            }));
          }
        }
      }
      menu.showAtPosition({ x: e.clientX, y: e.clientY });
    });

    // Drag-onto-card: make dragged card a subitem of this card
    cardEl.addEventListener('dragover', (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (!e.dataTransfer.types.includes('application/x-kanban-entry')) return;
      const draggedPath = e.dataTransfer.getData('application/x-kanban-entry');
      // Can't nest onto itself, and skip if dragged path not yet available (security restriction)
      if (draggedPath === entry.file.path) return;
      if (!this.isCardSubitemDropZone(cardEl, e)) {
        cardEl.removeClass('tps-kanban-card--drop-nest');
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cardEl.closest('.tps-kanban-cards')?.addClass('tps-kanban-drop-target');
        cardEl.closest('.tps-kanban-lane')?.addClass('tps-kanban-lane--card-drop-target');
        return;
      }
      e.preventDefault();
      e.stopPropagation(); // don't also highlight the lane cardsWrap
      e.dataTransfer.dropEffect = 'move';
      cardEl.addClass('tps-kanban-card--drop-nest');
    });

    cardEl.addEventListener('dragleave', (e: DragEvent) => {
      // Only clear if we're leaving the card entirely (not entering a child element)
      if (!cardEl.contains(e.relatedTarget as Node)) {
        cardEl.removeClass('tps-kanban-card--drop-nest');
      }
    });

    cardEl.addEventListener('drop', async (e: DragEvent) => {
      cardEl.removeClass('tps-kanban-card--drop-nest');
      if (!e.dataTransfer) return;
      if (!e.dataTransfer.types.includes('application/x-kanban-entry')) return;
      const draggedPath = e.dataTransfer.getData('application/x-kanban-entry');
      if (!draggedPath || draggedPath === entry.file.path) return;
      if (!this.isCardSubitemDropZone(cardEl, e)) {
        cardEl.closest('.tps-kanban-cards')?.removeClass('tps-kanban-drop-target');
        cardEl.closest('.tps-kanban-lane')?.removeClass('tps-kanban-lane--card-drop-target');
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const draggedFile = this.app.vault.getFileByPath(draggedPath);
      if (!draggedFile) {
        flowWarn('CardNest', 'blocked', {
          reason: 'missing-dragged-file',
          draggedPath,
          targetPath: entry.file.path,
        });
        return;
      }

      // Circular-parent guard: disallow if target is already a descendant of dragged
      if (this.isDescendantOf(entry.file.path, draggedPath)) {
        flowWarn('CardNest', 'blocked', {
          reason: 'circular-parent',
          draggedPath,
          targetPath: entry.file.path,
        });
        return;
      }

      // Determine the parent key to write (prefer GCM-configured, else 'parent')
      const parentKeys = this.getParentLinkKeys();
      const parentKey = parentKeys[0] ?? 'parent';

      const existingParentPath = this.resolveParentPath(draggedFile);
      flow('CardNest', 'drop:start', {
        draggedPath,
        targetPath: entry.file.path,
        parentKey,
        existingParentPath,
      });

      if (existingParentPath === entry.file.path) {
        // Already a child of this card — toggle off (remove parent link)
        await this.app.fileManager.processFrontMatter(draggedFile, (fm) => {
          const actualKey = this.findFrontmatterKeyCaseInsensitive(fm, parentKey);
          if (actualKey) delete fm[actualKey];
        });
      } else {
        // Generate the correct link format for this vault (respects shortest-path vs full-path settings)
        const linktext = this.app.metadataCache.fileToLinktext(entry.file, draggedFile.path, true);
        const linkValue = `[[${linktext}]]`;
        // Set as subitem of this card
        await this.app.fileManager.processFrontMatter(draggedFile, (fm) => {
          fm[parentKey] = linkValue;
        });
        await this.ensureParentSelfLink(entry.file);
        // Auto-expand the target so the new child is immediately visible
        this.expandedSubtreePaths.add(entry.file.path);
      }
      flow('CardNest', 'drop:done', {
        draggedPath,
        targetPath: entry.file.path,
        action: existingParentPath === entry.file.path ? 'remove-parent' : 'set-parent',
      });
      this.render();
    });

    return cardEl;
  }

  private shouldUseWideListCardLayout(): boolean {
    if (this.getLayoutMode() !== 'list') return false;
    const width = this.containerEl?.clientWidth || window.innerWidth || 0;
    return width >= 700;
  }

  private createTaskLaneCard(item: TaskRenderItem, propName: string | null, displayLane: DisplayLaneGroup): HTMLElement {
    const { file, task } = item;
    const taskTitle = this.getTaskVisibleTitle(task);
    const cardEl = document.createElement('div');
    cardEl.className = 'tps-kanban-card tps-kanban-task-card';
    cardEl.classList.toggle('tps-kanban-task-card--completed', this.isDoneTask(task));
    cardEl.draggable = false;
    cardEl.title = `${file.path}:${task.line}`;
    cardEl.dataset.path = file.path;
    cardEl.dataset.taskPath = file.path;
    cardEl.dataset.taskLine = String(task.line);
    cardEl.dataset.tpsGcmContext = 'kanban-task';
    cardEl.dataset.tpsKanbanPath = file.path;
    cardEl.dataset.tpsKanbanLine = String(task.line);
    cardEl.dataset.tpsKanbanCheckboxState = task.itemKind === 'bullet' ? '' : task.checkboxState || '[ ]';
    cardEl.dataset.tpsKanbanTaskText = task.text;
    const taskStyleRule = this.resolveTaskCardStyleRule(file, task, propName);
    this.addTextStyleClasses(cardEl, taskStyleRule?.textStyle);
    const taskRuleColor = this.normalizeCssColorValue(taskStyleRule?.color || '');
    if (taskRuleColor) {
      cardEl.style.setProperty('--tps-card-color', taskRuleColor);
      cardEl.classList.add('tps-kanban-card--colored');
    }

    const inner = cardEl.createDiv({ cls: 'tps-kanban-card-inner' });
    cardEl.addEventListener('pointerdown', (e: PointerEvent) => {
      this.beginTaskPointerDrag(e, file, task, propName, displayLane, cardEl);
    });
    const buildRootTaskPayload = () => JSON.stringify({
      type: 'task-line',
      source: 'tps-kanban',
      itemKind: task.itemKind || 'task',
      path: file.path,
      line: task.line,
      rawLine: '',
      checkboxState: task.itemKind === 'bullet' ? undefined : task.checkboxState || '[ ]',
      text: taskTitle,
      sourceLaneValues: this.getDisplayLaneWritableValues(displayLane),
    });
    const handleRootTaskDragStart = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, button, textarea, select')) return;
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      const payload = buildRootTaskPayload();
      e.dataTransfer.setData(KANBAN_TASK_MIME, payload);
      e.dataTransfer.setData(TPS_TASK_LINE_MIME, payload);
      e.dataTransfer.setData('text/plain', `${file.path}:${task.line}`);
      cardEl.addClass('tps-kanban-card-task--dragging');
    };
    cardEl.addEventListener('dragstart', handleRootTaskDragStart);
    cardEl.addEventListener('dragend', () => {
      cardEl.removeClass('tps-kanban-card-task--dragging');
    });

    cardEl.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
        const handled = this.openTaskLineContextMenu(e, file.path, task.line);
        if (handled) return;

        if (!this.selectedPaths.has(file.path) && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
          this.selectOnly(file.path);
        } else if (e.shiftKey) {
          this.selectRange(file.path);
        } else if (e.metaKey || e.ctrlKey) {
          this.toggleSelect(file.path);
        }

        const selectedFiles = this.getSelectedFiles();
        const menu = new Menu();

        if (selectedFiles.length > 1) {
          this.app.workspace.trigger('files-menu', menu as any, selectedFiles as any);
        } else {
          const target = selectedFiles[0] ?? file;
          this.app.workspace.trigger('file-menu', menu as any, target as any);
        }

        menu.addSeparator();
        menu.addItem(it => it
          .setTitle('Open task')
          .setIcon('list')
          .onClick(() => {
            void this.openTaskLine(file, task.line);
          }));

        menu.showAtPosition({ x: e.clientX, y: e.clientY });
      });

    const titleRow = inner.createDiv({ cls: 'tps-kanban-card-title-row' });
    const dragHandle = titleRow.createSpan({
      cls: 'tps-kanban-task-card-drag-handle',
      attr: {
        role: 'button',
        tabindex: '0',
        draggable: 'true',
        'aria-label': `Drag ${task.itemKind === 'bullet' ? 'bullet' : 'task'}: ${taskTitle}`,
        title: task.itemKind === 'bullet' ? 'Drag bullet' : 'Drag task',
      },
    });
    setIconWithFallback(dragHandle, 'grip-vertical');
    dragHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      this.beginTaskPointerDrag(e, file, task, propName, displayLane, cardEl);
    });
    dragHandle.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    });
    if (task.itemKind === 'bullet') {
      const iconEl = titleRow.createDiv({ cls: 'tps-kanban-card-icon' });
      setIconWithFallback(iconEl, 'list');
    } else {
      const checkboxEl = titleRow.createEl('input', {
        cls: 'tps-kanban-card-task-checkbox tps-kanban-task-card-checkbox',
        attr: {
          type: 'checkbox',
          role: 'checkbox',
          'aria-label': `Toggle task: ${taskTitle}`,
          'data-checkbox-state': task.checkboxState || '[ ]',
          'data-checkbox-marker': this.getCheckboxMarker(task.checkboxState || '[ ]'),
        },
      });
      checkboxEl.checked = this.getDoneStatuses().has(this.getStatusForCheckboxState(task.checkboxState || '[ ]'));
      checkboxEl.draggable = false;
      checkboxEl.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
      });
      checkboxEl.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
      });
      checkboxEl.addEventListener('change', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        void this.updateTaskCheckboxState(file, task.line, this.getToggleCheckboxStateForTask(task));
      });
    }
    const titleEl = titleRow.createEl('span', {
      text: taskTitle,
      cls: 'tps-kanban-card-title tps-kanban-task-card-title',
      attr: { role: 'button', tabindex: '0', 'aria-label': `Open task in ${file.basename}` },
    });
    titleEl.addEventListener('click', (e: MouseEvent) => {
      if (Date.now() < this.suppressTaskCardClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (this.openTaskQuickEditor(e, cardEl, titleEl)) return;
      e.preventDefault();
      e.stopPropagation();
      void this.openTaskLine(file, task.line);
    });
    titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (this.openTaskQuickEditor(e, cardEl, titleEl)) return;
      e.preventDefault();
      e.stopPropagation();
      void this.openTaskLine(file, task.line);
    });

    const metaRow = inner.createDiv({ cls: 'tps-kanban-card-meta-row tps-kanban-task-card-meta' });
    for (const property of this.getTaskCardMetaProperties(file, task, propName)) {
      metaRow.createSpan({
        cls: `tps-kanban-card-property${property.kind ? ` tps-kanban-card-property--${property.kind}` : ''}`,
        text: property.text,
        attr: { title: property.title || property.text },
      });
    }

    dragHandle.addEventListener('dragstart', handleRootTaskDragStart);
    cardEl.addEventListener('pointermove', (e: PointerEvent) => {
      this.handleTaskPointerMove(e);
    });
    cardEl.addEventListener('pointerup', (e: PointerEvent) => {
      void this.handleTaskPointerUp(e);
    });
    cardEl.addEventListener('pointercancel', (e: PointerEvent) => {
      this.cancelTaskPointerDrag(e);
    });

    cardEl.addEventListener('dragover', (e: DragEvent) => {
      if (!this.hasTaskDropData(e.dataTransfer || null)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      cardEl.addClass('tps-kanban-card--drop-nest');
    });
    cardEl.addEventListener('dragleave', () => {
      cardEl.removeClass('tps-kanban-card--drop-nest');
    });
    cardEl.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cardEl.removeClass('tps-kanban-card--drop-nest');
      if (!e.dataTransfer || !propName) return;
      const parsed = this.parseTaskDropPayload(e.dataTransfer);
      if (!parsed) return;
      const taskFile = parsed?.path ? this.app.vault.getFileByPath(parsed.path) : null;
      if (!taskFile || !parsed.line) return;
      const targetSelection = await this.resolveDropValueForDisplayLane(displayLane);
      if (!targetSelection.selected) return;
      await this.confirmAndApplyInlineTaskDrop(
        taskFile,
        parsed.line,
        propName,
        targetSelection.value,
        Array.isArray(parsed.sourceLaneValues) ? parsed.sourceLaneValues : [],
      );
      this.render();
    });

    return cardEl;
  }

  private getTaskCardMetaProperties(file: TFile, task: OpenTaskSubitem, groupPropName: string | null): TaskPropertyDisplay[] {
    const selectedPropIds = this.getCardPropertyIds(groupPropName);
    const hidden = new Set(['tpsinlineprops', 'externalid', 'externaleventid', 'tpscalendaruid', 'tpscalendarsourceurl']);
    const props: TaskPropertyDisplay[] = [];
    const seen = new Set<string>();

    for (const propId of selectedPropIds) {
      const property = this.getTaskPropertyValue(file, task, propId, hidden);
      if (!property) continue;
      const id = `${property.kind || ''}:${property.text.toLowerCase()}`;
      if (seen.has(id)) continue;
      props.push(property);
      seen.add(id);
      if (props.length >= 4) break;
    }

    return props;
  }

  private getTaskPropertyValue(file: TFile, task: OpenTaskSubitem, propId: string, hidden: Set<string>): TaskPropertyDisplay | null {
    const normalized = this.normalizeTaskPropertyId(propId);
    if (!normalized || hidden.has(normalized)) return null;

    if (normalized === 'status') {
      const status = task.itemKind === 'bullet' ? 'bullet' : this.getStatusForCheckboxState(task.checkboxState || '[ ]') || 'todo';
      return status ? {
        text: status,
        kind: 'status',
        editable: task.itemKind !== 'bullet',
        propName: this.getTaskInlinePropertyName(propId) || 'status',
        rawValue: status,
      } : null;
    }

    if (normalized === 'kind' || normalized === 'itemkind' || normalized === 'itemtype') {
      const kind = task.itemKind === 'bullet' ? 'bullet' : 'task';
      return { text: kind, kind: 'kind', editable: false };
    }

    if (normalized === 'path' || normalized === 'file' || normalized === 'source') {
      return { text: file.basename, title: file.path, kind: 'source', editable: false };
    }

    if (normalized === 'line') {
      return { text: String(task.line + 1), title: `${file.path}:${task.line + 1}`, kind: 'line', editable: false };
    }

    for (const field of task.inlineFields ?? []) {
      const key = this.normalizeInlinePropertyKey(field.key);
      if (!key || key !== normalized || hidden.has(key)) continue;
      const value = String(field.value || '').trim();
      if (!value) return null;
      const text = this.formatTaskCardField(field.key, value);
      if (!text) return null;
      return {
        text,
        title: key === 'tag' || key === 'tags' ? value : `${field.key}: ${value}`,
        kind: key === 'tag' || key === 'tags' ? 'tag' : key,
        editable: true,
        propName: field.key,
        rawValue: value,
      };
    }

    return null;
  }

  private normalizeTaskPropertyId(propId: string): string {
    const raw = String(propId || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (lower === 'file.name' || lower === 'file.basename' || lower === 'file.fullname' || lower === 'file.link') return 'path';
    if (lower === 'title' || lower === 'task.title') return 'title';
    const frontmatterProp = this.getFrontmatterPropNameFromId(raw);
    const withoutPrefix = lower.startsWith('task.') ? raw.slice(5) : frontmatterProp ?? raw;
    const normalized = this.normalizeInlinePropertyKey(withoutPrefix);
    if (normalized === 'filename' || normalized === 'basename' || normalized === 'fullname') return 'path';
    return normalized;
  }

  private formatTaskCardField(key: string, value: string): string {
    const normalized = this.normalizeInlinePropertyKey(key);
    if (normalized === 'tag' || normalized === 'tags') return value.replace(/^#/, '');
    if (this.isDateLikeProperty(normalized)) {
      const dateTime = this.formatCardPropertyValue(value);
      if (dateTime && dateTime !== value) return dateTime;
      const timeMatch = value.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/u);
      if (timeMatch) {
        const hour = Number(timeMatch[1]);
        const minute = timeMatch[2];
        if (Number.isFinite(hour)) {
          const suffix = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return `${displayHour}:${minute} ${suffix}`;
        }
      }
      return dateTime || value;
    }
    if (this.isDurationLikeProperty(normalized)) return this.formatDurationLikeValue(value);
    const text = this.formatCardPropertyValue(value);
    return text.length > 34 ? `${text.slice(0, 31)}...` : text;
  }

  private isDateLikeProperty(normalizedKey: string): boolean {
    return normalizedKey === 'scheduled'
      || normalizedKey === 'due'
      || normalizedKey === 'start'
      || normalizedKey === 'end'
      || normalizedKey === 'date'
      || normalizedKey === 'created'
      || normalizedKey === 'modified'
      || normalizedKey === 'ctime'
      || normalizedKey === 'mtime'
      || normalizedKey.endsWith('date')
      || normalizedKey.endsWith('time')
      || normalizedKey.endsWith('at');
  }

  private isDurationLikeProperty(normalizedKey: string): boolean {
    return normalizedKey === 'timeestimate'
      || normalizedKey === 'estimate'
      || normalizedKey === 'duration'
      || normalizedKey.endsWith('duration');
  }

  private formatDurationLikeValue(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/[a-z]/i.test(raw)) return raw;
    return `${raw}m`;
  }

  private getCheckboxMarker(rawState: string): string {
    const state = this.normalizeCheckboxState(rawState);
    return state.slice(1, -1);
  }

  private async createSubitemForEntry(
    parentEntry: BasesEntry,
    propName: string | null,
    displayLane: DisplayLaneGroup,
  ): Promise<void> {
    const targetSelection = propName
      ? await this.resolveDropValueForDisplayLane(displayLane)
      : { selected: true, value: null as string | null };
    if (!targetSelection.selected) {
      flow('CreateSubitem', 'cancelled-target', { parentPath: parentEntry.file.path, lane: displayLane.label });
      return;
    }

    const parentKey = this.getParentLinkKeys()[0] ?? 'parent';
    const parentLinkValue = this.getFullPathWikilink(parentEntry.file);
    const targetValue = targetSelection.value;

    flow('CreateSubitem', 'submit', {
      parentPath: parentEntry.file.path,
      parentKey,
      propName: propName || '',
      lane: displayLane.label,
      targetValue,
    });
    await this.createFileForView(undefined, (fm: Record<string, unknown>) => {
      if (propName) {
        if (targetValue == null) {
          delete fm[propName];
        } else {
          fm[propName] = targetValue;
        }
      }
      fm[parentKey] = parentLinkValue;
    });

    await this.ensureParentSelfLink(parentEntry.file);
    this.expandedSubtreePaths.add(parentEntry.file.path);
    this.queuePostCreateRefresh();
  }

  private async createTaskForEntry(
    file: TFile,
    propName: string | null = null,
    displayLane: DisplayLaneGroup | null = null,
    taskFilter = this.getTaskRootFilterFromBaseFilters(),
  ): Promise<void> {
    const targetSelection = propName && displayLane
      ? await this.resolveDropValueForDisplayLane(displayLane)
      : { selected: true, value: null as string | null };
    if (!targetSelection.selected) {
      flow('CreateTask', 'cancelled-target', { path: file.path, lane: displayLane?.label || '' });
      return;
    }

    const title = await new Promise<string | null>((resolve) => {
      new TaskTitleModal(this.app, file.basename, resolve).open();
    });
    if (!title) {
      flow('CreateTask', 'cancelled-title', { path: file.path });
      return;
    }

    const defaults = this.getRootTaskCreationDefaults(taskFilter);
    const taskLine = this.buildRootTaskLine(title, propName, targetSelection.value, taskFilter, defaults);
    flow('CreateTask', 'write', {
      path: file.path,
      propName: propName || '',
      lane: displayLane?.label || '',
      targetValue: targetSelection.value,
      status: defaults.status || '',
      tags: Array.from(defaults.tags || []),
      inlineKeys: Array.from(defaults.inlineFields?.keys?.() || []),
    });
    await this.app.vault.process(file, (content) => {
      const trimmedEnd = content.replace(/\s+$/g, '');
      return trimmedEnd ? `${trimmedEnd}\n${taskLine}\n` : `${taskLine}\n`;
    });

    this.clearTaskCachesForPath(file.path);
    this.expandedSubtreePaths.delete(file.path);
    this.queuePostCreateRefresh();
  }

  private async createRootTaskForLane(
    propName: string | null,
    displayLane: DisplayLaneGroup,
    taskFilter = this.getTaskRootFilterFromBaseFilters(),
  ): Promise<void> {
    const targetSelection = propName
      ? await this.resolveDropValueForDisplayLane(displayLane)
      : { selected: true, value: null as string | null };
    if (!targetSelection.selected) {
      flow('CreateRootTask', 'cancelled-target', { lane: displayLane.label });
      return;
    }

    const title = await new Promise<string | null>((resolve) => {
      new TaskTitleModal(this.app, 'task board', resolve).open();
    });
    if (!title) {
      flow('CreateRootTask', 'cancelled-title', { lane: displayLane.label });
      return;
    }

    const defaults = this.getRootTaskCreationDefaults(taskFilter);
    const targetFile = await this.resolveRootTaskTargetFile(defaults);
    if (!targetFile) {
      flowWarn('CreateRootTask', 'missing-target', {
        lane: displayLane.label,
        defaultTargetPath: defaults.targetPath || '',
        configuredDefaultRootTaskPath: this.plugin.settings?.defaultRootTaskPath || '',
      });
      new Notice('Could not resolve a note to write the task into.');
      return;
    }

    const taskLine = this.buildRootTaskLine(title, propName, targetSelection.value, taskFilter, defaults);
    flow('CreateRootTask', 'write', {
      path: targetFile.path,
      lane: displayLane.label,
      propName: propName || '',
      targetValue: targetSelection.value,
      status: defaults.status || '',
      tags: Array.from(defaults.tags || []),
      inlineKeys: Array.from(defaults.inlineFields?.keys?.() || []),
      openAfterCreate: this.plugin.settings.openTaskDestinationAfterCreate !== false,
    });
    await this.app.vault.process(targetFile, (content) => this.insertLineAfterFrontmatter(content, taskLine));

    this.clearTaskCachesForPath(targetFile.path);
    emitFilesUpdated(this.app, [targetFile.path], 'tps-kanban');
    this.queuePostCreateRefresh();
    if (this.plugin.settings.openTaskDestinationAfterCreate !== false) {
      await this.openOrFocusFile(targetFile);
    }
  }

  private buildRootTaskLine(
    title: string,
    propName: string | null,
    laneValue: string | null,
    taskFilter: KanbanTaskRootFilter,
    defaults = this.getRootTaskCreationDefaults(taskFilter),
  ): string {
    return buildKanbanRootTaskLine({
      title,
      propName,
      laneValue,
      defaults,
      getCheckboxStateForStatus: (status) => this.getCheckboxStateForStatus(status),
      isStatusPropertyName: (name) => this.isStatusPropertyName(name),
    });
  }

  private getRootTaskCreationDefaults(taskFilter: KanbanTaskRootFilter): TaskCreationDefaults {
    const fallback: TaskCreationDefaults = {
      mode: taskFilter.mode,
      includeDone: taskFilter.includeDone,
      status: taskFilter.statuses.size === 1 ? Array.from(taskFilter.statuses)[0] ?? null : null,
      inlineFields: new Map(),
      tags: new Set(Array.from(taskFilter.tags).filter((tag) => !taskFilter.excludeTags.has(tag))),
      excludedStatuses: new Set(taskFilter.excludeStatuses),
      excludedTags: new Set(taskFilter.excludeTags),
    };

    let structured: TaskCreationDefaults | null = null;
    for (const root of this.getBaseFilterRoots()) {
      const defaults = this.inferTaskCreationDefaultsFromFilterNode(root);
      if (!defaults) continue;
      structured = this.mergeTaskCreationDefaults(fallback, defaults);
      if (structured) {
        break;
      }
    }

    return structured ?? fallback;
  }

  private inferTaskCreationDefaultsFromFilterNode(node: unknown): TaskCreationDefaults | null {
    if (!node) return null;
    if (typeof node === 'string') return this.inferTaskCreationDefaultsFromString(node);
    if (Array.isArray(node)) return this.inferTaskCreationDefaultsFromAnd(node);
    if (typeof node !== 'object') return null;

    const record = node as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, 'and')) {
      return this.inferTaskCreationDefaultsFromAnd(this.asArray(record.and));
    }
    if (Object.prototype.hasOwnProperty.call(record, 'or')) {
      for (const child of this.asArray(record.or)) {
        const defaults = this.inferTaskCreationDefaultsFromFilterNode(child);
        if (defaults && defaults.mode !== 'notes') return defaults;
      }
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'any')) {
      for (const child of this.asArray(record.any)) {
        const defaults = this.inferTaskCreationDefaultsFromFilterNode(child);
        if (defaults && defaults.mode !== 'notes') return defaults;
      }
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'not')) {
      const negated = this.inferTaskCreationDefaultsFromFilterNode(record.not);
      if (!negated) return null;
      return {
        tags: new Set(),
        inlineFields: new Map(),
        excludedTags: new Set(negated.tags),
        excludedStatuses: new Set(negated.status ? [negated.status] : []),
      };
    }

    return this.inferTaskCreationDefaultsFromObject(record);
  }

  private inferTaskCreationDefaultsFromAnd(nodes: unknown[]): TaskCreationDefaults | null {
    let merged: TaskCreationDefaults | null = null;
    for (const child of nodes) {
      const childDefaults = this.inferTaskCreationDefaultsFromFilterNode(child);
      if (!childDefaults) continue;
      merged = this.mergeTaskCreationDefaults(merged, childDefaults);
      if (!merged) return null;
    }
    return merged;
  }

  private mergeTaskCreationDefaults(left: TaskCreationDefaults | null, right: TaskCreationDefaults): TaskCreationDefaults | null {
    if (!left) return {
      mode: right.mode,
      includeDone: right.includeDone,
      status: right.status,
      targetPath: right.targetPath,
      inlineFields: new Map(right.inlineFields),
      tags: new Set(right.tags),
      excludedStatuses: new Set(right.excludedStatuses),
      excludedTags: new Set(right.excludedTags),
    };

    const status = right.status ?? left.status ?? null;
    if (left.status && right.status && left.status !== right.status) return null;
    const targetPath = right.targetPath ?? left.targetPath ?? null;
    if (left.targetPath && right.targetPath && this.normalizeTaskTargetPath(left.targetPath) !== this.normalizeTaskTargetPath(right.targetPath)) return null;

    const inlineFields = new Map(left.inlineFields);
    for (const [normalizedKey, field] of right.inlineFields) {
      const previous = inlineFields.get(normalizedKey);
      if (previous && previous.value.toLowerCase() !== field.value.toLowerCase()) return null;
      inlineFields.set(normalizedKey, field);
    }
    const tags = new Set([...left.tags, ...right.tags]);
    const excludedTags = new Set([...left.excludedTags, ...right.excludedTags]);
    const excludedStatuses = new Set([...left.excludedStatuses, ...right.excludedStatuses]);
    for (const tag of tags) if (excludedTags.has(tag)) return null;
    if (status && excludedStatuses.has(status)) return null;

    return {
      mode: right.mode ?? left.mode,
      includeDone: right.includeDone ?? left.includeDone,
      status,
      targetPath,
      inlineFields,
      tags,
      excludedStatuses,
      excludedTags,
    };
  }

  private inferTaskCreationDefaultsFromString(rawExpr: string): TaskCreationDefaults | null {
    const raw = String(rawExpr || '').trim();
    if (parseBareSemanticKindExpression(raw)) {
      return { mode: 'notes', inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }
    const isNegated = raw.startsWith('!');
    const expr = (isNegated ? raw.slice(1) : raw).trim();
    const defaults = this.inferPositiveTaskCreationDefaultsFromString(expr);
    if (!defaults || !isNegated) return defaults;
    return {
      inlineFields: new Map(),
      tags: new Set(),
      excludedTags: new Set(defaults.tags),
      excludedStatuses: new Set(defaults.status ? [defaults.status] : []),
    };
  }

  private inferPositiveTaskCreationDefaultsFromString(expr: string): TaskCreationDefaults | null {
    const kindMatch = expr.match(/^(?:(?:tps|kanban)\.)?(?:itemtype|itemkind|kind)\s*(?:==|=)\s*["']?(task|tasks|note|notes|all|mixed)["']?$/i);
    if (kindMatch?.[1]) {
      const value = kindMatch[1].toLowerCase();
      return { mode: value.startsWith('task') ? 'tasks' : value.startsWith('note') ? 'notes' : 'mixed', inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }
    if (/^(?:task\.)?(?:open|isopen)\s*(?:==|=)\s*(true|1)$/i.test(expr) || /^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(false|0)$/i.test(expr)) {
      return { includeDone: false, inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }
    if (/^(?:task\.)?(?:done|isdone|completed|complete)\s*(?:==|=)\s*(true|1)$/i.test(expr)) {
      return { includeDone: true, status: 'complete', inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }
    return this.inferTaskValueCreationDefaultsFromString(expr, 'status')
      ?? this.inferTaskValueCreationDefaultsFromString(expr, 'tags')
      ?? this.inferTaskPathCreationDefaultsFromString(expr)
      ?? this.inferTaskInlineFieldCreationDefaultsFromString(expr);
  }

  private inferTaskPathCreationDefaultsFromString(expr: string): TaskCreationDefaults | null {
    const pathMatch = expr.match(/^(?:task\.)?(?:path|file|file\.path)\s*(?:==|=|is|equals?)\s*(?:"([^"]+)"|'([^']+)'|([^\s].*?))$/i);
    const resolved = pathMatch ? this.resolveBaseContextToken(pathMatch[1] || pathMatch[2] || pathMatch[3]) : null;
    const targetPath = this.normalizeTaskTargetPath(resolved || '');
    if (!targetPath) return null;
    return { targetPath, inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
  }

  private inferTaskValueCreationDefaultsFromString(expr: string, propName: 'status' | 'tags'): TaskCreationDefaults | null {
    const propPattern = `(?:task\\.)?${propName === 'tags' ? '(?:tags|tag)' : 'status'}`;
    const tokenDefaults = (token: string, excluded = false): TaskCreationDefaults => {
      const normalized = propName === 'tags' ? this.normalizeTaskTag(token) : String(token || '').trim().toLowerCase();
      return {
        status: propName === 'status' && !excluded ? normalized : null,
        inlineFields: new Map(),
        tags: new Set(propName === 'tags' && !excluded ? [normalized] : []),
        excludedStatuses: new Set(propName === 'status' && excluded ? [normalized] : []),
        excludedTags: new Set(propName === 'tags' && excluded ? [normalized] : []),
      };
    };
    const callMatch = expr.match(new RegExp(`^${propPattern}\\.(?:containsAny|contains|equals)\\((.*)\\)$`, 'i'));
    if (callMatch) {
      const token = this.extractQuotedStrings(callMatch[1] || '')[0];
      return token ? tokenDefaults(token) : null;
    }
    const comparisonMatch = expr.match(new RegExp(`^${propPattern}\\s*(==|=|!=|!==)\\s*["']([^"']+)["']$`, 'i'));
    if (comparisonMatch?.[2]) return tokenDefaults(comparisonMatch[2], String(comparisonMatch[1] || '').startsWith('!'));
    return null;
  }

  private inferTaskInlineFieldCreationDefaultsFromString(expr: string): TaskCreationDefaults | null {
    const match = expr.match(/^(?:task\.)?([A-Za-z][\w -]{0,40})\s*(==|=|is|equals?)\s*(?:"([^"]+)"|'([^']+)'|([^\s].*?))$/i);
    const rawKey = String(match?.[1] || '').trim();
    const value = String(this.resolveBaseContextToken(match?.[3] || match?.[4] || match?.[5]) || '').trim();
    if (!rawKey || !value || this.isReservedTaskDefaultKey(rawKey)) return null;
    return {
      inlineFields: new Map([[this.normalizeInlinePropertyKey(rawKey), { key: rawKey, value }]]),
      tags: new Set(),
      excludedStatuses: new Set(),
      excludedTags: new Set(),
    };
  }

  private inferTaskCreationDefaultsFromObject(node: Record<string, unknown>): TaskCreationDefaults | null {
    const propRaw = String(node.property ?? node.field ?? '').trim();
    if (!propRaw) return null;
    const normalizedProp = this.normalizeInlinePropertyKey(propRaw.replace(/^task\./i, '').replace(/^tps\./i, ''));
    const operator = String(node.operator ?? node.op ?? '').trim().toLowerCase();
    const values = this.asArray(node.values ?? node.value).map((value) => String(value || '').trim()).filter(Boolean);
    if (!values.length) return null;
    const excluded = operator.startsWith('!') || operator.includes('not') || operator === '!=' || operator === '!==';

    if (isBareSemanticKindFilter(propRaw, values)) {
      return { mode: 'notes', inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }

    if (['itemtype', 'itemkind', 'kind'].includes(normalizedProp)) {
      const value = values[0].toLowerCase();
      return { mode: value.startsWith('task') ? 'tasks' : value.startsWith('note') ? 'notes' : 'mixed', inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() };
    }
    if (['open', 'isopen'].includes(normalizedProp)) {
      return values.some((value) => value.toLowerCase() === 'true' || value === '1')
        ? { includeDone: false, inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() }
        : null;
    }
    if (['status', 'checkboxstatus'].includes(normalizedProp)) {
      const value = values[0].toLowerCase();
      return { status: excluded ? null : value, inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(excluded ? [value] : []), excludedTags: new Set() };
    }
    if (['tag', 'tags'].includes(normalizedProp)) {
      const value = this.normalizeTaskTag(values[0]);
      return { inlineFields: new Map(), tags: new Set(excluded ? [] : [value]), excludedStatuses: new Set(), excludedTags: new Set(excluded ? [value] : []) };
    }
    if (['path', 'file', 'filepath'].includes(normalizedProp) || propRaw.toLowerCase() === 'task.path' || propRaw.toLowerCase() === 'task.file.path') {
      const value = this.normalizeTaskTargetPath(this.resolveBaseContextToken(values[0]) || '');
      return value && !excluded ? { targetPath: value, inlineFields: new Map(), tags: new Set(), excludedStatuses: new Set(), excludedTags: new Set() } : null;
    }
    if (!excluded && !propRaw.toLowerCase().startsWith('note.') && !propRaw.toLowerCase().startsWith('file.') && !this.isReservedTaskDefaultKey(normalizedProp)) {
      return {
        inlineFields: new Map([[normalizedProp, { key: propRaw.replace(/^task\./i, '').replace(/^tps\./i, ''), value: values[0] }]]),
        tags: new Set(),
        excludedStatuses: new Set(),
        excludedTags: new Set(),
      };
    }
    return null;
  }

  private isReservedTaskDefaultKey(key: string): boolean {
    const normalized = this.normalizeInlinePropertyKey(key.replace(/^(?:task|tps|kanban)\./i, ''));
    return ['itemtype', 'itemkind', 'kind', 'status', 'checkboxstatus', 'tag', 'tags', 'open', 'isopen', 'done', 'isdone', 'completed', 'complete', 'path', 'file', 'filepath', 'fileextension', 'fileext'].includes(normalized);
  }

  private asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    return value == null ? [] : [value];
  }

  private insertLineAfterFrontmatter(content: string, line: string): string {
    const normalizedLine = String(line || '').trim();
    if (!normalizedLine) return content;
    const normalizedContent = String(content || '').replace(/\s+$/g, '');
    return normalizedContent ? `${normalizedContent}\n${normalizedLine}\n` : `${normalizedLine}\n`;
  }

  private async resolveRootTaskTargetFile(defaults = this.getRootTaskCreationDefaults(this.getTaskRootFilterFromBaseFilters())): Promise<TFile | null> {
    const targetPath = resolveKanbanRootTaskTargetPath(defaults.targetPath, this.plugin.settings?.defaultRootTaskPath || '');
    if (targetPath) {
      const existing = this.app.vault.getFileByPath(targetPath);
      if (existing instanceof TFile) {
        flow('CreateRootTaskTarget', 'resolved-existing', { path: targetPath });
        return existing;
      }
      const folderPath = targetPath.includes('/') ? targetPath.slice(0, targetPath.lastIndexOf('/')) : '';
      if (folderPath) await this.ensureFolderPath(folderPath);
      const basename = targetPath.split('/').pop()?.replace(/\.md$/i, '') || 'Tasks';
      flow('CreateRootTaskTarget', 'create-file', { path: targetPath, folderPath });
      return await this.app.vault.create(targetPath, `---\ntitle: ${basename}\n---\n`);
    }

    flowWarn('CreateRootTaskTarget', 'unresolved', {
      defaultTargetPath: defaults.targetPath || '',
      configuredDefaultRootTaskPath: this.plugin.settings?.defaultRootTaskPath || '',
    });
    return null;
  }

  private normalizeTaskTargetPath(value: unknown): string | null {
    return normalizeKanbanTaskTargetPath(value);
  }

  private normalizeNoteTargetPath(value: unknown): string | null {
    const raw = String(value || '').trim()
      .replace(/^\[\[|\]\]$/g, '')
      .replace(/^\"+|\"+$/g, '')
      .replace(/^'+|'+$/g, '');
    if (!raw) return null;
    const normalized = normalizePath(raw).replace(/^\/+/, '');
    if (!normalized || normalized.endsWith('/')) return null;
    return normalized.toLowerCase().endsWith('.md') ? normalized : `${normalized}.md`;
  }

  private normalizeNoteTargetFolder(value: unknown): string | null {
    const raw = String(value || '').trim()
      .replace(/^\"+|\"+$/g, '')
      .replace(/^'+|'+$/g, '');
    if (!raw) return null;
    const normalized = normalizePath(raw).replace(/^\/+|\/+$/g, '');
    if (!normalized || normalized.toLowerCase().endsWith('.md')) return null;
    return normalized;
  }

  private async ensureFolderPath(folderPath: string): Promise<void> {
    const parts = normalizePath(folderPath).split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private getFullPathWikilink(file: TFile): string {
    const linkPath = file.path.replace(/\.md$/i, '');
    return `[[${linkPath}]]`;
  }

  private normalizeCssColorValue(rawValue: string): string {
    const value = String(rawValue || '').trim();
    if (!value || /[<>{}\n\r;]/.test(value)) return '';
    const bareHex = value.match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (bareHex) return `#${bareHex[1]}`;
    if (value.startsWith('var(')) return value;
    try {
      if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', value)) {
        return value;
      }
    } catch {
      // Fall through.
    }
    return '';
  }

  private render(preserveScroll = true): void {
    this.renderGeneration += 1;
    if (!this.shouldRenderView()) return;
    const scrollState = preserveScroll ? this.captureRenderScrollState() : null;
    this.applyLayoutSettings();
    this.ensureContainer();
    this.containerEl.empty();

    const propName = this.getGroupByPropName();
    const propId = this.getGroupByPropId(propName);
    const listGrouping = this.isLikelyListGroupingProperty(propName, propId);
    const sourceGroups = this.getSourceGroupsForRender(propId, listGrouping);
    void this.renderAsync(sourceGroups, propName, scrollState);
  }

  private async renderAsync(
    sourceGroups: BasesEntryGroup[],
    propName: string | null,
    scrollState: KanbanRenderScrollState | null = null,
  ): Promise<void> {
    this.activeNotePath = this.getActiveMarkdownPath();
    const allGroups = this.mergeGroupsByLaneId(sourceGroups);

    // Separate keyed groups from the ungrouped lane, then reorder per settings
    const keyed = allGroups.filter((g) => this.getLaneId(g) !== 'ungrouped');
    const ungrouped = allGroups.filter((g) => this.getLaneId(g) === 'ungrouped');
    const forced = this.getForcedLanesFromFilters(propName);

    const keyedWithForced: BasesEntryGroup[] = [...keyed];
    const existingKeys = new Set(keyed.map((g) => String(g.key).trim().toLowerCase()));
    for (const forcedKey of forced.keys) {
      const normalized = forcedKey.trim().toLowerCase();
      if (!normalized || existingKeys.has(normalized)) continue;
      keyedWithForced.push(this.createSyntheticGroup(forcedKey));
      existingKeys.add(normalized);
    }

    const ungroupedWithForced = [...ungrouped];
    if (forced.includeUngrouped && ungroupedWithForced.length === 0) {
      ungroupedWithForced.push(this.createSyntheticGroup(null));
    }

    const ungroupedPos = this.plugin.settings.ungroupedPosition;
    let mergedGroups = ungroupedPos === 'first'
      ? [...ungroupedWithForced, ...keyedWithForced]
      : [...keyedWithForced, ...ungroupedWithForced];
    mergedGroups = this.includeSavedLaneGroups(mergedGroups);
    if (mergedGroups.length === 0) {
      mergedGroups = [this.createSyntheticGroup(null)];
    }
    let groups = this.applyManualLaneOrder(mergedGroups);
    const taskFilter = this.getTaskRootFilterFromBaseFilters();
    let parentByChild = this.buildParentByChild(groups);
    let laneRenderItemsByLane = !this.shouldRenderNoteEntriesForGroups(groups, taskFilter)
      ? new Map<string, LaneRenderItem[]>()
      : this.buildLaneRenderItemsByLane(groups, parentByChild);
    let taskRenderItemsByLane = this.buildTaskRenderItemsByLane(
      groups,
      propName,
      this.getVisibleNotePaths(groups),
      taskFilter,
    );
    groups = this.ensureGroupsForTaskLanes(groups, taskRenderItemsByLane);
    parentByChild = this.buildParentByChild(groups);
    laneRenderItemsByLane = !this.shouldRenderNoteEntriesForGroups(groups, taskFilter)
      ? new Map<string, LaneRenderItem[]>()
      : this.buildLaneRenderItemsByLane(groups, parentByChild);
    taskRenderItemsByLane = this.buildTaskRenderItemsByLane(
      groups,
      propName,
      this.getVisibleNotePaths(groups),
      taskFilter,
    );
    const displayLanes = this.buildDisplayLaneGroups(groups);
    const renderItemsByDisplayLane = new Map<string, LaneRenderItem[]>();
    const taskItemsByDisplayLane = new Map<string, TaskRenderItem[]>();
    for (const displayLane of displayLanes) {
      renderItemsByDisplayLane.set(
        displayLane.id,
        this.getRenderItemsForDisplayLane(displayLane, laneRenderItemsByLane),
      );
      const taskItems = displayLane.laneIds.flatMap((laneId) => taskRenderItemsByLane.get(laneId) ?? []);
      taskItemsByDisplayLane.set(displayLane.id, taskItems);
    }
    this.renderedTaskItemCount = Array.from(taskItemsByDisplayLane.values())
      .reduce((total, taskItems) => total + taskItems.length, 0);

    this.renderedFileOrder = this.getOrderedVisiblePaths(displayLanes, renderItemsByDisplayLane);
    this.renderedResultCount = this.renderedFileOrder.length + this.renderedTaskItemCount;
    this.hasRenderedResultCount = true;
    const visible = new Set(this.renderedFileOrder);
    this.selectedPaths = new Set(Array.from(this.selectedPaths).filter((p) => visible.has(p)));
    if (this.selectionAnchorPath && !visible.has(this.selectionAnchorPath)) this.selectionAnchorPath = null;

    const layoutMode = this.getLayoutMode();
    const showingCompletedTasks = this.shouldShowCompletedTasks();
    const isReadingEmbed = this.isReadingEmbeddedKanbanContext();
    const controls = this.containerEl.createDiv({
      cls: `tps-kanban-view-controls${isReadingEmbed ? ' tps-kanban-view-controls--reading-embed' : ''}`,
    });
    const createControlButton = (icon: string, label: string, pressed: boolean | null, onClick: () => void) => {
      const button = controls.createEl('button', {
        cls: 'tps-kanban-view-toggle tps-kanban-view-toggle--icon',
        attr: {
          type: 'button',
          'aria-label': label,
          title: label,
        },
      });
      if (pressed !== null) button.setAttr('aria-pressed', pressed ? 'true' : 'false');
      setIconWithFallback(button, icon);
      button.createSpan({ cls: 'tps-kanban-view-toggle-label', text: label });
      button.addEventListener('click', onClick);
      return button;
    };
    {
      createControlButton(
        layoutMode === 'list' ? 'columns' : 'list',
        layoutMode === 'list' ? 'Switch to board' : 'Switch to list',
        null,
        () => {
          void this.toggleLayoutMode();
        },
      );
    }
    createControlButton(
      this.plugin.settings.dynamicEmptyLaneWidth ? 'panel-left-close' : 'panel-left-open',
      this.plugin.settings.dynamicEmptyLaneWidth ? 'Dynamic width: on' : 'Dynamic width: off',
      this.plugin.settings.dynamicEmptyLaneWidth,
      () => {
        void this.toggleDynamicEmptyLaneWidth();
      },
    );
    createControlButton(
      showingCompletedTasks ? 'eye-off' : 'eye',
      showingCompletedTasks ? 'Hide completed' : 'Show completed',
      showingCompletedTasks,
      () => {
        void this.toggleCompletedTaskVisibility();
      },
    );

    const boardClasses = ['tps-kanban-board'];
    if (layoutMode === 'list') boardClasses.push('tps-kanban-board--list');
    if (this.shouldCompressEmptyLanes(displayLanes, renderItemsByDisplayLane, taskItemsByDisplayLane)) {
      boardClasses.push('tps-kanban-board--dynamic-empty');
    }
    const board = this.containerEl.createEl('div', { cls: boardClasses.join(' ') });
    board.addEventListener('click', (e: MouseEvent) => {
      if (e.target === board || e.target === this.containerEl) this.clearSelection();
    });

    for (const [displayLaneIndex, displayLane] of displayLanes.entries()) {
      const primaryGroup = displayLane.groups[0];
      const laneEl = board.createEl('div', { cls: 'tps-kanban-lane' });
      const laneId = this.getLaneId(primaryGroup);
      const renderItems = renderItemsByDisplayLane.get(displayLane.id) ?? [];
      const taskItems = taskItemsByDisplayLane.get(displayLane.id) ?? [];
      const itemCount = renderItems.length + taskItems.length;
      const laneCollapsed = this.collapsedListLaneIds.has(displayLane.id);
      laneEl.dataset.laneId = laneId;
      laneEl.dataset.displayLaneId = displayLane.id;
      laneEl.classList.toggle('tps-kanban-lane--empty', itemCount === 0);
      laneEl.classList.toggle('tps-kanban-lane--collapsed', laneCollapsed);

      const createCommandOverride = this.getCreateCommandOverride();
      const laneAddMode = this.resolveCardAddMode(taskFilter);
      const laneAdd = resolveKanbanLaneAddPresentation(laneAddMode, displayLane.label);
      const handleLaneAdd = async () => {
        if (this.runCreateCommandOverride()) return;
        flow('LaneAdd', 'click', {
          lane: displayLane.label,
          mode: createCommandOverride ? 'command' : laneAddMode,
          commandId: createCommandOverride?.id || '',
          createsTask: laneAdd.shouldCreateTask,
          taskFilterMode: taskFilter.mode,
          propName: propName || '',
        });
        if (laneAdd.shouldCreateTask) {
          await this.createRootTaskForLane(propName, displayLane, taskFilter);
          return;
        }
        const targetSelection = propName
          ? await this.resolveDropValueForDisplayLane(displayLane)
          : { selected: true, value: null as string | null };
        if (!targetSelection.selected) return;
        const targetValue = targetSelection.value;
        const proc = propName
          ? (fm: Record<string, unknown>) => {
            if (targetValue == null) {
              delete fm[propName];
            } else {
              fm[propName] = targetValue;
            }
          }
          : undefined;
        await this.createFileForView(undefined, proc);
      };

      // lane header: title + entry count badge
      const header = laneEl.createEl('div', { cls: 'tps-kanban-lane-header' });
      const canReorderLane = displayLane.groups.length === 1;
      header.draggable = canReorderLane;
      header.classList.toggle('tps-kanban-lane-header--draggable', canReorderLane);
      header.title = canReorderLane ? 'Drag header to reorder lane' : '';
      const dragHandle = header.createEl('button', {
        cls: 'tps-kanban-lane-handle',
        attr: { type: 'button', 'aria-label': 'Reorder lane', title: 'Drag lane header to reorder lane' },
      });
      setIconWithFallback(dragHandle, 'grip-vertical');
      dragHandle.draggable = canReorderLane;
      if (!canReorderLane) {
        dragHandle.classList.add('is-disabled');
      }
      header.addEventListener('dragstart', (e: DragEvent) => {
        if (!canReorderLane || (e.target as HTMLElement | null)?.closest('.tps-kanban-lane-label-edit, .tps-kanban-lane-collapse, .tps-kanban-lane-header-add, .tps-kanban-lane-layout-toggle')) {
          e.preventDefault();
          return;
        }
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-kanban-lane', laneId);
        board.addClass('tps-kanban-board--lane-drag');
      });
      header.addEventListener('dragend', () => {
        board.removeClass('tps-kanban-board--lane-drag');
        board.querySelectorAll('.tps-kanban-lane--drop-before, .tps-kanban-lane--drop-after').forEach((el) => {
          (el as HTMLElement).classList.remove('tps-kanban-lane--drop-before', 'tps-kanban-lane--drop-after');
        });
      });

      laneEl.addEventListener('dragover', (e: DragEvent) => {
        if (!e.dataTransfer) return;
        if (!Array.from(e.dataTransfer.types).includes('application/x-kanban-lane')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        laneEl.removeClass('tps-kanban-lane--drop-before');
        laneEl.removeClass('tps-kanban-lane--drop-after');
        const rect = laneEl.getBoundingClientRect();
        const pointerOffset = layoutMode === 'list' ? e.clientY - rect.top : e.clientX - rect.left;
        const midpoint = layoutMode === 'list' ? rect.height / 2 : rect.width / 2;
        if (pointerOffset < midpoint) {
          laneEl.addClass('tps-kanban-lane--drop-before');
        } else {
          laneEl.addClass('tps-kanban-lane--drop-after');
        }
      });
      laneEl.addEventListener('dragleave', () => {
        laneEl.removeClass('tps-kanban-lane--drop-before');
        laneEl.removeClass('tps-kanban-lane--drop-after');
      });
      laneEl.addEventListener('drop', async (e: DragEvent) => {
        if (!e.dataTransfer) return;
        if (!Array.from(e.dataTransfer.types).includes('application/x-kanban-lane')) return;
        e.preventDefault();
        const position = laneEl.hasClass('tps-kanban-lane--drop-after') ? 'after' : 'before';
        laneEl.removeClass('tps-kanban-lane--drop-before');
        laneEl.removeClass('tps-kanban-lane--drop-after');
        board.removeClass('tps-kanban-board--lane-drag');

        const draggedLaneId = e.dataTransfer.getData('application/x-kanban-lane');
        if (!draggedLaneId || draggedLaneId === laneId) {
          flowWarn('LaneOrder', 'drop:ignored', {
            reason: draggedLaneId ? 'same-lane' : 'missing-lane',
            draggedLaneId,
            targetLaneId: laneId,
          });
          return;
        }
        const nextGroups = this.reorderGroups(groups, draggedLaneId, laneId, position);
        if (nextGroups === groups) {
          flowWarn('LaneOrder', 'drop:ignored', {
            reason: 'unchanged-order',
            draggedLaneId,
            targetLaneId: laneId,
            position,
          });
          return;
        }
        flow('LaneOrder', 'drop:save', {
          draggedLaneId,
          targetLaneId: laneId,
          position,
        });
        await this.saveManualLaneOrder(nextGroups);
        flow('LaneOrder', 'drop:done', {
          draggedLaneId,
          targetLaneId: laneId,
          position,
        });
        this.render();
      });

      header.createEl('span', { text: displayLane.label, cls: 'tps-kanban-lane-title' });
      header.createEl('span', { text: String(itemCount), cls: 'tps-kanban-lane-count' });
      if (!isReadingEmbed && this.isEmbeddedKanbanContext() && displayLaneIndex === 0) {
        const layoutToggle = header.createEl('button', {
          cls: 'tps-kanban-lane-layout-toggle',
          attr: {
            type: 'button',
            'aria-label': layoutMode === 'list' ? 'Switch to board' : 'Switch to list',
            title: layoutMode === 'list' ? 'Switch to board' : 'Switch to list',
          },
        });
        setIconWithFallback(layoutToggle, layoutMode === 'list' ? 'columns' : 'list');
        layoutToggle.addEventListener('pointerdown', (evt: PointerEvent) => {
          evt.preventDefault();
          evt.stopPropagation();
        });
        layoutToggle.addEventListener('click', (evt: MouseEvent) => {
          evt.preventDefault();
          evt.stopPropagation();
          void this.toggleLayoutMode();
        });
      }
      if (isReadingEmbed || this.isEmbeddedKanbanContext()) {
        const headerAdd = header.createEl('button', {
          cls: 'tps-kanban-lane-header-add',
          attr: {
            type: 'button',
            'aria-label': createCommandOverride ? `Run ${createCommandOverride.name}` : laneAdd.ariaLabel,
            title: createCommandOverride ? `Run ${createCommandOverride.name}` : laneAdd.title,
          },
        });
        setIconWithFallback(headerAdd, 'plus');
        headerAdd.addEventListener('pointerdown', (evt: PointerEvent) => {
          evt.preventDefault();
          evt.stopPropagation();
        });
        headerAdd.addEventListener('click', (evt: MouseEvent) => {
          evt.preventDefault();
          evt.stopPropagation();
          void handleLaneAdd();
        });
      }
      const labelEdit = header.createEl('button', {
        cls: 'tps-kanban-lane-label-edit',
        attr: { type: 'button', 'aria-label': 'Rename lane label', title: 'Rename column label' },
      });
      setIconWithFallback(labelEdit, 'pencil');
      if (displayLane.groups.length > 1) {
        labelEdit.classList.add('is-disabled');
      }
      labelEdit.addEventListener('pointerdown', (evt: PointerEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
      });
      labelEdit.addEventListener('click', (evt) => {
        if (displayLane.groups.length > 1) return;
        evt.preventDefault();
        evt.stopPropagation();
        void this.renameLaneLabel(primaryGroup);
      });
      header.addEventListener('dblclick', (evt) => {
        if (displayLane.groups.length > 1) return;
        evt.preventDefault();
        evt.stopPropagation();
        void this.renameLaneLabel(primaryGroup);
      });

      const cardsWrap = laneEl.createEl('div', { cls: 'tps-kanban-cards' });
      const collapseBtn = header.createEl('button', {
        cls: 'tps-kanban-lane-collapse',
        attr: {
          type: 'button',
          'aria-label': laneCollapsed ? 'Expand lane' : 'Collapse lane',
          title: laneCollapsed ? 'Expand lane' : 'Collapse lane',
          'aria-expanded': laneCollapsed ? 'false' : 'true',
        },
      });
      setIconWithFallback(collapseBtn, laneCollapsed ? 'chevron-right' : 'chevron-down');
      collapseBtn.addEventListener('pointerdown', (evt: PointerEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
      });
      collapseBtn.addEventListener('click', (evt: MouseEvent) => {
        evt.preventDefault();
        evt.stopPropagation();
        this.toggleListLaneCollapsed(displayLane.id);
      });

      if (laneCollapsed) continue;

      // drop zone — dragging a card here updates its groupBy property in frontmatter
      if (propName) {
        const clearCardDropTarget = () => {
          cardsWrap.removeClass('tps-kanban-drop-target');
          header.removeClass('tps-kanban-lane-header--card-drop-target');
          laneEl.removeClass('tps-kanban-lane--card-drop-target');
        };
        const showCardDropTarget = (target: 'header' | 'cards') => {
          cardsWrap.classList.toggle('tps-kanban-drop-target', target === 'cards');
          header.classList.toggle('tps-kanban-lane-header--card-drop-target', target === 'header');
          laneEl.addClass('tps-kanban-lane--card-drop-target');
        };
        const handleCardDropDragOver = (target: 'header' | 'cards') => (e: DragEvent) => {
          if (!e.dataTransfer) return;
          const types = Array.from(e.dataTransfer.types);
          if (types.includes('application/x-kanban-entry') || this.hasTaskDropData(e.dataTransfer)) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            showCardDropTarget(target);
          }
        };
        const handleCardDropDragLeave = (targetEl: HTMLElement) => (e: DragEvent) => {
          if (targetEl.contains(e.relatedTarget as Node | null)) return;
          clearCardDropTarget();
        };
        const handleCardDrop = async (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          clearCardDropTarget();
          if (!e.dataTransfer) return;
          const taskPayload = this.parseTaskDropPayload(e.dataTransfer);
          const filePath = e.dataTransfer.getData('application/x-kanban-entry');
          if (!filePath && !taskPayload) return;
          const targetSelection = await this.resolveDropValueForDisplayLane(displayLane);
          if (!targetSelection.selected) {
            flow('LaneDrop', 'cancelled-target', {
              lane: displayLane.label,
              propName,
              hasTaskPayload: !!taskPayload,
              filePath,
            });
            return;
          }
          const targetValue = targetSelection.value;
          if (taskPayload) {
            const taskFile = taskPayload.path ? this.app.vault.getFileByPath(taskPayload.path) : null;
            if (!taskFile || !taskPayload.line) {
              flowWarn('LaneDrop', 'blocked', {
                reason: 'missing-task-source',
                path: taskPayload.path,
                line: taskPayload.line,
                lane: displayLane.label,
              });
              return;
            }
            flow('LaneDrop', 'task:start', {
              path: taskFile.path,
              line: taskPayload.line,
              lane: displayLane.label,
              propName,
              targetValue,
            });
            const applied = await this.confirmAndApplyInlineTaskDrop(
              taskFile,
              taskPayload.line,
              propName,
              targetValue,
              Array.isArray(taskPayload.sourceLaneValues) ? taskPayload.sourceLaneValues : [],
            );
            if (!applied) {
              flow('LaneDrop', 'task:not-applied', {
                path: taskFile.path,
                line: taskPayload.line,
                lane: displayLane.label,
                propName,
                targetValue,
              });
              this.render();
              return;
            }
          } else {
            const file = this.app.vault.getFileByPath(filePath);
            if (!file) {
              flowWarn('LaneDrop', 'blocked', {
                reason: 'missing-file',
                filePath,
                lane: displayLane.label,
              });
              return;
            }
            let sourceLaneValues: string[] = [];
            try {
              const rawSourceValues = e.dataTransfer.getData('application/x-kanban-entry-source-values');
              const parsedSourceValues = rawSourceValues ? JSON.parse(rawSourceValues) : [];
              sourceLaneValues = Array.isArray(parsedSourceValues) ? parsedSourceValues : [];
            } catch {
              sourceLaneValues = [];
            }
            await this.applyFrontmatterProperty(file, propName, targetValue, sourceLaneValues);
            await this.applyCompanionRulesToFile(file);
          }
          flow('LaneDrop', 'done', {
            lane: displayLane.label,
            propName,
            targetValue,
            kind: taskPayload ? 'task' : 'note',
            path: taskPayload?.path || filePath,
          });
          this.render();
        };

        header.addEventListener('dragover', handleCardDropDragOver('header'));
        header.addEventListener('dragleave', handleCardDropDragLeave(header));
        header.addEventListener('drop', handleCardDrop);
        cardsWrap.addEventListener('dragover', handleCardDropDragOver('cards'));
        cardsWrap.addEventListener('dragleave', handleCardDropDragLeave(cardsWrap));
        cardsWrap.addEventListener('drop', handleCardDrop);
      }

      for (const item of renderItems) {
        const card = this.createEntryCard(item.entry, groups, propName, item, displayLane);
        cardsWrap.appendChild(card);
      }
      for (const taskItem of taskItems) {
        const card = this.createTaskLaneCard(taskItem, propName, displayLane);
        cardsWrap.appendChild(card);
      }

      laneEl.createEl('button', { text: createCommandOverride ? `+ ${createCommandOverride.name}` : laneAdd.buttonText, cls: 'tps-kanban-add-card' })
        .addEventListener('click', async () => {
          await handleLaneAdd();
        });
    }
    this.syncSelectionClasses();
    this.syncNativeResultsCountSoon();
    this.restoreRenderScrollState(scrollState);
  }

}
