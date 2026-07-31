import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild } from 'esbuild';

const localRoot = fileURLToPath(new URL('..', import.meta.url));
const baselineRoot = resolve(process.argv[2] ?? localRoot);
const candidateRoot = resolve(process.argv[3] ?? localRoot);
const expectedBaselineHash = '390c34d0dfd7c6226a27f799f644f39fa0b6f5158d0b8543f596627e3ff774d9';
assert.equal(typeof globalThis.gc, 'function', 'run this benchmark with node --expose-gc');
const baselineHash = createHash('sha256')
  .update(readFileSync(join(baselineRoot, 'src/views/KanbanView.ts')))
  .digest('hex');
assert.equal(baselineHash, expectedBaselineHash, 'baseline KanbanView.ts is not exact public 0.1.6');

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
      setup(esbuild) {
        esbuild.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian-stub', namespace: 'stub' }));
        esbuild.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
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
  const source = Buffer.from(build.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${source}#${encodeURIComponent(sourceRoot)}-${Date.now()}`);
}

function createView(KanbanView, scenario, counter) {
  const view = Object.create(KanbanView.prototype);
  view.getDoneStatuses = () => new Set(scenario.doneStatuses);
  view.getStatusForCheckboxState = (state) => scenario.statusByState[state] ?? 'todo';
  const parseLineItem = view.parseLineItem.bind(view);
  view.parseLineItem = (...args) => {
    counter.calls += 1;
    return parseLineItem(...args);
  };
  return view;
}

function parse(KanbanView, content, scenario) {
  const counter = { calls: 0 };
  const view = createView(KanbanView, scenario, counter);
  return {
    result: view.parseOpenTasks(
      content,
      'Inbox/Line Parser Benchmark.md',
      scenario.limit,
      scenario.includeDone,
      scenario.includeBullets,
    ),
    calls: counter.calls,
  };
}

let randomState = 0x6d2b79f5;
function random() {
  randomState = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), 61 | randomState);
  return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
}

const lineFactories = [
  (index) => `- [ ] Open ${index} #alpha [area:: Work]`,
  (index) => `  * [x] Done ${index} <!-- hidden -->`,
  (index) => `\t1. [/] Working ${index} [owner:: Sam]`,
  (index) => `    - [-] Cancelled ${index} ^block-${index}`,
  (index) => `- [?] Holding ${index} — Unicode`,
  (index) => `- [!] Important ${index}`,
  (index) => `- Ordinary bullet ${index} [kind:: note]`,
  (index) => `  1. Ordered bullet ${index}`,
  (index) => `Paragraph ${index}`,
  (index) => `# Heading ${index}`,
  () => '',
  (index) => `- [not-a-checkbox] ${index}`,
];
const randomLines = Array.from({ length: 100_000 }, (_, index) => {
  const factory = lineFactories[Math.floor(random() * lineFactories.length)];
  return factory(index);
});
const parityContent = randomLines.join('\r\n');
const lineCount = randomLines.length;
const statusMaps = [
  {
    '[ ]': 'todo',
    '[x]': 'complete',
    '[/]': 'working',
    '[-]': 'wont-do',
    '[?]': 'holding',
    '[!]': 'important',
  },
  {
    '[ ]': 'queued',
    '[x]': 'finished',
    '[/]': 'finished',
    '[-]': 'cancelled',
    '[?]': 'queued',
    '[!]': 'queued',
  },
];
const scenarios = [];
for (const includeDone of [false, true]) {
  for (const includeBullets of [false, true]) {
    for (const statusByState of statusMaps) {
      scenarios.push({
        includeDone,
        includeBullets,
        statusByState,
        doneStatuses: statusByState === statusMaps[0]
          ? ['complete', 'wont-do']
          : ['finished', 'cancelled'],
        limit: includeBullets ? Number.MAX_SAFE_INTEGER : 12_345,
      });
    }
  }
}

const [{ KanbanView: BaselineView }, { KanbanView: CandidateView }] = await Promise.all([
  importKanbanView(baselineRoot),
  importKanbanView(candidateRoot),
]);

const parityHash = createHash('sha256');
let baselineParityCalls = 0;
let candidateParityCalls = 0;
for (const scenario of scenarios) {
  const baseline = parse(BaselineView, parityContent, scenario);
  const candidate = parse(CandidateView, parityContent, scenario);
  assert.deepEqual(candidate.result, baseline.result, 'candidate changed parsed task or bullet output');
  assert.equal(baseline.calls, lineCount * 2, 'baseline did not classify every line twice');
  assert.equal(candidate.calls, lineCount, 'candidate did not classify every line exactly once');
  baselineParityCalls += baseline.calls;
  candidateParityCalls += candidate.calls;
  parityHash.update(JSON.stringify(candidate.result));
}

const benchmarkLines = Array.from({ length: 5_000 }, (_, index) => [
  `- [ ] Parent ${index} [area:: Work]`,
  `  - Child bullet ${index}`,
  `    1. [x] Done grandchild ${index}`,
  `Paragraph ${index}`,
  `- [/] Working ${index}`,
]).flat();
const benchmarkContent = benchmarkLines.join('\n');
const benchmarkScenario = {
  includeDone: true,
  includeBullets: true,
  statusByState: statusMaps[0],
  doneStatuses: ['complete', 'wont-do'],
  limit: Number.MAX_SAFE_INTEGER,
};
for (let index = 0; index < 8; index += 1) {
  parse(index % 2 ? BaselineView : CandidateView, benchmarkContent, benchmarkScenario);
}

const measurements = { baseline: [], candidate: [] };
const benchmarkCalls = { baseline: 0, candidate: 0 };
function measure(label, View) {
  globalThis.gc();
  const startedAt = performance.now();
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const measured = parse(View, benchmarkContent, {
      ...benchmarkScenario,
      includeBullets: iteration % 2 === 0,
    });
    benchmarkCalls[label] += measured.calls;
  }
  measurements[label].push(performance.now() - startedAt);
}
for (let sample = 0; sample < 21; sample += 1) {
  if (sample % 2 === 0) {
    measure('baseline', BaselineView);
    measure('candidate', CandidateView);
  } else {
    measure('candidate', CandidateView);
    measure('baseline', BaselineView);
  }
}

function summarize(samples) {
  const ordered = [...samples].sort((left, right) => left - right);
  const at = (fraction) => ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
  return { medianMs: at(0.5), p95Ms: at(0.95) };
}
const baselineTiming = summarize(measurements.baseline);
const candidateTiming = summarize(measurements.candidate);
assert.equal(benchmarkCalls.baseline, benchmarkCalls.candidate * 2, 'benchmark classification count was not halved');
assert.ok(
  candidateTiming.medianMs < baselineTiming.medianMs,
  `candidate median ${candidateTiming.medianMs}ms did not beat baseline ${baselineTiming.medianMs}ms`,
);
assert.ok(
  candidateTiming.p95Ms < baselineTiming.p95Ms,
  `candidate p95 ${candidateTiming.p95Ms}ms did not beat baseline ${baselineTiming.p95Ms}ms`,
);

process.stdout.write(`${JSON.stringify({
  baselineRoot,
  candidateRoot,
  baselineHash,
  parity: {
    sourceLines: lineCount,
    scenarios: scenarios.length,
    comparisons: lineCount * scenarios.length,
    digest: parityHash.digest('hex'),
    baselineCalls: baselineParityCalls,
    candidateCalls: candidateParityCalls,
  },
  benchmark: {
    sourceLines: benchmarkLines.length,
    samples: measurements.baseline.length,
    iterationsPerSample: 5,
    baselineCalls: benchmarkCalls.baseline,
    candidateCalls: benchmarkCalls.candidate,
    baseline: baselineTiming,
    candidate: candidateTiming,
  },
}, null, 2)}\n`);
