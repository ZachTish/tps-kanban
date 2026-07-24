import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settingsTabSource = readFileSync(new URL('../src/settings/SettingsTab.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/settings.ts', import.meta.url), 'utf8');
const sourceStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const loadedStyles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const persistedKeys = [
  'enableLogging',
  'iconKey',
  'colorKey',
  'frontmatterColorTarget',
  'cardStyleRules',
  'ungroupedPosition',
  'laneOrderByView',
  'scale',
  'layoutModeByView',
  'showCompletedTasksByView',
  'dynamicEmptyLaneWidth',
  'laneLabelAliasesByView',
  'cardActivationMode',
  'cardAddButtonDefault',
  'defaultRootTaskPath',
  'openTaskDestinationAfterCreate',
  'openTaskPreviewLimit',
  'showTaskOverflowCount',
];

const userControlKeys = [
  'enableLogging',
  'iconKey',
  'colorKey',
  'frontmatterColorTarget',
  'cardStyleRules',
  'ungroupedPosition',
  'scale',
  'dynamicEmptyLaneWidth',
  'cardActivationMode',
  'cardAddButtonDefault',
  'defaultRootTaskPath',
  'openTaskDestinationAfterCreate',
  'openTaskPreviewLimit',
  'showTaskOverflowCount',
];

const perViewKeys = [
  'laneOrderByView',
  'layoutModeByView',
  'showCompletedTasksByView',
  'laneLabelAliasesByView',
];

test('settings use five shallow routes and render only the active destination', () => {
  const destinations = [
    ['rules-creation', 'Rules & creation'],
    ['cards', 'Cards'],
    ['appearance', 'Appearance'],
    ['lanes-layout', 'Lanes & layout'],
    ['advanced', 'Advanced'],
  ];
  for (const [id, title] of destinations) {
    assert.ok(settingsTabSource.includes(`id: '${id}',\n    title: '${title}',`));
  }
  assert.match(settingsTabSource, /private activeSettingsPage: KanbanSettingsPage = 'rules-creation'/);
  assert.match(settingsTabSource, /text: 'Choose what to configure'/);
  assert.match(settingsTabSource, /switch \(this\.activeSettingsPage\)/);
  assert.equal((settingsTabSource.match(/createEl\('section'/g) ?? []).length, 1);
  assert.equal((settingsTabSource.match(/createEl\('details'/g) ?? []).length, 1);
  assert.doesNotMatch(settingsTabSource, /createCollapsibleSection|tps-collapsible-section/);
  assert.match(settingsTabSource, /Base rules at a glance/);
  assert.match(settingsTabSource, /Open full Base filter reference/);
  assert.doesNotMatch(settingsSource, /activeSettingsPage|settingsScrollTopByPage|rules-creation/);
});

test('all persisted keys, compatibility paths, per-view ownership, and reset actions remain intact', () => {
  const interfaceBody = settingsSource.match(/export interface KanbanSettings \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const interfaceKeys = [...interfaceBody.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
  assert.deepEqual(interfaceKeys.sort(), [...persistedKeys].sort());

  const defaultsBody = settingsSource.match(/export const DEFAULT_SETTINGS: KanbanSettings = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  const defaultKeys = [...defaultsBody.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
  assert.deepEqual(defaultKeys.sort(), [...persistedKeys].sort());

  for (const key of userControlKeys) {
    assert.match(settingsTabSource, new RegExp(`this\\.plugin\\.settings\\.${key}\\b`));
  }
  for (const key of perViewKeys) {
    assert.match(settingsSource, new RegExp(`\\b${key}:`));
    assert.doesNotMatch(settingsTabSource, new RegExp(`this\\.plugin\\.settings\\.${key}\\s*=`));
  }
  assert.match(settingsTabSource, /Board\/list mode, manual lane order, lane labels, and completed-task visibility are saved per Base view/);

  assert.match(settingsSource, /frontmatterColorTarget: "card" \| "icon" \| "both" \| "off"/);
  assert.match(settingsSource, /value === 'card' \|\| value === 'icon' \|\| value === 'both' \|\| value === 'off'/);
  assert.match(settingsTabSource, /\.addOption\('card', 'Card only'\)/);
  assert.match(settingsTabSource, /\.addOption\('off', 'Off'\)/);
  assert.match(settingsTabSource, /\.setValue\(this\.plugin\.settings\.frontmatterColorTarget === 'off' \? 'off' : 'card'\)/);
  assert.match(settingsTabSource, /this\.plugin\.settings\.frontmatterColorTarget = value as 'card' \| 'off'/);

  assert.match(settingsTabSource, /\.setLimits\(0, 20, 1\)/);
  assert.match(settingsTabSource, /this\.plugin\.settings\.openTaskPreviewLimit = 5/);
  assert.match(settingsTabSource, /\.setTooltip\('Reset to 5'\)/);
  assert.match(settingsTabSource, /\.setLimits\(50, 140, 5\)/);
  assert.match(settingsTabSource, /this\.plugin\.settings\.scale = 1/);
  assert.match(settingsTabSource, /\.setTooltip\('Reset to 100%'\)/);
});

test('route navigation is keyboard-visible, focus-aware, scroll-safe, and mobile horizontal', () => {
  assert.match(settingsTabSource, /createEl\('nav'/);
  assert.match(settingsTabSource, /setAttr\('aria-label', 'Kanban settings sections'\)/);
  assert.match(settingsTabSource, /button\.type = 'button'/);
  assert.doesNotMatch(settingsTabSource, /button\.setAttr\('aria-controls'/);
  assert.match(settingsTabSource, /button\.setAttr\('aria-pressed', String\(isActive\)\)/);
  assert.match(settingsTabSource, /pageHeading\.tabIndex = -1/);
  assert.match(settingsTabSource, /pageHeading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(settingsTabSource, /pageHeading\.scrollIntoView\(\{ block: 'start' \}\)/);
  assert.match(settingsTabSource, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.match(settingsTabSource, /settingsScrollTopByPage = new Map<KanbanSettingsPage, number>\(\)/);
  assert.match(settingsTabSource, /containerEl\.scrollTop = this\.settingsScrollTopByPage\.get\(this\.activeSettingsPage\) \?\? 0/);

  assert.equal(loadedStyles, sourceStyles);
  assert.match(sourceStyles, /\.tps-kanban-settings-route:focus-visible/);
  assert.match(sourceStyles, /\.tps-kanban-settings-route\[aria-pressed="true"\]/);
  assert.match(sourceStyles, /\.tps-kanban-settings-route\s*\{[\s\S]*height: auto;/);
  assert.match(sourceStyles, /\.tps-kanban-settings-page-heading\s*\{[\s\S]*scroll-margin-top:/);
  assert.match(sourceStyles, /\.tps-kanban-settings-page-heading:focus\s*\{[\s\S]*outline: 2px solid var\(--interactive-accent\)/);
  assert.match(sourceStyles, /@media \(max-width: 700px\), \(hover: none\) and \(pointer: coarse\) \{[\s\S]*\.tps-kanban-settings-nav\s*\{[\s\S]*display: flex;[\s\S]*overflow-x: auto;/);
  assert.match(sourceStyles, /\.tps-kanban-settings-route\s*\{[\s\S]*scroll-snap-align: start;/);
  assert.match(sourceStyles, /\.tps-kanban-settings-page > \.setting-item\s*\{[\s\S]*flex-direction: column;/);

  const settingsClasses = [...sourceStyles.matchAll(/\.([a-z0-9-]*settings-[a-z0-9-]+)/gi)]
    .map((match) => match[1]);
  assert.ok(settingsClasses.length > 0);
  assert.equal(settingsClasses.every((className) => className.startsWith('tps-kanban-settings-')), true);
});

test('README specifies the shallow settings contract and focused validation command', () => {
  for (const title of ['Rules & creation', 'Cards', 'Appearance', 'Lanes & layout', 'Advanced']) {
    assert.ok(readme.includes(title));
  }
  assert.match(readme, /only the active destination is rendered/i);
  assert.match(readme, /route choice is transient/i);
  assert.match(readme, /compact Base rules guide/i);
  assert.match(readme, /one optional full reference/i);
  assert.match(readme, /saved per Base view/i);
  assert.match(readme, /`icon` and `both` remain load-compatible/i);
  assert.match(readme, /`npm run test:settings`/);
  assert.equal(packageJson.scripts['test:settings'], 'node --test scripts/test-settings-contract.mjs');
  assert.match(packageJson.scripts.test, /npm run test:settings/);
});
