import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const viewSource = readFileSync(new URL('../src/views/KanbanView.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/settings.ts', import.meta.url), 'utf8');
const settingsTabSource = readFileSync(new URL('../src/settings/SettingsTab.ts', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const loadedStylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

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
  assert.match(viewSource, /private getVirtualBaseEmbedHost\(\): HTMLElement \| null/);
  assert.match(viewSource, /private getEmbeddedBasePathFromDom\(\): string \| null/);
  assert.ok(viewSource.includes('.internal-embed[src$=".base"]'));
  assert.match(viewSource, /this\.getEmbeddedBasePathFromDom\(\)/);
  assert.match(viewSource, /if \(directFile && this\.getVirtualBaseEmbedHost\(\)\) return directFile\.path/);
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

test('card task previews are bounded and use source markdown labels', () => {
  assert.match(settingsSource, /openTaskPreviewLimit: 5/);
  assert.match(settingsSource, /showTaskOverflowCount: true/);
  assert.match(viewSource, /cardContent/);
  assert.match(viewSource, /private getPreviewTasksForFile\(file: TFile\): \{ tasks: OpenTaskSubitem\[\]; overflowCount: number \}/);
  assert.match(viewSource, /const fallback = this\.parseOpenTasks\(content, file\.path, limit\)/);
  assert.match(viewSource, /const openTasks = fallback\.openTasks\.map/);
  assert.match(viewSource, /displayText: task\.displayText \|\| task\.text/);
  assert.doesNotMatch(viewSource, /displayText: enriched\?\.displayText \|\| task\.displayText/);
  assert.match(viewSource, /openTaskOverflowByPath/);
  assert.match(viewSource, /\+\$\{openTaskOverflow\} more/);
  assert.match(viewSource, /openTaskLine\(entry\.file, task\.line\)/);
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
  assert.match(viewSource, /'aria-label': `Toggle task: \$\{task\.displayText \|\| task\.text\}`/);
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
  assert.match(viewSource, /private render\(preserveScroll = true\): void \{\s*this\.renderGeneration \+= 1;\s*if \(!this\.shouldRenderView\(\)\) return;/);
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
  assert.match(viewSource, /const currentViewName = fallbackViewName \|\| viewNames\[0\] \|\| ''/);
  assert.match(viewSource, /const baseFile = this\.getBaseFile\(\)/);
  assert.match(viewSource, /return fileRoots\?\.length \? this\.dedupeFilterRoots\(fileRoots\) : \[\]/);
  assert.doesNotMatch(viewSource, /const knownViewNames = this\.baseFileFilterCache\?\.path === file\.path/);
});

test('mixed or task filters do not force the whole board task-only', () => {
  assert.match(viewSource, /private hasTaskDirectiveInFilterNode\(node: unknown\): boolean/);
  assert.match(viewSource, /Object\.prototype\.hasOwnProperty\.call\(record, 'or'\)[\s\S]*Object\.prototype\.hasOwnProperty\.call\(record, 'any'\)[\s\S]*return;/);
  assert.match(viewSource, /taskFilter\.mode !== 'tasks'[\s\S]*!taskFilter\.hasTaskDirective[\s\S]*!explicitTaskSourcePaths\.has\(file\.path\)[\s\S]*!visibleNotePaths\.has\(file\.path\)/);
});

test('status kanban renders tasks as lane items and keeps done tasks addressable', () => {
  assert.match(viewSource, /type TaskRenderItem/);
  assert.match(viewSource, /private allTasksByPath = new Map<string, OpenTaskSubitem\[\]>\(\)/);
  assert.match(viewSource, /buildTaskRenderItemsByLane\(\s*groups: BasesEntryGroup\[\],\s*propName: string \| null,/);
  assert.match(viewSource, /this\.parseOpenTasks\(content, file\.path, Number\.MAX_SAFE_INTEGER, true\)/);
  assert.match(viewSource, /getLaneIdForStatus\(this\.getStatusForCheckboxState\(task\.checkboxState/);
  assert.match(viewSource, /isStatusPropertyName\(propName\)/);
  assert.match(viewSource, /if \(this\.isStatusPropertyName\(propName\)\)/);
  assert.match(viewSource, /nextLine = this\.updateInlineTaskCheckboxState\(nextLine, value\)/);
  assert.match(viewSource, /createTaskLaneCard\(taskItem, propName, displayLane\)/);
  assert.match(viewSource, /role: 'button', tabindex: '0'/);
  assert.doesNotMatch(viewSource, /cls: 'tps-kanban-card-title tps-kanban-task-card-title',[\\s\\S]{0,120}type: 'button'/);
  assert.match(viewSource, /status == null \? '\[ \]' : this\.getCheckboxStateForStatus\(status\)/);
  assert.match(viewSource, /type ActiveTaskPointerDrag/);
  assert.match(viewSource, /itemKind\?: 'task' \| 'bullet'/);
  assert.match(viewSource, /private parseLineItem\(line: string, includeBullets = true\): \{ itemKind: 'task' \| 'bullet'; checkboxState\?: string; text: string \} \| null/);
  assert.match(viewSource, /tps-kanban-task-card-drag-handle/);
  assert.match(viewSource, /sourceLaneValues: this\.getDisplayLaneWritableValues\(displayLane\)/);
  assert.match(viewSource, /application\/x-kanban-entry-source-values/);
  assert.match(viewSource, /private async applyFrontmatterTags/);
  assert.match(viewSource, /normalizeFrontmatterTags/);
  assert.match(viewSource, /this\.getDisplayLaneWritableValues\(active\.displayLane\)/);
  assert.match(viewSource, /private updateInlineTaskTag\(line: string, value: string, sourceLaneValues: string\[\] = \[\]\)/);
  assert.match(viewSource, /sourceTag\.toLowerCase\(\) !== cleanTag\.toLowerCase\(\)/);
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

test('dragging a linked task writes only to the checklist source line', () => {
  assert.match(viewSource, /type: 'task-line',\s*source: 'tps-kanban',\s*itemKind: task\.itemKind \|\| 'task',\s*path: entry\.file\.path,\s*line: task\.line,/);
  assert.match(viewSource, /e\.dataTransfer\.setData\(KANBAN_TASK_MIME, payload\)/);
  assert.match(viewSource, /e\.dataTransfer\.setData\(TPS_TASK_LINE_MIME, payload\)/);
  assert.match(viewSource, /const taskFile = parsed\?\.path \? this\.app\.vault\.getFileByPath\(parsed\.path\) : null;/);
  assert.match(viewSource, /await this\.confirmAndApplyInlineTaskDrop\(\s*taskFile,\s*parsed\.line,/);
  assert.match(viewSource, /private async buildTaskDropPlan/);
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
  assert.match(viewSource, /Array\.isArray\(parsed\.views\)/);
  assert.match(viewSource, /viewRecord\.filters/);
  assert.match(viewSource, /queryController\?\.query\?\.file\?\.path/);
  assert.match(viewSource, /\(this as any\)\?\.queryController\?\.query\?\.filters/);
  assert.match(viewSource, /const runtimeRoots = this\.extractFilterRootCandidates/);
  assert.match(viewSource, /private getConfiguredBaseViewName\(\): string/);
  assert.match(viewSource, /this\.getConfiguredBaseViewName\(\)/);
  assert.match(viewSource, /const baseFile = this\.getBaseFile\(\)/);
  assert.match(viewSource, /const fileRoots = this\.getBaseFileFilterRoot\(\)/);
  assert.match(viewSource, /return fileRoots\?\.length \? this\.dedupeFilterRoots\(fileRoots\) : \[\]/);
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
  assert.match(viewSource, /if \(structuredMatch === true\) \{/);
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
  assert.match(viewSource, /const shouldCreateTask = laneAddMode === 'task'/);
  assert.match(viewSource, /shouldCreateTask \? '\+ Add task' : '\+ Add card'/);
  assert.match(viewSource, /await this\.createRootTaskForLane\(propName, displayLane, taskFilter\)/);
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
  assert.match(viewSource, /for \(const tag of defaults\.tags\)/);
  assert.match(viewSource, /const writableTag = this\.normalizeWritableTaskTag\(tag\)/);
  assert.match(viewSource, /const writableLaneTag = this\.normalizeWritableTaskTag\(laneTag\)/);
  assert.match(viewSource, /for \(const \[defaultProp, field\] of defaults\.inlineFields\)/);
  assert.match(viewSource, /defaultProp === normalizedProp/);
  assert.doesNotMatch(viewSource, /for \(const tag of tags\) parts\.push\(`#\$\{tag\}`\)[\s\S]{0,120}normalizeTaskTag\(laneValue\)/);
});

test('kanban creation defaults can be controlled by Base task filters', () => {
  assert.match(viewSource, /targetPath\?: string \| null/);
  assert.match(viewSource, /private inferTaskPathCreationDefaultsFromString\(expr: string\): TaskCreationDefaults \| null/);
  assert.match(viewSource, /\(\?:task\\\.\)\?\(\?:path\|file\|file\\\.path\)/);
  assert.match(viewSource, /private getBaseContextFile\(\): TFile \| null/);
  assert.match(viewSource, /private resolveBaseContextToken\(rawValue: unknown\): string \| null/);
  assert.match(viewSource, /\^this\\\.file\\\.path\$/);
  assert.match(viewSource, /this\.getBaseContextFrontmatterValue\(frontmatterMatch\[1\]\)/);
  assert.match(viewSource, /private getEmbeddedBaseFilterRoot\(\): unknown\[\] \| null/);
  assert.match(viewSource, /private async loadEmbeddedBaseFilters\(file: TFile/);
  assert.match(viewSource, /private embeddedBaseBlockMatchesCurrentKanbanView\(parsed: Record<string, unknown> \| null \| undefined, viewName: string\): boolean/);
  assert.match(viewSource, /const blockMatch = this\.getEmbeddedKanbanBlockMatch\(parsed, viewName\)/);
  assert.match(viewSource, /const type = String\(record\.type \|\| ''\)\.trim\(\)/);
  assert.match(viewSource, /const blockPattern = \/```base\\s\*\\n\(\[\\s\\S\]\*\?\)```\/gi/);
  assert.match(viewSource, /this\.extractBaseFileFilterRoots\(parsed, viewName\)/);
  assert.match(viewSource, /this\.embeddedBaseFilterCache = null/);
  assert.match(viewSource, /this\.resolveBaseContextToken\(pathMatch\[1\] \|\| pathMatch\[2\] \|\| pathMatch\[3\]\)/);
  assert.match(viewSource, /this\.resolveBaseContextToken\(comparisonMatch\[2\] \|\| comparisonMatch\[3\] \|\| comparisonMatch\[4\]\)/);
  assert.match(viewSource, /private async resolveRootTaskTargetFile\(defaults = this\.getRootTaskCreationDefaults/);
  assert.match(viewSource, /const configuredTargetPath = defaults\.targetPath \|\| this\.plugin\.settings\?\.defaultRootTaskPath \|\| ''/);
  assert.match(viewSource, /await this\.ensureFolderPath\(folderPath\)/);
  assert.match(viewSource, /if \(taskFilter\.mode === 'tasks'\) \{/);
  assert.match(viewSource, /await this\.createRootTaskForLane\(null, \{ id: 'ungrouped'/);
  assert.match(viewSource, /const forcedMode = taskFilter\.mode === 'tasks'/);
  assert.match(viewSource, /taskFilter\.mode === 'notes'/);
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
  assert.match(viewSource, /const forcedMode = taskFilter\.mode === 'tasks'/);
  assert.match(viewSource, /: taskFilter\.mode === 'notes'/);
  assert.match(viewSource, /return forcedMode \?\? \(this\.plugin\.settings\?\.cardAddButtonDefault \?\? 'note'\)/);
  assert.doesNotMatch(viewSource, /taskOnlyBoard/);
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
  assert.match(viewSource, /for \(const \[defaultProp, field\] of defaults\.inlineFields\)/);
  assert.match(viewSource, /parts\.push\(`\[\$\{field\.key\}:: \$\{field\.value\}\]`\)/);
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
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-task-card > \.tps-kanban-card-inner > \.tps-kanban-card-title-row\s*\{[\s\S]*grid-template-columns:\s*18px minmax\(0, 1fr\);/);
  assert.match(stylesSource, /\.tps-kanban-container--reading-embed \.tps-kanban-task-card-title\s*\{[\s\S]*-webkit-line-clamp:\s*2;/);
});

test('kanban does not register vault-wide or Notebook Navigator open interception', () => {
  assert.doesNotMatch(mainSource, /registerVaultWidePreviewClicks/);
  assert.doesNotMatch(mainSource, /handleVaultWideInternalLinkPointer/);
  assert.doesNotMatch(mainSource, /shouldUseHoverPreviewForPointer/);
  assert.doesNotMatch(mainSource, /registerNotebookNavigatorPreviewClicks/);
  assert.doesNotMatch(mainSource, /handleNotebookNavigatorFilePointer/);
  assert.doesNotMatch(mainSource, /this\.registerNotebookNavigatorPreviewClicks\(\)/);
});
