TPS Kanban (Dev)

## Install with BRAT

This plugin is distributed from the private GitHub repository `ZachTish/tps-kanban`. To let BRAT read its releases:

1. Create a fine-grained GitHub personal access token scoped only to `ZachTish/tps-kanban`, with **Repository permissions → Contents: Read-only**.
2. In BRAT, add `ZachTish/tps-kanban` as a beta plugin, provide that token for private-repository access, and select **Latest** so BRAT tracks the newest published release.
3. Store the token only in BRAT's device-local configuration. Never put it in this repository, a vault note, plugin settings, or any committed file.

## Development and deployment

Canonical source, tests, Git metadata, and dependencies live in `/Users/zachtisherman/TishOS Plugin Development/TPS-Kanban (Dev)`, outside both vaults. `npm run build` and watch builds deploy byte-changed runtime artifacts by default only to `/Users/zachtisherman/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Plugin Test Vault/.obsidian/plugins/tps-kanban`; `npm test` is therefore isolated even though it ends with a production-mode build. Promotion to `/Users/zachtisherman/TishOS v0.1/.obsidian/plugins/tps-kanban` is an explicit guarded post-validation action. Neither target overwrites `data.json` or other runtime-owned state.

- 2026-07-16 isolation validation: all 51 declared tests and the required final `npm run build` passed with `[runtime-deploy] target=test ... unchanged`. Obsidian 1.12.7 loaded the plugin in the registered test vault, where the synthetic Kanban view rendered `todo` and `working` lanes with their expected task cards. No live promotion occurred, and production runtime checksums remained unchanged.

## Mobile modal contract

Kanban task, lane, drop-confirmation, and card-edit modals use `tps-keyboard-aware-modal`, reusing TPS GCM's shared visible-viewport behavior on mobile.

A Kanban board view that integrates with Obsidian's **Bases** plugin. It appears as a selectable view type alongside Table, Calendar, etc. in any `.base` file.

## Features

- **Lanes are driven by the base's Group By setting** — one lane per distinct value of the grouped property
- Cards inside each lane are the base's query results, sorted by the base's multi-level Sort setting
- **TPS List** (`tps list`) is owned and registered by TPS Global Context Menu. TPS Kanban no longer exposes a TPS List renderer factory or participates in its runtime lifecycle, so this plugin can be disabled without removing the list view.
- Click a card to open the linked note
- **Drag a card between lanes** — updates the groupBy frontmatter property on the note to the new lane's value
- Right-click a card for quick open and move-to-lane actions
- **Add card** button per lane creates either:
  - a task-line in the target note when the board is task-only (`kind == "task"`), or
  - a linked note for note/mixed boards, unless **Card add button default** is set to `task`.
  - a configured command when the view sets `createAction: command` and `createCommandId: plugin-id:command-id`; this override wins over note/task creation.
  - When task creation is used, lane/group values and simple Base task filters are written into the new task line so it immediately matches the column it was added from.
  - When note creation is used, simple positive Base note filters such as `file.folder == "Projects"` or `file.path == "Projects/New card.md"` seed the creation target so the new note starts inside the board criteria instead of at the vault root.
- **+ Add subitem** on each note card creates either a linked subitem or an inline task depending on the same defaulting rules. In task mode, the inline task is written into the selected card's note and receives the same lane value and simple task filter defaults as lane `+ Add task`.
- Root task cards expose a real checkbox control for completion; clicking the title still opens the task, and dragging still starts from the drag handle/card gesture.
- In `tps list`, note and root task rows only show metadata for properties included in the Base property/order selection, matching normal Bases list behavior instead of adding source/status chips automatically.
- Re-renders automatically whenever the base data or configuration changes
- **Card icon** — shows a Lucide icon on each card read from a configurable frontmatter property (default: `icon`)
- **Card color accent** — applies a left-border color strip to each card from a configurable frontmatter property (default: `color`)
- **Ungrouped lane position** — configure whether cards with no group-by value appear in the first or last lane

## Usage

1. Enable **TPS Kanban (Dev)** in Obsidian community plugins.
2. Open or create a `.base` file (*File → New base*).
3. In the view toolbar, click the view-type selector and choose **Kanban** for a board or **tps list** for the list-style task-capable view.
4. Use the base toolbar's **Group By** picker to select which property defines the lanes (e.g. `status`, `priority`).
5. Use the base toolbar's **Sort** picker to control the order of cards within each lane.
6. Drag cards between lanes — this writes the new value back to the note's frontmatter.

## Settings

| Setting | Default | Description |
|---|---|---|
| Enable debug logging | `false` | Enables concise developer-console traces for lifecycle, settings saves, Base filter reads, lane add decisions, note/task creation, and edit failures. Errors are always logged |
| Icon property | `icon` | Frontmatter key holding a Lucide icon name to show on the card |
| Color property | `color` | Frontmatter key holding a CSS color value (hex, rgb, named) for the card's left-border accent |
| Card add button default | `note` | Controls what `+ Add card` / `+ Add subitem` creates when board mode is mixed. `task` creates inline checkbox tasks in notes; `note` creates linked notes |
| Ungrouped lane position | `Last` | Whether cards with no group-by value appear before or after the keyed lanes |
| Default root task note path | `''` | Optional explicit sink for root task lines when no `task.path` base/default exists. If empty, task creation is blocked and no implicit fallback note is created |
| Open task destination after create | `true` | Auto-open the note that receives a newly created root task |
| Card click behavior | `open` | Normal card/list clicks open and focus the note. Hover Editor preview behavior is controlled by GCM's `Force previews for Base links` toggle |

The `icon` and `color` defaults match the keys written by Notebook Navigator Companion, so cards automatically pick up whatever styling NNC has applied to each note.

Card click previews are gated by TPS Global Context Menu's `Force previews for Base links` setting. When that GCM toggle is off, cards open/focus notes normally even if Kanban's stored activation mode was previously `preview`.

## Behaviour Matrix

| Board mode | `Card add button default` | Lane add action |
|---|---|---|
| `tasks` | any | Always create task item |
| `notes` | any | Always create linked note/subitem |
| `mixed` | `note` | Create linked note/subitem |
| `mixed` | `task` | Create task line in the target note |
| any | view `createAction: command` | Run `createCommandId` |

## Verification notes
- Root task creation now requires an explicit target path from either `task.path` filter/defaults or `Default root task note path`. If no target can be resolved, creation is aborted and no implicit fallback note is created.
- Root task target paths are normalized before file resolution. Plain paths, wikilinks with aliases, markdown links, and heading fragments all resolve to the underlying `.md` path, and `task.path` filter/defaults still take precedence over the configured default root task note path.
- Even when the board is mixed-mode without explicit `task.*` directives, explicit `task.path`/root-task defaults are now treated as task scan sources so board rendering can include newly created tasks in that target note.
- Card and toolbar creation mode honors ordered filter sources: the active view supplies the first structural task/note mode, while all-view/base filters only fill a missing mode. This prevents a lower-priority structural filter from overriding an active semantic note kind such as `kind: workout`.
- Default extraction follows top-down filter precedence:
  - active view filter sources are evaluated before all-view/base filters for creation defaults,
  - and inside a filter tree, `or`/`any` branches are resolved in source order so the first branch with usable defaults wins.
- Note-mode `+ Add card` uses positive note `file.path` filters as an exact target when that file does not already exist, and positive note `file.folder` filters as the folder for an `Untitled` draft. If an exact `file.path` already exists, creation is blocked with a notice because no second note can satisfy that filter. If no deterministic path/folder can be inferred, Kanban falls back to the native Bases note creation behavior instead of inventing a root-level sink.
- Column `+ Add task` creation writes:
  - the lane status as the checkbox marker when grouping by `status`,
  - the lane tag as `#tag` when grouping by `tags`,
  - the lane property as `[property:: value]` for other task fields,
  - Base filter tags and status defaults,
  - and simple custom task equality filters such as `task.area == "Work"` as inline fields.
  The grouped lane value wins when it overlaps a Base default, so adding in a column does not create a contradictory task.
- Task-mode `+ Add subitem` uses the same task-line construction as column `+ Add task`, but its sink is the selected card's note rather than the root task target path.
- Embedded daily-note scheduled boards should express all-day creation through their Base filter defaults. Use an ordered `or` inside the scheduled branch with `allDay == true` first, followed by `allDay == false` and `allDay.isEmpty()`. Kanban writes the first branch as `[allDay:: true]` through the generic inline-default path while still showing timed or missing-`allDay` scheduled tasks.
- Embedded note templates can use current-note tokens in task filters:
  - `task.path == this.file.path` resolves root task creation to the note containing the embedded Base.
  - `scheduled == this.scheduled` resolves against the containing note's frontmatter, or against a rendered Home/dashboard context when the embed supplies `data-tps-context-scheduled`, and can force a scheduled-date lane for daily-note boards.
  - ordered `allDay` alternatives in the same scheduled branch can default newly created scheduled tasks to all-day without hiding timed/intraday tasks.
- Daily-note scratchpad boards should include an explicit task target such as `task.path == this.file.path` when lane add should create task lines in the containing note. Global scratchpad boards can still be built, but they must provide an explicit `Default root task note path` instead of relying on an implicit fallback note.
- Reading-mode embedded boards hide editing chrome but keep card layout stable. Task cards use a two-column checkbox/title grid when drag handles are hidden, clamp titles to two lines, and suppress internal sync fields such as `tpsInlineProps` from card metadata chips. Board-mode embedded lanes stretch to the tallest lane in the row so shorter lanes still occupy their allotted grid height.
- Reading-mode embedded boards hide the global view controls and bottom `+ Add task` / `+ Add card` buttons so they behave like compact inline content on mobile. Lane headers keep compact add and collapse controls with forced SVG visibility, and the add control uses the same lane-add resolution as the full board button. Embedded Base wrappers are marked and compacted so the board sits close to the note title/properties, mobile embedded board lanes fit the note width, colored card accents are preserved, and Kanban mobile chrome suppression stays scoped to Kanban controls so GCM/property headers remain visible while swiping.
- Live-preview embedded boards keep editing controls available while editing a note. The compact toolbar can switch between board/list mode, and embedded lane headers also expose a first-lane board/list toggle plus lane rename/add/collapse controls so the controls remain reachable when Obsidian's embedded Bases chrome is constrained. Reading-mode embeds intentionally keep global controls hidden.
- Mobile and iPad controls use inline SVG fallbacks for toolbar and lane buttons so Obsidian does not render blank control pills when native icon injection fails.
- Bases header result counts are synced after Kanban finishes rendering and use the actual displayed note cards plus displayed task cards, so mixed note/task boards do not show the pre-render native row count.
- `tps list` is fully owned by TPS Global Context Menu as the Bases view type `tps-list`. This plugin registers and exposes only the Kanban view.
- `tps list` and Kanban both honor a view-level plus-button command override. Add `createAction: command` and `createCommandId: plugin-id:command-id` to the view config to run a command instead of creating a note or task. Without that override, existing Base/task/default creation behavior is unchanged.
- `tps list` note rows render as normal internal links, while task rows intentionally render like plain checklist text. Task titles inherit row font/size/weight, have no link underline/accent color, and suppress button backgrounds/borders so checkbox task rows do not look like boxed pills.
- Kanban task rows honor both active-view filters and whole-Base filters. The two persisted trees are independent roots combined with an outer `and`; nested `and`/`or`/`not` semantics remain intact, inactive sibling-view filters are ignored, and unsaved active-view edits are composed without duplicate roots. Source-oriented fields such as `file.folder`, `file.path`, and `file.name` resolve through the task's source note; `file.links` remains empty on synthesized task rows. A plain `kind = task` filter keeps completed tasks hidden by default; an explicit completed-status filter or the per-view completed-task toggle can include them.
- File-folder/path comparisons and empty-link checks support both Obsidian's live object filter payloads and the string formulas persisted in `.base` YAML, including `file.folder != "Archive"`, `!file.path.startsWith("Archive/")`, and `file.links.isEmpty()`. For synthesized task rows, negative folder equality excludes both the named folder and its descendants, so an archive-root guard also rejects dated paths such as `Archive/2026-07-05/`; positive folder equality remains exact. Vault-wide synthesized task scans wait for the persisted `.base` filter tree before rendering, preventing a permissive partial-filter frame from exposing excluded source folders.
- Vault-wide TPS task views batch their asynchronous source-file reads and repaint once after the batch settles, avoiding hundreds of intermediate Home renders while preserving cold-start population.
- `tps list` task rows use a compact checklist-style grid with a fixed, centered checkbox slot instead of a wide negative-offset list layout.
- `tps list` can display source bullet/instance rows alongside checkbox tasks. Bullet rows open their source line but are not exposed as task-line context targets, so the global task menu does not try to resolve non-checkbox lines as tasks.
- `tps list` uses `order` only as the selected-property list and uses explicit Base `sort`/`sortBy` config for row ordering. When a sort is configured, note and task rows in the same section are sorted together instead of rendering all notes first and all tasks second.
- Task metadata uses the same compact value formatter as note properties for selected fields. Date-like fields such as `scheduled`, `due`, `completedDate`, `created`, and `modified` show compact dates/date-times; duration-like fields such as `timeEstimate` show minute labels when the value is numeric; tags hide the leading `#`; generic custom fields show values without a repeated `key:` prefix.
- In `tps list`, clicking a displayed writable property opens a compact inline input. Note/file rows write editable note properties back to frontmatter, while task rows write editable task properties back to the matching inline field on the source task line. File-derived/system fields such as file path, source, kind, and line remain read-only.
- Normal note-card and `tps list` note-row clicks open and focus notes by default. Hover Editor preview interception only runs when TPS Global Context Menu's `Force previews for Base links` setting is enabled; repeated/double clicks open the note after preview. Task-title clicks are handled separately by GCM's exact-line virtual task editor, while configured source filename links remain full-note links. Stale per-Kanban `preview` settings do not hijack normal focus behavior.
- Note and task opens from Kanban cards and `tps list` rows first focus an existing target tab. If the target file is not already open, Kanban creates a new foreground tab instead of replacing the current Base or an unrelated non-pinned Markdown tab.
- Task titles in Kanban cards, nested task previews, and `tps list` rows are rendered from a cleaned presentation title. Raw tags, bracket inline fields, hidden `tps-inline-props` comments/spans, and block references stay in the source task line for filtering/storage but do not appear next to the visible title.
- Kanban search matching is scoped to the current Base/embed leaf. Global Obsidian sidebar search text must not filter embedded task boards.
- Embedded Kanban source resolution prefers the containing markdown note before neighboring or hidden `.base` tabs in the same workspace leaf. This keeps daily-note filters and `this.scheduled` context stable after tab switches/reloads.
- Task inline property parsing is delimiter-aware: bracketed fields such as `[tpsInlineProps:: ...]` are stripped through the closing `]`, so encoded calendar metadata containing parentheses does not leak into the visible card title.
- Bare `kind` filters distinguish TPS record kinds from Kanban row kinds. Structural values (`task`, `bullet`, `note`, `all`, `mixed`, including plurals) keep their existing row-routing behavior; other values such as `kind == "workout"` or `kind == "food"` are note frontmatter filters, stay note-only, seed the same frontmatter on creation, and do not scan or render checkbox lines as root task rows.
- Embedded daily scheduled/unscheduled task boards only use the daily fallback when the parsed filter tree contains the expected task kind, `scheduled == this.scheduled`, and empty-scheduled branch. More complex Base filters stay on the structured evaluator instead of being treated as broad daily boards.
- Diagnostics are intentionally gated behind **Enable debug logging** in settings. When enabled, Kanban traces plugin load/unload, settings saves, Base and embedded Base filter reads, lane `+ Add` mode decisions, note vs task routing, root task target resolution, task-line writes, linked subitem creation, card frontmatter moves, task drag/drop confirmation and apply outcomes, card nesting drops, lane reorder drops, lane drop blocks/cancellations, card/task open routing, task-line scroll failures, checkbox mutation outcomes, and list-property edit failures. Repeated identical messages are deduped, and errors still log when diagnostics are off.
- To validate defaults:
  1. Open settings and set a known default target path and card mode.
  2. In a task-capable board, click the lane `+ Add` control and confirm it routes according to board mode:
     - `tasks` -> task line
     - `notes` -> note
     - `mixed`/`all` + `Card add button default = task` -> task line
     - `mixed`/`all` + `Card add button default = note` -> note
  3. For task-line routing, confirm the target comes from `task.path` or `Default root task note path` and that no implicit fallback note is created.
  4. Return settings to their original values.
- Validated in tests:
  - `tasks` mode always routes lane add to task creation.
  - `notes` mode always routes lane add to note creation.
  - `mixed` mode follows `Card add button default`.
  - `all` mode follows `Card add button default`.
  - root task creation requires `task.path` or `Default root task note path`.
  - root task target normalization handles plain paths, `[[wikilinks|aliases]]`, markdown links, and heading fragments while preserving Base defaults over configured fallback paths.
  - note creation can derive a matching folder/path target from positive Base note filters.
  - root task cards expose native checkbox controls that toggle completion without opening the task.
  - task checkbox status mapping and source-line mutation are covered as pure behavior: custom mappings, fallback statuses, ordered/indented checkbox tasks, and non-task lines are all handled deterministically.
  - `tps list` registers as a forced-list Bases view, renders native-style grouped bullets instead of Kanban cards, hides Kanban-specific controls, derives note/task row metadata from selected Base properties, keeps selected properties separate from sorting, and applies explicit Base sort config across both note and task rows.
  - normal note clicks only use Hover Editor preview mode when GCM's forced Base preview setting is enabled, and repeated/double clicks open the note in a foreground tab.
  - column-created tasks preserve target note, status, tags, lane property, and custom inline defaults.
  - embedded daily/project templates can use `this.scheduled` and `this.file.path` for scoped Kanban task creation.
  - reading-mode embedded task cards keep horizontal titles and filtered metadata while using the same task records as live preview.
  - live-preview embedded boards retain the list/board switcher and lane rename/add controls while reading-mode embeds stay compact.
- Rebuild this plugin and reload Obsidian before validating behavior in the Kanban view.
- 2026-07-11: Fixed nested archived tasks leaking through the live Home Tasks panel. The active Home layout uses a custom `Tasks.base` component whose persisted filter is `or -> and(kind == task, file.folder != _archive, file.folder != Archive)`; the former exact folder comparison allowed sources under dated archive descendants. Negative folder-root equality is now subtree-aware for persisted strings and live filter objects without changing positive equality. Behavioral coverage reproduces the actual Home Base tree and verifies `Archive/`, `_archive/`, similarly prefixed non-archive folders, and normal project paths. Validation: focused and full Kanban tests, production builds of Kanban and the GCM-owned bundled TPS List renderer, Obsidian reload, and live Home result inspection.
- 2026-07-11: Hardened synthesized TPS List filtering for `Open Unscheduled Tasks.base`. Task source paths now honor `startsWith` in persisted string and live object filters, vault-wide task rendering waits for the current Base/view filter cache, and a partial structured match can no longer bypass the default completed-task guard. Behavioral coverage verifies `Archive/`, `_archive/`, open/completed tasks, explicit completed-task views, and deferred rendering while persisted filters load. Validation: focused and full Kanban tests plus typecheck/production build; the final integration pass rebuilds GCM and reloads Obsidian because GCM bundles this renderer.
- 2026-07-09: Kept semantic TPS note kinds separate from Kanban's structural row kinds. Bare `kind: workout`, `kind: food`, and future non-structural values now remain note-only across string/object Base filters and note creation, while `kind == task` and the other established structural values retain task/bullet/note routing. Validation: focused kind-filter regression, full Kanban test suite, typecheck, and production build.
- 2026-07-07: Expanded TPS Kanban drag/drop and open diagnostics. Card frontmatter moves now log mutation start/done routes, task drops log no-change/confirmation/apply outcomes, card nesting logs blocked/drop decisions, lane reorders log ignored/save/done states, lane drops log task/file blocks plus final target values, card/task opens log existing-vs-new-tab routing, and checkbox toggles log changed/no-change outcomes. Regression coverage updated in `scripts/test-kanban-utils.mjs`. Validation: focused Kanban utility regression and production build.
- 2026-07-12: Removed the legacy TPS List factory and settings refresh hooks from TPS Kanban. TPS Global Context Menu now owns the renderer source and runtime lifecycle, allowing Kanban to remain disabled while `tps-list` stays available.
- 2026-07-12: Completed TPS List source cleanup. Removed native-list rendering methods, hierarchy utilities, row types, CSS, settings branches, compatibility APIs, and list-specific tests from Kanban. Added explicit whole-Base plus active-view filter composition with mirrored behavioral contract tests; sole ownership tests in GCM prevent TPS List code from returning here.
- 2026-07-10: TPS List task rows now keep the task title as the primary display name and honor configured file-name properties instead of suppressing them. The containing file renders as a normal internal link after the title according to Base `order`, and task-title sorting now sorts the task title rather than the source filename. Validation: focused Kanban regression, full builds, Obsidian reload, and live TPS List QA.
- 2026-07-10: TPS List now preserves Markdown task hierarchy within each Base group. Base sorting reorders root rows and siblings only; matching descendants remain immediately beneath their direct parent with visible nesting, while orphaned/filtered descendants safely render at root. Validation: behavioral hierarchy tests cover sibling sorting, filtered parents, spaces, and tabs; production builds and live Obsidian QA.
- 2026-07-10: TPS List sort resolution now reads Obsidian's getter-backed Base configuration in addition to direct config fields. This fixes views whose Sort control was active but whose synthesized task rows remained in source order. Validation: focused config regression, production builds, reload, and a title-sorted hierarchy Base showing sorted roots with attached children.
- 2026-07-10: Kanban and TPS List task-title clicks now hand off to GCM's exact-line virtual task editor for quick in-place content changes, while note cards and configured source filename links keep the full-note Hover Editor/open behavior. Validation: focused GCM task-click regressions, production builds, reload, and live custom Base QA.
- 2026-07-07: Re-audited TPS Kanban diagnostics after the suite logging pass. Runtime direct-console use remains confined to `src/logger.ts`; `flowError` now emits a single compact structured error summary instead of duplicating the raw error object. Validation: direct-console scan, `npm test` including production build, Obsidian third-party plugin reload, and settings UI check that Diagnostics is visible with `Enable debug logging` off.
- 2026-07-07: Added per-view plus-button command override for Kanban and `tps-list`. Views can set `createAction: command` and `createCommandId` to run an Obsidian command, while unset views continue resolving lane add through task filters, note filters, and `Card add button default`. Validation: production `npm run build`.
- 2026-07-07: Added centralized gated diagnostics logging for TPS Kanban. `src/logger.ts` now mirrors the TPS logging contract with default-off debug/info/warn output, always-on errors, and deduping. Lifecycle, settings persistence, Base filter parsing, lane add routing, note/task creation, root task target resolution, and list property update failures now emit concise flow logs. Validation: `npm test` including production build; Obsidian third-party plugin reload; temporarily enabled disabled TPS Kanban to verify its settings tab, confirmed Diagnostics is visible and `Enable debug logging` is off, then restored the vault plugin enable list.
- 2026-07-04: Kanban root task creation now appends the new task line to the end of the resolved task target note instead of placing it immediately after frontmatter. Validation: production `npm run build`.
- 2026-07-03: Normal Kanban and `tps list` note clicks now open/focus notes unless GCM's `Force previews for Base links` setting is enabled. The default card activation mode is `open`, and stale stored `preview` settings no longer hijack tab focus. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: `npm test`, production build, Obsidian reload, and TPS Home visual check after reload.
- 2026-07-03: Kanban/list task titles now strip presentation-only inline metadata before rendering, including raw tags and hidden `%% tps-inline-props:... %%` payloads, while preserving selected Base properties as separate metadata chips. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test, `npm test`, production build, Obsidian reload.
- 2026-07-03: Flattened `tps list` task-row styling so task titles no longer render as underlined, boxed button/link pills on iPad. Titles now inherit normal list text styling while keeping the checkbox and open-task click behavior. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test and production build.
- 2026-07-03: Tightened `tps list` task indentation to better match normal checklist rows and changed task `scheduled` property formatting so date-time values display date plus time instead of time-only. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test and production build.
- 2026-07-03: Expanded `tps list` property formatting beyond `scheduled`, separated Base `order` from sort resolution, and added mixed note/task row sorting when explicit Base sort config is present. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test and production build.
- 2026-07-03: Refined `tps list` row styling so full note/file rows keep native internal-link styling while task rows use a centered checkbox grid for cleaner checklist alignment. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test and production build.
- 2026-07-03: Added inline editing for writable `tps list` property values. Task property edits reuse the inline task-line write path, and note property edits use frontmatter updates; file/system fields remain read-only. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility test and production build.
- 2026-07-03: `this.scheduled` resolution now honors rendered dashboard embed context via `data-tps-context-scheduled` before falling back to containing-note frontmatter. This lets TPS Home day switching drive TPS List/Kanban Base filters without making Home a Markdown file. Validation: focused GCM Home regression and production builds.
- 2026-07-03: Base filter extraction now treats `tps-list` views as filter-owning views, not only Kanban views. `Open Unscheduled Tasks.base` carries its task filters directly on the TPS List view so Home can render unscheduled task rows without depending on native note result rows first. Validation: focused Kanban utility regression and production build.
- 2026-07-03: Home-embedded `tps-list` views now resolve their virtual Base host before active markdown context and embedded filter block matching includes `tps-list`. This fixes task-only Home components such as `Open Unscheduled Tasks.base` reading zero results because their saved task filters were not loaded. Validation: focused Kanban utility regression, production build, Obsidian reload, and TPS Home check.
- 2026-07-04: `tps-list` bullet/instance rows no longer advertise task-line context metadata. Right-clicking rows such as workout instance bullets opens their source line instead of asking TPS Global Context Menu to resolve a non-checkbox task line. Validation: focused Kanban utility regression, production build, Obsidian reload, and TPS Home check.
- 2026-07-04: Extracted root task target normalization and task-line construction into `src/task-creation-utils.ts`, then added behavioral coverage for link-shaped `task.path` values, Base-default precedence, lane status/tag/custom-field task-line output, and excluded tags. This protects lane `+ Add task` routing from wikilink/markdown-link target values while keeping KanbanView focused on view orchestration. Validation: `node --test scripts/test-kanban-utils.mjs`, `npm test` including production build, Obsidian reload, and TPS Home embedded TPS List render check.
- 2026-07-04: Moved lane-add presentation and root-task checkbox marker resolution into `src/task-creation-utils.ts` so the view no longer owns duplicated `task` vs `card` labels or lane/default checkbox precedence. Behavioral coverage now verifies header add labels, bottom add labels, task/card mode flags, and status-lane/default marker selection through the helper used by KanbanView. Validation: focused Kanban utility suite, full `npm test` including production build, Obsidian reload, and TPS Home embedded TPS List render check.
- 2026-07-04: Extracted checkbox/status mapping and task-line checkbox replacement into `src/task-checkbox-utils.ts`, then added behavioral coverage for mapped toggles, fallback done/open toggles, ordered task lines, indented task lines, and non-task lines. Kanban cards and TPS List rows still call the same view methods, but the source-line mutation path is now testable without a live vault. Validation: `node --test scripts/test-kanban-utils.mjs`, `npm test` including production build, Obsidian reload, and TPS Home embedded TPS List render check.
- 2026-07-04: Task opens from pinned/Home-embedded `tps list` rows no longer reuse the first unrelated non-pinned Markdown tab. Regression coverage checks that the opener falls back to a fresh tab rather than scanning `getLeavesOfType('markdown')`; validation: focused Kanban utility regression, full `npm test`, Obsidian reload, and TPS Home embedded List source-open check.
- 2026-07-04: Validated mixed/no-explicit-task note creation through the settings UI by temporarily changing **Card add button default** from `Inline task` to `Linked note subitem`, adding a card in a disposable folder-filtered Base, confirming `Inbox/TPS Kanban Note Add UI QA/Untitled.md` was created with `status: todo`, then restoring the setting to `Inline task`. Disposable QA files were moved to `Archive/`.
- 2026-07-04: Note-card and `tps list` note-row opens now create a foreground tab when the target note is not already open, preserving the current Base tab. Forced Base preview handling now lets a repeated/double click open after the preview instead of being swallowed by the preview-bubble guard. Regression coverage updated in `scripts/test-kanban-utils.mjs`; validation: focused Kanban utility regression, full `npm test` including production build, Obsidian reload, and disposable Base UI checks for board and list note opening.
- 2026-07-04: Rechecked linked-task drag/drop handling. `buildKanbanTaskDropLine` and the Kanban task drop path continue to write only the checklist source line from `{ path, line }` payloads, preserving unrelated tags and removing source-lane values. Validation: `node --test scripts/test-kanban-utils.mjs` passed; live Obsidian QA fixture rendered the expected task lanes and source-line metadata. Computer-use drag automation did not emit the native drop confirmation, so physical drag remains a manual UI verification point.
- 2026-06-29: Settings saves are serialized and coalesced so rapid text edits persist the latest full value instead of an earlier one-character write. Validation: `npm run build` and shared save-queue simulation; Controller settings UI was reloaded and checked as the representative TPS settings persistence path.

## Notes

- Lanes are read-only columns: they are determined by the distinct values of the Group By property in the base. To add a new lane, use a property value that doesn't exist yet.
- If no Group By is configured, the board shows a single ungrouped lane.
- Only `frontmatter` properties support drag-to-move. Computed or file properties are displayed but dragging between lanes is disabled when the Group By targets a non-frontmatter property.

## Settings layout

Card click and add-button behavior are root-level core controls. Card metadata, lane behavior, card content, the Base query guide, and diagnostics are optional collapsed groups. There is no nested accordion beyond the top-level groups, and a fresh settings open starts with all groups collapsed.

- 2026-07-13: Promoted the two primary card interactions to the root and kept all optional settings collapsed. Validation: settings hierarchy audit, full test suite, production build/deploy, and Obsidian reload.
