import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function loadFilterModule() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/base-filter-roots.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const accepted = new Set(['tps-list']);

test('whole-Base and active-view filters are separate effective AND roots', async () => {
  const { extractPersistedFilterRoots, combineEffectiveFilterResults } = await loadFilterModule();
  const parsed = {
    filters: { or: ['file.folder == "Inbox"', 'file.folder == "Projects"'] },
    views: [
      { type: 'tps-list', name: 'Open', filters: { and: ['kind == "task"', 'status != "complete"'] } },
      { type: 'tps-list', name: 'Completed', filters: { and: ['kind == "task"', 'status == "complete"'] } },
    ],
  };
  const result = extractPersistedFilterRoots(parsed, 'Open', accepted);
  assert.deepEqual(result.filters, [parsed.views[0].filters, parsed.filters]);
  assert.equal(combineEffectiveFilterResults([true, true]), true);
  assert.equal(combineEffectiveFilterResults([true, false]), false);
  assert.equal(combineEffectiveFilterResults([false, true]), false);
});

test('inactive sibling-view filters never leak into the active view', async () => {
  const { extractPersistedFilterRoots } = await loadFilterModule();
  const parsed = {
    filters: { and: ['file.ext == "md"'] },
    views: [
      { type: 'tps-list', name: 'Today', filters: { and: ['scheduled == today()'] } },
      { type: 'tps-list', name: 'Later', filters: { and: ['scheduled > today()'] } },
      { type: 'table', name: 'Evidence', filters: { and: ['kind == "note"'] } },
    ],
  };
  const result = extractPersistedFilterRoots(parsed, 'Later', accepted);
  assert.deepEqual(result.filters, [parsed.views[1].filters, parsed.filters]);
});

test('runtime edits, active-view filters, and whole-Base filters compose without duplicates', async () => {
  const { composeEffectiveFilterRoots } = await loadFilterModule();
  const runtime = { and: ['priority == "high"'] };
  const active = { or: ['status == "todo"', 'status == "doing"'] };
  const base = { and: ['kind == "task"'] };
  assert.deepEqual(composeEffectiveFilterRoots([runtime, active], [active, base]), [runtime, active, base]);
});

test('unknown filter results cannot bypass a known failing Base or view root', async () => {
  const { combineEffectiveFilterResults } = await loadFilterModule();
  assert.equal(combineEffectiveFilterResults([null, true]), true);
  assert.equal(combineEffectiveFilterResults([null, false, true]), false);
  assert.equal(combineEffectiveFilterResults([null, null]), null);
});

test('missing requested view does not borrow filters from another named view', async () => {
  const { extractPersistedFilterRoots } = await loadFilterModule();
  const parsed = {
    filters: { and: ['file.ext == "md"'] },
    views: [{ type: 'tps-list', name: 'Only', filters: { and: ['status == "todo"'] } }],
  };
  const result = extractPersistedFilterRoots(parsed, 'Missing', accepted);
  assert.deepEqual(result.filters, [parsed.filters]);
});
