import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const viewSource = readFileSync(new URL('../src/views/KanbanView.ts', import.meta.url), 'utf8');
const taskCreationUtilsSource = readFileSync(new URL('../src/task-creation-utils.ts', import.meta.url), 'utf8');
const taskCheckboxUtilsSource = readFileSync(new URL('../src/task-checkbox-utils.ts', import.meta.url), 'utf8');
const taskDropUtilsSource = readFileSync(new URL('../src/task-drop-utils.ts', import.meta.url), 'utf8');
const filterKindUtilsSource = readFileSync(new URL('../src/filter-kind-utils.ts', import.meta.url), 'utf8');
const gcmApiSource = readFileSync(new URL('../src/tps-gcm-api.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/settings.ts', import.meta.url), 'utf8');
const settingsTabSource = readFileSync(new URL('../src/settings/SettingsTab.ts', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const loadedStylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

async function importTaskCreationUtils() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/task-creation-utils.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [
      {
        name: 'obsidian-stub',
        setup(build) {
          build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian-stub', namespace: 'stub' }));
          build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            loader: 'js',
            contents: `
              export function normalizePath(value) {
                return String(value || '')
                  .replace(/\\\\/g, '/')
                  .replace(/\\/{2,}/g, '/')
                  .replace(/^\\.\\//, '')
                  .replace(/\\/\\.\\//g, '/')
                  .replace(/\\/$/, '');
              }
            `,
          }));
        },
      },
    ],
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importTaskCheckboxUtils() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/task-checkbox-utils.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importTaskDropUtils() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/task-drop-utils.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importFilterKindUtils() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/filter-kind-utils.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importKanbanSettings() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/settings.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importKanbanSettingsPersistence() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/settings-persistence.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function importGcmApiBridge() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/tps-gcm-api.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'obsidian-stub',
      setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian-stub', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export class App {}' }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function importKanbanView() {
  const build = await esbuild.build({
    entryPoints: [fileURLToPath(new URL('../src/views/KanbanView.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [
      {
        name: 'obsidian-stub',
        setup(build) {
          build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian-stub', namespace: 'stub' }));
          build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            loader: 'js',
            contents: `
              export class BasesView {}
              export class QueryController {}
              export class Menu {}
              export class BasesEntry {}
              export class BasesEntryGroup {}
              export function setIcon() {}
              export class TFile {}
              globalThis.__KanbanTestTFile = TFile;
              export function debounce(callback) { return callback; }
              export function normalizePath(value) { return String(value || '').replace(/\\\\/g, '/'); }
              export class Modal {}
              export class Setting {}
              export function getAllTags() { return []; }
              export class WorkspaceLeaf {}
              export function parseYaml(value) {
                return typeof globalThis.__KanbanParseYaml === 'function'
                  ? globalThis.__KanbanParseYaml(value)
                  : {};
              }
              export class Notice {
                constructor(message) {
                  if (Array.isArray(globalThis.__KanbanFormulaNotices)) {
                    globalThis.__KanbanFormulaNotices.push(String(message));
                  }
                }
              }
              export const Platform = { isMobile: false };
            `,
          }));
        },
      },
    ],
  });
  return import(`data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`);
}

async function flushDeferredWork() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

function createEntityIndexApiMock() {
  return {
    version: 3,
    ensureReady: async () => {},
    queryAsync: async () => [],
    getRevision: () => 1,
    onChanged: () => () => {},
  };
}

function provideGcmProtocolApi(view, {
  formulas = createFormulaApiMock().api,
  lineMetadata = createLineMetadataApiMock().api,
  entityIndex = createEntityIndexApiMock(),
  api: extraApi = {},
} = {}) {
  const api = {
    ...extraApi,
    ...(formulas ? { formulas } : {}),
    ...(lineMetadata ? { lineMetadata } : {}),
    ...(entityIndex ? { entityIndex } : {}),
  };
  const accepted = view.acceptGcmApiEvent({
    source: 'tps-global-context-menu',
    timestamp: Date.now(),
    available: true,
    api,
    formulasVersion: formulas?.version ?? null,
    lineMetadataVersion: lineMetadata?.version ?? null,
    entityIndexVersion: entityIndex?.version ?? null,
    taskLinesVersion: extraApi?.taskLines?.version ?? null,
    taskCheckboxesVersion: extraApi?.taskCheckboxes?.version ?? null,
  });
  assert.equal(accepted, true);
  return api;
}

function createTaskReadHarness(KanbanView) {
  const pendingReads = [];
  const filesByPath = new Map();
  let refreshCount = 0;
  let parseCount = 0;
  const view = Object.create(KanbanView.prototype);
  view.openTasksByPath = new Map();
  view.allTasksByPath = new Map();
  view.openTaskOverflowByPath = new Map();
  view.taskReadsInFlight = new Map();
  view.taskReadQueue = [];
  view.activeTaskReadCount = 0;
  view.taskReadFailures = new Map();
  view.taskReadRetryTimer = null;
  view.taskReadExhaustionNotified = false;
  view.isViewLoaded = true;
  view.renderGeneration = 0;
  view.refreshDebounced = () => {
    refreshCount += 1;
  };
  view.app = {
    vault: {
      cachedRead(file) {
        const gate = deferred();
        pendingReads.push({ file, gate });
        return gate.promise;
      },
      getFileByPath(path) {
        return filesByPath.get(path) ?? null;
      },
    },
  };
  view.getTaskRootFilterFromBaseFilters = () => ({
    mode: 'mixed',
    hasTaskDirective: false,
    includeDone: false,
    statuses: new Set(),
    excludeStatuses: new Set(),
    tags: new Set(),
    excludeTags: new Set(),
  });
  view.isVisibleFile = () => true;
  view.isTaskSourceFile = () => false;
  view.getGcmServices = () => null;
  view.getGcmApi = () => null;
  view.getOpenTaskPreviewLimit = () => 5;
  view.getDoneStatuses = () => new Set(['complete']);
  view.getStatusForCheckboxState = (state) => state === '[x]' ? 'complete' : 'todo';
  view.getTaskVisibleTitle = (task) => task.text;
  view.getTaskReadRetryDelayMs = () => 1;
  view.parseOpenTasks = (content, path, _limit, _includeDone, includeBullets = false) => {
    parseCount += 1;
    return {
      openTasks: [{
        itemKind: 'task',
        line: 1,
        checkboxState: '[ ]',
        text: String(content),
        displayText: String(content),
        inlineFields: [{ key: 'path', value: path }],
      }, ...(includeBullets ? [{
        itemKind: 'bullet',
        line: 2,
        text: String(content),
        displayText: String(content),
        inlineFields: [{ key: 'path', value: path }],
      }] : [])],
      overflowCount: 0,
    };
  };
  return {
    view,
    pendingReads,
    filesByPath,
    refreshCount: () => refreshCount,
    parseCount: () => parseCount,
  };
}

function getFrontmatterPropNameFromId(propId) {
  const raw = String(propId ?? '').trim();
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot === -1) return raw;
  return raw.slice(0, dot) === 'note' ? raw.slice(dot + 1) : null;
}

function normalizeGroupToken(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^['"]+|['"]+$/g, '').trim();
}

function extractGroupValues(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((value) => String(value ?? '').trim()).filter(Boolean);
  if (raw instanceof Set) return Array.from(raw.values()).map((value) => String(value ?? '').trim()).filter(Boolean);
  if (typeof raw === 'object' && Array.isArray(raw.values)) {
    return raw.values.map((value) => String(value ?? '').trim()).filter(Boolean);
  }
  const scalar = String(raw).trim();
  if (!scalar) return [];
  const unwrapped = scalar.startsWith('[') && scalar.endsWith(']') ? scalar.slice(1, -1) : scalar;
  if (!/[,;\n]/.test(unwrapped)) return [normalizeGroupToken(unwrapped)];
  return unwrapped.split(/[,;\n]/g).map((part) => normalizeGroupToken(part)).filter(Boolean);
}

test('resolves writable Bases property IDs to frontmatter keys', () => {
  assert.equal(getFrontmatterPropNameFromId('note.status'), 'status');
  assert.equal(getFrontmatterPropNameFromId('status'), 'status');
  assert.equal(getFrontmatterPropNameFromId('file.name'), null);
});

test('loaded Obsidian stylesheet matches source stylesheet', () => {
  assert.equal(loadedStylesSource, stylesSource);
});

test('GCM-sensitive frontmatter writes use the supported service exactly once with native standalone fallback', async () => {
  const { KanbanView } = await importKanbanView();
  const file = { path: 'Inbox/Card.md' };
  const mutator = (frontmatter) => {
    frontmatter.status = 'working';
  };

  let gcmCalls = 0;
  let nativeCalls = 0;
  const gcmView = Object.create(KanbanView.prototype);
  gcmView.getGcmServices = () => ({
    frontmatter: {
      async process(receivedFile, receivedMutator) {
        gcmCalls += 1;
        assert.equal(receivedFile, file);
        const frontmatter = {};
        await receivedMutator(frontmatter);
        assert.deepEqual(frontmatter, { status: 'working' });
        return true;
      },
    },
  });
  gcmView.app = {
    fileManager: {
      async processFrontMatter() {
        nativeCalls += 1;
      },
    },
  };

  assert.equal(await gcmView.processFrontmatter(file, mutator), true);
  assert.equal(gcmCalls, 1);
  assert.equal(nativeCalls, 0);

  const nativeView = Object.create(KanbanView.prototype);
  nativeView.getGcmServices = () => null;
  nativeView.app = {
    fileManager: {
      async processFrontMatter(receivedFile, receivedMutator) {
        nativeCalls += 1;
        assert.equal(receivedFile, file);
        const frontmatter = {};
        await receivedMutator(frontmatter);
        assert.deepEqual(frontmatter, { status: 'working' });
      },
    },
  };

  assert.equal(await nativeView.processFrontmatter(file, mutator), undefined);
  assert.equal(gcmCalls, 1);
  assert.equal(nativeCalls, 1);
});

test('GCM frontmatter false and errors propagate without a native retry', async () => {
  const { KanbanView } = await importKanbanView();
  const file = { path: 'Inbox/Card.md' };
  let nativeCalls = 0;
  const view = Object.create(KanbanView.prototype);
  view.app = {
    fileManager: {
      async processFrontMatter() {
        nativeCalls += 1;
      },
    },
  };

  view.getGcmServices = () => ({
    frontmatter: {
      async process() {
        return false;
      },
    },
  });
  assert.equal(await view.processFrontmatter(file, () => {}), false);
  assert.equal(nativeCalls, 0);

  const expectedError = new Error('GCM write failed');
  view.getGcmServices = () => ({
    frontmatter: {
      async process() {
        throw expectedError;
      },
    },
  });
  await assert.rejects(view.processFrontmatter(file, () => {}), (error) => error === expectedError);
  assert.equal(nativeCalls, 0);
});

test('tag-lane and card-nesting writes share the GCM-first frontmatter route', () => {
  const routedWriteCount = viewSource.match(/await this\.processFrontmatter\(/g)?.length ?? 0;
  assert.equal(routedWriteCount, 3);
  assert.match(viewSource, /private async applyFrontmatterTags[\s\S]*?await this\.processFrontmatter\(file,/);
  assert.match(viewSource, /Already a child of this card[\s\S]*?await this\.processFrontmatter\(draggedFile,/);
  assert.match(viewSource, /Set as subitem of this card[\s\S]*?await this\.processFrontmatter\(draggedFile,/);
  assert.match(viewSource, /private async applyFrontmatterProperty[\s\S]*?await this\.app\.fileManager\.processFrontMatter\(file,/);
});

test('normal card clicks open/focus unless GCM forces Base previews', () => {
  const methodMatch = viewSource.match(/private shouldPreviewCardClicks\(\): boolean \{([\s\S]*?)\n  \}/);
  assert.ok(methodMatch, 'shouldPreviewCardClicks method should exist');
  assert.match(methodMatch[1], /return shouldForceBaseLinkPreview\(this\.app\);/);
  assert.doesNotMatch(methodMatch[1], /cardActivationMode/);
  assert.match(settingsSource, /cardActivationMode: 'open'/);
  assert.match(settingsTabSource, /\.setValue\(this\.plugin\.settings\.cardActivationMode \|\| 'open'\)/);
});

test('repeated card clicks are not swallowed by the preview-bubble guard', () => {
  assert.match(viewSource, /let lastPreviewClickTimeStamp = 0;/);
  assert.match(viewSource, /lastPreviewClickTimeStamp = e\.timeStamp \|\| 0;/);
  assert.doesNotMatch(viewSource, /if \(!\(e instanceof PointerEvent\)\) return false;/);
  assert.match(viewSource, /const repeated = lastTapPath === entry\.file\.path && now - lastTapAt < 650;/);
  assert.match(viewSource, /const isSamePreviewClick = lastPreviewOpenAt > 0[\s\S]*!!lastPreviewClickTimeStamp[\s\S]*e\.timeStamp === lastPreviewClickTimeStamp;/);
  assert.match(viewSource, /if \(isSamePreviewClick\) \{/);
  assert.ok(
    viewSource.indexOf('if (isSamePreviewClick) {') < viewSource.indexOf('if (!this.shouldPreviewCardClicks() || shouldOpenFromRepeatedTap(e)) {'),
    'same-preview-click guard should still run before preview/open decision',
  );
});

test('card and task opens create a foreground tab when the target file is not already open', () => {
  const methodMatch = viewSource.match(/private getTargetLeafForOpen\(\): WorkspaceLeaf \| null \{([\s\S]*?)\n  \}/);
  assert.ok(methodMatch, 'getTargetLeafForOpen method should exist');
  assert.match(methodMatch[1], /return this\.app\.workspace\.getLeaf\('tab'\)/);
  assert.doesNotMatch(methodMatch[1], /activeLeaf/);
  assert.doesNotMatch(methodMatch[1], /getLeavesOfType\('markdown'\)/);
});

test('root task cards follow selected Base properties', () => {
  assert.match(viewSource, /const selectedPropIds = this\.getCardPropertyIds\(groupPropName\)/);
  assert.match(viewSource, /private getTaskPropertyValue\(file: TFile, task: OpenTaskSubitem, propId: string/);
  assert.match(viewSource, /private normalizeTaskPropertyId\(propId: string\): string/);
  assert.match(viewSource, /this\.getTaskPropertyValue\(file, task, propId, hidden\)/);
  assert.doesNotMatch(viewSource, /const props: Array<\{ text: string; title\?: string; kind\?: string \}> = \[\s*\{ text: file\.basename, kind: 'source' \}/);
});

test('settings include a Base-native query guide', () => {
  assert.match(settingsTabSource, /Base query guide/);
  assert.match(settingsTabSource, /applies it separately to note cards and checkbox task cards/);
  assert.match(settingsTabSource, /kind == "task"/);
  assert.match(settingsTabSource, /task\.tags\.contains\("#type\/task\/toget"\)/);
  assert.match(settingsTabSource, /task\.path == "Collections\/Toget\.md"/);
  assert.match(settingsTabSource, /Bare tags, status, and custom fields are shared/);
  assert.match(settingsTabSource, /task\.<inlineKey>/);
  assert.match(settingsTabSource, /file\.ext == "md"/);
  assert.match(settingsTabSource, /Only checkbox tasks tagged #test/);
  assert.match(settingsTabSource, /task\.tags\.contains\("#test"\)/);
  assert.match(settingsTabSource, /Without a path, task tag\/status filters scan markdown task lines/);
  assert.match(settingsTabSource, /Use quoted tag values in \.base text/);
});

test('kanban search stays scoped to the current leaf or embed', () => {
  const methodMatch = viewSource.match(/private getActiveBasesSearchQuery\(\): string \{([\s\S]*?)\n  \}/);
  assert.ok(methodMatch, 'getActiveBasesSearchQuery method should exist');
  const methodSource = methodMatch[1];
  assert.match(methodSource, /closest\('\.workspace-leaf'\)/);
  assert.match(methodSource, /closest\('\.internal-embed, \.markdown-embed, \.cm-embed-block, \.sync-embed, \.sync-container'\)/);
  assert.ok(
    methodSource.indexOf("closest('.internal-embed, .markdown-embed, .cm-embed-block, .sync-embed, .sync-container')") <
    methodSource.indexOf("closest('.workspace-leaf')"),
    'embedded bases should prefer their own toolbar search before the workspace search',
  );
  assert.doesNotMatch(methodSource, /ownerDocument\.body/);
});

test('embedded kanban resolves markdown context before neighboring base tabs', () => {
  assert.match(viewSource, /private getWorkspaceLeafMarkdownContextPath\(\): string \| null/);
  assert.match(viewSource, /private getEmbeddedBasePathFromDom\(\): string \| null/);
  assert.ok(viewSource.includes('.internal-embed[src$=".base"]'));
  assert.match(viewSource, /this\.getEmbeddedBasePathFromDom\(\)/);
  assert.match(viewSource, /if \(directFile\) return directFile\.path/);
  assert.match(viewSource, /const embeddedMarkdownContext = this\.getWorkspaceLeafMarkdownContextPath\(\)/);
  assert.match(viewSource, /if \(embeddedMarkdownContext\) return embeddedMarkdownContext/);
  assert.doesNotMatch(viewSource, /getActiveWorkspaceBasePath|resolveBasePathFromDomTitle|resolveBasePathFromDocumentTitle/);
  assert.match(viewSource, /const markdownContextPath = this\.getWorkspaceLeafMarkdownContextPath\(\)/);
  assert.match(viewSource, /if \(markdownContextFile instanceof TFile\) return markdownContextFile/);
  assert.doesNotMatch(viewSource, /private getBaseFile\(\): TFile \| null \{\s*const directFile = this\.getRuntimeBaseFile\(\)/);
  assert.match(viewSource, /closest\('\.markdown-reading-view, \.markdown-source-view, \.markdown-preview-view, \.markdown-embed, \.internal-embed, \.cm-embed-block, \.sync-embed, \.sync-container'\)/);
  assert.match(viewSource, /file instanceof TFile && file\.extension === 'md'/);
  assert.match(viewSource, /value\.endsWith\('\.md'\)/);
  assert.match(viewSource, /private getEmbeddedKanbanBlockMatch\(parsed: Record<string, unknown> \| null \| undefined, viewName: string\): 'exact' \| 'fallback' \| null/);
  assert.match(viewSource, /const roots = exactFormulaSets\.length \? exactRoots : fallbackRoots/);
  assert.match(viewSource, /return kanbanViews\.length === 1 \? 'fallback' : null/);
});

test('Base formula authority never falls back to an active neighboring tab or ambiguous title', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const wrongActiveBase = Object.assign(new TFile(), {
    path: 'Other/Schedule.base', name: 'Schedule.base', basename: 'Schedule', extension: 'base',
  });
  const duplicateBase = Object.assign(new TFile(), {
    path: 'Archive/Schedule.base', name: 'Schedule.base', basename: 'Schedule', extension: 'base',
  });
  const view = Object.create(KanbanView.prototype);
  view.getRuntimeBaseFile = () => null;
  view.getWorkspaceLeafMarkdownContextPath = () => 'Inbox/Embedded Host.md';
  view.getWorkspaceLeafBasePath = () => null;
  view.app = {
    workspace: {
      getActiveFile: () => wrongActiveBase,
      activeLeaf: { view: { file: wrongActiveBase }, getDisplayText: () => 'Schedule' },
    },
    vault: {
      getFileByPath: () => null,
      getFiles: () => [wrongActiveBase, duplicateBase],
    },
  };

  assert.equal(view.getBaseSourcePath(), 'Inbox/Embedded Host.md', 'the owning embedded Markdown leaf wins over the active tab');
  view.getWorkspaceLeafMarkdownContextPath = () => null;
  assert.equal(view.getBaseSourcePath(), null, 'an unresolved owner fails closed instead of borrowing the active Base');
  assert.equal(view.resolveBasePathFromName('Schedule'), null, 'same-named Base titles are never guessed');
});

test('extracts multi-value lane labels from Bases value shapes', () => {
  assert.deepEqual(extractGroupValues(['Todo', 'Doing', '']), ['Todo', 'Doing']);
  assert.deepEqual(extractGroupValues(new Set(['Todo', 'Doing'])), ['Todo', 'Doing']);
  assert.deepEqual(extractGroupValues({ values: ['Todo', 'Doing'] }), ['Todo', 'Doing']);
});

test('extracts serialized frontmatter lane labels', () => {
  assert.deepEqual(extractGroupValues('[Todo, "Doing"; Done]'), ['Todo', 'Doing', 'Done']);
  assert.deepEqual(extractGroupValues('Single'), ['Single']);
});

test('root task creation utilities normalize targets and build lane-matching task lines', async () => {
  const {
    buildKanbanRootTaskLine,
    getKanbanRootTaskCheckboxMarker,
    normalizeKanbanTaskTargetPath,
    resolveKanbanLaneAddPresentation,
    resolveKanbanRootTaskTargetPath,
  } = await importTaskCreationUtils();

  assert.match(taskCreationUtilsSource, /export function resolveKanbanLaneAddPresentation/);
  assert.match(viewSource, /resolveKanbanLaneAddPresentation\(laneAddMode, displayLane\.label\)/);
  assert.match(viewSource, /if \(laneAdd\.shouldCreateTask\)/);
  assert.match(viewSource, /createCommandOverride \? `Run \$\{createCommandOverride\.name\}` : laneAdd\.ariaLabel/);
  assert.match(viewSource, /createCommandOverride \? `Run \$\{createCommandOverride\.name\}` : laneAdd\.title/);
  assert.match(viewSource, /createCommandOverride \? `\+ \$\{createCommandOverride\.name\}` : laneAdd\.buttonText/);

  assert.equal(normalizeKanbanTaskTargetPath('Inbox/Tasks'), 'Inbox/Tasks.md');
  assert.equal(normalizeKanbanTaskTargetPath('[[Inbox/Tasks|Task Inbox]]'), 'Inbox/Tasks.md');
  assert.equal(normalizeKanbanTaskTargetPath('[Task Inbox](Inbox/Tasks.md#Today)'), 'Inbox/Tasks.md');
  assert.equal(resolveKanbanRootTaskTargetPath('[[Inbox/Filtered Tasks|Filtered]]', 'Inbox/Default.md'), 'Inbox/Filtered Tasks.md');
  assert.equal(resolveKanbanRootTaskTargetPath('', '[Default](Inbox/Default.md#Tasks)'), 'Inbox/Default.md');
  assert.equal(resolveKanbanRootTaskTargetPath('', ''), null);

  const checkboxForStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'next') return '[/]';
    if (normalized === 'complete') return '[x]';
    if (normalized === 'todo') return '[ ]';
    return null;
  };
  const defaults = {
    status: 'next',
    targetPath: 'Inbox/Tasks.md',
    tags: new Set(['#work', '#skip']),
    excludedTags: new Set(['#skip']),
    inlineFields: new Map([
      ['area', { key: 'area', value: 'GCP' }],
      ['status', { key: 'status', value: 'next' }],
    ]),
  };

  assert.deepEqual(resolveKanbanLaneAddPresentation('task', 'Doing'), {
    shouldCreateTask: true,
    buttonText: '+ Add task',
    title: 'Add task',
    ariaLabel: 'Add task to Doing',
  });
  assert.deepEqual(resolveKanbanLaneAddPresentation('note', ''), {
    shouldCreateTask: false,
    buttonText: '+ Add card',
    title: 'Add card',
    ariaLabel: 'Add card to lane',
  });
  assert.equal(
    getKanbanRootTaskCheckboxMarker({
      propName: 'task.status',
      laneValue: 'complete',
      defaults,
      getCheckboxStateForStatus: checkboxForStatus,
    }),
    'x',
  );
  assert.equal(
    getKanbanRootTaskCheckboxMarker({
      propName: 'task.area',
      laneValue: 'Ops',
      defaults,
      getCheckboxStateForStatus: checkboxForStatus,
    }),
    '/',
  );

  assert.equal(
    buildKanbanRootTaskLine({
      title: 'Plan rollout',
      propName: 'task.status',
      laneValue: 'complete',
      defaults,
      getCheckboxStateForStatus: checkboxForStatus,
    }),
    '- [x] Plan rollout #work [area:: GCP]',
    'lane status should win over default status and status should not be duplicated inline',
  );
  assert.equal(
    buildKanbanRootTaskLine({
      title: 'Refine scope',
      propName: 'task.tags',
      laneValue: '#deep work',
      defaults,
      getCheckboxStateForStatus: checkboxForStatus,
    }),
    '- [/] Refine scope #work #deep-work [area:: GCP]',
    'tag lanes should add a writable lane tag while retaining non-excluded filter tags',
  );
  assert.equal(
    buildKanbanRootTaskLine({
      title: 'Write summary',
      propName: 'task.area',
      laneValue: 'Ops',
      defaults,
      getCheckboxStateForStatus: checkboxForStatus,
    }),
    '- [/] Write summary #work [area:: Ops]',
    'lane inline property should win over matching Base default field',
  );
});

test('task checkbox utilities toggle mapped statuses and update only task checkbox markers', async () => {
  assert.match(taskCheckboxUtilsSource, /export function replaceKanbanTaskLineCheckboxState/);
  assert.match(viewSource, /replaceKanbanTaskLineCheckboxState\(current, nextState\)/);
  const {
    getKanbanCheckboxStateForStatus,
    getKanbanStatusForCheckboxState,
    getKanbanToggleCheckboxState,
    replaceKanbanTaskLineCheckboxState,
  } = await importTaskCheckboxUtils();
  const mappings = [
    { checkboxState: '[ ]', statuses: ['todo'], toggleTargetStatus: 'complete' },
    { checkboxState: '[x]', statuses: ['complete'], toggleTargetStatus: 'todo' },
    { checkboxState: '[/]', statuses: ['next'], toggleTargetStatus: 'complete' },
    { checkboxState: '[?]', statuses: ['holding'], toggleTargetStatus: 'todo' },
  ];

  assert.equal(getKanbanStatusForCheckboxState('[/]', mappings), 'next');
  assert.equal(getKanbanStatusForCheckboxState('[~]', mappings), 'wont-do');
  assert.equal(getKanbanCheckboxStateForStatus('next', mappings), '[/]');
  assert.equal(getKanbanCheckboxStateForStatus('working', mappings), '[\\]');
  assert.equal(getKanbanToggleCheckboxState('[/]', mappings, new Set(['complete'])), '[x]');
  assert.equal(getKanbanToggleCheckboxState('[x]', mappings, new Set(['complete'])), '[ ]');
  assert.equal(getKanbanToggleCheckboxState('[?]', mappings, new Set(['complete'])), '[ ]');
  assert.equal(getKanbanToggleCheckboxState('[!]', mappings, new Set(['complete', 'done'])), '[x]');
  assert.equal(getKanbanToggleCheckboxState('[x]', [{ checkboxState: '[x]', statuses: ['done'] }], new Set(['done'])), '[ ]');

  assert.equal(replaceKanbanTaskLineCheckboxState('- [ ] Write tests', '[x]'), '- [x] Write tests');
  assert.equal(replaceKanbanTaskLineCheckboxState('  1. [/] Ordered task [area:: GCP]', '[x]'), '  1. [x] Ordered task [area:: GCP]');
  assert.equal(replaceKanbanTaskLineCheckboxState('* [ ] Bullet marker task', 'x'), '* [x] Bullet marker task');
  assert.equal(replaceKanbanTaskLineCheckboxState('- plain bullet', '[x]'), '- plain bullet');
  assert.equal(replaceKanbanTaskLineCheckboxState('Not a task [ ] line', '[x]'), 'Not a task [ ] line');
});

test('card task previews are bounded and use source markdown labels', () => {
  assert.match(settingsSource, /openTaskPreviewLimit: 5/);
  assert.match(settingsSource, /showTaskOverflowCount: true/);
  assert.match(viewSource, /cardContent/);
  assert.match(viewSource, /private getPreviewTasksForFile\(file: TFile\): \{ tasks: OpenTaskSubitem\[\]; overflowCount: number \}/);
  assert.match(viewSource, /const allLineItems = this\.parseOpenTasks\(content, path, Number\.MAX_SAFE_INTEGER, true, true\)\.openTasks/);
  assert.match(viewSource, /const allTasks = allLineItems\.filter\(\(item\) => item\.itemKind !== 'bullet'\)/);
  assert.match(viewSource, /const localPreview = this\.selectOpenTaskPreview\(allTasks, limit\)/);
  assert.match(viewSource, /const openTasks = localPreview\.openTasks\.map/);
  assert.match(viewSource, /displayText: this\.getTaskVisibleTitle\(merged\)/);
  assert.doesNotMatch(viewSource, /displayText: enriched\?\.displayText \|\| task\.displayText/);
  assert.match(viewSource, /openTaskOverflowByPath/);
  assert.match(viewSource, /\+\$\{openTaskOverflow\} more/);
  assert.match(viewSource, /openTaskLine\(entry\.file, task\.line\)/);
});

test('one all-task parse derives the same bounded open previews as direct parsing', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  view.app = {};
  provideGcmProtocolApi(view);
  const defaultStatusByState = {
    '[ ]': 'todo',
    '[x]': 'complete',
    '[/]': 'working',
    '[-]': 'wont-do',
    '[?]': 'holding',
    '[!]': 'important',
  };
  const content = [
    '- [ ] Open parent #alpha [area:: Work]',
    '  - [x] Done child',
    '    1. [/] Working grandchild [owner:: Sam]',
    '  - [-] Cancelled child',
    '- [?] Holding task',
    '- [!] Important task',
    '- [ ] Final open task',
  ].join('\n');

  for (const scenario of [
    { doneStatuses: ['complete', 'wont-do'], statusByState: defaultStatusByState },
    {
      doneStatuses: ['complete', 'wont-do', 'working', 'holding'],
      statusByState: { ...defaultStatusByState, '[/]': 'working', '[?]': 'holding' },
    },
  ]) {
    view.getDoneStatuses = () => new Set(scenario.doneStatuses);
    view.getStatusForCheckboxState = (state) => scenario.statusByState[state] || 'todo';
    const allTasks = view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER, true).openTasks;
    for (const limit of [
      Number.NEGATIVE_INFINITY,
      -1,
      -0.5,
      0,
      0.5,
      1,
      1.9,
      5,
      20,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ]) {
      assert.deepEqual(
        view.selectOpenTaskPreview(allTasks, limit),
        view.parseOpenTasks(content, 'Inbox/Tasks.md', limit),
        `derived preview changed for limit ${String(limit)}`,
      );
    }
  }
});

test('markdown item parsing classifies each source line once in both inclusion modes', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  view.app = {};
  provideGcmProtocolApi(view);
  view.getDoneStatuses = () => new Set(['complete']);
  view.getStatusForCheckboxState = (state) => state === '[x]' ? 'complete' : 'todo';

  const content = [
    '- [ ] Parent task',
    '  - Nested bullet',
    '    - [x] Done child',
    'Paragraph resets the hierarchy',
    '  1. [/] Working task',
  ].join('\n');
  const lineCount = content.split('\n').length;
  const parseLineItem = view.parseLineItem.bind(view);
  let parseCalls = 0;
  view.parseLineItem = (...args) => {
    parseCalls += 1;
    return parseLineItem(...args);
  };

  const tasksOnly = view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER);
  assert.equal(parseCalls, lineCount);
  assert.deepEqual(
    tasksOnly.openTasks.map(({ itemKind, line, parentLine, checkboxState, text }) => ({
      itemKind,
      line,
      parentLine,
      checkboxState,
      text,
    })),
    [
      { itemKind: 'task', line: 1, parentLine: undefined, checkboxState: '[ ]', text: 'Parent task' },
      { itemKind: 'task', line: 5, parentLine: undefined, checkboxState: '[/]', text: 'Working task' },
    ],
  );

  parseCalls = 0;
  const withBullets = view.parseOpenTasks(
    content,
    'Inbox/Tasks.md',
    Number.MAX_SAFE_INTEGER,
    false,
    true,
  );
  assert.equal(parseCalls, lineCount);
  assert.deepEqual(
    withBullets.openTasks.map(({ itemKind, line, parentLine, checkboxState, text }) => ({
      itemKind,
      line,
      parentLine,
      checkboxState,
      text,
    })),
    [
      { itemKind: 'task', line: 1, parentLine: undefined, checkboxState: '[ ]', text: 'Parent task' },
      { itemKind: 'bullet', line: 2, parentLine: 1, checkboxState: undefined, text: 'Nested bullet' },
      { itemKind: 'task', line: 5, parentLine: undefined, checkboxState: '[/]', text: 'Working task' },
    ],
  );
});

test('canonical document scanning excludes protected Markdown while preserving physical nested line identities', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  view.app = {};
  view.getDoneStatuses = () => new Set(['complete']);
  view.getStatusForCheckboxState = (state) => state === '[x]' ? 'complete' : 'todo';
  const content = [
    '---',
    'kind: task',
    '---',
    '- [ ] Parent [owner:: Ada]',
    '  - Nested bullet #project',
    '    - [ ] Nested task [kind:: deep]',
    '```md',
    '- [ ] fenced fake',
    '```',
    '    - [ ] indented fake',
    '- [ ] Final task',
  ].join('\n');
  const excludedIndexes = new Set([0, 1, 2, 6, 7, 8, 9]);
  const lineMetadataMock = createLineMetadataApiMock({
    scanDocument: (source) => scanPhysicalDocumentLines(source)
      .filter((line) => !excludedIndexes.has(line.index)),
  });
  provideGcmProtocolApi(view, { lineMetadata: lineMetadataMock.api });
  const parseLineItem = view.parseLineItem.bind(view);
  view.parseLineItem = (line, ...args) => {
    assert.doesNotMatch(line, /fake/u, 'excluded source text must never reach Kanban line parsing');
    return parseLineItem(line, ...args);
  };

  const parsed = view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER, true, true);
  assert.equal(lineMetadataMock.getScanCount(), 1, 'one canonical document scan owns the discovery pass');
  assert.deepEqual(
    parsed.openTasks.map(({ itemKind, internalId, line, parentLine, text }) => ({
      itemKind,
      internalId,
      line,
      parentLine,
      text,
    })),
    [
      { itemKind: 'task', internalId: 'Inbox/Tasks.md:4', line: 4, parentLine: undefined, text: 'Parent [owner:: Ada]' },
      { itemKind: 'bullet', internalId: 'Inbox/Tasks.md:5', line: 5, parentLine: 4, text: 'Nested bullet #project' },
      { itemKind: 'task', internalId: 'Inbox/Tasks.md:6', line: 6, parentLine: 5, text: 'Nested task [kind:: deep]' },
      { itemKind: 'task', internalId: 'Inbox/Tasks.md:11', line: 11, parentLine: undefined, text: 'Final task' },
    ],
  );
  assert.deepEqual(parsed.openTasks[2].inlineFields, [{ key: 'kind', value: 'deep' }]);
  assert.equal(lineMetadataMock.getParseCount(), 4, 'each discovered item receives one canonical metadata parse');
});

test('protected document gaps break only the hierarchy level owned by their Markdown indentation', async () => {
  const { KanbanView } = await importKanbanView();
  const parseFixture = (content, excludedIndexes) => {
    const view = Object.create(KanbanView.prototype);
    view.app = {};
    view.getDoneStatuses = () => new Set(['complete']);
    view.getStatusForCheckboxState = () => 'todo';
    const lineMetadata = createLineMetadataApiMock({
      scanDocument: (source) => scanPhysicalDocumentLines(source)
        .filter((line) => !excludedIndexes.has(line.index)),
    }).api;
    provideGcmProtocolApi(view, { lineMetadata });
    return view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER, true, true).openTasks;
  };

  for (const { label, parent, fenceIndent, laterIndent } of [
    { label: 'unindented bullet fence', parent: '- [ ] Parent', fenceIndent: 0, laterIndent: 2 },
    { label: 'one-space top-level bullet fence', parent: '- [ ] Parent', fenceIndent: 1, laterIndent: 1 },
    { label: 'two-space top-level ordered fence', parent: '1. [ ] Parent', fenceIndent: 2, laterIndent: 2 },
    { label: 'three-space top-level wide-ordered fence', parent: '10. [ ] Parent', fenceIndent: 3, laterIndent: 3 },
  ]) {
    const fencePadding = ' '.repeat(fenceIndent);
    const topLevelFence = [
      parent,
      `${fencePadding}\`\`\`md`,
      `${fencePadding}- [ ] fenced fake`,
      `${fencePadding}\`\`\``,
      `${' '.repeat(laterIndent)}- [ ] Detached after fence`,
    ].join('\n');
    assert.deepEqual(
      parseFixture(topLevelFence, new Set([1, 2, 3]))
        .map(({ line, parentLine, text }) => ({ line, parentLine, text })),
      [
        { line: 1, parentLine: undefined, text: 'Parent' },
        { line: 5, parentLine: undefined, text: 'Detached after fence' },
      ],
      `${label} cannot bridge an earlier task parent to a later indented task`,
    );
  }

  const listContainedFence = [
    '- [ ] Parent',
    '  ```md',
    '  code',
    '  ```',
    '  - [ ] Legitimate child',
  ].join('\n');
  assert.deepEqual(
    parseFixture(listContainedFence, new Set([1, 2, 3]))
      .map(({ line, parentLine, text }) => ({ line, parentLine, text })),
    [
      { line: 1, parentLine: undefined, text: 'Parent' },
      { line: 5, parentLine: 1, text: 'Legitimate child' },
    ],
    'a list-contained protected block preserves its legitimate outer list parent',
  );

  const orderedListContainedFence = [
    '10. [ ] Parent',
    '    ```md',
    '    code',
    '    ```',
    '    - [ ] Legitimate child',
  ].join('\n');
  assert.deepEqual(
    parseFixture(orderedListContainedFence, new Set([1, 2, 3]))
      .map(({ line, parentLine, text }) => ({ line, parentLine, text })),
    [
      { line: 1, parentLine: undefined, text: 'Parent' },
      { line: 5, parentLine: 1, text: 'Legitimate child' },
    ],
    'wide ordered markers preserve blocks and children at their true continuation indentation',
  );
});

test('canonical CR-only descriptors preserve physical identities and hierarchy', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  view.app = {};
  view.getDoneStatuses = () => new Set(['complete']);
  view.getStatusForCheckboxState = () => 'todo';
  const lineMetadataMock = createLineMetadataApiMock();
  provideGcmProtocolApi(view, { lineMetadata: lineMetadataMock.api });
  const content = '- [ ] Parent\r  - [ ] Child\r- [ ] Tail';

  const tasks = view.parseOpenTasks(content, 'Inbox/CR.md', Number.MAX_SAFE_INTEGER, true, true).openTasks;
  assert.deepEqual(
    tasks.map(({ internalId, line, parentLine, text }) => ({ internalId, line, parentLine, text })),
    [
      { internalId: 'Inbox/CR.md:1', line: 1, parentLine: undefined, text: 'Parent' },
      { internalId: 'Inbox/CR.md:2', line: 2, parentLine: 1, text: 'Child' },
      { internalId: 'Inbox/CR.md:3', line: 3, parentLine: undefined, text: 'Tail' },
    ],
  );
  assert.equal(lineMetadataMock.getScanCount(), 1);
});

test('task and bullet discovery fails closed without a complete document-scanning contract', async (t) => {
  const { KanbanView } = await importKanbanView();
  const createView = () => {
    const view = Object.create(KanbanView.prototype);
    view.app = {};
    view.getDoneStatuses = () => new Set(['complete']);
    view.getStatusForCheckboxState = () => 'todo';
    return view;
  };
  const content = '- [ ] Must not be synthesized';

  await t.test('missing scanDocument rejects the advertised v1 snapshot and deduplicates the diagnostic', () => {
    globalThis.__KanbanFormulaNotices = [];
    const view = createView();
    const incompleteLineMetadata = { ...createLineMetadataApiMock().api };
    delete incompleteLineMetadata.scanDocument;
    provideGcmProtocolApi(view, { lineMetadata: incompleteLineMetadata });
    let parseCalls = 0;
    view.parseLineItem = () => { parseCalls += 1; return null; };
    assert.deepEqual(view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER), { openTasks: [], overflowCount: 0 });
    assert.deepEqual(view.parseOpenTasks(content, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER), { openTasks: [], overflowCount: 0 });
    assert.equal(parseCalls, 0, 'an incomplete API cannot trigger raw-line discovery');
    assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
    assert.match(globalThis.__KanbanFormulaNotices[0], /document scanning is required/i);
  });

  for (const [label, source, mutateApi, expectedMessage] of [
    [
      'throwing scanner',
      content,
      (api) => { api.scanDocument = () => { throw new Error('document scan failed'); }; },
      /document scan failed/i,
    ],
    [
      'invalid coordinates',
      content,
      (api) => { api.scanDocument = () => [{ index: 0, lineNumber: 1, text: 'wrong', start: 0, end: 5 }]; },
      /inconsistent physical document line coordinates/i,
    ],
    [
      'mislabeled physical index',
      `Heading\n${content}`,
      (api) => {
        api.scanDocument = (source) => [{
          index: 0,
          lineNumber: 1,
          text: content,
          start: 'Heading\n'.length,
          end: source.length,
        }];
      },
      /inconsistent physical document line coordinates/i,
    ],
    [
      'CRLF-half descriptor',
      `${content}\r\nTail`,
      (api) => {
        api.scanDocument = () => [{
          index: 0,
          lineNumber: 1,
          text: `${content}\r`,
          start: 0,
          end: content.length + 1,
        }];
      },
      /inconsistent physical document line coordinates/i,
    ],
    [
      'throwing metadata parser',
      content,
      (api) => { api.parseLine = () => { throw new Error('line metadata parse failed'); }; },
      /line metadata parse failed/i,
    ],
  ]) {
    await t.test(label, () => {
      globalThis.__KanbanFormulaNotices = [];
      const view = createView();
      const lineMetadata = createLineMetadataApiMock().api;
      mutateApi(lineMetadata);
      provideGcmProtocolApi(view, { lineMetadata });
      assert.deepEqual(view.parseOpenTasks(source, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER), { openTasks: [], overflowCount: 0 });
      assert.deepEqual(view.parseOpenTasks(source, 'Inbox/Tasks.md', Number.MAX_SAFE_INTEGER), { openTasks: [], overflowCount: 0 });
      assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'document-level failures remain visible and deduplicated');
      assert.match(globalThis.__KanbanFormulaNotices[0], expectedMessage);
    });
  }
  delete globalThis.__KanbanFormulaNotices;
});

test('task preview reads reject stale owners and deduplicate bullet work', async (t) => {
  const { KanbanView } = await importKanbanView();

  await t.test('one cold task read performs one parser pass', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const file = { path: 'Inbox/One Pass.md' };
    harness.filesByPath.set(file.path, file);
    harness.view.loadOpenTasksForFile(file);
    harness.pendingReads[0].gate.resolve('one-pass');
    await flushDeferredWork();

    assert.equal(harness.parseCount(), 1);
    assert.equal(harness.view.openTasksByPath.get(file.path)?.[0]?.text, 'one-pass');
    assert.equal(harness.view.allTasksByPath.get(file.path)?.[0]?.text, 'one-pass');
    assert.equal(harness.refreshCount(), 1);
  });

  await t.test('a modify can start a fresh read and the older success cannot overwrite it', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const file = { path: 'Inbox/Tasks.md' };
    harness.filesByPath.set(file.path, file);

    harness.view.loadOpenTasksForFile(file);
    harness.view.clearTaskCachesForPath(file.path);
    harness.view.loadOpenTasksForFile(file);
    assert.equal(harness.pendingReads.length, 2);

    harness.pendingReads[1].gate.resolve('new');
    await flushDeferredWork();
    assert.equal(harness.view.openTasksByPath.get(file.path)?.[0]?.text, 'new');

    harness.pendingReads[0].gate.resolve('old');
    await flushDeferredWork();
    assert.equal(harness.view.openTasksByPath.get(file.path)?.[0]?.text, 'new');
    assert.equal(harness.view.taskReadsInFlight.size, 0);
    assert.equal(harness.refreshCount(), 1);
  });

  await t.test('rename and same-path replacement cannot leak owners or task caches', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const oldPath = 'Inbox/Tasks.md';
    const newPath = 'Inbox/Renamed Tasks.md';
    const original = { path: oldPath };
    harness.filesByPath.set(oldPath, original);
    harness.view.loadOpenTasksForFile(original);

    original.path = newPath;
    harness.filesByPath.delete(oldPath);
    harness.filesByPath.set(newPath, original);
    harness.view.clearTaskCachesForPath(oldPath);
    harness.view.clearTaskCachesForPath(newPath);

    const replacement = { path: oldPath };
    harness.filesByPath.set(oldPath, replacement);
    harness.view.loadOpenTasksForFile(replacement);
    assert.equal(harness.pendingReads.length, 2);

    harness.pendingReads[1].gate.resolve('replacement');
    await flushDeferredWork();
    harness.pendingReads[0].gate.resolve('renamed-stale');
    await flushDeferredWork();

    assert.equal(harness.view.openTasksByPath.get(oldPath)?.[0]?.text, 'replacement');
    assert.equal(harness.view.openTasksByPath.has(newPath), false);
    assert.equal(harness.view.taskReadsInFlight.size, 0);
    assert.equal(harness.refreshCount(), 1);
  });

  await t.test('delete and recreate at one path never inherits a pending read', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const path = 'Inbox/Reused.md';
    const deleted = { path };
    harness.filesByPath.set(path, deleted);
    harness.view.loadOpenTasksForFile(deleted);

    harness.filesByPath.delete(path);
    harness.view.clearTaskCachesForPath(path);
    const replacement = { path };
    harness.filesByPath.set(path, replacement);
    harness.view.loadOpenTasksForFile(replacement);
    assert.equal(harness.pendingReads.length, 2);

    harness.pendingReads[1].gate.resolve('replacement');
    await flushDeferredWork();
    harness.pendingReads[0].gate.resolve('deleted-stale');
    await flushDeferredWork();

    assert.equal(harness.view.openTasksByPath.get(path)?.[0]?.text, 'replacement');
    assert.equal(harness.view.taskReadsInFlight.size, 0);
  });

  await t.test('one hundred pending bullet requests perform one read', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const file = { path: 'Inbox/Bullets.md' };
    harness.filesByPath.set(file.path, file);
    const filter = { mode: 'bullets' };

    for (let index = 0; index < 100; index += 1) {
      assert.deepEqual(harness.view.getAllLineItemsForFile(file, filter), []);
    }
    assert.equal(harness.pendingReads.length, 1);

    harness.pendingReads[0].gate.resolve('bullet');
    await flushDeferredWork();
    assert.equal(
      harness.view.getAllLineItemsForFile(file, filter)[0]?.text,
      'bullet',
    );
    assert.equal(harness.pendingReads.length, 1);
    assert.equal(harness.refreshCount(), 1);
  });

  await t.test('a stale failure cannot replace a newer success with empty caches', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const file = { path: 'Inbox/Failure.md' };
    harness.filesByPath.set(file.path, file);
    harness.view.loadOpenTasksForFile(file);
    harness.view.clearTaskCachesForPath(file.path);
    harness.view.loadOpenTasksForFile(file);
    assert.equal(harness.pendingReads.length, 2);

    harness.pendingReads[1].gate.resolve('new');
    await flushDeferredWork();
    harness.pendingReads[0].gate.reject(new Error('stale read failed'));
    await flushDeferredWork();

    assert.equal(harness.view.openTasksByPath.get(file.path)?.[0]?.text, 'new');
    assert.equal(harness.view.allTasksByPath.get(file.path)?.[0]?.text, 'new');
    assert.equal(harness.refreshCount(), 1);
  });

  await t.test('line read failures remain not-ready and recover after bounded backoff', async () => {
    const taskHarness = createTaskReadHarness(KanbanView);
    const taskFile = { path: 'Inbox/Task Failure.md' };
    taskHarness.filesByPath.set(taskFile.path, taskFile);
    taskHarness.view.loadOpenTasksForFile(taskFile);
    taskHarness.pendingReads[0].gate.reject(new Error('task read failed'));
    await flushDeferredWork();
    assert.equal(taskHarness.view.openTasksByPath.has(taskFile.path), false);
    assert.equal(taskHarness.view.allTasksByPath.has(taskFile.path), false);
    assert.equal(taskHarness.view.openTaskOverflowByPath.has(taskFile.path), false);
    assert.equal(taskHarness.view.taskReadFailures.get(`lines:${taskFile.path}`)?.attempts, 1);
    assert.equal(taskHarness.refreshCount(), 1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    taskHarness.view.loadOpenTasksForFile(taskFile);
    assert.equal(taskHarness.pendingReads.length, 2);
    taskHarness.pendingReads[1].gate.resolve('recovered');
    await flushDeferredWork();
    assert.equal(taskHarness.view.openTasksByPath.get(taskFile.path)?.[0]?.text, 'recovered');
    assert.equal(taskHarness.view.allTasksByPath.get(`${taskFile.path}:bullets`)?.[1]?.itemKind, 'bullet');
    assert.equal(taskHarness.view.taskReadFailures.has(`lines:${taskFile.path}`), false);

    const sharedHarness = createTaskReadHarness(KanbanView);
    const bulletFile = { path: 'Inbox/Shared Read.md' };
    sharedHarness.filesByPath.set(bulletFile.path, bulletFile);
    const filter = { mode: 'bullets' };
    sharedHarness.view.loadOpenTasksForFile(bulletFile);
    sharedHarness.view.getAllLineItemsForFile(bulletFile, filter);
    assert.equal(sharedHarness.pendingReads.length, 1, 'task preview and bullet rows share one cold source read');
    sharedHarness.pendingReads[0].gate.resolve('shared');
    await flushDeferredWork();
    assert.equal(sharedHarness.view.allTasksByPath.get(bulletFile.path)?.[0]?.text, 'shared');
    assert.equal(sharedHarness.view.getAllLineItemsForFile(bulletFile, filter)?.[1]?.itemKind, 'bullet');
    assert.equal(sharedHarness.parseCount(), 1, 'the shared source is parsed once');
  });

  await t.test('vault-wide bullet reads repaint once after the whole batch settles', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const files = Array.from({ length: 4 }, (_, index) => ({ path: `Inbox/Bullet Batch ${index}.md` }));
    for (const file of files) {
      harness.filesByPath.set(file.path, file);
      harness.view.getAllLineItemsForFile(file, { mode: 'bullets' });
    }
    assert.equal(harness.pendingReads.length, files.length);

    harness.pendingReads[1].gate.resolve('second');
    harness.pendingReads[0].gate.resolve('first');
    harness.pendingReads[2].gate.reject(new Error('bounded batch failure'));
    await flushDeferredWork();
    assert.equal(harness.refreshCount(), 0, 'partial batches never repaint');

    harness.pendingReads[3].gate.resolve('last');
    await flushDeferredWork();
    assert.equal(harness.refreshCount(), 1);
    assert.equal(harness.view.allTasksByPath.has(`${files[2].path}:bullets`), false);
    assert.equal(harness.view.taskReadFailures.get(`lines:${files[2].path}`)?.attempts, 1);
  });

  await t.test('global cold reads cap concurrency and repaint only after the queued batch settles', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const files = Array.from({ length: 20 }, (_, index) => ({ path: `Inbox/Queued ${index}.md` }));
    for (const file of files) {
      harness.filesByPath.set(file.path, file);
      harness.view.getAllLineItemsForFile(file, { mode: 'bullets' });
    }
    assert.equal(harness.pendingReads.length, 8, 'only the configured read window starts immediately');
    assert.equal(harness.view.taskReadQueue.length, 12);

    for (const pending of harness.pendingReads.slice(0, 8)) pending.gate.resolve(pending.file.path);
    await flushDeferredWork();
    assert.equal(harness.pendingReads.length, 16);
    assert.equal(harness.refreshCount(), 0);

    for (const pending of harness.pendingReads.slice(8, 16)) pending.gate.resolve(pending.file.path);
    await flushDeferredWork();
    assert.equal(harness.pendingReads.length, 20);
    assert.equal(harness.refreshCount(), 0);

    for (const pending of harness.pendingReads.slice(16)) pending.gate.resolve(pending.file.path);
    await flushDeferredWork();
    assert.equal(harness.refreshCount(), 1);
    assert.equal(harness.parseCount(), 20);
  });

  await t.test('persistent line read failures stop at the retry bound and file invalidation resets them', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const file = { path: 'Inbox/Persistent Failure.md' };
    harness.filesByPath.set(file.path, file);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      harness.view.loadOpenTasksForFile(file);
      harness.pendingReads[attempt].gate.reject(new Error(`failure ${attempt + 1}`));
      await flushDeferredWork();
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const terminal = harness.view.taskReadFailures.get(`lines:${file.path}`);
    assert.equal(terminal?.attempts, 3);
    assert.equal(terminal?.exhausted, true);
    assert.equal(harness.view.taskReadRetryTimer, null);
    await new Promise((resolve) => setTimeout(resolve, 5));
    harness.view.loadOpenTasksForFile(file);
    assert.equal(harness.pendingReads.length, 3, 'terminal failure does not loop reads');

    harness.view.clearTaskCachesForPath(file.path);
    assert.equal(harness.view.taskReadFailures.has(`lines:${file.path}`), false);
    harness.view.loadOpenTasksForFile(file);
    assert.equal(harness.pendingReads.length, 4, 'file invalidation permits a fresh snapshot attempt');
    harness.pendingReads[3].gate.resolve('after-modify');
    await flushDeferredWork();
    assert.equal(harness.view.allTasksByPath.get(file.path)?.[0]?.text, 'after-modify');
  });

  await t.test('cache teardown blocks late commits, repaints, and replacement reads', async () => {
    const harness = createTaskReadHarness(KanbanView);
    const first = { path: 'Folder/First.md' };
    const second = { path: 'Folder/Second.md' };
    harness.filesByPath.set(first.path, first);
    harness.filesByPath.set(second.path, second);
    harness.view.loadOpenTasksForFile(first);
    harness.view.getAllLineItemsForFile(second, { mode: 'bullets' });
    assert.equal(harness.pendingReads.length, 2);

    harness.view.isViewLoaded = false;
    harness.view.clearAllTaskCaches();
    harness.pendingReads[0].gate.resolve('late-task');
    harness.pendingReads[1].gate.resolve('late-bullet');
    await flushDeferredWork();
    harness.view.loadOpenTasksForFile(first);
    harness.view.getAllLineItemsForFile(second, { mode: 'bullets' });

    assert.equal(harness.view.openTasksByPath.size, 0);
    assert.equal(harness.view.allTasksByPath.size, 0);
    assert.equal(harness.view.openTaskOverflowByPath.size, 0);
    assert.equal(harness.view.taskReadsInFlight.size, 0);
    assert.equal(harness.pendingReads.length, 2);
    assert.equal(harness.refreshCount(), 0);
  });

  assert.match(viewSource, /onload\(\): void \{\s*this\.isViewLoaded = true/);
  assert.match(viewSource, /onunload\(\): void \{\s*this\.isViewLoaded = false;\s*this\.clearAllTaskCaches\(\)/);
  assert.match(viewSource, /private render\(preserveScroll = true\): void \{\s*if \(!this\.isViewLoaded\) return/);
  assert.match(viewSource, /vault\.on\('create', \(file\) => \{\s*if \(!\(file instanceof TFile\)\) return/);
  assert.match(viewSource, /vault\.on\('rename', \(file, oldPath\) =>/);
  assert.match(viewSource, /this\.clearTaskCachesForPath\(oldPath\)/);
  assert.match(viewSource, /this\.clearTaskCachesForPath\(file\.path\)/);
  assert.match(viewSource, /this\.clearAllTaskCaches\(\)/);
});

test('task titles hide inline metadata in kanban views', () => {
  assert.match(viewSource, /private stripTaskHiddenMetadata\(text: string\): string/);
  assert.ok(viewSource.includes('%%\\s*tps-inline-props'));
  assert.match(viewSource, /private getTaskVisibleTitle\(task: Pick<OpenTaskSubitem, 'displayText' \| 'text'>\): string/);
  assert.ok(viewSource.includes(".replace(/(^|\\s)#[\\p{L}\\p{N}/_-]+/gu, ' ')"));
  assert.match(viewSource, /const taskTitle = this\.getTaskVisibleTitle\(task\)/);
  assert.match(viewSource, /text: taskTitle/);
  assert.match(viewSource, /'aria-label': `Toggle task: \$\{taskTitle\}`/);
  assert.doesNotMatch(viewSource, /text: task\.displayText \|\| task\.text/);
  assert.doesNotMatch(viewSource, /'aria-label': `Toggle task: \$\{task\.displayText \|\| task\.text\}`/);
});

test('card summaries do not fall back to task text', () => {
  assert.match(viewSource, /private getCardSummary\(\s*entry: BasesEntry,\s*frontmatter: Record<string, unknown> \| undefined,\s*\): string/);
  assert.match(viewSource, /const summaryKeys = \['summary', 'description', 'details', 'notes'\]/);
  assert.match(viewSource, /const summary = this\.getCardSummary\(entry, fm\)/);
  assert.doesNotMatch(viewSource, /firstOpenTask/);
  assert.doesNotMatch(viewSource, /getCardSummary\(entry, fm, openTasks\)/);
});

test('frontmatter color is card-only until explicit icon color behavior exists', () => {
  assert.match(settingsSource, /frontmatterColorTarget: 'card'/);
  assert.match(viewSource, /const colorTarget = settings\.frontmatterColorTarget \|\| 'card'/);
  assert.match(viewSource, /cardEl\.style\.setProperty\('--tps-card-color', colorValue\)/);
  assert.doesNotMatch(viewSource, /--tps-card-icon-color/);
  assert.match(viewSource, /private resolveTaskCardStyleRule\(file: TFile, task: OpenTaskSubitem/);
  assert.match(settingsSource, /DEFAULT_PRIORITY_CARD_STYLE_RULES/);
});

test('card style rules short-circuit condition evaluation for notes and tasks', async () => {
  const { KanbanView } = await importKanbanView();
  const trueCondition = { field: 'state', operator: 'is', value: 'ready' };
  const falseCondition = { field: 'state', operator: 'is', value: 'blocked' };

  const createResolver = (kind) => {
    const view = Object.create(KanbanView.prototype);
    const lineMetadataApi = createLineMetadataApiMock().api;
    let activeFrontmatter = { state: 'ready', owner: 'frontmatter-owner' };
    view.plugin = { settings: { cardStyleRules: [] } };
    view.app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: activeFrontmatter }),
      },
    };
    provideGcmProtocolApi(view, { lineMetadata: lineMetadataApi });
    view.getStatusForCheckboxState = (state) => state === '[/]' ? 'working' : 'todo';
    const evaluateCondition = view.evaluateStyleCondition.bind(view);
    let conditionCalls = 0;
    view.evaluateStyleCondition = (...args) => {
      conditionCalls += 1;
      return evaluateCondition(...args);
    };

    return (rules, taskOverrides = {}) => {
      view.plugin.settings.cardStyleRules = rules;
      activeFrontmatter = {
        state: 'ready',
        owner: 'frontmatter-owner',
        ...(kind === 'note' ? taskOverrides : {}),
      };
      conditionCalls = 0;
      const matchedRule = kind === 'note'
        ? view.resolveCardStyleRule(activeFrontmatter, {
          file: { path: 'Inbox/Note.md', name: 'Note.md', basename: 'Note', extension: 'md' },
          getValue: () => undefined,
        }, null)
        : view.resolveTaskCardStyleRule(
          { path: 'Inbox/Task.md' },
          {
            itemKind: 'task',
            checkboxState: '[ ]',
            inlineFields: [],
            rawLine: '- [ ] Task',
            text: 'Task',
            ...taskOverrides,
          },
          null,
        );
      return { matchedRule, conditionCalls };
    };
  };

  const rule = (id, match, conditions, active = true) => ({
    id,
    active,
    match,
    conditions,
  });

  for (const kind of ['note', 'task']) {
    const resolve = createResolver(kind);
    const cases = [
      { id: 'any-continue-match', match: 'any', conditions: [falseCondition, trueCondition], matches: true, calls: 2 },
      { id: 'any-worst-null', match: 'any', conditions: [falseCondition, falseCondition], matches: false, calls: 2 },
      { id: 'all-continue-null', match: 'all', conditions: [trueCondition, falseCondition], matches: false, calls: 2 },
      { id: 'all-worst-match', match: 'all', conditions: [trueCondition, trueCondition], matches: true, calls: 2 },
      { id: 'any-short-match', match: 'any', conditions: [trueCondition, falseCondition], matches: true, calls: 1 },
      { id: 'all-short-null', match: 'all', conditions: [falseCondition, trueCondition], matches: false, calls: 1 },
    ];

    for (const testCase of cases) {
      const testedRule = rule(`${kind}-${testCase.id}`, testCase.match, testCase.conditions);
      const result = resolve([testedRule]);
      assert.equal(
        result.matchedRule,
        testCase.matches ? testedRule : null,
        `${kind} ${testCase.id} result`,
      );
      assert.equal(result.conditionCalls, testCase.calls, `${kind} ${testCase.id} calls`);
    }

    const firstRule = rule(`${kind}-first`, 'any', [trueCondition]);
    const laterRule = rule(`${kind}-later`, 'any', [trueCondition]);
    const firstMatch = resolve([firstRule, laterRule]);
    assert.equal(firstMatch.matchedRule, firstRule, `${kind} returns the exact first matching rule`);
    assert.equal(firstMatch.conditionCalls, 1, `${kind} stops before later matching rules`);

    const finalRule = rule(`${kind}-after-skips`, 'all', [trueCondition]);
    const afterSkips = resolve([
      rule(`${kind}-inactive`, 'any', [trueCondition], false),
      rule(`${kind}-empty`, 'any', []),
      rule(`${kind}-non-array`, 'any', 'not-an-array'),
      finalRule,
    ]);
    assert.equal(afterSkips.matchedRule, finalRule, `${kind} skips inactive and invalid rules`);
    assert.equal(afterSkips.conditionCalls, 1, `${kind} does not evaluate skipped rules`);

    const undefinedMatch = rule(`${kind}-undefined-match`, undefined, [trueCondition, trueCondition]);
    const undefinedResult = resolve([undefinedMatch]);
    assert.equal(undefinedResult.matchedRule, undefinedMatch, `${kind} undefined match remains all`);
    assert.equal(undefinedResult.conditionCalls, 2, `${kind} undefined match checks every all condition`);

    const bogusMatch = rule(`${kind}-bogus-match`, 'bogus', [trueCondition, falseCondition]);
    const bogusResult = resolve([bogusMatch]);
    assert.equal(bogusResult.matchedRule, null, `${kind} unsupported match remains all`);
    assert.equal(bogusResult.conditionCalls, 2, `${kind} unsupported match preserves all continuation`);
  }

  const resolveTask = createResolver('task');
  const taskDataRule = rule('task-frontmatter-inline-status', 'all', [
    { field: 'owner', operator: 'is', value: 'frontmatter-owner' },
    { field: 'state', operator: 'is', value: 'inline-ready' },
    { field: 'status', operator: 'is', value: 'working' },
    { field: 'kind', operator: 'is', value: 'task' },
  ]);
  const taskDataResult = resolveTask([taskDataRule], {
    checkboxState: '[/]',
    inlineFields: [{ key: 'state', value: 'inline-ready' }],
  });
  assert.equal(taskDataResult.matchedRule, taskDataRule);
  assert.equal(taskDataResult.conditionCalls, 4);

  const explicitTaskKindRule = rule('task-explicit-kind', 'all', [
    { field: 'kind', operator: 'is', value: 'task' },
    { field: 'kind', operator: 'is', value: 'project' },
  ]);
  assert.equal(resolveTask([explicitTaskKindRule], {
    rawLine: '- [ ] Task [kind:: project]',
  }).matchedRule, explicitTaskKindRule, 'task style kind uses structural and explicit membership');

  const resolveNote = createResolver('note');
  const additiveNoteKindRule = rule('note-additive-kind', 'all', [
    { field: 'kind', operator: 'is', value: 'note' },
    { field: 'kind', operator: 'is', value: 'task' },
  ]);
  assert.equal(resolveNote([additiveNoteKindRule], { kind: 'task' }).matchedRule, additiveNoteKindRule, 'note style kind preserves structural note plus frontmatter kind');
});

test('settings normalization preserves an explicit empty style-rule list and every supported color target', async () => {
  assert.match(mainSource, /frontmatterColorTarget: normalizeFrontmatterColorTarget\(stored\.frontmatterColorTarget\)/);
  assert.match(mainSource, /cardStyleRules: normalizeCardStyleRules\(stored\.cardStyleRules\)/);
  const settings = await importKanbanSettings();
  assert.deepEqual(settings.normalizeCardStyleRules([]), []);
  assert.equal(settings.normalizeCardStyleRules(undefined).length, settings.DEFAULT_PRIORITY_CARD_STYLE_RULES.length);
  assert.deepEqual(settings.normalizeCardStyleRules([{
    label: 'Custom',
    active: false,
    match: 'any',
    conditions: [{ field: ' priority ', operator: 'contains', value: 2 }],
  }]), [{
    id: undefined,
    label: 'Custom',
    active: false,
    match: 'any',
    conditions: [{ field: 'priority', operator: 'contains', value: '2' }],
    color: '',
    icon: '',
    textStyle: '',
  }]);

  for (const target of ['off', 'card', 'icon', 'both']) {
    assert.equal(settings.normalizeFrontmatterColorTarget(target), target);
  }
  assert.equal(settings.normalizeFrontmatterColorTarget('unsupported'), 'card');
});

test('settings persistence merges local keys into the latest raw data without adopting remote keys as intent', async () => {
  const { SettingsPersistenceCoordinator } = await importKanbanSettingsPersistence();
  let disk = {
    localChoice: 'old',
    remoteChoice: 'remote-before-save',
    settingsVersion: 99,
    futurePayload: { keep: true },
  };
  const live = { localChoice: 'old', remoteChoice: 'old' };
  const normalize = (stored) => ({
    localChoice: String(stored.localChoice || ''),
    remoteChoice: String(stored.remoteChoice || ''),
  });
  const reconcile = (requested, persisted) => {
    for (const key of Object.keys(persisted)) {
      if (JSON.stringify(live[key]) === JSON.stringify(requested[key])) live[key] = persisted[key];
    }
  };
  const coordinator = new SettingsPersistenceCoordinator({
    loadLatest: async () => structuredClone(disk),
    saveMerged: async (merged) => { disk = structuredClone(merged); },
    normalize,
    onPersisted: reconcile,
  }, structuredClone(live));

  live.localChoice = 'local-one';
  await coordinator.request(live);
  assert.deepEqual(disk, {
    localChoice: 'local-one',
    remoteChoice: 'remote-before-save',
    settingsVersion: 99,
    futurePayload: { keep: true },
  });
  assert.equal(live.remoteChoice, 'remote-before-save');

  disk.remoteChoice = 'remote-after-save';
  disk.futurePayload = { keep: true, addedRemotely: true };
  live.localChoice = 'local-two';
  await coordinator.request(live);
  assert.equal(disk.localChoice, 'local-two');
  assert.equal(disk.remoteChoice, 'remote-after-save');
  assert.deepEqual(disk.futurePayload, { keep: true, addedRemotely: true });
});

test('settings persistence durably applies an old-new-old revert queued during an active write', async () => {
  const { SettingsPersistenceCoordinator } = await importKanbanSettingsPersistence();
  let disk = { mode: 'old' };
  const firstSaveStarted = deferred();
  const releaseFirstSave = deferred();
  const secondSaveStarted = deferred();
  const releaseSecondSave = deferred();
  const writes = [];
  const coordinator = new SettingsPersistenceCoordinator({
    loadLatest: async () => structuredClone(disk),
    saveMerged: async (merged) => {
      writes.push(structuredClone(merged));
      if (writes.length === 1) {
        firstSaveStarted.resolve();
        await releaseFirstSave.promise;
      } else {
        secondSaveStarted.resolve();
        await releaseSecondSave.promise;
      }
      disk = structuredClone(merged);
    },
    normalize: (stored) => ({ mode: String(stored.mode || '') }),
  }, { mode: 'old' });

  const first = coordinator.request({ mode: 'new' });
  await firstSaveStarted.promise;
  let revertResolved = false;
  const revert = coordinator.request({ mode: 'old' }).then(() => { revertResolved = true; });
  releaseFirstSave.resolve();
  await secondSaveStarted.promise;
  assert.equal(revertResolved, false, 'the revert caller must wait for the second durable write');
  releaseSecondSave.resolve();
  await Promise.all([first, revert]);

  assert.deepEqual(writes.map((write) => write.mode), ['new', 'old']);
  assert.equal(disk.mode, 'old');
});

test('a pending newest settings snapshot supersedes a failed active write for every waiter', async () => {
  const { SettingsPersistenceCoordinator } = await importKanbanSettingsPersistence();
  let disk = { first: 'old', second: 'old' };
  const firstSaveStarted = deferred();
  const releaseFailedSave = deferred();
  let attempts = 0;
  const coordinator = new SettingsPersistenceCoordinator({
    loadLatest: async () => structuredClone(disk),
    saveMerged: async (merged) => {
      attempts += 1;
      if (attempts === 1) {
        firstSaveStarted.resolve();
        await releaseFailedSave.promise;
        throw new Error('synthetic first-write failure');
      }
      disk = structuredClone(merged);
    },
    normalize: (stored) => ({
      first: String(stored.first || ''),
      second: String(stored.second || ''),
    }),
  }, { first: 'old', second: 'old' });

  const first = coordinator.request({ first: 'new', second: 'old' });
  await firstSaveStarted.promise;
  const newest = coordinator.request({ first: 'new', second: 'newest' });
  releaseFailedSave.resolve();
  await Promise.all([first, newest]);

  assert.equal(attempts, 2);
  assert.deepEqual(disk, { first: 'new', second: 'newest' });
});

test('failed settings intent is retained for an explicit same-snapshot retry', async () => {
  const { SettingsPersistenceCoordinator } = await importKanbanSettingsPersistence();
  let disk = { mode: 'old' };
  let attempts = 0;
  const coordinator = new SettingsPersistenceCoordinator({
    loadLatest: async () => structuredClone(disk),
    saveMerged: async (merged) => {
      attempts += 1;
      if (attempts === 1) throw new Error('synthetic write failure');
      disk = structuredClone(merged);
    },
    normalize: (stored) => ({ mode: String(stored.mode || '') }),
  }, { mode: 'old' });

  await assert.rejects(coordinator.request({ mode: 'new' }), /synthetic write failure/);
  await coordinator.request({ mode: 'new' });
  assert.equal(attempts, 2);
  assert.equal(disk.mode, 'new');
});

test('a settings request made in the persistence completion callback is not stranded', async () => {
  const { SettingsPersistenceCoordinator } = await importKanbanSettingsPersistence();
  let disk = { mode: 'old' };
  let live = { mode: 'old' };
  let completionRequest;
  const writes = [];
  let coordinator;
  coordinator = new SettingsPersistenceCoordinator({
    loadLatest: async () => structuredClone(disk),
    saveMerged: async (merged) => {
      writes.push(structuredClone(merged));
      disk = structuredClone(merged);
    },
    normalize: (stored) => ({ mode: String(stored.mode || '') }),
    onPersisted: (_requested, persisted) => {
      if (persisted.mode === 'first' && !completionRequest) {
        live = { mode: 'second' };
        completionRequest = coordinator.request(live);
      }
    },
  }, live);

  live = { mode: 'first' };
  await coordinator.request(live);
  await completionRequest;
  assert.deepEqual(writes.map((write) => write.mode), ['first', 'second']);
  assert.equal(disk.mode, 'second');
});

test('kanban cards own their layout so task previews expand below metadata', () => {
  assert.doesNotMatch(viewSource, /className\s*=\s*['"]tps-kanban-card bases-feed-entry['"]/);
  assert.match(stylesSource, /\.tps-kanban-card\s*\{[\s\S]*display:\s*flex;/);
  assert.match(stylesSource, /\.tps-kanban-card\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(stylesSource, /\.tps-kanban-card\s*\{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(stylesSource, /\.tps-kanban-card\s*\{[\s\S]*height:\s*auto\s*!important;/);
  assert.match(stylesSource, /\.tps-kanban-card-tasks\s*\{[\s\S]*width:\s*100%;/);
  assert.match(stylesSource, /\.tps-kanban-card-tasks\s*\{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(stylesSource, /\.tps-kanban-card-subitems\s*\{[\s\S]*flex:\s*0 0 auto;/);
});

test('kanban lanes clip horizontal overflow instead of scrolling sideways', () => {
  assert.match(stylesSource, /\.tps-kanban-lane\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.match(stylesSource, /\.tps-kanban-cards\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.match(stylesSource, /\.tps-kanban-card\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(stylesSource, /\.tps-kanban-card-property\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-text\s*\{[\s\S]*text-overflow:clip;/);
});

test('kanban scale drives board lane dimensions', () => {
  assert.match(stylesSource, /--tps-kanban-scale:\s*1;/);
  assert.match(stylesSource, /--tps-kanban-lane-width:\s*clamp\(/);
  assert.match(stylesSource, /calc\(260px \* var\(--tps-kanban-scale\)\)/);
  assert.match(stylesSource, /grid-auto-columns:\s*var\(--tps-kanban-lane-width\)/);
  assert.match(stylesSource, /gap:\s*calc\(12px \* var\(--tps-kanban-scale\)\)/);
});

test('list lane headers keep controls on one row', () => {
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-lane-header\s*\{[\s\S]*grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto auto auto auto;/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-lane-collapse\s*\{[\s\S]*grid-row:\s*1;/);
});

test('list mode scale affects row density', () => {
  assert.match(stylesSource, /\.tps-kanban-board--list\s*\{[\s\S]*gap:\s*max\(6px, calc\(12px \* var\(--tps-kanban-scale\)\)\);/);
  assert.match(stylesSource, /\.tps-kanban-board--list \.tps-kanban-card\s*\{[\s\S]*min-height:\s*max\(44px, calc\(88px \* var\(--tps-kanban-scale\)\)\);/);
  assert.match(stylesSource, /\.tps-kanban-board--list \.tps-kanban-card\s*\{[\s\S]*padding:\s*max\(6px, calc\(11px \* var\(--tps-kanban-scale\)\)\);/);
  assert.match(stylesSource, /\.tps-kanban-board--list \.tps-kanban-card\s*\{[\s\S]*font-size:\s*max\(12px, calc\(13px \* var\(--tps-kanban-scale\)\)\);/);
});

test('wide list cards place properties beside title with summary below', () => {
  assert.match(viewSource, /private getCardSummary\(/);
  assert.match(viewSource, /private shouldUseWideListCardLayout\(\): boolean/);
  assert.match(viewSource, /inner\.style\.gridTemplateColumns = 'minmax\(0, 1fr\) minmax\(128px, 34%\)'/);
  assert.match(viewSource, /metaRow\.style\.gridColumn = '2'/);
  assert.match(viewSource, /const summaryKeys = \['summary', 'description', 'details', 'notes'\]/);
  assert.match(viewSource, /inner\.createDiv\(\{ cls: 'tps-kanban-card-summary', text: summary \}\)/);
  assert.match(stylesSource, /container-type:\s*inline-size;/);
  assert.match(stylesSource, /@container \(min-width: 620px\)/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-card-inner\s*\{[\s\S]*display:grid;/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-card-inner\s*\{[\s\S]*grid-template-columns:minmax\(0, 1fr\) minmax\(128px, 34%\);/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-card-meta-row\s*\{[\s\S]*grid-column:2;/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-card-summary\s*\{[\s\S]*grid-column:1 \/ -1;/);
  assert.match(stylesSource, /\.tps-kanban-container--list \.tps-kanban-card-inner\s*\{[\s\S]*grid-template-columns:minmax\(0, 1fr\) minmax\(180px, 44cqw\);/);
});

test('completed tasks are hidden by default and can be shown per view for manipulation', () => {
  assert.match(settingsSource, /showCompletedTasksByView: \{\}/);
  assert.match(mainSource, /showCompletedTasksByView: stored\.showCompletedTasksByView/);
  assert.match(viewSource, /private shouldShowCompletedTasks\(\): boolean/);
  assert.match(viewSource, /private async toggleCompletedTaskVisibility\(\): Promise<void>/);
  assert.match(viewSource, /showingCompletedTasks \? 'Hide completed' : 'Show completed'/);
  assert.match(viewSource, /if \(pressed !== null\) button\.setAttr\('aria-pressed', pressed \? 'true' : 'false'\)/);
  assert.match(viewSource, /includeDone: false/);
  assert.match(viewSource, /if \(this\.shouldShowCompletedTasks\(\)\) filter\.includeDone = true/);
  assert.match(viewSource, /taskEl\.classList\.toggle\('tps-kanban-card-task--completed', this\.isDoneTask\(task\)\)/);
  assert.match(viewSource, /cardEl\.classList\.toggle\('tps-kanban-task-card--completed', this\.isDoneTask\(task\)\)/);
  assert.match(viewSource, /this\.getAllTasksForFile\(file\)/);
  assert.match(viewSource, /void this\.updateTaskCheckboxState\(entry\.file, task\.line, this\.getToggleCheckboxStateForTask\(task\)\)/);
  assert.match(stylesSource, /\.tps-kanban-view-toggle\[aria-pressed="true"\]/);
  assert.match(stylesSource, /\.tps-kanban-card-task--completed \.tps-kanban-card-task-text\s*\{[\s\S]*text-decoration:line-through;/);
});

test('root task cards expose native checkbox completion controls', () => {
  assert.match(viewSource, /private createTaskLaneCard\([\s\S]*?item: TaskRenderItem,[\s\S]*?propName: string \| null,[\s\S]*?taskGroupPropId: string \| null,[\s\S]*?displayLane: DisplayLaneGroup,[\s\S]*?\): HTMLElement/);
  assert.match(viewSource, /cls: 'tps-kanban-card-task-checkbox tps-kanban-task-card-checkbox'/);
  assert.match(viewSource, /type: 'checkbox'/);
  assert.match(viewSource, /'aria-label': `Toggle task: \$\{taskTitle\}`/);
  assert.match(viewSource, /checkboxEl\.checked = this\.getDoneStatuses\(\)\.has\(this\.getStatusForCheckboxState\(task\.checkboxState \|\| '\[ \]'\)\)/);
  assert.match(viewSource, /checkboxEl\.addEventListener\('pointerdown', \(e: PointerEvent\) => \{\s*e\.stopPropagation\(\);/);
  assert.match(viewSource, /checkboxEl\.addEventListener\('click', \(e: MouseEvent\) => \{\s*e\.stopPropagation\(\);/);
  assert.match(viewSource, /void this\.updateTaskCheckboxState\(file, task\.line, this\.getToggleCheckboxStateForTask\(task\)\)/);
  assert.match(stylesSource, /\.tps-kanban-task-card > \.tps-kanban-card-inner > \.tps-kanban-card-title-row\s*\{[\s\S]*grid-template-columns:14px 18px minmax\(0, 1fr\);/);
});

test('collapsing task previews preserves kanban scroll position', () => {
  assert.match(viewSource, /type KanbanRenderScrollState = \{/);
  assert.match(viewSource, /private captureRenderScrollState\(\): KanbanRenderScrollState/);
  assert.match(viewSource, /private restoreRenderScrollState\(state: KanbanRenderScrollState \| null\): void/);
  assert.match(viewSource, /private render\(preserveScroll = true\): void/);
  assert.match(viewSource, /const scrollState = preserveScroll \? this\.captureRenderScrollState\(\) : null/);
  assert.match(viewSource, /void this\.renderAsync\(sourceGroups, propName, taskGroupPropId, scrollState\)/);
  assert.match(viewSource, /this\.restoreRenderScrollState\(scrollState\)/);
  assert.match(viewSource, /window\.requestAnimationFrame\(restore\)/);
});

test('hidden Bases kanban instances do not render during initial mixed-view open', () => {
  assert.match(viewSource, /private shouldRenderView\(\): boolean/);
  assert.match(viewSource, /if \(!this\.containerEl\?\.isConnected\) return false/);
  assert.match(viewSource, /if \(this\.containerEl\.isShown\(\)\) return true/);
  assert.match(viewSource, /activeContainer\?\.contains\(this\.containerEl\)/);
  assert.match(viewSource, /private render\(preserveScroll = true\): void \{\s*if \(!this\.isViewLoaded\) return;\s*this\.renderGeneration \+= 1;\s*if \(!this\.shouldRenderView\(\)\) return;/);
});

test('reading-mode embedded kanban hides Bases chrome and edit controls', () => {
  assert.match(viewSource, /private getContainingWorkspaceLeaf\(\): WorkspaceLeaf \| null/);
  assert.match(viewSource, /private isEmbeddedKanbanContext\(\): boolean/);
  assert.match(viewSource, /private isReadingEmbeddedKanbanContext\(\): boolean/);
  assert.match(viewSource, /text\.length <= 180/);
  assert.match(viewSource, /\\bSort\\b/);
  assert.match(viewSource, /\\bFilter\\b/);
  assert.match(viewSource, /\\bProperties\\b/);
  assert.match(viewSource, /viewType === 'markdown'/);
  assert.match(viewSource, /\.markdown-source-view, \.cm-editor, \.cm-content, \.cm-preview-code-block/);
  assert.match(viewSource, /mode === 'preview' \|\| mode === 'reading'/);
  assert.match(viewSource, /tps-kanban-view-controls--reading-embed/);
  assert.match(viewSource, /\.markdown-reading-view, \.markdown-rendered/);
  assert.match(viewSource, /tps-kanban-embedded-hidden-header/);
  assert.match(viewSource, /tps-kanban-container--reading-embed/);
  assert.match(viewSource, /tps-kanban-container--live-embed/);
  assert.match(viewSource, /tps-kanban-container--embedded/);
  assert.match(viewSource, /if \(typeof mode === 'string'\) return mode === 'preview' \|\| mode === 'reading'/);
  assert.match(viewSource, /tps-kanban-reading-embed-root/);
  assert.match(viewSource, /tps-kanban-reading-embed-block/);
  assert.match(viewSource, /tps-kanban-reading-embed-section/);
  assert.match(viewSource, /isReadingEmbed \|\| this\.isEmbeddedKanbanContext\(\)/);
  assert.match(viewSource, /displayLaneIndex === 0/);
  assert.match(viewSource, /cls: 'tps-kanban-lane-layout-toggle'/);
  assert.match(viewSource, /void this\.toggleLayoutMode\(\)/);
  assert.match(viewSource, /cls: 'tps-kanban-lane-header-add'/);
  assert.match(viewSource, /void handleLaneAdd\(\)/);
  assert.match(viewSource, /const createControlButton = \(icon: string, label: string, pressed: boolean \| null, onClick: \(\) => void\)/);
  assert.match(viewSource, /layoutMode === 'list' \? 'columns' : 'list'/);
  assert.match(viewSource, /button\.createSpan\(\{ cls: 'tps-kanban-view-toggle-label', text: label \}\)/);
  assert.match(viewSource, /const laneCollapsed = this\.collapsedListLaneIds\.has\(displayLane\.id\)/);
  assert.match(viewSource, /cls: 'tps-kanban-lane-collapse'/);
  assert.match(stylesSource, /\.tps-kanban-embedded-hidden-header\s*\{[\s\S]*display:\s*none !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-view-controls\s*\{[\s\S]*display:\s*none !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--live-embed \.tps-kanban-view-controls\s*\{[\s\S]*justify-content:\s*flex-start;/);
  assert.match(stylesSource, /body\.tps-tps-mobile-ui-gesture-hidden \.tps-kanban-container--live-embed \.tps-kanban-view-controls/);
  assert.match(stylesSource, /body\.tps-tps-mobile-ui-gesture-hidden \.tps-kanban-container--live-embed \.tps-kanban-lane-header-add/);
  assert.match(stylesSource, /body\.tps-tps-mobile-ui-gesture-hidden \.tps-kanban-container--live-embed \.tps-kanban-lane-layout-toggle/);
  assert.match(stylesSource, /display:\s*inline-flex !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-board--list \.tps-kanban-lane\s*\{[\s\S]*min-height:\s*0;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-lane\s*\{[\s\S]*padding:\s*6px 8px;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-lane-header\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto auto !important;[\s\S]*min-height:\s*22px;[\s\S]*margin:\s*0 0 4px;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-lane-header-add\s*\{[\s\S]*grid-column:\s*3 !important;[\s\S]*grid-row:\s*1 !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-lane-collapse\s*\{[\s\S]*grid-column:\s*4 !important;[\s\S]*grid-row:\s*1 !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-board--list \.tps-kanban-lane--empty \.tps-kanban-cards\s*\{[\s\S]*display:\s*flex;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-add-card \{[\s\S]*display:\s*none !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\.tps-kanban-container--list \.tps-kanban-add-card\s*\{[\s\S]*display:\s*none !important;/);
  assert.match(stylesSource, /\.tps-kanban-lane--collapsed \.tps-kanban-cards,\s*\.tps-kanban-lane--collapsed \.tps-kanban-add-card\s*\{[\s\S]*display:none;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-lane-header-add,[\s\S]*\.tps-kanban-container--reading-embed \.tps-kanban-lane-collapse\s*\{[\s\S]*width:\s*20px;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-lane-header-add svg,[\s\S]*\.tps-kanban-container--reading-embed \.tps-kanban-lane-collapse svg\s*\{[\s\S]*display:\s*block !important;[\s\S]*visibility:\s*visible !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-card--colored\s*\{[\s\S]*--tps-card-color[\s\S]*box-shadow:\s*inset 3px 0 0 var\(--tps-card-color\) !important;/);
  assert.match(stylesSource, /\.markdown-rendered \.internal-embed:has\(\.tps-kanban-container--reading-embed\),[\s\S]*\.markdown-preview-view \.tps-kanban-reading-embed-section\s*\{[\s\S]*margin-top:\s*0 !important;[\s\S]*margin-bottom:\s*8px !important;[\s\S]*padding-top:\s*0 !important;/);
  assert.match(stylesSource, /\.markdown-rendered \.tps-kanban-reading-embed-section,[\s\S]*\.markdown-preview-view \.tps-kanban-reading-embed-block\s*\{[\s\S]*transform:\s*translateY\(-104px\);[\s\S]*margin-bottom:\s*-96px !important;/);
  assert.match(stylesSource, /\.markdown-rendered \.metadata-container:has\(~ \.tps-kanban-reading-embed-block\),[\s\S]*\.markdown-preview-view \.metadata-container:has\(~ \.tps-kanban-reading-embed-root\)\s*\{[\s\S]*margin-bottom:\s*8px !important;[\s\S]*padding-bottom:\s*0 !important;/);
  assert.match(stylesSource, /\.markdown-rendered \.el-pre:has\(\.tps-kanban-container--reading-embed\),[\s\S]*\.markdown-preview-view \.el-div:has\(\.tps-kanban-container--reading-embed\)\s*\{[\s\S]*margin-top:\s*0 !important;[\s\S]*padding-top:\s*0 !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed\s*\{[\s\S]*padding:\s*0 0 6px !important;[\s\S]*margin-top:\s*0 !important;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed:not\(\.tps-kanban-container--list\) \.tps-kanban-board\s*\{[\s\S]*grid-auto-columns:\s*minmax\(min\(220px, 100%\), 1fr\);[\s\S]*align-items:\s*stretch;[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed:not\(\.tps-kanban-container--list\) \.tps-kanban-lane\s*\{[\s\S]*height:\s*100%;[\s\S]*width:\s*auto;[\s\S]*min-width:\s*0;/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed:not\(\.tps-kanban-container--list\) \.tps-kanban-cards\s*\{[\s\S]*flex:\s*1 1 auto;/);
  assert.match(stylesSource, /@media \(max-width: 700px\), \(hover: none\) and \(pointer: coarse\) \{[\s\S]*\.tps-kanban-container--reading-embed:not\(\.tps-kanban-container--list\) \.tps-kanban-board\s*\{[\s\S]*grid-auto-columns:\s*minmax\(0, 100%\);[\s\S]*gap:\s*6px;/);
  assert.match(stylesSource, /@media \(max-width: 700px\), \(hover: none\) and \(pointer: coarse\) \{[\s\S]*\.tps-kanban-container--reading-embed:not\(\.tps-kanban-container--list\) \.tps-kanban-lane\s*\{[\s\S]*max-width:\s*100%;[\s\S]*padding:\s*6px;/);
  assert.doesNotMatch(stylesSource, /body\.tps-tps-mobile-ui-keyboard-hidden \.tps-kanban-container \.tps-gcm-top-properties-panel/);
  assert.doesNotMatch(stylesSource, /body\.tps-tps-mobile-ui-keyboard-hidden \.tps-kanban-container \.tps-gcm-top-property-row/);
  assert.doesNotMatch(stylesSource, /body\.tps-tps-mobile-ui-gesture-hidden \.tps-kanban-container \.tps-gcm-top-properties-panel/);
  assert.doesNotMatch(stylesSource, /body\.tps-tps-mobile-ui-gesture-hidden \.tps-kanban-container \.tps-gcm-top-property-row/);
});

test('saved base file filters are scoped to the configured Bases view name', () => {
  assert.match(viewSource, /baseFileFilterCache: \{ path: string; mtime: number; viewName: string; viewNames: string\[\]; filters: unknown\[\] \| null; formulas: FormulaDefinitions; errorAt\?: number \} \| null/);
  assert.match(viewSource, /this\.getWorkspaceLeafBasePath\(\)/);
  assert.match(viewSource, /const viewName = this\.getConfiguredBaseViewName\(\)/);
  assert.match(viewSource, /this\.baseFileFilterCache\.viewName === viewName/);
  assert.match(viewSource, /private getCurrentBaseViewName\(knownViewNames\?: Set<string>\): string/);
  assert.match(viewSource, /private getVisibleBaseViewName\(knownViewNames\?: Set<string>\): string/);
  assert.match(viewSource, /const visible = this\.getVisibleBaseViewName\(knownViewNames\)/);
  assert.match(viewSource, /const visibleText = String\(root\.innerText \|\| ''\)/);
  assert.match(viewSource, /if \(visibleKnownNames\.length === 1\) return visibleKnownNames\[0\]/);
  assert.match(viewSource, /const extracted = this\.extractBaseFileFilterRoots\(parsed, viewName\)/);
  assert.match(viewSource, /viewName: extracted\.viewName/);
  assert.match(viewSource, /extractPersistedFilterRoots\(parsed, fallbackViewName/);
  assert.match(viewSource, /const baseFile = this\.getBaseFile\(\)/);
  assert.match(viewSource, /const directFile = this\.getRuntimeBaseFile\(\);\s*if \(directFile\) return directFile\.path/);
  assert.match(viewSource, /composeEffectiveFilterRoots\(runtimeRoots, fileRoots \|\| \[\]\)/);
  assert.match(viewSource, /private getTaskFileComparableValues\(file: TFile \| null, propRaw: string\): string\[\]/);
  assert.match(viewSource, /if \(prop === 'links' \|\| prop === 'link'\)[\s\S]*?return \[\]/);
  assert.match(viewSource, /const folderComparison = expr\.match\(\/\^file\\\.folder/);
  assert.match(viewSource, /file\\\.links\?\\\.\(\?:isEmpty\|empty\)/);
  assert.doesNotMatch(viewSource, /for \(const delay of \[250, 750, 1500\]\)/);
  assert.match(viewSource, /private getTaskReadConcurrencyLimit\(\): number/);
  assert.match(viewSource, /if \(released && !this\.taskReadsInFlight\.size\) this\.refreshDebounced\(\)/);
  assert.doesNotMatch(viewSource, /const knownViewNames = this\.baseFileFilterCache\?\.path === file\.path/);
});

test('mixed or task filters do not force the whole board task-only', () => {
  assert.match(viewSource, /private hasTaskDirectiveInFilterNode\(node: unknown\): boolean/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'or'\)[\s\S]*Object\.prototype\.hasOwnProperty\.call\(record, 'any'\)[\s\S]*return;/);
  assert.match(viewSource, /taskFilter\.mode !== 'tasks'[\s\S]*!taskFilter\.hasTaskDirective[\s\S]*!explicitTaskSourcePaths\.has\(file\.path\)[\s\S]*!visibleNotePaths\.has\(file\.path\)/);
});

test('task lane synthesis builds each render index once without changing final results', async () => {
  const renderAsyncStart = viewSource.indexOf('  private async renderAsync(');
  const renderAsyncEnd = viewSource.lastIndexOf('\n}');
  assert.ok(renderAsyncStart >= 0 && renderAsyncEnd > renderAsyncStart);
  const renderAsyncSource = viewSource.slice(renderAsyncStart, renderAsyncEnd);
  assert.equal(
    (renderAsyncSource.match(/this\.buildTaskRenderItemsByLane\(/g) || []).length,
    1,
    'each render should perform one full-vault task build',
  );
  assert.equal(
    (renderAsyncSource.match(/this\.buildParentByChild\(/g) || []).length,
    1,
    'each render should build the child-to-parent index once',
  );
  assert.equal(
    (renderAsyncSource.match(/this\.buildLaneRenderItemsByLane\(/g) || []).length,
    1,
    'each render should build note lane items once',
  );
  assert.match(
    renderAsyncSource,
    /const taskRenderItemsByLane = this\.buildTaskRenderItemsByLane\([\s\S]*groups = this\.ensureGroupsForTaskLanes\(groups, taskRenderItemsByLane\);[\s\S]*const parentByChild = this\.buildParentByChild\(groups\);[\s\S]*const laneRenderItemsByLane = [\s\S]*this\.buildLaneRenderItemsByLane\(groups, parentByChild\);/,
  );

  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  const todoFile = { path: 'Inbox/Todo.md' };
  const doingFile = { path: 'Projects/Doing.md' };
  const todoTask = { text: 'First task', laneIds: ['key:todo'] };
  const doingTask = { text: 'Second task', laneIds: ['key:doing', 'key:done'] };
  view.app = {
    vault: {
      getMarkdownFiles: () => { throw new Error('task discovery must not scan every Markdown file'); },
    },
  };
  view.isBaseFileFilterReady = () => true;
  view.getActiveBasesSearchQuery = () => '';
  view.getExplicitTaskSourceFiles = () => [];
  view.shouldScanVaultForTaskFilters = () => true;
  view.getIndexedLineSourceFiles = () => [todoFile, doingFile];
  view.getAllLineItemsForFile = (file) => file.path === todoFile.path ? [todoTask] : [doingTask];
  view.taskMatchesRootFilter = () => true;
  view.taskMatchesSearchQuery = () => true;
  view.getTaskLaneIds = (_file, task) => task.laneIds;
  view.getLaneId = (group) => group.key == null ? 'ungrouped' : `key:${String(group.key).toLowerCase()}`;
  view.applyManualLaneOrder = (groups) => groups;

  const groups = [{
    key: 'todo',
    entries: [{ file: todoFile }],
    hasKey: () => true,
  }];
  const taskFilter = {
    mode: 'tasks',
    hasTaskDirective: true,
    includeDone: true,
    statuses: new Set(),
    excludeStatuses: new Set(),
    tags: new Set(),
    excludeTags: new Set(),
  };
  const beforeSynthesis = view.buildTaskRenderItemsByLane(
    groups,
    'status',
    new Set([todoFile.path]),
    taskFilter,
  );
  const groupsWithTaskLanes = view.ensureGroupsForTaskLanes(groups, beforeSynthesis);
  assert.deepEqual(
    groupsWithTaskLanes.map((group) => [view.getLaneId(group), group.entries.length]),
    [['key:todo', 1], ['key:doing', 0], ['key:done', 0]],
  );

  const afterSynthesisOracle = view.buildTaskRenderItemsByLane(
    groupsWithTaskLanes,
    'status',
    new Set([todoFile.path]),
    taskFilter,
  );
  assert.deepEqual(Array.from(afterSynthesisOracle.keys()), Array.from(beforeSynthesis.keys()));
  for (const [laneId, items] of beforeSynthesis) {
    const oracleItems = afterSynthesisOracle.get(laneId) || [];
    assert.equal(oracleItems.length, items.length, `${laneId} task count should be unchanged`);
    assert.deepEqual(
      oracleItems.map((item) => item.task),
      items.map((item) => item.task),
      `${laneId} task identities and order should be unchanged`,
    );
  }

  const parentFile = { path: 'Projects/Parent.md' };
  const childFile = { path: 'Projects/Child.md' };
  const parentEntry = { file: parentFile };
  const childEntry = { file: childFile };
  const noteGroups = [{
    key: 'todo',
    entries: [parentEntry, childEntry],
    hasKey: () => true,
  }];
  const createIndexView = () => {
    const indexView = Object.create(KanbanView.prototype);
    indexView.app = {
      metadataCache: {
        getFileCache: () => ({ frontmatter: {} }),
      },
    };
    indexView.expandedSubtreePaths = new Set([parentFile.path]);
    indexView.getLaneId = (group) => group.key == null
      ? 'ungrouped'
      : `key:${String(group.key).toLowerCase()}`;
    indexView.applyManualLaneOrder = (nextGroups) => nextGroups;
    indexView.resolveParentPath = (file) => file.path === childFile.path ? parentFile.path : null;
    indexView.getChildLinkKeys = () => [];
    return indexView;
  };

  const legacyView = createIndexView();
  let legacyGroups = noteGroups;
  const discardedParentByChild = legacyView.buildParentByChild(legacyGroups);
  legacyView.buildLaneRenderItemsByLane(
    legacyGroups,
    discardedParentByChild,
  );
  legacyGroups = legacyView.ensureGroupsForTaskLanes(legacyGroups, beforeSynthesis);
  const legacyParentByChild = legacyView.buildParentByChild(legacyGroups);
  const legacyLaneItems = legacyView.buildLaneRenderItemsByLane(legacyGroups, legacyParentByChild);

  const optimizedView = createIndexView();
  const optimizedGroups = optimizedView.ensureGroupsForTaskLanes(noteGroups, beforeSynthesis);
  const optimizedParentByChild = optimizedView.buildParentByChild(optimizedGroups);
  const optimizedLaneItems = optimizedView.buildLaneRenderItemsByLane(
    optimizedGroups,
    optimizedParentByChild,
  );

  assert.deepEqual(
    optimizedGroups.map((group) => [optimizedView.getLaneId(group), group.entries.length]),
    legacyGroups.map((group) => [legacyView.getLaneId(group), group.entries.length]),
  );
  assert.deepEqual(optimizedParentByChild, legacyParentByChild);
  assert.deepEqual(optimizedLaneItems, legacyLaneItems);
  const optimizedTodoItems = optimizedLaneItems.get('key:todo') || [];
  assert.equal(optimizedTodoItems[0]?.entry, parentEntry);
  assert.equal(optimizedTodoItems[0]?.children[0]?.entry, childEntry);
  assert.deepEqual(
    Array.from(optimizedLaneItems, ([laneId, items]) => [laneId, items.length]),
    [['key:todo', 1], ['key:doing', 0], ['key:done', 0]],
  );
});

test('status kanban renders tasks as lane items and keeps done tasks addressable', () => {
  assert.match(viewSource, /type TaskRenderItem/);
  assert.match(viewSource, /private allTasksByPath = new Map<string, OpenTaskSubitem\[\]>\(\)/);
  assert.match(viewSource, /buildTaskRenderItemsByLane\(\s*groups: BasesEntryGroup\[\],\s*propName: string \| null,/);
  assert.match(viewSource, /this\.parseOpenTasks\(content, path, Number\.MAX_SAFE_INTEGER, true, true\)/);
  assert.match(viewSource, /getLaneIdForStatus\(this\.getStatusForCheckboxState\(task\.checkboxState/);
  assert.match(viewSource, /isStatusPropertyName\(propName\)/);
  assert.match(viewSource, /if \(this\.isStatusPropertyName\(propName\)\)/);
  assert.match(viewSource, /nextLine = buildKanbanTaskDropLine\(\{\s*line: currentLine,\s*propName,\s*value,\s*sourceLaneValues,\s*filterTags,\s*filterStatus,/);
  assert.match(viewSource, /createTaskLaneCard\(mixedItem\.item, propName, taskGroupPropId, displayLane\)/);
  assert.match(viewSource, /role: 'button', tabindex: '0'/);
  assert.doesNotMatch(viewSource, /cls: 'tps-kanban-card-title tps-kanban-task-card-title',[\\s\\S]{0,120}type: 'button'/);
  assert.match(viewSource, /type ActiveTaskPointerDrag/);
  assert.match(viewSource, /itemKind\?: 'task' \| 'bullet'/);
  assert.match(viewSource, /private parseLineItem\(line: string, includeBullets = true\): \{ itemKind: 'task' \| 'bullet'; checkboxState\?: string; text: string \} \| null \{\s*return parseKanbanLineItem\(line, includeBullets\);/);
  assert.match(viewSource, /tps-kanban-task-card-drag-handle/);
  assert.match(viewSource, /sourceLaneValues: this\.getDisplayLaneWritableValues\(displayLane\)/);
  assert.match(viewSource, /application\/x-kanban-entry-source-values/);
  assert.match(viewSource, /private async applyFrontmatterTags/);
  assert.match(viewSource, /normalizeFrontmatterTags/);
  assert.match(viewSource, /this\.getDisplayLaneWritableValues\(active\.displayLane\)/);
  assert.match(taskDropUtilsSource, /sourceTag\.toLowerCase\(\) !== cleanTag\.toLowerCase\(\)/);
  assert.match(viewSource, /createSpan\(\{\s*cls: 'tps-kanban-task-card-drag-handle'/);
  assert.doesNotMatch(viewSource, /createEl\('button', \{\s*cls: 'tps-kanban-task-card-drag-handle'/);
  assert.match(viewSource, /cardEl\.addEventListener\('pointerdown'/);
  assert.match(viewSource, /beginTaskPointerDrag\(e, file, task, propName, displayLane, cardEl\)/);
  assert.match(viewSource, /document\.elementFromPoint\(event\.clientX, event\.clientY\)/);
  assert.match(viewSource, /laneEl\.dataset\.displayLaneId = displayLane\.id/);
  assert.match(viewSource, /cardEl\.draggable = false/);
  assert.match(viewSource, /if \(event\.button !== 0\) return;/);
  assert.match(viewSource, /if \(task\.itemKind === 'bullet'\) \{/);
  assert.match(viewSource, /setIconWithFallback\(iconEl, 'list'\)/);
  assert.match(viewSource, /cls: 'tps-kanban-card-task-checkbox tps-kanban-task-card-checkbox'/);
  assert.match(viewSource, /'data-checkbox-state': task\.checkboxState \|\| '\[ \]'/);
  assert.match(viewSource, /getCheckboxMarker\(task\.checkboxState \|\| '\[ \]'\)/);
  assert.match(viewSource, /draggable: 'true'/);
  assert.match(viewSource, /'aria-label': `Drag \$\{task\.itemKind === 'bullet' \? 'bullet' : 'task'\}:/);
  assert.match(viewSource, /title: task\.itemKind === 'bullet' \? 'Drag bullet' : 'Drag task'/);
  assert.match(viewSource, /checkboxState: task\.itemKind === 'bullet' \? undefined : task\.checkboxState \|\| '\[ \]'/);
  assert.match(viewSource, /checkboxState: active\.itemKind === 'bullet' \? undefined : active\.checkboxState \|\| '\[ \]'/);
  assert.match(viewSource, /dragHandle\.draggable = canReorderLane/);
  assert.match(viewSource, /position: 'before' \| 'after' = 'before'/);
  assert.match(viewSource, /laneEl\.hasClass\('tps-kanban-lane--drop-after'\) \? 'after' : 'before'/);
  assert.match(stylesSource, /\.tps-kanban-task-card-drag-handle\s*\{/);
  assert.match(stylesSource, /\.tps-kanban-task-card-drag-handle\s*\{[\s\S]*opacity:0;/);
  assert.match(stylesSource, /\.tps-kanban-task-card:hover \.tps-kanban-task-card-drag-handle/);
  assert.match(stylesSource, /\.tps-kanban-task-card:focus-within \.tps-kanban-task-card-drag-handle/);
  assert.match(stylesSource, /\.tps-kanban-task-drop-preview\s*\{/);
  assert.match(stylesSource, /\.tps-kanban-task-drop-preview-line\s*\{[\s\S]*white-space:pre-wrap;/);
  assert.match(stylesSource, /max-width:18px;/);
  assert.match(stylesSource, /max-height:18px;/);
  assert.match(stylesSource, /\.tps-kanban-lane-handle,[\s\S]*opacity:0\.68;/);
  assert.match(stylesSource, /\.tps-kanban-lane-handle,[\s\S]*pointer-events:auto;/);
  assert.match(stylesSource, /\.tps-kanban-task-card > \.tps-kanban-card-inner\s*\{[\s\S]*gap:9px;/);
  assert.match(stylesSource, /\.tps-kanban-task-card > \.tps-kanban-card-inner > \.tps-kanban-card-title-row\s*\{[\s\S]*grid-template-columns:14px 18px minmax\(0, 1fr\);/);
  assert.match(stylesSource, /\.tps-kanban-task-card > \.tps-kanban-card-inner > \.tps-kanban-card-title-row\s*\{[\s\S]*overflow:hidden;/);
  assert.match(stylesSource, /\.tps-kanban-task-card-title\s*\{[\s\S]*white-space:normal;/);
  assert.match(stylesSource, /\.tps-kanban-task-card-title\s*\{[\s\S]*overflow:hidden;/);
  assert.match(stylesSource, /\.tps-kanban-task-card-title\s*\{[\s\S]*-webkit-line-clamp:3;/);
  assert.match(stylesSource, /\.tps-kanban-task-card-meta\s*\{[\s\S]*padding-left:37px;/);
  assert.match(viewSource, /const taskContentEl = taskEl\.createDiv\(\{ cls: 'tps-kanban-card-task-content' \}\)/);
  assert.match(viewSource, /taskContentEl\.createSpan\(\{ cls: 'tps-kanban-card-task-text'/);
  assert.match(stylesSource, /\.tps-kanban-card-task\s*\{[\s\S]*display:flex;/);
  assert.match(stylesSource, /\.tps-kanban-card-task\s*\{[\s\S]*align-items:flex-start;/);
  assert.match(stylesSource, /\.tps-kanban-card-tasks\s*\{[\s\S]*gap:7px;/);
  assert.match(stylesSource, /\.tps-kanban-card-tasks\s*\{[\s\S]*padding:10px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task\s*\{[\s\S]*min-height:30px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task\s*\{[\s\S]*padding:6px 7px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task\s*\{[\s\S]*line-height:1\.45;/);
  assert.match(stylesSource, /\.tps-kanban-card-task > \.tps-kanban-task-card-drag-handle\s*\{[\s\S]*flex:0 0 14px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task > \.tps-kanban-task-card-drag-handle\s*\{[\s\S]*opacity:0;/);
  assert.match(stylesSource, /\.tps-kanban-card-task:hover > \.tps-kanban-task-card-drag-handle/);
  assert.match(stylesSource, /\.tps-kanban-card-task-checkbox\s*\{[\s\S]*width:16px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-checkbox\s*\{[\s\S]*flex:0 0 16px;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-content\s*\{[\s\S]*flex-direction:column;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-content\s*\{[\s\S]*flex:1 1 auto;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-text\s*\{[\s\S]*min-width:0;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-text\s*\{[\s\S]*white-space:normal;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-text\s*\{[\s\S]*overflow-wrap:anywhere;/);
  assert.match(stylesSource, /\.tps-kanban-card-task-checkbox\[data-checkbox-state\]:not\(\[data-checkbox-state="\[ \]"\]\):not\(:checked\)::after/);
  assert.match(stylesSource, /\.tps-kanban-task-card\s*\{/);
  assert.match(viewSource, /private getTaskInlineFieldRanges\(text: string\): Array<\{ start: number; end: number; key: string; value: string \}>/);
  assert.match(viewSource, /const closer = opener === '\[' \? '\]' : '\)'/);
  assert.match(viewSource, /output \+= source\.slice\(cursor, range\.start\)/);
  assert.doesNotMatch(viewSource, /\(\?:\\\[\\\|\\\(\)\(\[A-Za-z\]\[\\w -\]\{0,40\}\)::\\s\*\(\[\^\\\]\\\)\]\+\)/);
});

test('dragging a linked task writes only to the checklist source line', async () => {
  const {
    buildKanbanTaskDropLine,
    parseKanbanLineItem,
    updateKanbanInlineTaskTag,
  } = await importTaskDropUtils();
  const checkboxForStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'complete') return '[x]';
    if (normalized === 'working') return '[/]';
    if (normalized === 'blocked') return '[-]';
    if (normalized === 'todo') return '[ ]';
    return null;
  };
  const isStatusPropertyName = (propName) => String(propName || '').trim().toLowerCase() === 'status';

  assert.deepEqual(parseKanbanLineItem('- [ ] Call vendor [area:: office]', true), {
    itemKind: 'task',
    checkboxState: '[ ]',
    text: 'Call vendor [area:: office]',
  });
  assert.deepEqual(parseKanbanLineItem('- Draft notes [area:: office]', true), {
    itemKind: 'bullet',
    text: 'Draft notes [area:: office]',
  });
  assert.equal(parseKanbanLineItem('- Draft notes [area:: office]', false), null);

  assert.equal(
    buildKanbanTaskDropLine({
      line: '- [ ] Call vendor [area:: office] #home',
      propName: 'status',
      value: 'complete',
      getCheckboxStateForStatus: checkboxForStatus,
      isStatusPropertyName,
    }),
    '- [x] Call vendor [area:: office] #home',
  );
  assert.equal(
    buildKanbanTaskDropLine({
      line: '- [ ] Call vendor #todo #home',
      propName: 'tags',
      value: '#waiting on vendor',
      sourceLaneValues: ['#todo'],
      getCheckboxStateForStatus: checkboxForStatus,
      isStatusPropertyName,
    }),
    '- [ ] Call vendor #home #waiting-on-vendor',
  );
  assert.equal(
    buildKanbanTaskDropLine({
      line: '- [ ] Call vendor [area:: office] #home',
      propName: 'area',
      value: 'errands',
      filterTags: ['#project/home'],
      filterStatus: 'working',
      getCheckboxStateForStatus: checkboxForStatus,
      isStatusPropertyName,
    }),
    '- [/] Call vendor #home [area:: errands] #project/home',
  );
  assert.equal(
    buildKanbanTaskDropLine({
      line: '- Draft notes [area:: office] #todo',
      propName: 'status',
      value: 'complete',
      filterStatus: 'working',
      getCheckboxStateForStatus: checkboxForStatus,
      isStatusPropertyName,
    }),
    '- Draft notes [area:: office] #todo',
  );
  assert.equal(
    updateKanbanInlineTaskTag('- [ ] Call vendor #todo #home', 'todo', ['todo']),
    '- [ ] Call vendor #todo #home',
  );

  assert.match(viewSource, /type: 'task-line',\s*source: 'tps-kanban',\s*itemKind: task\.itemKind \|\| 'task',\s*path: entry\.file\.path,\s*line: task\.line,/);
  assert.match(viewSource, /e\.dataTransfer\.setData\(KANBAN_TASK_MIME, payload\)/);
  assert.match(viewSource, /e\.dataTransfer\.setData\(TPS_TASK_LINE_MIME, payload\)/);
  assert.match(viewSource, /const taskFile = parsed\?\.path \? this\.app\.vault\.getFileByPath\(parsed\.path\) : null;/);
  assert.match(viewSource, /await this\.confirmAndApplyInlineTaskDrop\(\s*taskFile,\s*parsed\.line,/);
  assert.match(viewSource, /nextLine = buildKanbanTaskDropLine\(\{/);
  assert.match(viewSource, /parseKanbanLineItem\(line, includeBullets\)/);
  assert.match(viewSource, /private async buildTaskDropPlan/);
  assert.match(taskDropUtilsSource, /export function buildKanbanTaskDropLine/);
  assert.match(viewSource, /cls: 'tps-kanban-task-drop-preview'/);
  assert.match(viewSource, /cls: 'tps-kanban-task-drop-preview-line'/);
  assert.match(viewSource, /changes\.push\(`Current line: \$\{currentLine\}`\)/);
  assert.match(viewSource, /changes\.push\(`Result line: \$\{nextLine\}`\)/);
  assert.match(viewSource, /const displayTag = tag\.startsWith\('#'\) \? tag : `#\$\{tag\}`/);
  assert.match(viewSource, /changes\.push\(`Add Base filter tag \$\{displayTag\}\.`\)/);
  assert.match(viewSource, /await this\.app\.vault\.process\(file, \(content\) =>/);
  assert.match(viewSource, /const current = lines\[index\];/);
  assert.match(viewSource, /lines\[index\] = next;/);
  assert.doesNotMatch(viewSource, /metadataCache\.getFirstLinkpathDest[\s\S]{0,400}application\/x-kanban-task/);
});

test('root task cards are filtered independently from visible parent note cards', () => {
  assert.match(viewSource, /type KanbanTaskRootFilter/);
  assert.match(viewSource, /private getSourceGroupsForRender\(propId: string \| null, listGrouping: boolean\): BasesEntryGroup\[\]/);
  assert.match(viewSource, /if \(this\.groupsContainEntries\(nativeGroups\)\) return nativeGroups/);
  assert.match(viewSource, /const nativeEntries: BasesEntry\[\] = this\.data\?\.data \?\? \[\]/);
  assert.match(viewSource, /this\.groupEntriesByProperty\(nativeEntries, propId\)/);
  assert.doesNotMatch(viewSource, /fallbackEntries/);
  assert.doesNotMatch(viewSource, /noteMatchesStructuredBaseFilters/);
  assert.match(viewSource, /getTaskRootFilterFromBaseFilters\(\)/);
  assert.match(viewSource, /parseYaml/);
  assert.match(viewSource, /private getBaseFileFilterRoot\(\)/);
  assert.match(viewSource, /private async loadBaseFileFilters\(file: TFile/);
  assert.match(viewSource, /const parsed = parseYaml\(content\)/);
  assert.match(viewSource, /private extractBaseFileFilterRoots/);
  assert.match(viewSource, /extractPersistedFilterRoots\(parsed, fallbackViewName/);
  assert.match(viewSource, /queryController\?\.query\?\.file\?\.path/);
  assert.match(viewSource, /\(this as any\)\?\.queryController\?\.query\?\.filters/);
  assert.match(viewSource, /const runtimeRoots = this\.extractFilterRootCandidates/);
  assert.match(viewSource, /private getConfiguredBaseViewName\(\): string/);
  assert.match(viewSource, /this\.getConfiguredBaseViewName\(\)/);
  assert.match(viewSource, /const baseFile = this\.getBaseFile\(\)/);
  assert.match(viewSource, /const fileRoots = this\.getBaseFileFilterRoot\(\)/);
  assert.match(viewSource, /composeEffectiveFilterRoots\(runtimeRoots, fileRoots \|\| \[\]\)/);
  assert.match(viewSource, /private getTaskFileComparableValues\(file: TFile \| null, propRaw: string\): string\[\]/);
  assert.match(viewSource, /if \(prop === 'links' \|\| prop === 'link'\)[\s\S]*?return \[\]/);
  assert.match(viewSource, /private collectFilterRootCandidates\(root: unknown, roots: unknown\[\]\): void/);
  assert.match(viewSource, /this\.baseFilterSignature = this\.getBaseFilterSignature\(\)/);
  assert.match(viewSource, /window\.setInterval/);
  assert.match(viewSource, /for \(const root of this\.getBaseFilterRoots\(\)\)/);
  assert.match(viewSource, /file\.path === this\.getBaseSourcePath\(\)/);
  assert.match(viewSource, /taskFilter\.mode === 'notes'/);
  assert.match(viewSource, /taskFilter\.mode === 'tasks'/);
  assert.match(viewSource, /private shouldRenderNoteEntriesForGroups\(groups: BasesEntryGroup\[\], taskFilter: KanbanTaskRootFilter\): boolean/);
  assert.match(viewSource, /return this\.groupsContainEntries\(groups\)/);
  assert.match(viewSource, /!this\.shouldRenderNoteEntriesForGroups\(groups, taskFilter\)/);
  assert.match(viewSource, /private renderedTaskItemCount = 0/);
  assert.match(viewSource, /if \(taskFilter\.mode === 'tasks'\) return this\.renderedTaskItemCount/);
  assert.match(viewSource, /this\.renderedTaskItemCount = this\.countUniqueTaskRenderItems\(taskRenderItemsByLane\)/);
  assert.match(viewSource, /visibleNotePaths\.has\(file\.path\)/);
  assert.doesNotMatch(viewSource, /this\.app\.vault\.getMarkdownFiles\(\)/);
  assert.match(viewSource, /getIndexedLineSourceFiles\(\)/);
  assert.match(viewSource, /entityTypes: \['block'\]/);
  assert.match(viewSource, /lineKinds: \['task', 'bullet'\]/);
  assert.match(viewSource, /getTaskLaneIds\(file, task, propName\)/);
  assert.match(viewSource, /getTaskInlineValues\(task, 'tags'\)/);
  assert.match(viewSource, /private includeNativeEmptyGroups\(groups: BasesEntryGroup\[\], nativeGroups: BasesEntryGroup\[\]\): BasesEntryGroup\[\]/);
  assert.match(viewSource, /return this\.includeNativeEmptyGroups\(/);
  assert.match(viewSource, /private includeSavedLaneGroups\(groups: BasesEntryGroup\[\]\): BasesEntryGroup\[\]/);
  assert.match(viewSource, /mergedGroups = this\.includeSavedLaneGroups\(mergedGroups\)/);
  assert.match(viewSource, /const mergedWithSavedLanes = this\.includeSavedLaneGroups\(mergedGroups\)/);
  assert.match(viewSource, /excludeStatuses: Set<string>/);
  assert.match(viewSource, /excludeTags: Set<string>/);
  assert.match(viewSource, /filter\.excludeStatuses\.has\(status\)/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'not'\)/);
  assert.match(viewSource, /this\.collectTaskRootFilterNode\(record\.not, filter, !parentNegated\)/);
  assert.match(viewSource, /taskFilter\.mode === 'tasks' \|\| taskFilter\.mode === 'bullets' \|\| taskFilter\.hasTaskDirective/);
  assert.match(viewSource, /ensureGroupsForTaskLanes\(groups, taskRenderItemsByLane\)/);
});

test('task-only kanban creation and matching preserve complex boolean filters', () => {
  assert.match(viewSource, /private taskMatchesStructuredBaseFilters\(task: OpenTaskSubitem, file: TFile \| null = null\): boolean \| null/);
  assert.match(viewSource, /private evaluateTaskFilterNode\([\s\S]*node: unknown,[\s\S]*task: OpenTaskSubitem,[\s\S]*state: TaskFilterEvaluationState/);
  assert.doesNotMatch(viewSource, /if \(structuredMatch === true\) \{\s*return true;/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'and'\)/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'or'\)/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'any'\)/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'not'\)/);
  assert.match(viewSource, /combineTaskFilterResults\(.*'or'\)/);
  assert.match(viewSource, /private evaluateTaskFileFilterExpression\(expr: string, file: TFile \| null\): boolean \| null/);
  assert.match(viewSource, /private taskFilePathMatches\(file: TFile \| null, rawValue: string\): boolean/);
  assert.match(viewSource, /isEmpty/);
  assert.match(settingsTabSource, /task\.tags\.isEmpty\(\)/);
  assert.match(viewSource, /evaluateTaskValueFilterExpression\(expr, 'status', \[status\], false\)/);
  assert.match(viewSource, /evaluateTaskValueFilterExpression\(expr, 'tags', this\.getTaskInlineValues\(task, 'tags'\), false\)/);
  assert.match(viewSource, /private evaluateGenericTaskValueFilterExpression\(expr: string, task: OpenTaskSubitem\): boolean \| null/);
  assert.match(viewSource, /private getGenericTaskComparableValues\(task: OpenTaskSubitem, propRaw: string\): string\[\] \| null/);
  assert.match(viewSource, /this\.isSharedTaskValueFilterExpression\(expr\)/);
  assert.match(settingsTabSource, /Bare tags, status, and custom fields are shared/);
  assert.match(viewSource, /const propPattern = `\$\{requireTaskPrefix \? 'task\\\\\.' : '\(\?:task\\\\\.\)\?'\}/);
  assert.match(settingsTabSource, /Use note\.tags\/note\.status for note frontmatter only/);
  assert.match(viewSource, /taskFileExtensionPattern/);
  assert.match(viewSource, /const itemExtensionPattern = `\(\?:extension\|ext\|file\[/);
  assert.doesNotMatch(viewSource, /const fileExtensionPattern = `\(\?:task\\\\\.\)\?file/);
  assert.match(viewSource, /if \(this\.parseAdditiveKindExpression\(expr\)\)/);
  assert.match(viewSource, /const kindMatch = expr\.match\(\/\^\(\?:\(\?:tps\|kanban\)\\\.\)\?\(\?:itemtype\|itemkind\)/);
  assert.match(viewSource, /task\|tasks\|bullet\|bullets\|note\|notes\|all\|mixed/);
  assert.match(viewSource, /if \(value\.startsWith\('bullet'\)\) return task\.itemKind === 'bullet'/);
  assert.match(viewSource, /const laneAddMode = this\.resolveCardAddMode\(taskFilter\)/);
  assert.match(viewSource, /const createCommandOverride = this\.getCreateCommandOverride\(\)/);
  assert.match(viewSource, /if \(this\.runCreateCommandOverride\(\)\) return/);
  assert.match(viewSource, /const laneAdd = resolveKanbanLaneAddPresentation\(laneAddMode, displayLane\.label\)/);
  assert.match(viewSource, /if \(laneAdd\.shouldCreateTask\)/);
  assert.match(viewSource, /createCommandOverride \? `\+ \$\{createCommandOverride\.name\}` : laneAdd\.buttonText/);
  assert.match(viewSource, /await this\.createRootTaskForLane\(propName, displayLane, taskFilter\)/);
  assert.match(viewSource, /void this\.createTaskForEntry\(entry\.file, propName, displayLane, taskFilter\)/);
  assert.match(viewSource, /private async createTaskForEntry\([\s\S]*?propName: string \| null = null,[\s\S]*?displayLane: DisplayLaneGroup \| null = null,[\s\S]*?taskFilter = this\.getTaskRootFilterFromBaseFilters\(\)/);
  assert.match(viewSource, /private getRootTaskCreationDefaults\(taskFilter: KanbanTaskRootFilter\): TaskCreationDefaults/);
  assert.match(viewSource, /inlineFields: Map<string, \{ key: string; value: string \}>/);
  assert.match(viewSource, /private inferTaskCreationDefaultsFromFilterNode\(node: unknown\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /private inferTaskCreationDefaultsFromAnd\(nodes: unknown\[\]\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /private inferTaskInlineFieldCreationDefaultsFromString\(expr: string\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /for \(const child of this\.asArray\(record\.or\)\)/);
  assert.match(viewSource, /if \(defaults && defaults\.mode !== 'notes'\) return defaults/);
  assert.match(viewSource, /private mergeTaskCreationDefaults\(left: TaskCreationDefaults \| null, right: TaskCreationDefaults\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /const inlineFields = new Map\(left\.inlineFields\)/);
  assert.match(viewSource, /for \(const tag of tags\) if \(excludedTags\.has\(tag\)\) return null/);
  assert.match(viewSource, /return structured \?\? fallback/);
  assert.match(taskCreationUtilsSource, /for \(const tag of options\.defaults\.tags\)/);
  assert.match(taskCreationUtilsSource, /const writableTag = normalizeWritableTaskTag\(tag\)/);
  assert.match(taskCreationUtilsSource, /const writableLaneTag = normalizeWritableTaskTag\(laneTag\)/);
  assert.match(taskCreationUtilsSource, /for \(const \[defaultProp, field\] of options\.defaults\.inlineFields\)/);
  assert.match(taskCreationUtilsSource, /defaultProp === normalizedProp/);
  assert.match(viewSource, /const taskLine = this\.buildRootTaskLine\(title, propName, targetSelection\.value, taskFilter, defaults\)/);
  assert.doesNotMatch(viewSource, /const taskLine = `- \[ \] \$\{title\}`/);
  assert.doesNotMatch(viewSource, /for \(const tag of tags\) parts\.push\(`#\$\{tag\}`\)[\s\S]{0,120}normalizeTaskTag\(laneValue\)/);
});

test('synthesized Kanban tasks honor Home archive guards and done defaults', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  const lineMetadataApi = createLineMetadataApiMock().api;
  view.app = {};
  provideGcmProtocolApi(view, { lineMetadata: lineMetadataApi });
  view.getStatusForCheckboxState = (state) => String(state).toLowerCase() === '[x]' ? 'complete' : 'todo';
  view.getDoneStatuses = () => new Set(['complete', 'wont-do']);
  view.getTaskInlineValues = (task, key) => (task.inlineFields || [])
    .filter((field) => field.key.toLowerCase() === String(key).toLowerCase())
    .map((field) => field.value);
  view.normalizeInlinePropertyKey = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  view.normalizeTaskTag = (value) => String(value || '').trim().toLowerCase();
  view.resolveBaseContextToken = (value) => String(value || '');
  view.isEmbeddedScheduledDailyTaskBoard = () => false;
  view.shouldShowCompletedTasks = () => false;

  const task = (checkboxState) => ({ itemKind: 'task', checkboxState, inlineFields: [], rawLine: `- ${checkboxState} Task`, text: 'Task' });
  const file = (path) => ({
    path,
    basename: path.split('/').at(-1).replace(/\.md$/i, ''),
    name: path.split('/').at(-1),
    extension: 'md',
    parent: { path: path.split('/').slice(0, -1).join('/') },
  });
  const matches = (roots, checkboxState, path) => {
    view.getBaseFilterRoots = () => roots;
    return view.taskMatchesRootFilter(task(checkboxState), view.getTaskRootFilterFromBaseFilters(), file(path));
  };

  const archiveRoot = { and: ['kind == "task"', '!file.path.startsWith("Archive/")', '!file.path.startsWith("_archive/")'] };
  assert.equal(matches([archiveRoot], '[ ]', 'Archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([archiveRoot], '[ ]', '_archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([archiveRoot], '[ ]', 'Inbox/Home Renovations.md'), true);

  // Home currently renders the custom Tasks.base component. Its persisted
  // filter is wrapped in `or` and uses negative folder equality. For
  // synthesized task rows, an archive root exclusion must also reject files in
  // dated descendants such as Archive/2026-07-05/.
  const homeTasksRoot = {
    or: [{
      and: [
        'kind == "task"',
        'file.folder != "_archive"',
        'file.folder != "Archive"',
      ],
    }],
  };
  assert.equal(matches([homeTasksRoot], '[ ]', 'Archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([homeTasksRoot], '[ ]', '_archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([homeTasksRoot], '[ ]', 'Archive Notes/Home Renovations.md'), true);
  assert.equal(matches([homeTasksRoot], '[ ]', 'Projects/Home Renovations.md'), true);

  const liveHomeTasksRoot = {
    or: [{
      and: [
        { property: 'kind', operator: 'is', value: 'task' },
        { property: 'file.folder', operator: '!=', value: '_archive' },
        { property: 'file.folder', operator: '!=', value: 'Archive' },
      ],
    }],
  };
  assert.equal(matches([liveHomeTasksRoot], '[ ]', 'Archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([liveHomeTasksRoot], '[ ]', '_archive/2026-07-05/Home Renovations.md'), false);
  assert.equal(matches([liveHomeTasksRoot], '[ ]', 'Projects/Home Renovations.md'), true);

  assert.equal(matches(['kind == "task"'], '[x]', 'Inbox/Completed.md'), false);
  assert.equal(matches(['kind == "task"'], '[ ]', 'Inbox/Open.md'), true);
  assert.equal(matches([{ and: ['kind == "task"', 'status == "complete"'] }], '[x]', 'Inbox/Completed.md'), true);

  let scheduled = false;
  view.isBaseFileFilterReady = () => false;
  view.scheduleBaseFileFilterLoad = () => { scheduled = true; };
  const deferred = view.buildTaskRenderItemsByLane([], null, new Set(), {
    mode: 'tasks',
    hasTaskDirective: true,
    includeDone: false,
    statuses: new Set(),
    excludeStatuses: new Set(),
    tags: new Set(),
    excludeTags: new Set(),
  });
  assert.equal(deferred.size, 0);
  assert.equal(scheduled, true);
});

test('bare kind is additive across notes and line entities while itemKind stays structural', async () => {
  const {
    isBareSemanticKindFilter,
    isKanbanStructuralKindValue,
    parseBareSemanticKindExpression,
  } = await importFilterKindUtils();

  for (const value of ['task', 'tasks', 'bullet', 'bullets', 'note', 'notes', 'all', 'mixed']) {
    assert.equal(isKanbanStructuralKindValue(value), true, `${value} should remain structural`);
  }
  assert.equal(parseBareSemanticKindExpression('kind == "workout"'), 'workout');
  assert.equal(parseBareSemanticKindExpression("kind is 'food'"), 'food');
  assert.equal(parseBareSemanticKindExpression('kind == "task"'), null);
  assert.equal(parseBareSemanticKindExpression('task.kind == "workout"'), null);
  assert.equal(isBareSemanticKindFilter('kind', ['workout']), true);
  assert.equal(isBareSemanticKindFilter('kind', ['food']), true);
  assert.equal(isBareSemanticKindFilter('kind', ['task']), false);
  assert.equal(isBareSemanticKindFilter('itemKind', ['workout']), false);

  const { view, file, frontmatter, task } = await createFormulaViewHarness();
  frontmatter.kind = ['task', 'project'];
  const bullet = {
    ...task,
    itemKind: 'bullet',
    checkboxState: undefined,
    line: 9,
    rawLine: task.rawLine.replace('- [ ] Formula task', '- Formula bullet'),
    sourceText: task.sourceText.replace('Formula task', 'Formula bullet'),
    displayText: 'Formula bullet',
  };

  assert.deepEqual(view.getNoteAdditiveKinds(file), ['note', 'task', 'project'], 'native note styles expose structural and frontmatter kinds without a fallback note evaluator');

  assert.equal(view.evaluateTaskFilterString('kind == "task"', task, file), true, 'checkbox structure satisfies additive task kind');
  assert.equal(view.evaluateTaskFilterString('kind == "project"', task, file), true, 'explicit line kind augments structure');
  assert.equal(view.evaluateTaskFilterString('kind !== "task"', task, file), false, 'strict inequality parses as one operator');
  assert.equal(view.evaluateTaskFilterString('kind !== "client"', task, file), true);
  assert.equal(view.evaluateTaskFilterString('itemKind == "task"', task, file), true);
  assert.equal(view.evaluateTaskFilterString('itemKind == "bullet"', task, file), false);
  assert.equal(view.evaluateTaskFilterString('kind == "task"', bullet, file), true, 'an explicit task kind can augment a bullet');
  assert.equal(view.evaluateTaskFilterString('kind == "bullet"', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('kind.contains("project")', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('kind.containsAny("client", "project")', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('kind equals "project"', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('kind.exists()', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('kind.isEmpty()', bullet, file), false);
  assert.equal(view.evaluateTaskFilterString('itemKind == "bullet"', bullet, file), true);
  assert.equal(view.evaluateTaskFilterString('itemKind == "task"', bullet, file), false);
  const duplicateKindsTask = {
    ...task,
    rawLine: '- [ ] Duplicate kinds [kind:: task, Tasks, PROJECT, project]',
    sourceText: 'Duplicate kinds [kind:: task, Tasks, PROJECT, project]',
    inlineFields: [{ key: 'kind', value: 'task, Tasks, PROJECT, project' }],
    lineMetadata: undefined,
  };
  assert.deepEqual(view.getTaskAdditiveKinds(duplicateKindsTask, file), ['task', 'project']);

  for (const lineItem of [task, bullet]) {
    assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: '===', value: lineItem.itemKind }, lineItem, file), true);
    assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: 'exists' }, lineItem, file), true);
    assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: '!exists' }, lineItem, file), false);
    assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: 'empty' }, lineItem, file), false);
    assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: 'isNotEmpty' }, lineItem, file), true);
  }
  globalThis.__KanbanFormulaNotices = [];
  assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: 'matchesRegex', value: 'task' }, task, file), false);
  assert.equal(view.evaluateTaskFilterObject({ property: 'kind', operator: '!matchesRegex', value: 'client' }, task, file), false, 'unsupported negated operators cannot fail open');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
  assert.match(globalThis.__KanbanFormulaNotices[0], /entity filter unavailable/i);
  delete globalThis.__KanbanFormulaNotices;
  assert.equal(view.filterExpressionReferencesFormula('description.contains("formula.score")'), false);
  assert.equal(view.filterExpressionReferencesFormula('note.formula.value == 1'), false);
  assert.equal(view.filterExpressionReferencesFormula('formula.score == 1'), true);
  assert.equal(view.filterExpressionReferencesFormula('formula["Total Cost"] >= 1'), true);

  view.getBaseFilterRoots = () => ['kind == "project"'];
  view.shouldShowCompletedTasks = () => false;
  const rootFilter = view.getTaskRootFilterFromBaseFilters();
  assert.equal(rootFilter.mode, 'mixed');
  assert.equal(rootFilter.hasTaskDirective, true);
  assert.equal(rootFilter.mayMatchBullets, true, 'additive kinds force bullet discovery');
  assert.equal(view.resolveCardAddMode(rootFilter), 'note', 'mixed additive filters preserve the configured add mode');
  view.plugin.settings.cardAddButtonDefault = 'task';
  assert.equal(view.resolveCardAddMode(rootFilter), 'task');

  for (const root of [
    'kind.contains("project")',
    'kind.containsAny("client", "project")',
    'kind equals "project"',
    'kind.exists()',
    'kind.isEmpty()',
    { property: 'kind', operator: 'contains', value: 'project' },
  ]) {
    view.getBaseFilterRoots = () => [root];
    const classified = view.getTaskRootFilterFromBaseFilters();
    assert.equal(classified.hasTaskDirective, true);
    assert.equal(classified.mayMatchBullets, true, `${JSON.stringify(root)} must include bullet candidates`);
  }

  const stringDefaults = view.inferTaskCreationDefaultsFromString('kind == "project"');
  assert.equal(stringDefaults.mode, 'mixed');
  assert.deepEqual(stringDefaults.inlineFields.get('kind'), { key: 'kind', value: 'project' });
  const objectDefaults = view.inferTaskCreationDefaultsFromObject({ property: 'kind', operator: 'is', value: 'project' });
  assert.deepEqual(objectDefaults.inlineFields.get('kind'), { key: 'kind', value: 'project' });
  assert.deepEqual(
    view.inferTaskCreationDefaultsFromObject({ property: 'kind', operator: '===', value: 'project' }).inlineFields.get('kind'),
    { key: 'kind', value: 'project' },
  );
  assert.equal(view.inferTaskCreationDefaultsFromString('kind == "task"').inlineFields.size, 0, 'checkbox structure needs no redundant kind field');
  assert.deepEqual(view.extractNoteFrontmatterDefaults('kind == "project"'), { kind: 'project' });

  globalThis.__KanbanFormulaNotices = [];
  const missing = await createFormulaViewHarness({ lineMetadataApi: null });
  assert.equal(missing.view.evaluateTaskFilterString('kind == "task"', missing.task, missing.file), false);
  assert.equal(missing.view.evaluateTaskFilterString('kind != "project"', missing.task, missing.file), false, 'negative filters also fail closed on incomplete kind data');
  assert.equal(missing.view.evaluateTaskFilterString('itemKind == "task"', missing.task, missing.file), true, 'structural aliases remain independent');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'missing canonical line metadata is visible and deduplicated');
  assert.match(globalThis.__KanbanFormulaNotices[0], /line metadata unavailable/i);
  delete globalThis.__KanbanFormulaNotices;

  globalThis.__KanbanFormulaNotices = [];
  const throwingLineMetadata = createLineMetadataApiMock().api;
  throwingLineMetadata.parseLine = () => { throw new Error('canonical parse failed'); };
  const parseFailure = await createFormulaViewHarness({ lineMetadataApi: throwingLineMetadata });
  assert.equal(parseFailure.view.evaluateTaskFilterString('kind == "task"', parseFailure.task, parseFailure.file), false, 'a canonical parse failure cannot reuse fallback inline fields');
  assert.equal(parseFailure.view.evaluateTaskFilterString('itemKind == "task"', parseFailure.task, parseFailure.file), true);
  assert.match(globalThis.__KanbanFormulaNotices[0], /canonical parse failed/i);
  delete globalThis.__KanbanFormulaNotices;

  assert.doesNotMatch(viewSource, /parseBareSemanticKindExpression|isBareSemanticKindFilter/);
  assert.match(viewSource, /private extractNoteFrontmatterDefaults[\s\S]*defaults\[key\.trim\(\)\] = value;/);
  assert.match(filterKindUtilsSource, /'task',[\s\S]*'tasks',[\s\S]*'bullet',[\s\S]*'bullets',[\s\S]*'note',[\s\S]*'notes',[\s\S]*'all',[\s\S]*'mixed'/);
});

test('native note additive kinds read one metadata snapshot in stable order', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  let cacheReads = 0;
  const cache = {
    frontmatter: { KiNd: ['Task', 'Project, client', 'project'] },
  };
  view.app = {
    metadataCache: {
      getFileCache: () => {
        cacheReads += 1;
        return cache;
      },
    },
  };

  const values = view.getNoteAdditiveKinds({
    path: 'Inbox/Tagged.md',
    basename: 'Tagged',
    name: 'Tagged.md',
    extension: 'md',
  });

  assert.deepEqual(values, ['note', 'task', 'project', 'client']);
  assert.equal(cacheReads, 1);
});

test('kanban creation defaults can be controlled by Base task filters', () => {
  assert.match(viewSource, /targetPath\?: string \| null/);
  assert.match(viewSource, /private inferTaskPathCreationDefaultsFromString\(expr: string\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /\(\?:task\\\.\)\?\(\?:path\|file\|file\\\.path\)/);
  assert.match(viewSource, /private getBaseContextFile\(\): TFile \| null/);
  assert.match(viewSource, /private getDomBaseContextValue\(key: string\): string \| null/);
  assert.match(viewSource, /data-tps-context-scheduled/);
  assert.match(viewSource, /private resolveBaseContextToken\(rawValue: unknown\): string \| null/);
  assert.match(viewSource, /\^this\\\.file\\\.path\$/);
  assert.match(viewSource, /this\.getBaseContextFrontmatterValue\(frontmatterMatch\[1\]\)/);
  assert.match(viewSource, /private getEmbeddedBaseFilterRoot\(\): unknown\[\] \| null/);
  assert.match(viewSource, /private async loadEmbeddedBaseFilters\(file: TFile/);
  assert.match(viewSource, /const blockMatch = this\.getEmbeddedKanbanBlockMatch\(parsed, viewName\)/);
  assert.match(viewSource, /const type = String\(record\.type \|\| ''\)\.trim\(\)/);
  assert.match(viewSource, /const blockPattern = \/```base\\s\*\\n\(\[\\s\\S\]\*\?\)```\/gi/);
  assert.match(viewSource, /this\.extractBaseFileFilterRoots\(parsed, viewName\)/);
  assert.match(viewSource, /this\.embeddedBaseFilterCache = null/);
  assert.match(viewSource, /this\.resolveBaseContextToken\(pathMatch\[1\] \|\| pathMatch\[2\] \|\| pathMatch\[3\]\)/);
  assert.match(viewSource, /this\.resolveBaseContextToken\(comparisonMatch\[2\] \|\| comparisonMatch\[3\] \|\| comparisonMatch\[4\]\)/);
  assert.match(viewSource, /private async resolveRootTaskTargetFile\(defaults = this\.getRootTaskCreationDefaults/);
  assert.match(viewSource, /resolveKanbanRootTaskTargetPath\(defaults\.targetPath, this\.plugin\.settings\?\.defaultRootTaskPath \|\| ''\)/);
  assert.match(viewSource, /await this\.ensureFolderPath\(folderPath\)/);
  assert.match(viewSource, /if \(this\.getPriorityResolvedCreationMode\(taskFilter\) === 'tasks'\) \{/);
  assert.match(viewSource, /await this\.createRootTaskForLane\(null, \{ id: 'ungrouped'/);
  assert.match(viewSource, /private getPriorityResolvedCreationMode\(taskFilter: KanbanTaskRootFilter\)/);
  assert.match(viewSource, /for \(const root of this\.getBaseFilterRoots\(\)\)/);
  assert.match(viewSource, /inferPriorityCreationModeFromFilterNode\(root\)/);
  assert.match(viewSource, /for \(const branchKey of \['or', 'any'\]\)/);
  assert.match(viewSource, /const forcedMode = priorityMode === 'tasks'/);
  assert.match(viewSource, /priorityMode === 'notes'/);
  assert.match(viewSource, /return forcedMode \?\? \(this\.plugin\.settings\?\.cardAddButtonDefault \?\? 'note'\)/);
  assert.doesNotMatch(viewSource, /Calendar\.md/);
  assert.doesNotMatch(viewSource, /console\.debug\('\[TPS Kanban\] (?:lane add action|createRootTaskForLane|getRootTaskCreationDefaults|resolveRootTaskTargetFile)/);
});

test('note-mode creation can target folders and paths from Base note filters', () => {
  assert.match(viewSource, /type NoteCreationDefaults = \{\s*frontmatter: Record<string, unknown>;\s*baseFileName\?: string \| null;\s*blockedReason\?: string \| null;/);
  assert.match(viewSource, /if \(!baseFileName && creationDefaults\.blockedReason\) \{/);
  assert.match(viewSource, /new Notice\(creationDefaults\.blockedReason\)/);
  assert.match(viewSource, /const targetDefault = this\.extractNoteCreationTargetDefault\(root\)/);
  assert.match(viewSource, /await super\.createFileForView\(baseFileName \?\? creationDefaults\.baseFileName \?\? undefined, mergedProcessor\)/);
  assert.match(viewSource, /private extractNoteCreationTargetDefault\(filters: unknown\): Pick<NoteCreationDefaults, 'baseFileName' \| 'blockedReason'>/);
  assert.match(viewSource, /property === 'file\.path' \|\| property === 'path' \|\| property === 'filepath'/);
  assert.match(viewSource, /this\.app\.vault\.getFileByPath\(targetPath\) instanceof TFile/);
  assert.match(viewSource, /Cannot create a matching note because the Base filters require existing file:/);
  assert.match(viewSource, /return \{ baseFileName: targetPath\.replace\(\/\\\.md\$\/i, ''\) \}/);
  assert.match(viewSource, /property === 'file\.folder' \|\| property === 'folder' \|\| property === 'folderpath'/);
  assert.match(viewSource, /return folderTarget \? \{ baseFileName: `\$\{folderTarget\}\/Untitled` \} : \{\}/);
  assert.match(viewSource, /private normalizeNoteTargetPath\(value: unknown\): string \| null/);
  assert.match(viewSource, /private normalizeNoteTargetFolder\(value: unknown\): string \| null/);
  assert.match(viewSource, /if \(!normalized \|\| normalized\.endsWith\('\/'\)\) return null/);
  assert.match(viewSource, /if \(!normalized \|\| normalized\.toLowerCase\(\)\.endsWith\('\.md'\)\) return null/);
});

test('lane add mode resolution keeps tasks and notes explicit while mixed/all defer to settings', () => {
  assert.match(viewSource, /private resolveCardAddMode\(taskFilter: KanbanTaskRootFilter = this\.getTaskRootFilterFromBaseFilters\(\)\): 'note' \| 'task'/);
  assert.match(viewSource, /const priorityMode = this\.getPriorityResolvedCreationMode\(taskFilter\)/);
  assert.match(viewSource, /const forcedMode = priorityMode === 'tasks'/);
  assert.match(viewSource, /: priorityMode === 'notes'/);
  assert.match(viewSource, /return forcedMode \?\? \(this\.plugin\.settings\?\.cardAddButtonDefault \?\? 'note'\)/);
  assert.doesNotMatch(viewSource, /taskOnlyBoard/);
});

test('kanban diagnostics trace drag/drop mutation decisions', () => {
  for (const event of [
    "flow('CardMove', 'frontmatter:start'",
    "flow('CardMove', 'frontmatter:done'",
    "flowWarn('TaskDrop', 'no-change'",
    "flow('TaskDrop', 'confirm:start'",
    "flow('TaskDrop', 'confirm:cancelled'",
    "flow('TaskDrop', 'apply:start'",
    "flow('TaskDrop', changed ? 'apply:done' : 'apply:no-change'",
    "flowWarn('CardNest', 'blocked'",
    "flow('CardNest', 'drop:start'",
    "flow('CardNest', 'drop:done'",
    "flowWarn('LaneOrder', 'drop:ignored'",
    "flow('LaneOrder', 'drop:save'",
    "flow('LaneOrder', 'drop:done'",
    "flow('LaneDrop', 'task:start'",
    "flowWarn('LaneDrop', 'blocked'",
    "flow('LaneDrop', 'done'",
    "flow('OpenTarget', 'focus-existing'",
    "flow('OpenTarget', 'open-new'",
    "flow('OpenTaskLine', 'scroll:start'",
    "flowWarn('OpenTaskLine', 'blocked'",
    "flow('TaskCheckbox', 'update:start'",
    "flow('TaskCheckbox', changed ? 'update:done' : 'update:no-change'",
  ]) {
    assert.match(viewSource, new RegExp(event.replace(/[()'.?]/g, '\\$&')));
  }
});

test('scheduled daily task filters compare by day and render in the daily lane', () => {
  assert.match(viewSource, /private extractDateDay\(value: string\): string \| null/);
  assert.match(viewSource, /private normalizeScheduledLaneValue\(value: string\): string/);
  assert.match(viewSource, /normalized === 'scheduled' \? this\.normalizeScheduledLaneValue\(value\) : value/);
  assert.match(viewSource, /private taskValuesMatch\(propRaw: string, currentValues: string\[\], expectedValue: string\): boolean/);
  assert.match(viewSource, /if \(normalizedProp === 'scheduled'\) \{/);
  assert.match(viewSource, /return currentValues\.some\(\(current\) => this\.extractDateDay\(current\) === expectedDay\)/);
  assert.match(viewSource, /private isEmbeddedScheduledDailyTaskBoard\(\): boolean/);
  assert.doesNotMatch(viewSource, /shouldDefaultScheduledDailyLaneTaskToAllDay/);
  assert.doesNotMatch(viewSource, /parts\.push\(`\[allDay:: true\]`\)/);
  assert.match(taskCreationUtilsSource, /for \(const \[defaultProp, field\] of options\.defaults\.inlineFields\)/);
  assert.match(taskCreationUtilsSource, /parts\.push\(`\[\$\{field\.key\}:: \$\{field\.value\}\]`\)/);
  assert.match(viewSource, /private isEmbeddedScheduledDailyTaskFallbackFilter\(\): boolean/);
  assert.match(viewSource, /private collectFilterTextConditions\(root: unknown, seen = new WeakSet<object>\(\)\): string\[\]/);
  assert.match(viewSource, /private isScheduledTodayCondition\(condition: string\): boolean/);
  assert.match(viewSource, /private isScheduledEmptyCondition\(condition: string\): boolean/);
  assert.match(viewSource, /private taskMatchesEmbeddedScheduledDailyBoard\(task: OpenTaskSubitem\): boolean/);
  assert.match(viewSource, /if \(this\.isEmbeddedScheduledDailyTaskBoard\(\)\) return true/);
  assert.match(viewSource, /structuredMatch == null && this\.isEmbeddedScheduledDailyTaskBoard\(\)/);
  assert.match(viewSource, /if \(!values\.length\) return true/);
  assert.match(viewSource, /this\.taskValuesMatch\(comparisonMatch\[1\]\.trim\(\), values, token\)/);
  assert.match(viewSource, /this\.taskValuesMatch\(propRaw, currentValues, value\)/);
  assert.match(viewSource, /private getTaskCardMetaProperties\(file: TFile, task: OpenTaskSubitem, groupPropName: string \| null\)/);
  assert.match(viewSource, /hidden = new Set\(\['tpsinlineprops', 'externalid', 'externaleventid', 'tpscalendaruid', 'tpscalendarsourceurl'\]\)/);
  assert.match(viewSource, /private formatTaskCardField\(key: string, value: string\): string/);
  assert.match(viewSource, /const dateTime = this\.formatCardPropertyValue\(value\)/);
  assert.match(viewSource, /private isDateLikeProperty\(normalizedKey: string\): boolean/);
  assert.match(viewSource, /private formatDurationLikeValue\(value: string\): string/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-task-card > \.tps-kanban-card-inner > \.tps-kanban-card-title-row\s*\{[\s\S]*grid-template-columns:\s*18px minmax\(0, 1fr\);/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-task-card-title\s*\{[\s\S]*-webkit-line-clamp:\s*2;/);
});

test('Kanban task titles hand off to the exact-line virtual editor', () => {
  assert.match(viewSource, /private openTaskQuickEditor\(event: Event, taskEl: HTMLElement, sourceEl: HTMLElement \| null = taskEl\): boolean/);
  assert.match(viewSource, /getGcmTaskLinesApi\(this\.app\)/);
  assert.match(viewSource, /taskLines\.openQuickEditorForElement\(taskEl, sourceEl\)/);
  assert.match(viewSource, /if \(this\.openTaskQuickEditor\(e, cardEl, titleEl\)\) return/);
});

test('Kanban task interactions and checkbox mappings use only exact public GCM capabilities', async () => {
  const { KanbanView } = await importKanbanView();
  const view = Object.create(KanbanView.prototype);
  view.app = {};
  view.getDoneStatuses = () => new Set(['complete']);

  const contextEvents = [];
  const editorCalls = [];
  const sourceMappings = [
    { checkboxState: '!', statuses: [' Review ', ''], toggleTargetStatus: 'Complete', icon: 'eye', label: 'Review' },
    { checkboxState: '[x]', statuses: ['complete'], toggleTargetStatus: 'todo', icon: 'check', label: 'Complete' },
    { checkboxState: '[ ]', statuses: ['todo'], toggleTargetStatus: 'complete', icon: 'square', label: 'Todo' },
  ];
  provideGcmProtocolApi(view, {
    api: {
      services: {
        parents: {
          getChildKeys: () => ['offspring', 'parentOf'],
        },
      },
      taskLines: {
        version: 1,
        handleContextMenu(event) {
          contextEvents.push(event);
          return true;
        },
        async openQuickEditorForElement(taskEl, sourceEl) {
          editorCalls.push({ taskEl, sourceEl });
          return true;
        },
      },
      taskCheckboxes: {
        version: 1,
        getMappings: () => sourceMappings,
        stateForStatus: (status) => String(status) === 'review' ? '[!]' : '[ ]',
        statusForState: (state) => String(state) === '[!]' ? 'review' : 'todo',
      },
    },
  });

  const contextEvent = { type: 'contextmenu' };
  assert.equal(view.openTaskLineContextMenu(contextEvent), true);
  assert.deepEqual(contextEvents, [contextEvent]);

  const stopped = [];
  const editorEvent = {
    preventDefault: () => stopped.push('preventDefault'),
    stopPropagation: () => stopped.push('stopPropagation'),
    stopImmediatePropagation: () => stopped.push('stopImmediatePropagation'),
  };
  const taskEl = { id: 'task-row' };
  const sourceEl = { id: 'task-title' };
  assert.equal(view.openTaskQuickEditor(editorEvent, taskEl, sourceEl), true);
  assert.deepEqual(stopped, ['preventDefault', 'stopPropagation', 'stopImmediatePropagation']);
  assert.deepEqual(editorCalls, [{ taskEl, sourceEl }]);

  assert.deepEqual(view.getGcmCheckboxMappings(), [
    { checkboxState: '[!]', statuses: ['review'], toggleTargetStatus: 'Complete', icon: 'eye', label: 'Review' },
    { checkboxState: '[x]', statuses: ['complete'], toggleTargetStatus: 'todo', icon: 'check', label: 'Complete' },
    { checkboxState: '[ ]', statuses: ['todo'], toggleTargetStatus: 'complete', icon: 'square', label: 'Todo' },
  ]);
  assert.equal(view.getStatusForCheckboxState('[!]'), 'review');
  assert.equal(view.getCheckboxStateForStatus('review'), '[!]');
  assert.equal(view.getToggleCheckboxStateForTask({ checkboxState: '[!]' }), '[x]');
  assert.deepEqual(view.getChildLinkKeys(), ['offspring', 'parentOf'], 'custom relationship keys come from the public parent service');
  assert.equal(sourceMappings[0].checkboxState, '!', 'Kanban normalizes a local copy instead of mutating provider state');

  provideGcmProtocolApi(view, {
    api: {
      taskLines: {
        version: 2,
        handleContextMenu: () => true,
        openQuickEditorForElement: () => true,
      },
      taskCheckboxes: {
        version: 2,
        getMappings: () => sourceMappings,
        stateForStatus: () => '[!]',
        statusForState: () => 'review',
      },
    },
  });
  assert.equal(view.openTaskLineContextMenu({}), false, 'an unsupported task-lines version fails closed');
  assert.equal(view.openTaskQuickEditor(editorEvent, taskEl, sourceEl), false, 'an unsupported task-lines version does not consume the click');
  assert.equal(view.getCheckboxStateForStatus('review'), null, 'an unsupported checkbox capability cannot leak custom mappings');

  assert.doesNotMatch(viewSource, /getGcmPlugin|getGcmSettings|contextTargetService|taskLineContextMenuService|linkedSubitemCheckboxMappings/);
  assert.doesNotMatch(viewSource, /tps-global-context-menu|TPS-Global-Context-Menu|gcmPlugin/);
  assert.match(viewSource, /this\.getGcmServices\(\)\?\.parents\?\.getChildKeys\?\.\(\)/);
  assert.match(gcmApiSource, /taskLines\.version === TPS_TASK_LINES_API_VERSION/);
  assert.match(gcmApiSource, /taskCheckboxes\.version === TPS_TASK_CHECKBOXES_API_VERSION/);
});

test('kanban does not register vault-wide or Notebook Navigator open interception', () => {
  assert.doesNotMatch(mainSource, /registerVaultWidePreviewClicks/);
  assert.doesNotMatch(mainSource, /handleVaultWideInternalLinkPointer/);
  assert.doesNotMatch(mainSource, /shouldUseHoverPreviewForPointer/);
  assert.doesNotMatch(mainSource, /registerNotebookNavigatorPreviewClicks/);
  assert.doesNotMatch(mainSource, /handleNotebookNavigatorFilePointer/);
  assert.doesNotMatch(mainSource, /this\.registerNotebookNavigatorPreviewClicks\(\)/);
});

function scanPhysicalDocumentLines(content) {
  const source = String(content ?? '');
  const lines = [];
  const newline = /\r\n|\n|\r/gu;
  let cursor = 0;
  let match;
  while ((match = newline.exec(source)) !== null) {
    lines.push({
      index: lines.length,
      lineNumber: lines.length + 1,
      text: source.slice(cursor, match.index),
      start: cursor,
      end: match.index,
    });
    cursor = match.index + match[0].length;
  }
  lines.push({
    index: lines.length,
    lineNumber: lines.length + 1,
    text: source.slice(cursor),
    start: cursor,
    end: source.length,
  });
  return lines;
}

function createLineMetadataApiMock({ scanDocument = scanPhysicalDocumentLines } = {}) {
  let parseCount = 0;
  let scanCount = 0;
  const scanFields = (line) => {
    const source = String(line || '');
    const fields = [];
    for (let index = 0; index < source.length; index += 1) {
      const open = source[index];
      if (open !== '[' && open !== '(') continue;
      const close = open === '[' ? ']' : ')';
      let cursor = index + 1;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      const keyStart = cursor;
      while (/[A-Za-z0-9_.-]/.test(source[cursor] || '')) cursor += 1;
      const key = source.slice(keyStart, cursor);
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      if (!key || source.slice(cursor, cursor + 2) !== '::') continue;
      cursor += 2;
      const valueStart = cursor;
      let depth = 1;
      let end = -1;
      for (; cursor < source.length; cursor += 1) {
        if (source[cursor] === '\\') {
          cursor += 1;
          continue;
        }
        if (source[cursor] === open) depth += 1;
        else if (source[cursor] === close && --depth === 0) {
          end = cursor;
          break;
        }
      }
      if (end < 0) continue;
      fields.push({ key, value: source.slice(valueStart, end).trim() });
      index = end;
    }
    return fields;
  };
  const hasBalancedOuterListBrackets = (raw) => {
    const source = String(raw || '').trim();
    if (!source.startsWith('[') || !source.endsWith(']') || source.startsWith('[[')) return false;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (quote) { if (character === quote) quote = ''; continue; }
      if (character === '"' || character === "'") { quote = character; continue; }
      if (character === '[') depth += 1;
      else if (character === ']') depth -= 1;
      if (depth === 0 && index < source.length - 1) return false;
      if (depth < 0) return false;
    }
    return depth === 0 && !quote;
  };
  const splitStringListText = (raw) => {
    let source = String(raw || '').trim();
    if (hasBalancedOuterListBrackets(source)) source = source.slice(1, -1).trim();
    if (!source) return [];
    const values = [];
    let current = '';
    let quote = '';
    let escaped = false;
    let squareDepth = 0;
    let roundDepth = 0;
    let curlyDepth = 0;
    for (const character of source) {
      if (escaped) { current += character; escaped = false; continue; }
      if (character === '\\') { current += character; escaped = true; continue; }
      if (quote) { current += character; if (character === quote) quote = ''; continue; }
      if (character === '"' || character === "'") { current += character; quote = character; continue; }
      if (character === '[') squareDepth += 1;
      else if (character === ']') squareDepth = Math.max(0, squareDepth - 1);
      else if (character === '(') roundDepth += 1;
      else if (character === ')') roundDepth = Math.max(0, roundDepth - 1);
      else if (character === '{') curlyDepth += 1;
      else if (character === '}') curlyDepth = Math.max(0, curlyDepth - 1);
      if ((character === ',' || character === '\n') && squareDepth === 0 && roundDepth === 0 && curlyDepth === 0) {
        if (current.trim()) values.push(current.trim());
        current = '';
        continue;
      }
      current += character;
    }
    if (current.trim()) values.push(current.trim());
    return values;
  };
  const parseStringList = (value) => {
    const values = [];
    const visit = (item) => {
      if (Array.isArray(item)) { item.forEach(visit); return; }
      if (item == null || item === false) return;
      values.push(...splitStringListText(item));
    };
    visit(value);
    return Array.from(new Set(values));
  };
  const readTags = (line) => {
    const source = String(line || '').replace(/`[^`]*`/g, '');
    const inline = scanFields(source)
      .filter((field) => /^(?:tag|tags)$/i.test(field.key))
      .flatMap((field) => parseStringList(field.value));
    const visible = Array.from(source.matchAll(/(?:^|\s)#([\p{L}\p{N}/_-]+)/gu), (match) => match[1]);
    return Array.from(new Set([...inline, ...visible].map((tag) => String(tag).replace(/^#/, '').toLowerCase())));
  };
  const parseLine = (line) => {
    parseCount += 1;
    const source = String(line || '');
    const fields = scanFields(source);
    const withoutFields = fields.reduce((current, field) => current.replace(`[${field.key}:: ${field.value}]`, ''), source);
    const displayTitle = withoutFields
      .replace(/^\s*(?:[-*+]\s+)?(?:\[[^\]]*\]\s+)?/, '')
      .replace(/<!--.*?-->/g, '')
      .replace(/(?:^|\s)#[\p{L}\p{N}/_-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { fields, tags: readTags(source), displayTitle };
  };
  const api = {
    version: 1,
    readInlineFields: scanFields,
    readInlineFieldValue(line, key) {
      return scanFields(line).find((field) => field.key.toLowerCase() === String(key).toLowerCase())?.value ?? null;
    },
    readTags,
    parseStringList,
    parseTags(value) {
      return parseStringList(value).map((tag) => tag.replace(/^#/, '').toLowerCase());
    },
    getDisplayTitle(line) {
      return parseLine(line).displayTitle;
    },
    parseLine,
    scanDocument(content) {
      scanCount += 1;
      return scanDocument(content);
    },
  };
  return { api, getParseCount: () => parseCount, getScanCount: () => scanCount };
}

function createFormulaApiMock() {
  let lastContext = null;
  let compileCount = 0;
  const getCounts = new Map();
  const expressionCounts = new Map();
  const result = (formula, value) => ({
    status: value == null || value === '' || (Array.isArray(value) && value.length === 0) ? 'empty' : 'value',
    value: value ?? null,
    formula,
  });
  const formulaValue = (name, context, get) => {
    if (name === 'score') return result(name, Number(context.row?.eighth || 0) * 2);
    if (name === 'derived') return result(name, `${get('score').value}-${context.row?.owner}-${context.note?.owner}`);
    if (name === 'lane') return result(name, context.row?.seventh || '');
    if (name === 'flag') return result(name, context.row?.owner === 'row');
    if (name === 'Total Cost') return result(name, get('score').value);
    if (name === 'clock') return result(name, context.now);
    if (name === 'labels') return result(name, ['Alpha', 'Beta']);
    if (name === 'linkLane') return result(name, { __tpsFormulaType: 'link', path: 'People/Ada.md', display: 'Ada' });
    if (name === 'emptyList') return result(name, []);
    if (name === 'conditional') {
      return context.row?.owner === 'bad'
        ? { status: 'error', value: null, formula: name, code: 'conditional-error', message: 'conditional formula failed' }
        : result(name, Number(context.row?.eighth || 0));
    }
    if (name === 'bad') return { status: 'error', value: null, formula: name, code: 'syntax-error', message: 'bad formula' };
    if (name === 'unsupported') return { status: 'unsupported', value: null, formula: name, code: 'unsupported-function', message: 'unsupported formula' };
    return { status: 'error', value: null, formula: name, code: 'unknown-formula', message: `unknown ${name}` };
  };
  const api = {
    version: 1,
    hasReference(expression) {
      const source = String(expression ?? '');
      let searchable = '';
      let quote = '';
      for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
          if (char === '\\') {
            searchable += '  ';
            index += 1;
            continue;
          }
          if (char === quote) quote = '';
          searchable += ' ';
          continue;
        }
        if (char === '"' || char === "'" || char === '`') {
          quote = char;
          searchable += ' ';
          continue;
        }
        searchable += char;
      }
      return /(?:^|[^\w.])formula\s*(?:\.|\[)/i.test(searchable);
    },
    compile(definitions, sourceId) {
      compileCount += 1;
      return { definitions, sourceId, revision: JSON.stringify(definitions) };
    },
    createSession(compiled, context) {
      lastContext = context;
      const memo = new Map();
      const get = (name) => {
        const normalized = String(name || '').replace(/^formula\./i, '');
        if (!memo.has(normalized)) {
          getCounts.set(normalized, (getCounts.get(normalized) || 0) + 1);
          memo.set(normalized, formulaValue(normalized, context, get));
        }
        return memo.get(normalized);
      };
      const evaluateExpression = (expression, label = '$expression') => {
        const raw = String(expression || '').trim();
        expressionCounts.set(raw, (expressionCounts.get(raw) || 0) + 1);
        const direct = raw.match(/^(!)?formula\.([\w$-]+)$/i);
        if (direct) {
          const current = get(direct[2]);
          if (current.status === 'error' || current.status === 'unsupported') return { ...current, formula: label };
          const truthy = api.isTruthy(current.value);
          return result(label, direct[1] ? !truthy : truthy);
        }
        const bracketComparison = raw.match(/^(!)?formula\[(?:"([^"]+)"|'([^']+)')\]\s*(==|!=|>=|<=|>|<)\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))$/i);
        if (bracketComparison) {
          const current = get(bracketComparison[2] ?? bracketComparison[3]);
          if (current.status === 'error' || current.status === 'unsupported') return { ...current, formula: label };
          const expectedRaw = bracketComparison[5] ?? bracketComparison[6] ?? bracketComparison[7] ?? '';
          const expected = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expectedRaw) ? Number(expectedRaw) : expectedRaw;
          const operator = bracketComparison[4];
          let matches;
          if (operator === '==') matches = current.value === expected;
          else if (operator === '!=') matches = current.value !== expected;
          else if (operator === '>=') matches = current.value >= expected;
          else if (operator === '<=') matches = current.value <= expected;
          else if (operator === '>') matches = current.value > expected;
          else matches = current.value < expected;
          return result(label, bracketComparison[1] ? !matches : matches);
        }
        const comparison = raw.match(/^(!)?formula\.([\w$-]+)\s*(==|!=|>=|<=|>|<)\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))$/i);
        if (comparison) {
          const current = get(comparison[2]);
          if (current.status === 'error' || current.status === 'unsupported') return { ...current, formula: label };
          const expectedRaw = comparison[4] ?? comparison[5] ?? comparison[6] ?? '';
          const expected = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expectedRaw) ? Number(expectedRaw) : expectedRaw;
          let matches;
          if (comparison[3] === '==') matches = current.value === expected;
          else if (comparison[3] === '!=') matches = current.value !== expected;
          else if (comparison[3] === '>=') matches = current.value >= expected;
          else if (comparison[3] === '<=') matches = current.value <= expected;
          else if (comparison[3] === '>') matches = current.value > expected;
          else matches = current.value < expected;
          return result(label, comparison[1] ? !matches : matches);
        }
        const empty = raw.match(/^formula\.([\w$-]+)\.(isEmpty|isNotEmpty)\(\)$/i);
        if (empty) {
          const current = get(empty[1]);
          if (current.status === 'error' || current.status === 'unsupported') return { ...current, formula: label };
          const isEmpty = current.value == null || current.value === '' || (Array.isArray(current.value) && current.value.length === 0);
          return result(label, empty[2].toLowerCase() === 'isempty' ? isEmpty : !isEmpty);
        }
        const contains = raw.match(/^(!)?formula\.([\w$-]+)\.contains\("([^"]*)"\)$/i);
        if (contains) {
          const current = get(contains[2]);
          if (current.status === 'error' || current.status === 'unsupported') return { ...current, formula: label };
          const matched = Array.isArray(current.value)
            ? current.value.includes(contains[3])
            : String(current.value ?? '').includes(contains[3]);
          return result(label, contains[1] ? !matched : matched);
        }
        return { status: 'error', value: null, formula: label, code: 'unsupported-test-expression', message: raw };
      };
      return {
        compiled,
        get,
        getAll: () => Object.fromEntries(Object.keys(compiled.definitions).map((name) => [name, get(name)])),
        evaluateExpression,
      };
    },
    evaluateExpression() {
      throw new Error('Kanban should reuse its row session for filter expressions');
    },
    format(value) {
      if (value instanceof Date) {
        const pad = (part) => String(part).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
      }
      if (Array.isArray(value)) return value.join(', ');
      return value == null ? '' : String(value);
    },
    comparableValues(value) {
      return Array.isArray(value) ? value : value == null ? [] : [value];
    },
    sortKey(value) {
      return typeof value === 'number' ? `1:${String(value).padStart(8, '0')}` : `3:${String(value ?? '').toLowerCase()}`;
    },
    groupValues(value) {
      const unwrap = (item) => {
        if (item?.constructor?.type === 'list' && typeof item.length === 'function' && typeof item.get === 'function') {
          return Array.from({ length: item.length() }, (_, index) => item.get(index)).flatMap(unwrap);
        }
        if (item instanceof Set || Array.isArray(item)) return Array.from(item).flatMap(unwrap);
        return item == null ? [] : [item];
      };
      const values = unwrap(value);
      const seen = new Set();
      return values.flatMap((item) => {
        const text = item?.__tpsFormulaType === 'link' || item?.constructor?.type === 'link'
          ? String(item.path || '').trim()
          : api.format(item).trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) return [];
        seen.add(key);
        return [text];
      });
    },
    compare(left, right) {
      if (left?.__tpsFormulaType === 'link' || right?.__tpsFormulaType === 'link') {
        const path = (value) => String(value?.path ?? value ?? '').replace(/\.md$/i, '').toLowerCase();
        return path(left).localeCompare(path(right), undefined, { numeric: true, sensitivity: 'base' });
      }
      if (left instanceof Date || right instanceof Date) return new Date(left).getTime() - new Date(right).getTime();
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (String(left ?? '').trim() && String(right ?? '').trim() && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
      }
      return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    },
    isTruthy(value) {
      return Boolean(value);
    },
  };
  return {
    api,
    getLastContext: () => lastContext,
    getCompileCount: () => compileCount,
    getFormulaCount: (name) => getCounts.get(name) || 0,
    getExpressionCount: (expression) => expressionCounts.get(String(expression || '').trim()) || 0,
  };
}

async function createFormulaViewHarness({
  formulasApi = createFormulaApiMock().api,
  lineMetadataApi = createLineMetadataApiMock().api,
} = {}) {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const file = Object.assign(new TFile(), {
    path: 'Inbox/Formula Tasks.md',
    name: 'Formula Tasks.md',
    basename: 'Formula Tasks',
    extension: 'md',
    parent: { path: 'Inbox' },
    stat: { size: 128, ctime: 10, mtime: 20 },
  });
  const frontmatter = { owner: 'note', category: 'source-note' };
  const view = Object.create(KanbanView.prototype);
  view.app = {
    metadataCache: {
      getFileCache(received) {
        assert.equal(received, file);
        return { frontmatter, tags: [{ tag: '#source' }], links: [{ link: 'Target' }] };
      },
    },
  };
  provideGcmProtocolApi(view, { formulas: formulasApi, lineMetadata: lineMetadataApi });
  view.plugin = { settings: {} };
  view.config = {};
  view.formulaCompileCache = null;
  view.taskFormulaSessions = new WeakMap();
  view.formulaFileContexts = new Map();
  view.formulaLaneLabels = new Map();
  view.formulaDiagnostics = new Set();
  view.formulaNow = new Date(2026, 6, 31, 12, 0, 0);
  const formulaDefinitions = {
    score: 'number(eighth) * 2',
    derived: 'formula.score.toString() + "-" + owner + "-" + note.owner',
    lane: 'seventh',
    flag: 'owner == "row"',
    'Total Cost': 'formula.score',
    clock: 'now()',
    labels: '["Alpha", "Beta"]',
    linkLane: 'link("People/Ada.md", "Ada")',
    emptyList: '[]',
    conditional: 'owner == "bad" ? missing() : number(eighth)',
    bad: '(',
    unsupported: 'random()',
  };
  view.getActiveFormulaDefinitions = () => formulaDefinitions;
  view.getBaseSourcePath = () => 'Formula QA.base';
  view.getConfiguredBaseViewName = () => 'Formula board';
  view.getBaseContextFile = () => null;
  view.getBaseFile = () => null;
  view.createFormulaThisValue = () => ({ scheduled: '2026-07-31' });
  view.getTaskVisibleTitle = (task) => task.displayText || task.text;
  view.getStatusForCheckboxState = () => 'todo';
  view.getDoneStatuses = () => new Set(['complete']);
  view.getGcmServices = () => null;
  const task = {
    itemKind: 'task',
    line: 7,
    checkboxState: '[ ]',
    text: 'Formula task',
    sourceText: 'Formula task [first:: 1] [second:: 2] [third:: 3] [fourth:: 4] [fifth:: 5] [sixth:: 6] [seventh:: Urgent] [eighth:: 7] [owner:: row] [kind:: project, task] [status:: relational] [blank:: ] [project:: [[Projects/Alpha]]]',
    rawLine: '- [ ] Formula task [first:: 1] [second:: 2] [third:: 3] [fourth:: 4] [fifth:: 5] [sixth:: 6] [seventh:: Urgent] [eighth:: 7] [owner:: row] [kind:: project, task] [status:: relational] [blank:: ] [project:: [[Projects/Alpha]]] #work',
    displayText: 'Formula task',
    inlineFields: [
      { key: 'first', value: '1' },
      { key: 'second', value: '2' },
      { key: 'third', value: '3' },
      { key: 'fourth', value: '4' },
      { key: 'fifth', value: '5' },
      { key: 'sixth', value: '6' },
      { key: 'seventh', value: 'Urgent' },
      { key: 'eighth', value: '7' },
      { key: 'owner', value: 'row' },
      { key: 'kind', value: 'project, task' },
      { key: 'status', value: 'relational' },
    ],
  };
  return { KanbanView, view, file, frontmatter, task };
}

test('synthesized Kanban rows use the GCM formula session across context, dependencies, display, filters, lanes, sort, and search', async () => {
  const formulaMock = createFormulaApiMock();
  const lineMetadataMock = createLineMetadataApiMock();
  const { view, file, task } = await createFormulaViewHarness({ formulasApi: formulaMock.api, lineMetadataApi: lineMetadataMock.api });
  assert.deepEqual(
    view.extractBaseFormulaDefinitions({ formulas: { score: ' number(eighth) * 2 ', empty: '', 'formula.prefixed': ' 1 ', invalid: 4 } }),
    { score: 'number(eighth) * 2', empty: '', 'formula.prefixed': '1' },
    'formula names remain exact and empty expressions reach the GCM compiler for visible validation',
  );
  const parsedFields = view.extractTaskInlineFields('[a:: 1] [b:: 2] [c:: 3] [d:: 4] [e:: 5] [f:: 6] [g:: 7] [h:: 8]');
  assert.equal(parsedFields.length, 8, 'formula row context must not truncate after six inline fields');
  const nestedFields = view.extractTaskInlineFields('- [ ] Nested [project:: [[Projects/Alpha]]] [blank:: ] [tags:: alpha, beta] #home');
  assert.equal(nestedFields.find((field) => field.key === 'project')?.value, '[[Projects/Alpha]]');
  assert.equal(nestedFields.find((field) => field.key === 'blank')?.value, '', 'blank properties remain distinct from missing properties');
  const nestedTask = { itemKind: 'task', line: 1, text: 'Nested', inlineFields: nestedFields };
  assert.deepEqual(view.getTaskInlineValues(nestedTask, 'tags').sort(), ['#alpha', '#beta', '#home']);
  assert.deepEqual(lineMetadataMock.api.parseStringList('project'), ['project']);
  assert.deepEqual(lineMetadataMock.api.parseStringList('project, task'), ['project', 'task']);
  assert.deepEqual(lineMetadataMock.api.parseStringList('[project, task]'), ['project', 'task']);
  assert.deepEqual(lineMetadataMock.api.parseStringList('Project, project, Project, '), ['Project', 'project']);
  assert.deepEqual(lineMetadataMock.api.parseStringList('[[People/Doe, Jane]], project'), ['[[People/Doe, Jane]]', 'project']);
  assert.equal(lineMetadataMock.api.readInlineFieldValue('[blank:: ]', 'blank'), '');
  assert.equal(lineMetadataMock.api.readInlineFieldValue('[blank:: ]', 'missing'), null);

  const parseCountBeforeRow = lineMetadataMock.getParseCount();
  const derived = view.getTaskPropertyValue(file, task, 'formula.derived', new Set());
  assert.equal(derived.text, '14-row-note');
  assert.equal(derived.editable, false);
  assert.equal(view.getTaskPropertyValue(file, task, 'formula.clock', new Set()).text, '2026-07-31 12:00:00');
  const context = formulaMock.getLastContext();
  assert.equal(context.row.owner, 'row', 'bare values must prefer synthesized-row fields');
  assert.equal(context.note.owner, 'note', 'note namespace must retain source frontmatter');
  assert.equal(context.row.line, 7, 'line numbers must remain 1-based');
  assert.equal(context.row.status, 'relational', 'row.status remains the semantic inline field');
  assert.equal(context.task.status, 'todo', 'task.status remains checkbox workflow state');
  assert.equal(context.row.checkboxState, '[ ]', 'row.checkboxState preserves the raw checkbox marker');
  assert.equal(context.task.checkboxState, '[ ]', 'task.checkboxState preserves the raw checkbox marker');
  assert.equal(context.row.checkboxStatus, 'todo', 'row.checkboxStatus remains the normalized workflow status');
  assert.equal(context.row.blank, '', 'blank canonical fields remain addressable');
  assert.equal(context.row.project, '[[Projects/Alpha]]');
  assert.deepEqual(context.row.kinds, ['task', 'project']);
  assert.deepEqual(context.row.explicitKind, ['project', 'task']);
  assert.deepEqual(context.row.tags, ['#work'], 'synthetic row tags use canonical #tag values');
  assert.deepEqual(context.task.tags, ['#work'], 'task.tags matches the shared synthetic tag contract');
  assert.equal(context.row.itemKind, 'task');
  assert.equal(context.row.itemkind, 'task');
  assert.equal(context.row.file, undefined, 'row.file is not a duplicate structural namespace');
  assert.match(context.line.raw, /^- \[ \] Formula task/);
  assert.deepEqual(context.file.tags, ['source'], 'file.tags uses canonical unprefixed metadata tags');
  assert.equal(context.line.number, 7);
  assert.equal(context.file.path, file.path);
  assert.equal(context.now, view.formulaNow, 'all formula sessions in one render share one frozen now value');
  assert.equal(view.createFormulaFileContext(file), view.createFormulaFileContext(file), 'one render reuses immutable source-file formula context');
  assert.equal(lineMetadataMock.getParseCount(), parseCountBeforeRow + 1, 'one canonical parsed-line bundle is cached for every formula consumer on the row');
  const caseTask = {
    itemKind: 'task',
    line: 12,
    checkboxState: '[ ]',
    text: 'Case aliases',
    rawLine: '- [ ] Case aliases [Owner:: A] [owner:: B] [Project:: Alpha] [project:: Beta] [blank:: ]',
    sourceText: 'Case aliases [Owner:: A] [owner:: B] [Project:: Alpha] [project:: Beta] [blank:: ]',
    inlineFields: [],
  };
  const caseContext = view.createTaskFormulaContext(file, caseTask);
  assert.deepEqual(caseContext.row.owner, ['A', 'B']);
  assert.equal(caseContext.row.Owner, caseContext.row.owner, 'case aliases expose the same normalized aggregate instead of divergent exact values');
  assert.deepEqual(caseContext.row.project, ['Alpha', 'Beta'], 'duplicate normalized inline aliases aggregate in source order');
  assert.equal(caseContext.row.Project, caseContext.row.project);
  assert.equal(caseContext.row.blank, '', 'blank duplicate-capable aliases remain present instead of becoming missing');

  assert.equal(view.evaluateTaskFilterString('formula.flag', task, file), true, 'direct boolean formulas use the GCM expression session');
  assert.equal(view.evaluateTaskFilterString('formula.lane == "Urgent"', task, file), true, 'string formula filters use the GCM expression session');
  assert.equal(view.evaluateTaskFilterString('formula["Total Cost"] >= 14', task, file), true, 'computed formula references route through the GCM expression session');
  assert.equal(view.evaluateTaskFilterString('formula.score >= 14', task, file), true);
  assert.equal(view.evaluateTaskFilterString('formula.score > 14', task, file), false);
  assert.equal(view.evaluateTaskFilterNode({ not: 'formula.score > 14' }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'formula.score', operator: '>=', value: 14 }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'formula.derived', operator: 'contains', value: 'row' }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'formula.Total Cost', operator: '>=', value: 14 }, task, file), true, 'object filters safely address formula names that require computed references');
  assert.equal(view.evaluateTaskFilterObject({ property: 'formula.labels', operator: 'is', value: 'alpha' }, task, file), true, 'collection equality compares each typed formula member');
  assert.equal(view.evaluateTaskFilterObject({ property: 'formula.labels', operator: '!is', value: 'gamma' }, task, file), true);
  assert.equal(view.evaluateTaskFilterString('formula.emptyList', task, file), true, 'Bases formula truthiness follows JavaScript boolean coercion for plain lists');

  view.getBaseFilterRoots = () => [{ or: ['kind == "task"', 'formula.bad'] }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), true);
  assert.equal(formulaMock.getExpressionCount('formula.bad'), 0, 'a true OR branch skips an unreachable formula error');
  view.getBaseFilterRoots = () => [{ or: ['formula.bad', 'kind == "task"'] }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false, 'an evaluated formula error fails the row before later OR branches');
  assert.equal(formulaMock.getExpressionCount('formula.bad'), 1);
  view.getBaseFilterRoots = () => [{ and: ['kind == "note"', 'formula.bad'] }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false);
  assert.equal(formulaMock.getExpressionCount('formula.bad'), 1, 'a false AND branch skips an unreachable formula error');
  view.getBaseFilterRoots = () => [{ and: ['formula.bad', 'kind == "note"'] }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false);
  assert.equal(formulaMock.getExpressionCount('formula.bad'), 2);
  view.getBaseFilterRoots = () => [{ not: 'formula.bad' }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false, 'NOT cannot turn an evaluated formula failure into a match');
  assert.equal(formulaMock.getExpressionCount('formula.bad'), 3);

  assert.deepEqual(view.getTaskLaneIds(file, task, 'formula.lane'), ['key:urgent']);
  const multiValueLaneIds = view.getTaskLaneIds(file, task, 'formula.labels');
  assert.deepEqual(multiValueLaneIds, ['key:alpha', 'key:beta']);
  const placement = { file, task, laneId: multiValueLaneIds[0] };
  const placementsByLane = new Map([
    [multiValueLaneIds[0], [placement]],
    [multiValueLaneIds[1], [{ ...placement, laneId: multiValueLaneIds[1] }]],
  ]);
  assert.equal(view.countUniqueTaskRenderItems(placementsByLane), 1, 'multi-value formula lanes count one stable line entity');
  assert.equal(view.dedupeTaskRenderItems(Array.from(placementsByLane.values()).flat()).length, 1, 'aliased display lanes render one card per line entity');
  assert.deepEqual(view.getTaskLaneIds(file, task, 'formula.linkLane'), ['key:people/ada.md'], 'link formula grouping uses canonical paths, not display text');
  assert.equal(view.createSyntheticGroupFromLaneId('key:urgent').key, 'Urgent', 'task-only formula lanes retain the API-formatted label');
  assert.equal(view.taskMatchesSearchQuery(file, task, '14-row-note'), true);

  const matchingStyle = {
    active: true,
    match: 'all',
    conditions: [
      { field: 'formula.score', operator: 'is', value: '14' },
      { field: 'formula.clock', operator: 'is', value: '2026-07-31 12:00:00' },
    ],
    color: '#fff',
  };
  view.plugin.settings.cardStyleRules = [matchingStyle];
  assert.equal(view.resolveTaskCardStyleRule(file, task, null), matchingStyle, 'style rules can consume formula values');

  view.plugin.settings.cardStyleRules = [{
    active: true,
    match: 'any',
    conditions: [
      { field: 'status', operator: 'is', value: 'todo' },
      { field: 'formula.bad', operator: '!exists', value: '' },
    ],
    color: '#000',
  }];
  const lazyAnyRule = view.plugin.settings.cardStyleRules[0];
  const badEvaluationsBefore = formulaMock.getFormulaCount('bad');
  assert.equal(view.resolveTaskCardStyleRule(file, task, null), lazyAnyRule, 'an earlier matching any-condition skips unreachable formula work');
  assert.equal(formulaMock.getFormulaCount('bad'), badEvaluationsBefore);

  const trueBoolean = view.getTaskPropertyValue(file, task, 'formula.flag', new Set());
  assert.equal(trueBoolean.kind, 'formula-boolean');
  assert.equal(trueBoolean.booleanValue, true);
  const falseTask = {
    ...task,
    line: 10,
    rawLine: task.rawLine.replace('[owner:: row]', '[owner:: other]'),
    sourceText: task.sourceText.replace('[owner:: row]', '[owner:: other]'),
    inlineFields: task.inlineFields.map((field) => field.key === 'owner' ? { ...field, value: 'other' } : field),
    lineMetadata: undefined,
  };
  const falseBoolean = view.getTaskPropertyValue(file, falseTask, 'formula.flag', new Set());
  assert.equal(falseBoolean.kind, 'formula-boolean');
  assert.equal(falseBoolean.booleanValue, false, 'false formula values stay visible as unchecked read-only booleans');
  assert.equal(view.getTaskPropertyValue(file, task, 'formula.emptyList', new Set()), null, 'empty formulas omit the property chip');
  assert.equal(view.getTaskPropertyValue(file, task, 'formula.bad', new Set()).kind, 'formula-error', 'formula errors remain visibly distinct from empty values');

  const bullet = {
    ...task,
    itemKind: 'bullet',
    line: 11,
    checkboxState: undefined,
    text: 'Formula bullet',
    sourceText: task.sourceText.replace('Formula task', 'Formula bullet'),
    rawLine: task.rawLine.replace('- [ ] Formula task', '- Formula bullet'),
    displayText: 'Formula bullet',
    lineMetadata: undefined,
  };
  assert.equal(view.getTaskPropertyValue(file, bullet, 'formula.derived', new Set()).text, '14-row-note');
  const bulletContext = formulaMock.getLastContext();
  assert.equal(bulletContext.row.kind, 'bullet');
  assert.equal(bulletContext.row.title, 'Formula bullet');
  assert.equal(bulletContext.row.line, 11);
  assert.equal(bulletContext.line.number, 11);
  assert.equal(bulletContext.task, null, 'bullet rows expose line context without masquerading as checkbox tasks');
  assert.equal(bulletContext.row.checkboxState, undefined, 'plain bullets do not synthesize checkbox aliases');
  assert.equal(bulletContext.row.status, 'relational');
  assert.equal(view.evaluateTaskFilterString('formula.flag', bullet, file), true);
  assert.deepEqual(view.getTaskLaneIds(file, bullet, 'formula.lane'), ['key:urgent']);

  const lowerTask = {
    ...task,
    line: 8,
    rawLine: task.rawLine.replace('[eighth:: 7]', '[eighth:: 3]'),
    sourceText: task.sourceText.replace('[eighth:: 7]', '[eighth:: 3]'),
    inlineFields: task.inlineFields.map((field) => field.key === 'eighth' ? { ...field, value: '3' } : field),
    lineMetadata: undefined,
  };
  view.config = { getSort: () => [{ property: 'formula.score', direction: 'desc' }] };
  const sorted = view.sortTaskRenderItems([
    { file, task: lowerTask, laneId: 'key:urgent' },
    { file, task, laneId: 'key:urgent' },
  ]);
  assert.equal(sorted[0].task, task);
  const taskOnlyMixedSorted = view.sortMixedLaneRenderItems([], [
    { file, task: lowerTask, laneId: 'key:urgent' },
    { file, task, laneId: 'key:urgent' },
  ]);
  assert.equal(taskOnlyMixedSorted[0].item.task, task, 'formula sort descriptors apply even when a lane contains only synthesized rows');
  const unavailableTask = {
    ...lowerTask,
    line: 10,
    rawLine: lowerTask.rawLine.replace('[owner:: row]', '[owner:: bad]'),
    sourceText: lowerTask.sourceText.replace('[owner:: row]', '[owner:: bad]'),
    inlineFields: lowerTask.inlineFields.map((field) => field.key === 'owner' ? { ...field, value: 'bad' } : field),
    lineMetadata: undefined,
  };
  view.config = { getSort: () => [{ property: 'formula.conditional', direction: 'desc' }] };
  assert.equal(view.sortTaskRenderItems([
    { file, task: unavailableTask, laneId: 'key:urgent' },
    { file, task, laneId: 'key:urgent' },
  ])[0].task, task, 'failed formula sort values stay after available values even in descending order');
  view.app.vault = {
    getFileByPath: (path) => path === file.path ? file : null,
  };
  const statusResolver = view.getStatusForCheckboxState;
  view.getStatusForCheckboxState = (state) => state === '[x]' ? 'complete' : 'todo';
  view.shouldShowCompletedTasks = () => false;
  view.getBaseFilterRoots = () => ['formula.flag'];
  const doneTask = { ...task, checkboxState: '[x]', line: 13 };
  const hiddenDoneFilter = view.getTaskRootFilterFromBaseFilters();
  assert.equal(hiddenDoneFilter.hasFormulaFilter, true);
  assert.equal(view.taskMatchesRootFilter(doneTask, hiddenDoneFilter, file), false, 'an unrelated formula filter cannot bypass completed-task visibility');
  view.shouldShowCompletedTasks = () => true;
  assert.equal(view.taskMatchesRootFilter(doneTask, view.getTaskRootFilterFromBaseFilters(), file), true);
  view.getStatusForCheckboxState = statusResolver;
  view.shouldShowCompletedTasks = () => false;
  view.getBaseFilterRoots = () => ['formula.flag'];
  view.getExplicitTaskSourceFiles = () => [];
  view.getIndexedLineSourceFiles = () => [file];
  view.isBaseFileFilterReady = () => true;
  view.getActiveBasesSearchQuery = () => '';
  view.getAllLineItemsForFile = () => [task];
  const formulaOnlyTaskFilter = view.getTaskRootFilterFromBaseFilters();
  assert.equal(formulaOnlyTaskFilter.hasTaskDirective, true);
  assert.equal(view.shouldScanVaultForTaskFilters(formulaOnlyTaskFilter), true);
  assert.equal(view.buildTaskRenderItemsByLane([], null, new Set(), formulaOnlyTaskFilter).get('ungrouped')?.length, 1, 'formula-only filters discover synthetic rows even when native note groups are empty');
  assert.equal(formulaMock.getCompileCount(), 1, 'one authoritative Base definition compiles once across all task formula consumers');
});

test('formula API absence, version mismatch, formula errors, and unsupported operations fail visibly and closed', async () => {
  globalThis.__KanbanFormulaNotices = [];
  const missing = await createFormulaViewHarness({ formulasApi: null });
  assert.deepEqual(missing.view.getTaskLaneIds(missing.file, missing.task, 'formula.lane'), ['ungrouped']);
  assert.deepEqual(missing.view.getTaskLaneIds(missing.file, missing.task, 'formula.lane'), ['ungrouped']);
  missing.view.getBaseFilterRoots = () => [{ not: 'formula.score == 14' }];
  assert.equal(missing.view.taskMatchesStructuredBaseFilters(missing.task, missing.file), false);
  assert.equal(missing.view.taskMatchesStructuredBaseFilters(missing.task, null), false, 'missing row context cannot be inverted into a passing formula filter');
  assert.equal(missing.view.getTaskPropertyValue(missing.file, missing.task, 'formula.score', new Set()).text, '⚠ Formula');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'missing API diagnostics must be deduplicated');

  globalThis.__KanbanFormulaNotices = [];
  const incompatibleApi = { ...createFormulaApiMock().api, version: 2 };
  const incompatible = await createFormulaViewHarness({ formulasApi: incompatibleApi });
  incompatible.view.getBaseFilterRoots = () => ['formula.score == 14'];
  assert.equal(incompatible.view.taskMatchesStructuredBaseFilters(incompatible.task, incompatible.file), false);
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
  assert.match(globalThis.__KanbanFormulaNotices[0], /version 1 is required/i);

  globalThis.__KanbanFormulaNotices = [];
  const incompleteApi = { ...createFormulaApiMock().api };
  delete incompleteApi.hasReference;
  const incomplete = await createFormulaViewHarness({ formulasApi: incompleteApi });
  incomplete.view.getBaseFilterRoots = () => ['formula.score == 14'];
  assert.equal(incomplete.view.taskMatchesStructuredBaseFilters(incomplete.task, incomplete.file), false);
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
  assert.match(globalThis.__KanbanFormulaNotices[0], /complete formula contract was not available/i);

  for (const [label, hasReference] of [
    ['throwing', () => { throw new Error('reference detector unavailable'); }],
    ['invalid', () => 'yes'],
  ]) {
    globalThis.__KanbanFormulaNotices = [];
    const unavailableApi = { ...createFormulaApiMock().api, hasReference };
    const unavailable = await createFormulaViewHarness({ formulasApi: unavailableApi });
    const computedReference = 'kind == "task" && formula["score"] > 1';
    unavailable.view.getBaseFilterRoots = () => [computedReference];
    assert.equal(
      unavailable.view.taskMatchesStructuredBaseFilters(unavailable.task, unavailable.file),
      false,
      `${label} reference detection cannot admit a compound formula filter`,
    );
    unavailable.view.getBaseFilterRoots = () => [{ not: computedReference }];
    assert.equal(
      unavailable.view.taskMatchesStructuredBaseFilters(unavailable.task, unavailable.file),
      false,
      `${label} reference detection cannot be inverted by NOT`,
    );
    unavailable.view.getBaseFilterRoots = () => [{ or: ['kind == "task"', computedReference] }];
    assert.equal(
      unavailable.view.taskMatchesStructuredBaseFilters(unavailable.task, unavailable.file),
      false,
      `${label} reference detection cannot be bypassed by an earlier passing OR branch`,
    );
    assert.equal(globalThis.__KanbanFormulaNotices.length, 1, `${label} diagnostics are visible and deduplicated`);
    assert.match(globalThis.__KanbanFormulaNotices[0], /formula reference/i);
  }

  globalThis.__KanbanFormulaNotices = [];
  const broken = await createFormulaViewHarness();
  assert.equal(broken.view.getTaskPropertyValue(broken.file, broken.task, 'formula.bad', new Set()).text, '⚠ Formula');
  assert.deepEqual(broken.view.getTaskLaneIds(broken.file, broken.task, 'formula.unsupported'), ['ungrouped']);
  broken.view.getBaseFilterRoots = () => ['formula.bad == true'];
  assert.equal(broken.view.taskMatchesStructuredBaseFilters(broken.task, broken.file), false);
  broken.view.getBaseFilterRoots = () => [{ property: 'formula.score', operator: 'matchesRegex', value: '^14$' }];
  assert.equal(broken.view.taskMatchesStructuredBaseFilters(broken.task, broken.file), false, 'unknown object operators cannot silently degrade to equality');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 4, 'one visible diagnostic is emitted per distinct formula failure route');
  assert.match(globalThis.__KanbanFormulaNotices.at(-1), /not supported/i);
  delete globalThis.__KanbanFormulaNotices;
});

test('recognized line fields reject unsupported object operators without equality or NOT fallbacks', async () => {
  const { view, file, task } = await createFormulaViewHarness();
  assert.equal(view.evaluateTaskFilterObject({ property: 'owner', operator: 'is', value: 'row' }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'owner', operator: 'contains', value: 'ow' }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'owner', operator: 'isNotEmpty' }, task, file), true);
  assert.equal(view.evaluateTaskFilterObject({ property: 'owner', operator: 'notexists' }, task, file), false);
  assert.equal(view.evaluateTaskFilterObject({ property: 'open', operator: 'is', value: false }, task, file), false);

  globalThis.__KanbanFormulaNotices = [];
  const unsupported = { property: 'owner', operator: 'matchesRegex', value: 'row' };
  assert.equal(view.evaluateTaskFilterObject(unsupported, task, file), false, 'unknown positive operators never degrade to equality');
  assert.equal(view.evaluateTaskFilterObject({ ...unsupported, operator: '!matchesRegex' }, task, file), false, 'unknown negated operators fail closed directly');
  view.getBaseFilterRoots = () => [{ not: unsupported }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false, 'NOT cannot invert an unsupported operation into a match');
  view.getBaseFilterRoots = () => [{ or: [unsupported, 'kind == "task"'] }];
  assert.equal(view.taskMatchesStructuredBaseFilters(task, file), false, 'an evaluated unsupported branch fails the full structured row filter');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'unsupported-operator diagnostics are visible and deduplicated');
  delete globalThis.__KanbanFormulaNotices;
});

test('public GCM capability handshake supports either load order and clears atomically on unload', async () => {
  const bridge = await importGcmApiBridge();
  const createWorkspace = () => {
    const listeners = new Map();
    return {
      on(name, callback) {
        const callbacks = listeners.get(name) ?? new Set();
        callbacks.add(callback);
        listeners.set(name, callbacks);
        return () => callbacks.delete(callback);
      },
      trigger(name, payload) {
        for (const callback of listeners.get(name) ?? []) callback(payload);
      },
    };
  };
  const createExactEvent = (api) => ({
    source: 'tps-global-context-menu',
    timestamp: 1,
    available: true,
    api,
    formulasVersion: 1,
    lineMetadataVersion: 1,
    entityIndexVersion: 3,
    taskLinesVersion: api?.taskLines?.version ?? null,
    taskCheckboxesVersion: api?.taskCheckboxes?.version ?? null,
  });
  const api = {
    formulas: createFormulaApiMock().api,
    lineMetadata: createLineMetadataApiMock().api,
    entityIndex: createEntityIndexApiMock(),
  };

  const providerFirstApp = { workspace: createWorkspace() };
  providerFirstApp.workspace.on(bridge.TPS_GCM_API_CHANGED_EVENT, (event) => bridge.acceptGcmApiChanged(providerFirstApp, event));
  providerFirstApp.workspace.on(bridge.TPS_GCM_API_REQUEST_EVENT, () => {
    providerFirstApp.workspace.trigger(bridge.TPS_GCM_API_CHANGED_EVENT, createExactEvent(api));
  });
  bridge.requestGcmApi(providerFirstApp);
  assert.equal(bridge.getGcmApi(providerFirstApp), api, 'a synchronous request recovers when the provider loaded first');

  const consumerFirstApp = { workspace: createWorkspace() };
  consumerFirstApp.workspace.on(bridge.TPS_GCM_API_CHANGED_EVENT, (event) => bridge.acceptGcmApiChanged(consumerFirstApp, event));
  bridge.requestGcmApi(consumerFirstApp);
  assert.equal(bridge.getGcmApi(consumerFirstApp), null, 'a request before provider load remains unavailable');
  consumerFirstApp.workspace.trigger(bridge.TPS_GCM_API_CHANGED_EVENT, createExactEvent(api));
  assert.equal(bridge.getGcmApi(consumerFirstApp), api, 'the provider install announcement recovers the waiting consumer');

  consumerFirstApp.workspace.trigger(bridge.TPS_GCM_API_CHANGED_EVENT, {
    source: 'tps-global-context-menu',
    timestamp: 2,
    available: false,
    formulasVersion: null,
    lineMetadataVersion: null,
    entityIndexVersion: null,
    taskLinesVersion: null,
    taskCheckboxesVersion: null,
  });
  assert.equal(bridge.getGcmApi(consumerFirstApp), null, 'provider unload clears all cached capabilities');

  const incompatibleEvent = { ...createExactEvent(api), entityIndexVersion: 2 };
  consumerFirstApp.workspace.trigger(bridge.TPS_GCM_API_CHANGED_EVENT, incompatibleEvent);
  assert.equal(bridge.getGcmApi(consumerFirstApp), null, 'a partial version mismatch rejects the complete capability snapshot');
  assert.deepEqual(bridge.getGcmApiStatus(consumerFirstApp), {
    available: true,
    formulasVersion: 1,
    lineMetadataVersion: 1,
    entityIndexVersion: 2,
    taskLinesVersion: null,
    taskCheckboxesVersion: null,
  });

  const incompleteLineMetadata = { ...api.lineMetadata };
  delete incompleteLineMetadata.scanDocument;
  consumerFirstApp.workspace.trigger(bridge.TPS_GCM_API_CHANGED_EVENT, createExactEvent({
    ...api,
    lineMetadata: incompleteLineMetadata,
  }));
  assert.equal(
    bridge.getGcmApi(consumerFirstApp),
    null,
    'line metadata v1 without document scanning rejects the complete capability snapshot',
  );
  assert.match(gcmApiSource, /typeof lineMetadata\.scanDocument === 'function'/u);
  assert.doesNotMatch(gcmApiSource, /app\s*as any\)\?\.plugins|getPlugin\?\.|plugins\?\.plugins/);
});

test('GCM API lifecycle events recover Kanban-first startup and invalidate reload caches', async () => {
  const formulaMock = createFormulaApiMock();
  const lineMetadataMock = createLineMetadataApiMock();
  const harness = await createFormulaViewHarness({ formulasApi: null, lineMetadataApi: null });
  const entityIndex = createEntityIndexApiMock();
  harness.view.openTasksByPath = new Map([['stale', [harness.task]]]);
  harness.view.allTasksByPath = new Map([['stale', [harness.task]]]);
  harness.view.openTaskOverflowByPath = new Map([['stale', 1]]);
  harness.view.taskReadsInFlight = new Map();
  let refreshes = 0;
  harness.view.refreshDebounced = () => { refreshes += 1; };

  const activeApi = { formulas: formulaMock.api, lineMetadata: lineMetadataMock.api, entityIndex };
  harness.view.handleGcmApiChanged({
    source: 'tps-global-context-menu',
    timestamp: 1,
    available: true,
    api: activeApi,
    formulasVersion: 1,
    lineMetadataVersion: 1,
    entityIndexVersion: 3,
  });
  assert.equal(refreshes, 1);
  assert.equal(harness.view.openTasksByPath.size, 0);
  assert.equal(harness.view.evaluateTaskFilterString('formula.score == 14', harness.task, harness.file), true, 'Kanban-first startup recovers when GCM announces the exact API');

  harness.view.handleGcmApiChanged({
    source: 'tps-global-context-menu',
    timestamp: 2,
    available: false,
    formulasVersion: null,
    lineMetadataVersion: null,
    entityIndexVersion: null,
  });
  assert.equal(refreshes, 2);
  assert.equal(harness.view.evaluateTaskFilterString('formula.score == 14', harness.task, harness.file), null, 'GCM unload invalidates the prior compiled/session authority');
  harness.view.handleGcmApiChanged({ source: 'someone-else', timestamp: 3, available: true, api: activeApi, formulasVersion: 1, lineMetadataVersion: 1, entityIndexVersion: 3 });
  assert.equal(refreshes, 2, 'unrelated workspace events are ignored');

  assert.match(viewSource, /registerEvent\(\(this\.app\.workspace as any\)\.on\(\s*TPS_GCM_API_CHANGED_EVENT/);
  assert.match(viewSource, /requestGcmApi\(this\.app\)/);
  assert.match(viewSource, /private handleGcmApiChanged/);
});

test('Entity Index v3 supplies exact task and bullet sources and follows add/remove revisions', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const makeFile = (path) => Object.assign(new TFile(), {
    path,
    name: path.split('/').at(-1),
    basename: path.split('/').at(-1).replace(/\.md$/i, ''),
    extension: 'md',
  });
  const first = makeFile('Inbox/First.md');
  const removed = makeFile('Inbox/Removed.md');
  const added = makeFile('Inbox/Added.md');
  const headingOnly = makeFile('Inbox/Heading Only.md');
  const files = new Map([first, removed, added, headingOnly].map((file) => [file.path, file]));
  let revision = 1;
  let records = [
    { sourcePath: first.path, entityType: 'block', lineKind: 'task' },
    { sourcePath: removed.path, entityType: 'block', lineKind: 'bullet' },
    { sourcePath: headingOnly.path, entityType: 'block', lineKind: 'heading' },
    { sourcePath: 'Inbox/Note.md', entityType: 'note' },
  ];
  const queries = [];
  const callbacks = new Set();
  let unsubscribed = 0;
  const entityIndex = {
    version: 3,
    ensureReady: async () => { throw new Error('queryAsync owns readiness'); },
    queryAsync: async (query) => { queries.push(query); return records; },
    getRevision: () => revision,
    onChanged(callback) {
      callbacks.add(callback);
      return () => { callbacks.delete(callback); unsubscribed += 1; };
    },
  };
  const view = Object.create(KanbanView.prototype);
  view.entityIndexLineSourceCache = null;
  view.entityIndexLineSourceLoad = null;
  view.entityIndexLineSourceGeneration = 0;
  view.entityIndexRetryAttempts = 0;
  view.entityIndexRetryTimer = null;
  view.entityIndexReloadPending = false;
  view.formulaDiagnostics = new Set();
  view.isViewLoaded = true;
  let refreshes = 0;
  view.refreshDebounced = () => { refreshes += 1; };
  view.app = {
    vault: { getFileByPath: (path) => files.get(path) ?? null },
  };
  provideGcmProtocolApi(view, { entityIndex });

  view.bindEntityIndexChangeListener();
  assert.equal(view.getIndexedLineSourceFiles(), null, 'the first request stays not-ready instead of returning a partial snapshot');
  await flushDeferredWork();
  assert.deepEqual(queries, [{ entityTypes: ['block'], lineKinds: ['task', 'bullet'] }]);
  assert.deepEqual(view.getIndexedLineSourceFiles().map((file) => file.path), [first.path, removed.path]);
  assert.equal(refreshes, 1);

  records = [
    { sourcePath: added.path, entityType: 'block', lineKind: 'task' },
    { sourcePath: first.path, entityType: 'block', lineKind: 'bullet' },
  ];
  revision += 1;
  for (const callback of callbacks) callback(revision);
  assert.equal(view.getIndexedLineSourceFiles(), null, 'a changed revision invalidates the whole prior source set');
  await flushDeferredWork();
  assert.deepEqual(view.getIndexedLineSourceFiles().map((file) => file.path), [added.path, first.path], 'new first sources appear and removed last sources disappear atomically');
  assert.equal(queries.length, 2);

  view.unbindEntityIndexChangeListener();
  assert.equal(unsubscribed, 1);

  globalThis.__KanbanFormulaNotices = [];
  provideGcmProtocolApi(view, { entityIndex: { ...entityIndex, version: 2 } });
  view.invalidateEntityIndexLineSources();
  assert.equal(view.getIndexedLineSourceFiles(), null, 'the weaker published v2 contract is rejected');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
  assert.match(globalThis.__KanbanFormulaNotices[0], /version 3/i);
  delete globalThis.__KanbanFormulaNotices;
});

test('Entity Index reads serialize event storms and retry transient failures with a hard terminal bound', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const file = Object.assign(new TFile(), {
    path: 'Inbox/Indexed.md', name: 'Indexed.md', basename: 'Indexed', extension: 'md',
  });
  const callbacks = new Set();
  const gates = [deferred(), deferred()];
  let revision = 1;
  let queryCalls = 0;
  let activeQueries = 0;
  let maxActiveQueries = 0;
  const entityIndex = {
    version: 3,
    ensureReady: async () => {},
    queryAsync: async () => {
      const gate = gates[queryCalls];
      queryCalls += 1;
      activeQueries += 1;
      maxActiveQueries = Math.max(maxActiveQueries, activeQueries);
      try {
        return await gate.promise;
      } finally {
        activeQueries -= 1;
      }
    },
    getRevision: () => revision,
    onChanged(callback) { callbacks.add(callback); return () => callbacks.delete(callback); },
  };
  const view = Object.create(KanbanView.prototype);
  Object.assign(view, {
    entityIndexLineSourceCache: null,
    entityIndexLineSourceLoad: null,
    entityIndexLineSourceGeneration: 0,
    entityIndexReloadPending: false,
    entityIndexRetryAttempts: 0,
    entityIndexRetryTimer: null,
    formulaDiagnostics: new Set(),
    isViewLoaded: true,
  });
  view.refreshDebounced = () => {};
  view.app = {
    vault: { getFileByPath: (path) => path === file.path ? file : null },
  };
  provideGcmProtocolApi(view, { entityIndex });
  view.bindEntityIndexChangeListener();
  view.getIndexedLineSourceFiles();
  await flushDeferredWork();
  assert.equal(queryCalls, 1);
  for (let index = 0; index < 12; index += 1) {
    revision += 1;
    for (const callback of callbacks) callback(revision);
    view.getIndexedLineSourceFiles();
  }
  assert.equal(queryCalls, 1, 'an active provider query retains ownership during an event storm');
  gates[0].resolve([{ sourcePath: file.path, entityType: 'block', lineKind: 'task' }]);
  await flushDeferredWork();
  assert.equal(queryCalls, 2, 'all invalidations collapse into one replacement query after settlement');
  assert.equal(maxActiveQueries, 1);
  gates[1].resolve([{ sourcePath: file.path, entityType: 'block', lineKind: 'task' }]);
  await flushDeferredWork();
  assert.deepEqual(view.getIndexedLineSourceFiles(), [file]);
  view.unbindEntityIndexChangeListener();

  const createRetryView = (queryAsync) => {
    let retryRevision = 1;
    const retryIndex = {
      version: 3,
      ensureReady: async () => {},
      queryAsync,
      getRevision: () => retryRevision,
      onChanged: () => () => {},
    };
    const retryView = Object.create(KanbanView.prototype);
    Object.assign(retryView, {
      entityIndexLineSourceCache: null,
      entityIndexLineSourceLoad: null,
      entityIndexLineSourceGeneration: 0,
      entityIndexReloadPending: false,
      entityIndexRetryAttempts: 0,
      entityIndexRetryTimer: null,
      formulaDiagnostics: new Set(),
      isViewLoaded: true,
    });
    retryView.getEntityIndexRetryDelayMs = () => 1;
    retryView.getEntityIndexRetryMaxAttempts = () => 3;
    retryView.refreshDebounced = () => {};
    retryView.app = {
      vault: { getFileByPath: (path) => path === file.path ? file : null },
    };
    provideGcmProtocolApi(retryView, { entityIndex: retryIndex });
    return retryView;
  };

  let transientCalls = 0;
  const transient = createRetryView(async () => {
    transientCalls += 1;
    if (transientCalls === 1) throw new Error('transient incomplete index');
    return [{ sourcePath: file.path, entityType: 'block', lineKind: 'task' }];
  });
  transient.getIndexedLineSourceFiles();
  await new Promise((resolve) => setTimeout(resolve, 15));
  await flushDeferredWork();
  assert.equal(transientCalls, 2);
  assert.deepEqual(transient.getIndexedLineSourceFiles(), [file], 'a transient provider rejection recovers without unrelated activity');

  let permanentCalls = 0;
  const permanent = createRetryView(async () => {
    permanentCalls += 1;
    throw new Error('permanently incomplete index');
  });
  globalThis.__KanbanFormulaNotices = [];
  permanent.getIndexedLineSourceFiles();
  await new Promise((resolve) => setTimeout(resolve, 25));
  await flushDeferredWork();
  assert.equal(permanentCalls, 3, 'permanent failures stop at the declared attempt bound');
  assert.equal(permanent.entityIndexRetryAttempts, 3);
  assert.equal(permanent.entityIndexRetryTimer, null);
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'terminal exhaustion is visible once');
  delete globalThis.__KanbanFormulaNotices;
});

test('native note formulas stay authoritative and formula properties can never become Kanban write targets', async () => {
  const formulaMock = createFormulaApiMock();
  const { view, file, frontmatter, task } = await createFormulaViewHarness({ formulasApi: formulaMock.api });
  class PublicLinkValue {
    static type = 'link';
    constructor(path) { this.path = path; }
  }
  class PublicListValue {
    static type = 'list';
    constructor(values) { this.values = values; }
    length() { return this.values.length; }
    get(index) { return this.values[index]; }
    isTruthy() { return Boolean(this.values); }
  }
  class PublicErrorValue {
    static type = 'error';
    toString() { return 'native formula error'; }
  }
  const nativeCalls = [];
  const nativeEntry = {
    file,
    getValue(propId) {
      nativeCalls.push(propId);
      if (propId === 'formula.score') return 99;
      if (propId === 'formula.labels') return new PublicListValue(['Alpha', new PublicLinkValue('People/Ada.md')]);
      if (propId === 'formula.linkLane') return new PublicLinkValue('People/Ada.md');
      return null;
    },
  };
  assert.equal(view.getEntryValue(nativeEntry, 'formula.score'), 99);
  assert.deepEqual(nativeCalls, ['formula.score']);
  const nativeFormulaStyle = {
    active: true,
    match: 'all',
    conditions: [{ field: 'formula.score', operator: 'is', value: '99' }],
    color: '#fff',
  };
  view.plugin.settings.cardStyleRules = [nativeFormulaStyle];
  assert.equal(view.resolveCardStyleRule(frontmatter, nativeEntry, null), nativeFormulaStyle, 'native formula styles read exact formula IDs from the Bases entry');

  view.plugin.settings.cardStyleRules = [{
    active: true,
    match: 'all',
    conditions: [{ field: 'formula.score', operator: '!exists', value: '' }],
    color: '#000',
  }];
  assert.equal(view.resolveCardStyleRule(frontmatter, { file, getValue: () => { throw new Error('native formula failed'); } }, null), null, 'native formula read failures fail style rules closed');
  assert.equal(view.resolveCardStyleRule(frontmatter, { file, getValue: () => new PublicErrorValue() }, null), null, 'public native ErrorValue results fail style rules closed');

  view.data = { data: [nativeEntry] };
  view.config = { groupBy: { property: 'formula.labels' } };
  assert.equal(view.isLikelyListGroupingProperty('labels', 'formula.labels'), true);
  assert.deepEqual(
    view.groupEntriesByProperty([nativeEntry], 'formula.labels').map((group) => group.key),
    ['Alpha', 'People/Ada.md'],
    'native public ListValue members route through the exact GCM groupValues adapter before string conversion',
  );
  view.config = { groupBy: { property: 'formula.linkLane' } };
  const nativeLinkGroup = view.groupEntriesByProperty([nativeEntry], 'formula.linkLane')[0];
  assert.equal(view.getLaneId(nativeLinkGroup), view.getTaskLaneIds(file, task, 'formula.linkLane')[0], 'native and synthesized link values coalesce by canonical path');
  const nativeGroup = { key: 'native', entries: [nativeEntry], hasKey: () => true };
  view.data = { data: [nativeEntry], groupedData: [nativeGroup] };
  view.app.vault = { getMarkdownFiles: () => { throw new Error('native note authority must not scan the vault'); } };
  assert.deepEqual(view.getSourceGroupsForRender('formula.linkLane', false), [nativeGroup]);
  assert.doesNotMatch(viewSource, /getFallbackNoteEntriesFromBaseFilters/, 'native Bases data is the sole note source');

  view.config = { getSort: () => [{ property: 'formula.score', direction: 'asc' }] };
  const mixedSorted = view.sortMixedLaneRenderItems(
    [{ entry: nativeEntry }],
    [{ file, task, laneId: 'ungrouped' }],
  );
  assert.equal(mixedSorted[0].kind, 'line', 'native notes and synthesized lines share the exact formula sort adapter');
  const lowerNativeEntry = { file, getValue: (propId) => propId === 'formula.score' ? 10 : null };
  const noteOnlySorted = view.sortMixedLaneRenderItems(
    [{ entry: nativeEntry }, { entry: lowerNativeEntry }],
    [],
  );
  assert.equal(noteOnlySorted[0].item.entry, lowerNativeEntry, 'formula sort descriptors apply even when a lane contains only native notes');
  frontmatter.score = 12;
  frontmatter['formula.score'] = 13;
  assert.doesNotMatch(viewSource, /FALLBACK_BASES_ENTRY|createFallbackBasesEntry|getFallbackNoteValue|evaluateNoteFilter/, 'native Bases data must remain the sole note-query and note-formula authority');
  assert.deepEqual(view.extractNoteFrontmatterDefaults({ property: 'formula.score', operator: '==', value: 99 }), {}, 'note creation never writes a same-name formula property');
  assert.equal(view.inferTaskCreationDefaultsFromObject({ property: 'formula.score', operator: '==', value: 99 }), null, 'task creation never writes a same-name formula field');

  view.config = { groupBy: { property: 'formula.lane' } };
  assert.equal(view.getGroupByPropName(), null, 'formula lanes remain non-writable');
  assert.equal(view.getGroupByPropId(null), 'formula.lane', 'formula lanes remain readable for synthesized rows');
  view.config = { groupBy: { property: 'file.folder' } };
  assert.equal(view.getGroupByPropId(null), null, 'formula support does not reinterpret other read-only group properties as task fields');
  assert.equal(view.getTaskPropertyValue(file, task, 'formula.score', new Set()).editable, false);
  assert.doesNotMatch(viewSource, /getFrontmatterPropNameFromId\([^)]*formula/i);
  assert.match(viewSource, /const isReadOnlyFormulaLane = this\.isFormulaProperty\(taskGroupPropId\)/);
  assert.match(viewSource, /headerAdd\.disabled = isReadOnlyFormulaLane/);
  assert.match(viewSource, /addButton\.disabled = isReadOnlyFormulaLane/);
  assert.match(viewSource, /Formula lane \(read-only\)/);
});

test('embedded formula definitions come only from one authoritative matching Base block', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const file = Object.assign(new TFile(), {
    path: 'Inbox/Embedded Formula QA.md',
    name: 'Embedded Formula QA.md',
    basename: 'Embedded Formula QA',
    extension: 'md',
    stat: { mtime: 1 },
  });
  let content = '```base\nexact-empty\n```\n```base\nfallback-formulas\n```';
  const parsedByMarker = {
    'exact-empty': { match: 'exact', filters: null, formulas: {} },
    'fallback-formulas': { match: 'fallback', filters: ['kind == task'], formulas: { borrowed: '1' } },
    'exact-formulas': { match: 'exact', filters: ['kind == task'], formulas: { valid: '1' } },
  };
  globalThis.__KanbanParseYaml = (source) => parsedByMarker[String(source || '').trim()] || {};
  globalThis.__KanbanFormulaNotices = [];
  const view = Object.create(KanbanView.prototype);
  view.app = { vault: { cachedRead: async () => content } };
  view.embeddedBaseFilterCache = null;
  view.embeddedBaseFiltersLoadingKey = null;
  view.formulaDiagnostics = new Set();
  view.refreshDebounced = () => {};
  view.getBaseSourcePath = () => file.path;
  view.getBaseFile = () => null;
  view.getBaseContextFile = () => file;
  view.getConfiguredBaseViewName = () => 'Formula board';
  view.getEmbeddedKanbanBlockMatch = (parsed) => parsed.match || null;
  view.extractBaseFileFilterRoots = (parsed) => ({ viewName: 'Formula board', viewNames: ['Formula board'], filters: parsed.filters });

  assert.equal(view.isBaseFileFilterReady(), false, 'embedded definitions hold synthesized rows until the authoritative block is loaded');
  await view.loadEmbeddedBaseFilters(file, 1, 'Formula board');
  assert.equal(view.isBaseFileFilterReady(), true);
  assert.deepEqual(view.embeddedBaseFilterCache.formulas, {}, 'an exact block without formulas cannot borrow them from a fallback block');
  assert.equal(view.embeddedBaseFilterCache.filters, null, 'an exact block without filters cannot borrow fallback-block filters either');

  content = '```base\nexact-empty\n```\n```base\nexact-formulas\n```';
  await view.loadEmbeddedBaseFilters(file, 2, 'Formula board');
  assert.deepEqual(view.embeddedBaseFilterCache.formulas, {}, 'multiple exact matches disable formula evaluation instead of choosing one');
  assert.equal(view.embeddedBaseFilterCache.filters, null, 'ambiguous blocks disable filters and formulas together');
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1);
  assert.match(globalThis.__KanbanFormulaNotices[0], /Multiple embedded Base definitions/i);

  const older = deferred();
  const newer = deferred();
  let readIndex = 0;
  view.app.vault.cachedRead = () => (readIndex++ === 0 ? older.promise : newer.promise);
  const olderLoad = view.loadEmbeddedBaseFilters(file, 3, 'Formula board');
  const newerLoad = view.loadEmbeddedBaseFilters(file, 4, 'Formula board');
  newer.resolve('```base\nexact-formulas\n```');
  await newerLoad;
  older.resolve('```base\nfallback-formulas\n```');
  await olderLoad;
  assert.equal(view.embeddedBaseFilterCache.mtime, 4, 'a stale embedded read cannot overwrite a newer authoritative result');
  assert.deepEqual(view.embeddedBaseFilterCache.formulas, { valid: '1' });
  delete globalThis.__KanbanParseYaml;
  delete globalThis.__KanbanFormulaNotices;
});

test('Base definition read failures remain not-ready and retry successfully after bounded backoff', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const directFile = Object.assign(new TFile(), {
    path: 'QA.base', name: 'QA.base', basename: 'QA', extension: 'base', stat: { mtime: 1 },
  });
  const embeddedFile = Object.assign(new TFile(), {
    path: 'Inbox/QA.md', name: 'QA.md', basename: 'QA', extension: 'md', stat: { mtime: 2 },
  });
  const view = Object.create(KanbanView.prototype);
  view.baseFileFilterCache = null;
  view.embeddedBaseFilterCache = null;
  view.baseFileFiltersLoadingKey = null;
  view.embeddedBaseFiltersLoadingKey = null;
  view.formulaDiagnostics = new Set();
  view.getBaseFilterRetryDelayMs = () => 0;
  view.getConfiguredBaseViewName = () => 'QA';
  view.getCurrentBaseViewName = () => 'QA';
  view.extractBaseFileFilterRoots = (parsed) => ({ viewName: 'QA', viewNames: ['QA'], filters: parsed.filters || null });
  view.getEmbeddedKanbanBlockMatch = () => 'exact';
  let refreshes = 0;
  view.refreshDebounced = () => { refreshes += 1; };
  const attempts = new Map();
  view.app = { vault: {
    cachedRead: (file) => {
      const count = (attempts.get(file.path) || 0) + 1;
      attempts.set(file.path, count);
      if (count === 1) return Promise.reject(new Error(`${file.path} transient failure`));
      return Promise.resolve(file === directFile ? 'direct-success' : '```base\nembedded-success\n```');
    },
    getFileByPath: (path) => path === directFile.path ? directFile : path === embeddedFile.path ? embeddedFile : null,
  } };
  globalThis.__KanbanParseYaml = (source) => String(source).includes('success')
    ? { formulas: { score: '1' } }
    : {};

  view.getBaseFile = () => directFile;
  view.getBaseContextFile = () => null;
  await view.loadBaseFileFilters(directFile, 1, 'QA');
  assert.equal(view.baseFileFilterCache.errorAt > 0, true);
  assert.equal(view.isBaseFileFilterReady(), false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushDeferredWork();
  assert.equal(view.baseFileFilterCache.errorAt, undefined);
  assert.equal(view.isBaseFileFilterReady(), true);
  assert.deepEqual(view.baseFileFilterCache.formulas, { score: '1' });
  assert.equal(attempts.get(directFile.path), 2, 'direct recovery is autonomous');

  view.getBaseFile = () => null;
  view.getBaseContextFile = () => embeddedFile;
  await view.loadEmbeddedBaseFilters(embeddedFile, 2, 'QA');
  assert.equal(view.embeddedBaseFilterCache.errorAt > 0, true);
  assert.equal(view.isBaseFileFilterReady(), false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushDeferredWork();
  assert.equal(view.embeddedBaseFilterCache.errorAt, undefined);
  assert.equal(view.isBaseFileFilterReady(), true);
  assert.deepEqual(view.embeddedBaseFilterCache.formulas, { score: '1' });
  assert.equal(attempts.get(embeddedFile.path), 2, 'embedded recovery is autonomous');
  assert.equal(refreshes, 2, 'formula-only successful authoritative reads repaint after an error');
  delete globalThis.__KanbanParseYaml;
});

test('Base definition retry state is bounded and follows the newest exact snapshot', async () => {
  const { KanbanView } = await importKanbanView();
  const TFile = globalThis.__KanbanTestTFile;
  const makeFile = (path, mtime) => Object.assign(new TFile(), {
    path,
    name: path.split('/').at(-1),
    basename: path.split('/').at(-1).replace(/\.base$/i, ''),
    extension: 'base',
    stat: { mtime },
  });
  const persistentFile = makeFile('Persistent.base', 1);
  const persistent = Object.create(KanbanView.prototype);
  persistent.baseFileFilterCache = null;
  persistent.baseFileFiltersLoadingKey = null;
  persistent.baseFileFilterRetry = null;
  persistent.getBaseFilterRetryDelayMs = () => 0;
  persistent.getBaseFilterRetryMaxAttempts = () => 3;
  persistent.getCurrentBaseViewName = () => 'QA';
  persistent.extractBaseFileFilterRoots = () => ({ viewName: 'QA', viewNames: ['QA'], filters: null });
  persistent.refreshDebounced = () => {};
  let persistentReads = 0;
  persistent.app = { vault: {
    cachedRead: async () => { persistentReads += 1; throw new Error('still unavailable'); },
    getFileByPath: (path) => path === persistentFile.path ? persistentFile : null,
  } };
  globalThis.__KanbanFormulaNotices = [];

  await persistent.loadBaseFileFilters(persistentFile, 1, 'QA');
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushDeferredWork();
  assert.equal(persistentReads, 3);
  assert.equal(persistent.baseFileFilterRetry?.attempts, 3);
  assert.equal(persistent.baseFileFilterRetry?.exhausted, true);
  assert.equal(persistent.baseFileFilterRetry?.timer, null);
  assert.equal(globalThis.__KanbanFormulaNotices.length, 1, 'terminal retry exhaustion is visible once');

  const oldFile = makeFile('Old.base', 2);
  const currentFile = makeFile('Current.base', 3);
  const moving = Object.create(KanbanView.prototype);
  moving.baseFileFilterCache = null;
  moving.baseFileFiltersLoadingKey = null;
  moving.baseFileFilterRetry = null;
  moving.getBaseFilterRetryDelayMs = () => 5;
  moving.getCurrentBaseViewName = () => 'QA';
  moving.extractBaseFileFilterRoots = (parsed) => ({ viewName: 'QA', viewNames: ['QA'], filters: parsed.filters || null });
  moving.refreshDebounced = () => {};
  const counts = new Map();
  moving.app = { vault: {
    cachedRead: async (file) => {
      const count = (counts.get(file.path) || 0) + 1;
      counts.set(file.path, count);
      if (file === oldFile || count === 1) throw new Error('snapshot read failed');
      return 'current-success';
    },
    getFileByPath: (path) => path === oldFile.path ? oldFile : path === currentFile.path ? currentFile : null,
  } };
  globalThis.__KanbanParseYaml = () => ({ formulas: { score: '1' } });

  await moving.loadBaseFileFilters(oldFile, 2, 'QA');
  await moving.loadBaseFileFilters(currentFile, 3, 'QA');
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushDeferredWork();
  assert.equal(counts.get(oldFile.path), 1, 'the superseded retry timer is canceled');
  assert.equal(counts.get(currentFile.path), 2, 'the newest snapshot owns the retry');
  assert.equal(moving.baseFileFilterCache.path, currentFile.path);
  assert.equal(moving.baseFileFilterCache.errorAt, undefined);
  assert.deepEqual(moving.baseFileFilterCache.formulas, { score: '1' });

  delete globalThis.__KanbanParseYaml;
  delete globalThis.__KanbanFormulaNotices;
});
