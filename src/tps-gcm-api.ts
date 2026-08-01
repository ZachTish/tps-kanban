import { App } from 'obsidian';
import { TPS_EVENTS, TPS_LEGACY_EVENTS } from './tps-contracts';

export interface GcmEventsApi {
  emitFilesUpdated?: (paths: string[], options?: { sourcePluginId?: string }) => void;
}

export const TPS_FORMULA_API_VERSION = 1 as const;
export const TPS_LINE_METADATA_API_VERSION = 1 as const;
export const TPS_ENTITY_INDEX_API_VERSION = 3 as const;
export const TPS_TASK_LINES_API_VERSION = 1 as const;
export const TPS_TASK_CHECKBOXES_API_VERSION = 1 as const;
export const TPS_GCM_API_CHANGED_EVENT = 'tps:gcm-api-changed' as const;
export const TPS_GCM_API_REQUEST_EVENT = 'tps:gcm-api-request' as const;

export type GcmApiChangedEvent = {
  source: 'tps-global-context-menu';
  timestamp: number;
  available: boolean;
  api?: GcmApi | null;
  formulasVersion: number | null;
  lineMetadataVersion: number | null;
  entityIndexVersion: number | null;
  taskLinesVersion?: number | null;
  taskCheckboxesVersion?: number | null;
};

export type GcmApiRequestEvent = {
  requester: 'tps-kanban';
  timestamp: number;
};

export type GcmApiStatus = Pick<
  GcmApiChangedEvent,
  'available' | 'formulasVersion' | 'lineMetadataVersion' | 'entityIndexVersion'
> & {
  taskLinesVersion: number | null;
  taskCheckboxesVersion: number | null;
};

export type GcmLineMetadataField = {
  key: string;
  value: string;
};

export type GcmParsedLineMetadata = {
  fields: GcmLineMetadataField[];
  tags: string[];
  displayTitle: string;
};

export type GcmLineMetadataApi = {
  version: number;
  readInlineFields: (line: string) => GcmLineMetadataField[];
  readInlineFieldValue: (line: string, key: string) => string | null;
  readTags: (line: string) => string[];
  parseStringList: (value: unknown) => string[];
  parseTags: (value: unknown) => string[];
  getDisplayTitle: (line: string) => string;
  parseLine: (line: string) => GcmParsedLineMetadata;
};

export type GcmEntityIndexRecord = {
  sourcePath?: string;
  entityType?: 'note' | 'block';
  lineKind?: 'task' | 'bullet' | 'heading';
};

export type GcmEntityIndexApi = {
  version: number;
  ensureReady: () => Promise<void>;
  queryAsync: (query: Record<string, unknown>) => Promise<readonly GcmEntityIndexRecord[]>;
  getRevision: () => number;
  onChanged: (callback: (revision: number) => void) => () => void;
};

export type GcmTaskLinesApi = {
  version: number;
  handleContextMenu: (event: MouseEvent) => boolean;
  openQuickEditorForElement: (
    taskEl: HTMLElement,
    sourceEl?: HTMLElement | null,
  ) => Promise<boolean> | boolean;
};

export type GcmTaskCheckboxMapping = {
  checkboxState: string;
  statuses: readonly string[];
  toggleTargetStatus?: string;
  icon?: string;
  label?: string;
};

export type GcmTaskCheckboxesApi = {
  version: number;
  getMappings: () => readonly GcmTaskCheckboxMapping[];
  stateForStatus: (status: unknown) => string;
  statusForState: (state: unknown) => string;
};

export type GcmFormulaResult = {
  status: 'value' | 'empty' | 'unsupported' | 'error';
  value: unknown;
  formula: string;
  code?: string;
  message?: string;
};

export type GcmFormulaSession = {
  compiled?: { revision?: string };
  get: (formula: string) => GcmFormulaResult;
  getAll: () => Record<string, GcmFormulaResult>;
  evaluateExpression: (expression: string, label?: string) => GcmFormulaResult;
};

export type GcmFormulaApi = {
  version: number;
  compile: (definitions: unknown, sourceId?: string) => unknown;
  createSession: (compiled: unknown, context: Record<string, unknown>) => GcmFormulaSession;
  hasReference: (expression: string) => boolean;
  evaluate?: (compiled: unknown, formula: string, context: Record<string, unknown>) => GcmFormulaResult;
  evaluateAll?: (compiled: unknown, context: Record<string, unknown>) => Record<string, GcmFormulaResult>;
  evaluateExpression: (compiled: unknown, expression: string, context: Record<string, unknown>) => GcmFormulaResult;
  format: (value: unknown) => string;
  comparableValues: (value: unknown) => unknown[];
  sortKey: (value: unknown) => string;
  groupValues: (value: unknown) => string[];
  compare: (left: unknown, right: unknown) => number;
  isTruthy: (value: unknown) => boolean;
};

export interface GcmApi {
  events?: GcmEventsApi;
  formulas?: GcmFormulaApi;
  lineMetadata?: GcmLineMetadataApi;
  entityIndex?: GcmEntityIndexApi;
  taskLines?: GcmTaskLinesApi;
  taskCheckboxes?: GcmTaskCheckboxesApi;
  services?: Record<string, any>;
  sharedServices?: Record<string, any>;
  cardContent?: any;
  ui?: {
    shouldForceBaseLinkPreview?: () => boolean;
  };
}

const gcmApiByApp = new WeakMap<App, GcmApi>();
const gcmApiStatusByApp = new WeakMap<App, GcmApiStatus>();

function isGcmFormulaApi(value: unknown): value is GcmFormulaApi {
  const formulas = value as GcmFormulaApi | null | undefined;
  return !!formulas
    && formulas.version === TPS_FORMULA_API_VERSION
    && typeof formulas.compile === 'function'
    && typeof formulas.createSession === 'function'
    && typeof formulas.hasReference === 'function'
    && typeof formulas.evaluateExpression === 'function'
    && typeof formulas.format === 'function'
    && typeof formulas.comparableValues === 'function'
    && typeof formulas.sortKey === 'function'
    && typeof formulas.groupValues === 'function'
    && typeof formulas.compare === 'function'
    && typeof formulas.isTruthy === 'function';
}

function isGcmLineMetadataApi(value: unknown): value is GcmLineMetadataApi {
  const lineMetadata = value as GcmLineMetadataApi | null | undefined;
  return !!lineMetadata
    && lineMetadata.version === TPS_LINE_METADATA_API_VERSION
    && typeof lineMetadata.readInlineFields === 'function'
    && typeof lineMetadata.readInlineFieldValue === 'function'
    && typeof lineMetadata.readTags === 'function'
    && typeof lineMetadata.parseStringList === 'function'
    && typeof lineMetadata.parseTags === 'function'
    && typeof lineMetadata.getDisplayTitle === 'function'
    && typeof lineMetadata.parseLine === 'function';
}

function isGcmEntityIndexApi(value: unknown): value is GcmEntityIndexApi {
  const entityIndex = value as GcmEntityIndexApi | null | undefined;
  return !!entityIndex
    && entityIndex.version === TPS_ENTITY_INDEX_API_VERSION
    && typeof entityIndex.ensureReady === 'function'
    && typeof entityIndex.queryAsync === 'function'
    && typeof entityIndex.getRevision === 'function'
    && typeof entityIndex.onChanged === 'function';
}

function isGcmTaskLinesApi(value: unknown): value is GcmTaskLinesApi {
  const taskLines = value as GcmTaskLinesApi | null | undefined;
  return !!taskLines
    && taskLines.version === TPS_TASK_LINES_API_VERSION
    && typeof taskLines.handleContextMenu === 'function'
    && typeof taskLines.openQuickEditorForElement === 'function';
}

function isGcmTaskCheckboxesApi(value: unknown): value is GcmTaskCheckboxesApi {
  const taskCheckboxes = value as GcmTaskCheckboxesApi | null | undefined;
  return !!taskCheckboxes
    && taskCheckboxes.version === TPS_TASK_CHECKBOXES_API_VERSION
    && typeof taskCheckboxes.getMappings === 'function'
    && typeof taskCheckboxes.stateForStatus === 'function'
    && typeof taskCheckboxes.statusForState === 'function';
}

export function acceptGcmApiChanged(app: App, event: GcmApiChangedEvent): boolean {
  if (event?.source !== 'tps-global-context-menu') return false;
  gcmApiStatusByApp.set(app, {
    available: event.available === true,
    formulasVersion: event.formulasVersion ?? null,
    lineMetadataVersion: event.lineMetadataVersion ?? null,
    entityIndexVersion: event.entityIndexVersion ?? null,
    taskLinesVersion: event.taskLinesVersion ?? null,
    taskCheckboxesVersion: event.taskCheckboxesVersion ?? null,
  });
  if (!event.available) {
    gcmApiByApp.delete(app);
    return true;
  }
  const api = event.api;
  if (
    !api
    || event.formulasVersion !== TPS_FORMULA_API_VERSION
    || event.lineMetadataVersion !== TPS_LINE_METADATA_API_VERSION
    || event.entityIndexVersion !== TPS_ENTITY_INDEX_API_VERSION
    || !isGcmFormulaApi(api.formulas)
    || !isGcmLineMetadataApi(api.lineMetadata)
    || !isGcmEntityIndexApi(api.entityIndex)
  ) {
    gcmApiByApp.delete(app);
    return true;
  }
  gcmApiByApp.set(app, api);
  return true;
}

export function requestGcmApi(app: App): void {
  gcmApiByApp.delete(app);
  gcmApiStatusByApp.delete(app);
  (app.workspace as any).trigger(TPS_GCM_API_REQUEST_EVENT, {
    requester: 'tps-kanban',
    timestamp: Date.now(),
  } satisfies GcmApiRequestEvent);
}

export function getGcmApi(app: App): GcmApi | null {
  return gcmApiByApp.get(app) ?? null;
}

export function getGcmApiStatus(app: App): GcmApiStatus | null {
  return gcmApiStatusByApp.get(app) ?? null;
}

export function emitFilesUpdated(app: App, paths: string[], sourcePluginId: string): void {
  const normalized = paths.map((path) => String(path || '').trim()).filter(Boolean);
  if (!normalized.length) return;
  const api = getGcmApi(app);
  if (typeof api?.events?.emitFilesUpdated === 'function') {
    api.events.emitFilesUpdated(normalized, { sourcePluginId });
    return;
  }
  (app.workspace as any).trigger(TPS_LEGACY_EVENTS.GCM_FILES_UPDATED, normalized);
  (app.workspace as any).trigger(TPS_EVENTS.FILES_UPDATED, {
    sourcePluginId,
    timestamp: Date.now(),
    paths: normalized,
  });
}

export function shouldForceBaseLinkPreview(app: App): boolean {
  const api = getGcmApi(app);
  return typeof api?.ui?.shouldForceBaseLinkPreview === 'function'
    ? api.ui.shouldForceBaseLinkPreview() === true
    : false;
}

export function getGcmFormulaApi(app: App): GcmFormulaApi | null {
  const formulas = getGcmApi(app)?.formulas;
  return isGcmFormulaApi(formulas) ? formulas : null;
}

export function getGcmLineMetadataApi(app: App): GcmLineMetadataApi | null {
  const lineMetadata = getGcmApi(app)?.lineMetadata;
  return isGcmLineMetadataApi(lineMetadata) ? lineMetadata : null;
}

export function getGcmEntityIndexApi(app: App): GcmEntityIndexApi | null {
  const entityIndex = getGcmApi(app)?.entityIndex;
  return isGcmEntityIndexApi(entityIndex) ? entityIndex : null;
}

export function getGcmTaskLinesApi(app: App): GcmTaskLinesApi | null {
  if (getGcmApiStatus(app)?.taskLinesVersion !== TPS_TASK_LINES_API_VERSION) return null;
  const taskLines = getGcmApi(app)?.taskLines;
  return isGcmTaskLinesApi(taskLines) ? taskLines : null;
}

export function getGcmTaskCheckboxesApi(app: App): GcmTaskCheckboxesApi | null {
  if (getGcmApiStatus(app)?.taskCheckboxesVersion !== TPS_TASK_CHECKBOXES_API_VERSION) return null;
  const taskCheckboxes = getGcmApi(app)?.taskCheckboxes;
  return isGcmTaskCheckboxesApi(taskCheckboxes) ? taskCheckboxes : null;
}
