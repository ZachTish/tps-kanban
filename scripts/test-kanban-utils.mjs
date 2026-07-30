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
              export function debounce(callback) { return callback; }
              export function normalizePath(value) { return String(value || '').replace(/\\\\/g, '/'); }
              export class Modal {}
              export class Setting {}
              export function getAllTags() { return []; }
              export class WorkspaceLeaf {}
              export function parseYaml() { return {}; }
              export class Notice {}
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

function createTaskReadHarness(KanbanView) {
  const pendingReads = [];
  const filesByPath = new Map();
  let refreshCount = 0;
  const view = Object.create(KanbanView.prototype);
  view.openTasksByPath = new Map();
  view.allTasksByPath = new Map();
  view.openTaskOverflowByPath = new Map();
  view.taskReadsInFlight = new Map();
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
  view.getTaskVisibleTitle = (task) => task.text;
  view.parseOpenTasks = (content, path, _limit, _includeDone, includeBullets = false) => ({
    openTasks: [{
      itemKind: includeBullets ? 'bullet' : 'task',
      line: 1,
      checkboxState: includeBullets ? undefined : '[ ]',
      text: String(content),
      displayText: String(content),
      inlineFields: [{ key: 'path', value: path }],
    }],
    overflowCount: 0,
  });
  return {
    view,
    pendingReads,
    filesByPath,
    refreshCount: () => refreshCount,
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
  assert.match(viewSource, /const activeFile = this\.app\.workspace\.getActiveFile\?\.\(\)/);
  assert.match(viewSource, /this\.isEmbeddedKanbanContext\(\) && activeFile instanceof TFile && activeFile\.extension === 'md'/);
  assert.match(viewSource, /return activeFile\.path/);
  assert.match(viewSource, /const embeddedMarkdownContext = this\.getWorkspaceLeafMarkdownContextPath\(\)/);
  assert.match(viewSource, /if \(embeddedMarkdownContext\) return embeddedMarkdownContext/);
  assert.match(viewSource, /const markdownContextPath = this\.getWorkspaceLeafMarkdownContextPath\(\)/);
  assert.match(viewSource, /if \(markdownContextFile instanceof TFile\) return markdownContextFile/);
  assert.doesNotMatch(viewSource, /private getBaseFile\(\): TFile \| null \{\s*const directFile = this\.getRuntimeBaseFile\(\)/);
  assert.match(viewSource, /closest\('\.markdown-reading-view, \.markdown-source-view, \.markdown-preview-view, \.markdown-embed, \.internal-embed, \.cm-embed-block, \.sync-embed, \.sync-container'\)/);
  assert.match(viewSource, /file instanceof TFile && file\.extension === 'md'/);
  assert.match(viewSource, /value\.endsWith\('\.md'\)/);
  assert.match(viewSource, /private getEmbeddedKanbanBlockMatch\(parsed: Record<string, unknown> \| null \| undefined, viewName: string\): 'exact' \| 'fallback' \| null/);
  assert.match(viewSource, /const roots = exactRoots\.length \? exactRoots : fallbackRoots/);
  assert.match(viewSource, /return kanbanViews\.length === 1 \? 'fallback' : null/);
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
  assert.match(viewSource, /'aria-label': createCommandOverride \? `Run \$\{createCommandOverride\.name\}` : laneAdd\.ariaLabel/);
  assert.match(viewSource, /title: createCommandOverride \? `Run \$\{createCommandOverride\.name\}` : laneAdd\.title/);
  assert.match(viewSource, /text: createCommandOverride \? `\+ \$\{createCommandOverride\.name\}` : laneAdd\.buttonText/);

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
  assert.match(viewSource, /const fallback = this\.parseOpenTasks\(content, path, limit\)/);
  assert.match(viewSource, /const openTasks = fallback\.openTasks\.map/);
  assert.match(viewSource, /displayText: this\.getTaskVisibleTitle\(merged\)/);
  assert.doesNotMatch(viewSource, /displayText: enriched\?\.displayText \|\| task\.displayText/);
  assert.match(viewSource, /openTaskOverflowByPath/);
  assert.match(viewSource, /\+\$\{openTaskOverflow\} more/);
  assert.match(viewSource, /openTaskLine\(entry\.file, task\.line\)/);
});

test('task preview reads reject stale owners and deduplicate bullet work', async (t) => {
  const { KanbanView } = await importKanbanView();

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

  await t.test('normal failures stay empty while bullet failures remain retryable', async () => {
    const taskHarness = createTaskReadHarness(KanbanView);
    const taskFile = { path: 'Inbox/Task Failure.md' };
    taskHarness.filesByPath.set(taskFile.path, taskFile);
    taskHarness.view.loadOpenTasksForFile(taskFile);
    taskHarness.pendingReads[0].gate.reject(new Error('task read failed'));
    await flushDeferredWork();
    assert.deepEqual(taskHarness.view.openTasksByPath.get(taskFile.path), []);
    assert.deepEqual(taskHarness.view.allTasksByPath.get(taskFile.path), []);
    assert.equal(taskHarness.view.openTaskOverflowByPath.get(taskFile.path), 0);
    assert.equal(taskHarness.refreshCount(), 1);

    const bulletHarness = createTaskReadHarness(KanbanView);
    const bulletFile = { path: 'Inbox/Bullet Failure.md' };
    bulletHarness.filesByPath.set(bulletFile.path, bulletFile);
    const filter = { mode: 'bullets' };
    bulletHarness.view.getAllLineItemsForFile(bulletFile, filter);
    bulletHarness.pendingReads[0].gate.reject(new Error('bullet read failed'));
    await flushDeferredWork();
    assert.equal(
      bulletHarness.view.allTasksByPath.has(`${bulletFile.path}:bullets`),
      false,
    );
    assert.equal(bulletHarness.refreshCount(), 0);

    bulletHarness.view.getAllLineItemsForFile(bulletFile, filter);
    assert.equal(bulletHarness.pendingReads.length, 2);
    bulletHarness.pendingReads[1].gate.resolve('retry');
    await flushDeferredWork();
    assert.equal(
      bulletHarness.view.allTasksByPath.get(`${bulletFile.path}:bullets`)?.[0]?.text,
      'retry',
    );
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
  assert.match(viewSource, /private createTaskLaneCard\(item: TaskRenderItem, propName: string \| null, displayLane: DisplayLaneGroup\): HTMLElement/);
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
  assert.match(viewSource, /void this\.renderAsync\(sourceGroups, propName, scrollState\)/);
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
  assert.match(viewSource, /baseFileFilterCache: \{ path: string; mtime: number; viewName: string; viewNames: string\[\]; filters: unknown\[\] \| null \} \| null/);
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
  assert.match(viewSource, /this\.releaseTaskRead\(owner\)[\s\S]*!this\.hasTaskReadsInFlight\('tasks'\)[\s\S]*this\.refreshDebounced\(\)/);
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
  let fullVaultVisits = 0;

  view.app = {
    vault: {
      getMarkdownFiles: () => {
        fullVaultVisits += 1;
        return [todoFile, doingFile];
      },
    },
  };
  view.isBaseFileFilterReady = () => true;
  view.getActiveBasesSearchQuery = () => '';
  view.getExplicitTaskSourceFiles = () => [];
  view.shouldScanVaultForTaskFilters = () => true;
  view.getAllLineItemsForFile = (file) => file.path === todoFile.path ? [todoTask] : [doingTask];
  view.taskMatchesRootFilter = () => true;
  view.taskMatchesSearchQuery = () => true;
  view.getTaskLaneIds = (task) => task.laneIds;
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
  assert.equal(fullVaultVisits, 2);
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
  assert.match(viewSource, /this\.parseOpenTasks\(content, path, Number\.MAX_SAFE_INTEGER, true\)/);
  assert.match(viewSource, /getLaneIdForStatus\(this\.getStatusForCheckboxState\(task\.checkboxState/);
  assert.match(viewSource, /isStatusPropertyName\(propName\)/);
  assert.match(viewSource, /if \(this\.isStatusPropertyName\(propName\)\)/);
  assert.match(viewSource, /nextLine = buildKanbanTaskDropLine\(\{\s*line: currentLine,\s*propName,\s*value,\s*sourceLaneValues,\s*filterTags,\s*filterStatus,/);
  assert.match(viewSource, /createTaskLaneCard\(taskItem, propName, displayLane\)/);
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
  assert.match(viewSource, /const groupedEntries = nativeGroups\.flatMap/);
  assert.match(viewSource, /const nativeEntries: BasesEntry\[\] = groupedEntries\.length \? groupedEntries : \(this\.data\?\.data \?\? \[\]\)/);
  assert.match(viewSource, /if \(!fallbackEntries\.length && this\.groupsContainEntries\(nativeGroups\)\) return nativeGroups/);
  assert.match(viewSource, /const entriesByPath = new Map<string, BasesEntry>\(\)/);
  assert.match(viewSource, /for \(const entry of nativeEntries\)/);
  assert.match(viewSource, /for \(const entry of fallbackEntries\)/);
  assert.match(viewSource, /if \(entriesByPath\.size\) \{/);
  assert.match(viewSource, /this\.groupEntriesByProperty\(Array\.from\(entriesByPath\.values\(\)\), propId\)/);
  assert.match(viewSource, /private noteMatchesStructuredBaseFilters\(file: TFile\): boolean/);
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
  assert.match(viewSource, /this\.renderedTaskItemCount = Array\.from\(taskItemsByDisplayLane\.values\(\)\)/);
  assert.match(viewSource, /visibleNotePaths\.has\(file\.path\)/);
  assert.match(viewSource, /this\.app\.vault\.getMarkdownFiles\(\)/);
  assert.match(viewSource, /getTaskLaneIds\(task, propName\)/);
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
  assert.match(viewSource, /private evaluateTaskFilterNode\(node: unknown, task: OpenTaskSubitem, file: TFile \| null = null\): boolean \| null/);
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
  assert.match(viewSource, /const kindMatch = expr\.match\(\/\^\(\?:\(\?:tps\|kanban\)\\\.\)\?\(\?:itemtype\|itemkind\|kind\)/);
  assert.match(viewSource, /task\|tasks\|bullet\|bullets\|note\|notes\|all\|mixed/);
  assert.match(viewSource, /if \(value\.startsWith\('bullet'\)\) return task\.itemKind === 'bullet'/);
  assert.match(viewSource, /const laneAddMode = this\.resolveCardAddMode\(taskFilter\)/);
  assert.match(viewSource, /const createCommandOverride = this\.getCreateCommandOverride\(\)/);
  assert.match(viewSource, /if \(this\.runCreateCommandOverride\(\)\) return/);
  assert.match(viewSource, /const laneAdd = resolveKanbanLaneAddPresentation\(laneAddMode, displayLane\.label\)/);
  assert.match(viewSource, /if \(laneAdd\.shouldCreateTask\)/);
  assert.match(viewSource, /text: createCommandOverride \? `\+ \$\{createCommandOverride\.name\}` : laneAdd\.buttonText/);
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

  const task = (checkboxState) => ({ itemKind: 'task', checkboxState, inlineFields: [], text: 'Task' });
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

test('semantic note kinds stay note-only while structural task kinds keep task behavior', async () => {
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

  assert.match(viewSource, /if \(parseBareSemanticKindExpression\(expr\)\) \{\s*filter\.mode = 'notes';\s*return;/);
  assert.match(viewSource, /if \(isBareSemanticKindFilter\(propRaw, values\)\) \{\s*filter\.mode = 'notes';\s*return;/);
  assert.match(viewSource, /if \(parseBareSemanticKindExpression\(raw\)\) return false;/);
  assert.match(viewSource, /if \(isBareSemanticKindFilter\(propRaw, values\)\) return false;/);
  assert.match(viewSource, /if \(parseBareSemanticKindExpression\(raw\)\) \{\s*return \{ mode: 'notes'/);
  assert.match(viewSource, /if \(isBareSemanticKindFilter\(propRaw, values\)\) \{\s*return \{ mode: 'notes'/);
  assert.match(viewSource, /const currentValues = this\.getNoteComparableValues\(file, propRaw\);\s*result = values\.some/);
  assert.match(viewSource, /private extractNoteFrontmatterDefaults[\s\S]*defaults\[key\.trim\(\)\] = value;/);
  assert.match(filterKindUtilsSource, /'task',[\s\S]*'tasks',[\s\S]*'bullet',[\s\S]*'bullets',[\s\S]*'note',[\s\S]*'notes',[\s\S]*'all',[\s\S]*'mixed'/);
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
  assert.match(viewSource, /service\.openQuickEditorForElement\(taskEl, sourceEl\)/);
  assert.match(viewSource, /if \(this\.openTaskQuickEditor\(e, cardEl, titleEl\)\) return/);
});

test('kanban does not register vault-wide or Notebook Navigator open interception', () => {
  assert.doesNotMatch(mainSource, /registerVaultWidePreviewClicks/);
  assert.doesNotMatch(mainSource, /handleVaultWideInternalLinkPointer/);
  assert.doesNotMatch(mainSource, /shouldUseHoverPreviewForPointer/);
  assert.doesNotMatch(mainSource, /registerNotebookNavigatorPreviewClicks/);
  assert.doesNotMatch(mainSource, /handleNotebookNavigatorFilePointer/);
  assert.doesNotMatch(mainSource, /this\.registerNotebookNavigatorPreviewClicks\(\)/);
});
