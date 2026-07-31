import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join, resolve } from 'node:path';
import { build as esbuildBuild } from 'esbuild';

const baselineRoot = resolve(process.argv[2] ?? '');
const candidateRoot = resolve(process.argv[3] ?? '');
const randomCaseCount = Number(process.argv[4] ?? 200_000);
const sampleCount = Number(process.argv[5] ?? 15);
const baselineViewPath = join(baselineRoot, 'src/views/KanbanView.ts');
const candidateViewPath = join(candidateRoot, 'src/views/KanbanView.ts');
const expectedBaselineHash = 'f0b12dc6254ad39e5ebed94e4cd15ed5b3d969f83de63558aebdc2e6346dcf3c';

if (!Number.isSafeInteger(randomCaseCount) || randomCaseCount < 1) {
  throw new Error('Random case count must be a positive integer.');
}
if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) {
  throw new Error('Sample count must be a positive integer.');
}

const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const baselineSourceHash = hashFile(baselineViewPath);
const candidateSourceHash = hashFile(candidateViewPath);
assert.equal(
  baselineSourceHash,
  expectedBaselineHash,
  'baseline must be exact public TPS Kanban 0.1.5 KanbanView source',
);

async function importKanbanView(sourceRoot) {
  const build = await esbuildBuild({
    absWorkingDir: sourceRoot,
    entryPoints: [join(sourceRoot, 'src/views/KanbanView.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'obsidian-style-benchmark-stub',
      setup(buildContext) {
        buildContext.onResolve({ filter: /^obsidian$/ }, () => ({
          path: 'obsidian-stub',
          namespace: 'stub',
        }));
        buildContext.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
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
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}#${encodeURIComponent(sourceRoot)}-${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

function createStyleHarness(KanbanView) {
  const view = Object.create(KanbanView.prototype);
  let conditionCalls = 0;
  let currentFrontmatter = {};
  view.plugin = { settings: { cardStyleRules: [] } };
  view.app = {
    metadataCache: {
      getFileCache: () => ({ frontmatter: currentFrontmatter }),
    },
  };
  view.getStatusForCheckboxState = (state) => ({
    '[ ]': 'todo',
    '[x]': 'complete',
    '[/]': 'working',
    '[-]': 'wont-do',
  })[state] ?? 'todo';
  const evaluateCondition = view.evaluateStyleCondition.bind(view);
  view.evaluateStyleCondition = (...args) => {
    conditionCalls += 1;
    return evaluateCondition(...args);
  };

  return {
    resolve(testCase) {
      view.plugin.settings.cardStyleRules = testCase.rules;
      currentFrontmatter = testCase.frontmatter;
      const callsBefore = conditionCalls;
      const matchedRule = testCase.kind === 'task'
        ? view.resolveTaskCardStyleRule(
          { path: 'Inbox/Style Benchmark.md' },
          {
            itemKind: testCase.itemKind,
            checkboxState: testCase.checkboxState,
            inlineFields: testCase.inlineFields,
          },
          null,
        )
        : view.resolveCardStyleRule(testCase.frontmatter, {}, null);
      return {
        matchedRuleId: matchedRule?.id ?? null,
        matchedRuleIndex: matchedRule ? testCase.rules.indexOf(matchedRule) : -1,
        conditionCalls: conditionCalls - callsBefore,
      };
    },
  };
}

function createRandom(seed = 0x51f15e) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

const random = createRandom();
const choose = (items) => items[Math.floor(random() * items.length)];
const operators = [
  'is',
  '!is',
  'contains',
  '!contains',
  'starts',
  '!starts',
  'ends',
  '!ends',
  'exists',
  '!exists',
];
const fields = ['state', 'priority', 'owner', 'score', 'empty', 'status', 'kind'];
const values = ['', 'ready', 'blocked', 'high', 'low', 'sam', '7', 'task', 'bullet', 'todo'];

function createRandomCase(index) {
  const frontmatter = {
    state: choose(values),
    priority: choose(values),
    owner: choose(values),
    score: choose(values),
    empty: random() < 0.5 ? '' : choose(values),
  };
  const ruleCount = Math.floor(random() * 7);
  const rules = Array.from({ length: ruleCount }, (_, ruleIndex) => ({
    id: `case-${index}-rule-${ruleIndex}`,
    active: random() < 0.15 ? false : true,
    match: random() < 0.5 ? 'any' : 'all',
    conditions: Array.from(
      { length: Math.floor(random() * 9) },
      () => ({
        field: choose(fields),
        operator: choose(operators),
        value: choose(values),
      }),
    ),
  }));
  return {
    kind: index % 2 === 0 ? 'note' : 'task',
    frontmatter,
    rules,
    itemKind: random() < 0.2 ? 'bullet' : 'task',
    checkboxState: choose(['[ ]', '[x]', '[/]', '[-]']),
    inlineFields: [
      { key: 'state', value: choose(values) },
      { key: 'owner', value: choose(values) },
    ],
  };
}

const [{ KanbanView: BaselineView }, { KanbanView: CandidateView }] = await Promise.all([
  importKanbanView(baselineRoot),
  importKanbanView(candidateRoot),
]);
const baselineHarness = createStyleHarness(BaselineView);
const candidateHarness = createStyleHarness(CandidateView);
const parityHash = createHash('sha256');
let baselineRandomCalls = 0;
let candidateRandomCalls = 0;
let improvedRandomCases = 0;

for (let index = 0; index < randomCaseCount; index += 1) {
  const testCase = createRandomCase(index);
  const baseline = baselineHarness.resolve(testCase);
  const candidate = candidateHarness.resolve(testCase);
  assert.equal(
    candidate.matchedRuleIndex,
    baseline.matchedRuleIndex,
    `selected rule identity changed for randomized ${testCase.kind} case ${index}`,
  );
  assert.ok(
    candidate.conditionCalls <= baseline.conditionCalls,
    `candidate evaluated more conditions for randomized case ${index}`,
  );
  baselineRandomCalls += baseline.conditionCalls;
  candidateRandomCalls += candidate.conditionCalls;
  if (candidate.conditionCalls < baseline.conditionCalls) improvedRandomCases += 1;
  parityHash.update(`${testCase.kind}:${candidate.matchedRuleId ?? ''}\n`);
}
assert.ok(improvedRandomCases > 0, 'randomized workload did not exercise short-circuiting');

const trueCondition = { field: 'state', operator: 'is', value: 'ready' };
const falseCondition = { field: 'state', operator: 'is', value: 'blocked' };
const anyRules = Array.from({ length: 12 }, (_, index) => ({
  id: `any-${index}`,
  active: true,
  match: 'any',
  conditions: [trueCondition, ...Array.from({ length: 7 }, () => falseCondition)],
}));
const allRules = Array.from({ length: 12 }, (_, index) => ({
  id: `all-${index}`,
  active: true,
  match: 'all',
  conditions: [falseCondition, ...Array.from({ length: 7 }, () => trueCondition)],
}));
const benchmarkCardCount = 6_000;

function runBenchmarkBatch(harness) {
  let conditionCalls = 0;
  let checksum = 0;
  for (let index = 0; index < benchmarkCardCount; index += 1) {
    const useAny = index % 2 === 0;
    const result = harness.resolve({
      kind: index % 4 < 2 ? 'note' : 'task',
      frontmatter: { state: 'ready' },
      rules: useAny ? anyRules : allRules,
      itemKind: 'task',
      checkboxState: '[ ]',
      inlineFields: [],
    });
    conditionCalls += result.conditionCalls;
    if (result.matchedRuleId) checksum += result.matchedRuleId.length;
  }
  return { conditionCalls, checksum };
}

for (let index = 0; index < 4; index += 1) {
  runBenchmarkBatch(index % 2 === 0 ? baselineHarness : candidateHarness);
}

const measurements = {
  baseline: { samples: [], conditionCalls: 0, checksum: 0 },
  candidate: { samples: [], conditionCalls: 0, checksum: 0 },
};

function measure(label, harness) {
  const startedAt = performance.now();
  const result = runBenchmarkBatch(harness);
  measurements[label].samples.push(performance.now() - startedAt);
  measurements[label].conditionCalls += result.conditionCalls;
  measurements[label].checksum += result.checksum;
}

for (let sample = 0; sample < sampleCount; sample += 1) {
  if (sample % 2 === 0) {
    measure('baseline', baselineHarness);
    measure('candidate', candidateHarness);
  } else {
    measure('candidate', candidateHarness);
    measure('baseline', baselineHarness);
  }
}

function summarize(measurement) {
  const samples = [...measurement.samples].sort((left, right) => left - right);
  const percentile = (fraction) => samples[
    Math.min(samples.length - 1, Math.floor(samples.length * fraction))
  ];
  return {
    conditionCalls: measurement.conditionCalls,
    checksum: measurement.checksum,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
  };
}

const baselineSummary = summarize(measurements.baseline);
const candidateSummary = summarize(measurements.candidate);
assert.equal(candidateSummary.checksum, baselineSummary.checksum, 'benchmark outputs changed');
assert.equal(
  baselineSummary.conditionCalls,
  candidateSummary.conditionCalls * 8,
  'candidate must eliminate seven of eight condition evaluations after a decisive first result',
);
assert.ok(
  candidateSummary.medianMs <= baselineSummary.medianMs * 0.5,
  'multi-condition candidate median must be at most 50% of baseline',
);
assert.ok(
  candidateSummary.p95Ms <= baselineSummary.p95Ms * 0.6,
  'multi-condition candidate p95 must be at most 60% of baseline',
);

function runDecisiveOperationProof(harness) {
  let conditionCalls = 0;
  for (let index = 0; index < 30_000; index += 1) {
    conditionCalls += harness.resolve({
      kind: index % 2 === 0 ? 'note' : 'task',
      frontmatter: { state: 'ready' },
      rules: allRules,
      itemKind: 'task',
      checkboxState: '[ ]',
      inlineFields: [],
    }).conditionCalls;
  }
  return conditionCalls;
}

const decisiveOperationProof = {
  baselineConditionCalls: runDecisiveOperationProof(baselineHarness),
  candidateConditionCalls: runDecisiveOperationProof(candidateHarness),
};
assert.deepEqual(
  decisiveOperationProof,
  { baselineConditionCalls: 2_880_000, candidateConditionCalls: 360_000 },
  '12-rule × 8-condition decisive workload must reduce 2,880,000 calls to 360,000',
);

const worstCaseRules = [
  {
    id: 'worst-any',
    active: true,
    match: 'any',
    conditions: Array.from({ length: 8 }, () => falseCondition),
  },
  {
    id: 'worst-all',
    active: true,
    match: 'all',
    conditions: Array.from({ length: 8 }, () => trueCondition),
  },
];

function runWorstCaseProof(harness) {
  return ['note', 'task'].map((kind) => worstCaseRules.map((testedRule) => harness.resolve({
    kind,
    frontmatter: { state: 'ready' },
    rules: [testedRule],
    itemKind: 'task',
    checkboxState: '[ ]',
    inlineFields: [],
  }).conditionCalls));
}

const worstCaseOperationProof = {
  baselineConditionCalls: runWorstCaseProof(baselineHarness),
  candidateConditionCalls: runWorstCaseProof(candidateHarness),
};
assert.deepEqual(
  worstCaseOperationProof.candidateConditionCalls,
  worstCaseOperationProof.baselineConditionCalls,
  'worst-case any/all paths must retain identical condition counts',
);
assert.deepEqual(
  worstCaseOperationProof.baselineConditionCalls,
  [[8, 8], [8, 8]],
  'worst-case proof must fully evaluate all eight conditions in both resolvers',
);

const oneConditionRules = Array.from({ length: 5 }, (_, index) => ({
  id: `one-condition-${index}`,
  active: true,
  match: 'all',
  conditions: [{
    field: 'state',
    operator: 'is',
    value: index === 4 ? 'ready' : `not-ready-${index}`,
  }],
}));
const oneConditionCardCount = 30_000;

function runOneConditionBatch(harness) {
  let conditionCalls = 0;
  let checksum = 0;
  for (let index = 0; index < oneConditionCardCount; index += 1) {
    const result = harness.resolve({
      kind: index % 2 === 0 ? 'note' : 'task',
      frontmatter: { state: 'ready' },
      rules: oneConditionRules,
      itemKind: 'task',
      checkboxState: '[ ]',
      inlineFields: [],
    });
    conditionCalls += result.conditionCalls;
    checksum += result.matchedRuleId?.length ?? 0;
  }
  return { conditionCalls, checksum };
}

for (let index = 0; index < 4; index += 1) {
  runOneConditionBatch(index % 2 === 0 ? baselineHarness : candidateHarness);
}

const oneConditionMeasurements = {
  baseline: { samples: [], conditionCalls: 0, checksum: 0 },
  candidate: { samples: [], conditionCalls: 0, checksum: 0 },
};

function measureOneCondition(label, harness) {
  const startedAt = performance.now();
  const result = runOneConditionBatch(harness);
  oneConditionMeasurements[label].samples.push(performance.now() - startedAt);
  oneConditionMeasurements[label].conditionCalls += result.conditionCalls;
  oneConditionMeasurements[label].checksum += result.checksum;
}

for (let sample = 0; sample < sampleCount; sample += 1) {
  if (sample % 2 === 0) {
    measureOneCondition('baseline', baselineHarness);
    measureOneCondition('candidate', candidateHarness);
  } else {
    measureOneCondition('candidate', candidateHarness);
    measureOneCondition('baseline', baselineHarness);
  }
}

const baselineOneConditionSummary = summarize(oneConditionMeasurements.baseline);
const candidateOneConditionSummary = summarize(oneConditionMeasurements.candidate);
assert.equal(
  candidateOneConditionSummary.conditionCalls,
  baselineOneConditionSummary.conditionCalls,
  'one-condition configuration must retain identical evaluation counts',
);
assert.equal(
  candidateOneConditionSummary.checksum,
  baselineOneConditionSummary.checksum,
  'one-condition configuration outputs changed',
);
assert.ok(
  candidateOneConditionSummary.medianMs <= baselineOneConditionSummary.medianMs * 1.05,
  'one-condition candidate median must not regress by more than 5%',
);
assert.ok(
  candidateOneConditionSummary.p95Ms <= baselineOneConditionSummary.p95Ms * 1.05,
  'one-condition candidate p95 must not regress by more than 5%',
);

process.stdout.write(`${JSON.stringify({
  baselineRoot,
  candidateRoot,
  baselineSourceHash,
  candidateSourceHash,
  randomizedParity: {
    cases: randomCaseCount,
    digest: parityHash.digest('hex'),
    baselineConditionCalls: baselineRandomCalls,
    candidateConditionCalls: candidateRandomCalls,
    improvedCases: improvedRandomCases,
  },
  benchmark: {
    cardsPerSample: benchmarkCardCount,
    rulesPerCard: 12,
    conditionsPerRule: 8,
    sampleCount,
    baseline: baselineSummary,
    candidate: candidateSummary,
    conditionCallReductionPercent: (
      (1 - candidateSummary.conditionCalls / baselineSummary.conditionCalls) * 100
    ),
  },
  decisiveOperationProof,
  worstCaseOperationProof,
  oneConditionBenchmark: {
    cardsPerSample: oneConditionCardCount,
    rulesPerCard: 5,
    conditionsPerRule: 1,
    sampleCount,
    baseline: baselineOneConditionSummary,
    candidate: candidateOneConditionSummary,
  },
}, null, 2)}\n`);
