import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild } from 'esbuild';

const localRoot = fileURLToPath(new URL('..', import.meta.url));
const baselineRoot = resolve(process.argv[2] ?? localRoot);
const candidateRoot = resolve(process.argv[3] ?? baselineRoot);
const sampleCount = Number(process.argv[4] ?? 50);
const iterationsPerSample = 10;
const warmupCount = 10;

if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) {
  throw new Error('The sample count must be a positive integer.');
}

async function importKanbanView(sourceRoot) {
  const build = await esbuildBuild({
    absWorkingDir: sourceRoot,
    entryPoints: [join(sourceRoot, 'src/views/KanbanView.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'obsidian-benchmark-stub',
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
    }],
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}#${encodeURIComponent(sourceRoot)}-${Date.now()}`;
  return import(moduleUrl);
}

const defaultStatusByState = {
  '[ ]': 'todo',
  '[x]': 'complete',
  '[/]': 'working',
  '[-]': 'wont-do',
  '[?]': 'holding',
  '[!]': 'important',
};

async function runColdLoad(KanbanView, options) {
  const path = options.path ?? 'Inbox/Task Cache Benchmark.md';
  const file = { path };
  let readCount = 0;
  let refreshCount = 0;
  let parserCalls = 0;
  let lineVisits = 0;
  const view = Object.create(KanbanView.prototype);
  view.openTasksByPath = new Map();
  view.allTasksByPath = new Map();
  view.openTaskOverflowByPath = new Map();
  view.taskReadsInFlight = new Map();
  view.isViewLoaded = true;
  view.renderGeneration = 0;
  view.app = {
    vault: {
      async cachedRead() {
        readCount += 1;
        return options.content;
      },
      getFileByPath(requestedPath) {
        return requestedPath === path ? file : null;
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
  view.getOpenTaskPreviewLimit = () => options.limit;
  view.getDoneStatuses = () => new Set(options.doneStatuses ?? ['complete', 'wont-do']);
  view.getStatusForCheckboxState = (state) => (
    options.statusByState?.[state]
    ?? defaultStatusByState[state]
    ?? String(state ?? '').toLowerCase()
  );
  view.refreshDebounced = () => {
    refreshCount += 1;
  };

  const extractor = options.gcm?.throw
    ? () => {
      throw new Error('synthetic GCM extraction failure');
    }
    : options.gcm
      ? () => options.gcm.result
      : undefined;
  view.getGcmServices = () => options.gcm?.location === 'services'
    ? { cardContent: { extractOpenTasksFromMarkdown: extractor } }
    : null;
  view.getGcmApi = () => options.gcm?.location === 'legacy'
    ? { cardContent: { extractOpenTasksFromMarkdown: extractor } }
    : null;

  const parseOpenTasks = view.parseOpenTasks.bind(view);
  view.parseOpenTasks = (content, ...args) => {
    parserCalls += 1;
    lineVisits += content.split(/\r?\n/u).length;
    return parseOpenTasks(content, ...args);
  };

  view.loadOpenTasksForFile(file);
  for (let index = 0; index < 100 && view.taskReadsInFlight.size; index += 1) {
    await Promise.resolve();
  }
  assert.equal(view.taskReadsInFlight.size, 0, 'task read did not settle');

  return {
    output: {
      openTasks: view.openTasksByPath.get(path),
      allTasks: view.allTasksByPath.get(path),
      overflowCount: view.openTaskOverflowByPath.get(path),
    },
    parserCalls,
    lineVisits,
    readCount,
    refreshCount,
  };
}

const parityContent = [
  '# Tasks',
  '- [ ] Open parent #alpha [area:: Work] <!-- visible comment removed --> ^parent',
  '  - [x] Done child (priority:: high)',
  '    1. [/] Working grandchild [owner:: Sam]',
  '  - [-] Cancelled child',
  '- [?] Holding task #waiting',
  '- [!] Important custom task',
  '- [ ] Visible title <!-- tps-inline-props: hidden --> [score:: 3]',
  '- [ ] <!-- hidden-only -->',
  'Plain prose resets hierarchy',
  '- [ ] Final open task',
].join('\n');

const gcmTasks = [
  { line: 2, checkboxState: '[ ]', inlineFields: [{ key: 'gcm', value: 'local-fields-win' }] },
  { line: 7, checkboxState: '[!]', inlineFields: [{ key: 'gcm', value: 'first' }] },
  { line: 7, checkboxState: '[!]', inlineFields: [{ key: 'gcm', value: 'last' }] },
  { line: 6, checkboxState: '[?]', inlineFields: [{ key: 'gcm', value: 'holding' }] },
  { line: Number.NaN, checkboxState: '[ ]', inlineFields: [{ key: 'ignored', value: 'invalid-line' }] },
];

const parityScenarios = [];
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
  parityScenarios.push({ name: `default-limit-${String(limit)}`, content: parityContent, limit });
}
parityScenarios.push({
  name: 'custom-status-map',
  content: parityContent,
  limit: 20,
  statusByState: { ...defaultStatusByState, '[/]': 'done-custom', '[?]': 'done-custom' },
  doneStatuses: ['complete', 'wont-do', 'done-custom'],
});
for (const [name, location, overflowCount] of [
  ['services-gcm', 'services', 7],
  ['legacy-gcm-negative-overflow', 'legacy', -3],
  ['services-gcm-nan-overflow', 'services', Number.NaN],
]) {
  parityScenarios.push({
    name,
    content: parityContent,
    limit: 5,
    gcm: { location, result: { openTasks: gcmTasks, overflowCount } },
  });
}
parityScenarios.push({
  name: 'services-gcm-undefined-overflow',
  content: parityContent,
  limit: 5,
  gcm: { location: 'services', result: { openTasks: gcmTasks } },
});
parityScenarios.push({
  name: 'services-gcm-throw',
  content: parityContent,
  limit: 5,
  gcm: { location: 'services', throw: true },
});

const [{ KanbanView: BaselineView }, { KanbanView: CandidateView }] = await Promise.all([
  importKanbanView(baselineRoot),
  importKanbanView(candidateRoot),
]);

const parityOutputs = [];
for (const scenario of parityScenarios) {
  const baseline = await runColdLoad(BaselineView, scenario);
  const candidate = await runColdLoad(CandidateView, scenario);
  assert.deepEqual(candidate.output, baseline.output, `${scenario.name} changed cache output`);
  assert.equal(candidate.readCount, baseline.readCount, `${scenario.name} changed read count`);
  assert.equal(candidate.refreshCount, baseline.refreshCount, `${scenario.name} changed repaint count`);
  parityOutputs.push({ name: scenario.name, output: candidate.output });
}

const benchmarkContent = Array.from({ length: 5_000 }, (_, index) => [
  `- [ ] Open parent ${index} #benchmark [area:: Work]`,
  `  - [x] Done child ${index} [priority:: high]`,
  `  - ${['[/]', '[-]', '[?]', '[!]'][index % 4]} Custom task ${index}`,
  `Paragraph ${index}`,
]).flat().join('\n');
const benchmarkOptions = { content: benchmarkContent, limit: 5 };

for (let index = 0; index < warmupCount; index += 1) {
  await runColdLoad(index % 2 === 0 ? BaselineView : CandidateView, benchmarkOptions);
}

const measurements = {
  baseline: { samples: [], parserCalls: 0, lineVisits: 0, reads: 0, refreshes: 0 },
  candidate: { samples: [], parserCalls: 0, lineVisits: 0, reads: 0, refreshes: 0 },
};

async function measure(label, View) {
  const startedAt = performance.now();
  for (let index = 0; index < iterationsPerSample; index += 1) {
    const result = await runColdLoad(View, benchmarkOptions);
    measurements[label].parserCalls += result.parserCalls;
    measurements[label].lineVisits += result.lineVisits;
    measurements[label].reads += result.readCount;
    measurements[label].refreshes += result.refreshCount;
  }
  measurements[label].samples.push(performance.now() - startedAt);
}

for (let sample = 0; sample < sampleCount; sample += 1) {
  if (sample % 2 === 0) {
    await measure('baseline', BaselineView);
    await measure('candidate', CandidateView);
  } else {
    await measure('candidate', CandidateView);
    await measure('baseline', BaselineView);
  }
}

function summarize(measurement) {
  const samples = [...measurement.samples].sort((left, right) => left - right);
  const percentile = (fraction) => samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))];
  return {
    parserCalls: measurement.parserCalls,
    lineVisits: measurement.lineVisits,
    reads: measurement.reads,
    refreshes: measurement.refreshes,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
  };
}

const baselineSummary = summarize(measurements.baseline);
const candidateSummary = summarize(measurements.candidate);
assert.equal(
  baselineSummary.parserCalls,
  baselineSummary.reads * 2,
  'exact baseline must perform two parser passes per cold read',
);
assert.equal(
  candidateSummary.parserCalls,
  candidateSummary.reads,
  'candidate must perform one parser pass per cold read',
);
assert.equal(
  baselineSummary.lineVisits,
  candidateSummary.lineVisits * 2,
  'candidate must halve deterministic full-content line visits',
);
assert.equal(candidateSummary.reads, baselineSummary.reads, 'candidate changed vault-read count');
assert.equal(candidateSummary.refreshes, baselineSummary.refreshes, 'candidate changed repaint count');
assert.ok(
  candidateSummary.medianMs < baselineSummary.medianMs,
  `candidate median ${candidateSummary.medianMs}ms did not beat baseline ${baselineSummary.medianMs}ms`,
);
assert.ok(
  candidateSummary.p95Ms < baselineSummary.p95Ms,
  `candidate p95 ${candidateSummary.p95Ms}ms did not beat baseline ${baselineSummary.p95Ms}ms`,
);

process.stdout.write(`${JSON.stringify({
  baselineRoot,
  candidateRoot,
  parityScenarios: parityScenarios.length,
  parityDigest: createHash('sha256').update(JSON.stringify(parityOutputs)).digest('hex'),
  benchmark: {
    lineCount: benchmarkContent.split(/\r?\n/u).length,
    sampleCount,
    iterationsPerSample,
    warmupCount,
    baseline: baselineSummary,
    candidate: candidateSummary,
  },
}, null, 2)}\n`);
