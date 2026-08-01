# TPS Kanban

## 0.2.0

- Custom Base formulas now work on synthesized checkbox-task and bullet rows across card properties, lanes/grouping, filters, sort, search, and style rules. Kanban consumes GCM's exact version-1 formula and canonical line-metadata APIs; it does not copy an evaluator, create temporary notes, or reach into private Bases internals.
- Synthetic formula contexts expose row-first inline fields plus `row`, containing-note `note`, source `file`, Base-host `this`, structural `task`, one-based `line`, and stable render-time `now`. Formula booleans render as native disabled checkboxes instead of the text `true` or `false`.
- Bare `kind` is additive rather than exclusive. `kind == task` matches checkbox rows and notes explicitly authored with `kind: task`; a checkbox row with `[kind:: project]` matches both `task` and `project`. Use `itemKind`/`itemType` when a filter must select only structural `note`, `task`, or `bullet` rows.
- Global task/bullet discovery now uses GCM Entity Index v3 with complete-or-error asynchronous queries, revision ownership, serialized refreshes, and bounded retry. One redundant readiness preflight was removed because `queryAsync` owns readiness.
- Task editing, context menus, checkbox/status mapping, formulas, line metadata, and entity discovery use exact public GCM capabilities delivered through the workspace lifecycle handshake. Kanban accepts either load order, invalidates caches on replacement/unload, and recovers when GCM reloads; the old private plugin lookup and partial capability fallbacks are gone.
- Formula fields and formula-grouped lanes are read-only. Missing/incompatible capabilities, ambiguous embedded Base ownership, formula failures, unsupported operators, and incomplete entity data fail closed with deduplicated diagnostics rather than silently substituting note data or writable fields. Formula-reference detection is tri-state: an unavailable or invalid provider result rejects the synthetic row and cannot be inverted by `not` or bypassed by an earlier passing `or` branch.
- This is a backward-compatible minor release. Existing settings, commands, Base definitions, task lines, notes, and minimum Obsidian 1.10.0 remain unchanged; no migration is required. GCM 1.14.0 or newer is required only for the new synthetic formula/entity behavior.

## 0.1.8

- Fallback note-tag filtering now reads one Obsidian metadata-cache snapshot per file and reuses its frontmatter and inline tags; the released path requested the same file cache twice.
- Frontmatter-first ordering, inline-tag ordering, normalization, duplicate removal, filter results, note/card/task behavior, settings, commands, and persisted data remain unchanged.
- Exact public `0.1.7` and candidate actual methods matched across 100,000 seeded tag shapes with zero output or error mismatches while metadata reads fell from 200,000 to 100,000.
- A representative one-frontmatter/one-inline-tag workload improved median time 3.04% and p95 3.82% across 41 interleaved rounds. A tag-heavy workload stayed timing-neutral while still halving metadata reads, and the production bundle is 45 bytes smaller.
- This backward-compatible performance/reliability patch adds no cache, state, fallback, retry, monkeypatch, listener, timer, setting, migration, or unsupported API and keeps the minimum supported Obsidian version at 1.10.0.

## 0.1.7

- Markdown task and bullet discovery now classifies each source line once, then reuses that result for hierarchy and output. The released path called the same pure parser twice for every line.
- Task-only views still exclude ordinary bullets explicitly; bullet-inclusive views, nesting, line identity, status filtering, limits, inline fields, text cleanup, creation, drag/drop, settings, commands, and persisted data remain unchanged.
- Against exact public `0.1.6`, 800,000 comparisons across 100,000 randomized CRLF lines and eight inclusion/status scenarios produced zero output differences while parser calls fell from 1,600,000 to 800,000. In the controlled 25,000-line benchmark, median time improved from 208.87 ms to 198.28 ms and p95 from 210.80 ms to 201.44 ms.
- This backward-compatible performance/reliability patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration. Validation details and artifact hashes are in `release-notes/0.1.7.md`.

## 0.1.6

- Note-card and task-card style rules now stop evaluating as soon as an `any` rule is true or an `all` rule is false. The released path evaluated every condition and allocated a temporary result array even after the answer was known.
- Rule order, first-match identity, inactive/empty-rule handling, undefined-match compatibility, every condition operator, note frontmatter, task frontmatter/inline/status fields, settings, commands, and persisted data remain unchanged.
- Against exact public `0.1.5`, 200,000 deterministic note/task cases selected the same rule while condition evaluations fell from 1,141,701 to 444,027. A decisive 12-rule × 8-condition workload fell from 2,880,000 evaluations to 360,000 (87.5%); worst-case counts remained identical, and the five-rule × one-condition path did not regress.
- This backward-compatible performance patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration. Validation details and artifact hashes are in `release-notes/0.1.6.md`.

## 0.1.5

- A cold task-source read now parses the Markdown once into the complete ordered task set, then derives the bounded open-task card preview from that result. The released `0.1.4` path parsed every source twice.
- Task status mapping is evaluated only where completion filtering needs it. Preview order, hierarchy, inline fields, custom checkbox mappings, GCM enrichment and overflow authority, stale-read ownership, repaint batching, settings, commands, and persisted data remain unchanged.
- Against exact public `0.1.4`, the 20,000-line release benchmark reduced 500 cold loads from 1,000 parser calls and 20,000,000 line visits to 500 calls and 10,000,000 visits. Median time improved from 896.2 ms to 625.4 ms per ten-load sample and p95 from 926.2 ms to 644.1 ms, with identical cache output, vault reads, and repaints.
- This backward-compatible performance/reliability patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration. Validation covers 75 declared checks plus exact-release parity, a separate final production-mode build, and test-vault reload; exact evidence and artifact hashes are in `release-notes/0.1.5.md`.

## 0.1.4

- Tag-lane moves and card-nesting parent-link changes now call TPS Global Context Menu's supported `services.frontmatter.process` API explicitly when that service is available.
- Native Obsidian frontmatter processing remains the standalone path when GCM is absent. A GCM refusal or error is propagated without retrying the mutation natively, so one user action can never write twice or bypass GCM validation.
- Status moves, generic property moves, tag merging, case-insensitive parent removal, parent link formatting, refresh events, settings, commands, and persisted data remain unchanged.
- This backward-compatible reliability patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration. Validation covers 73 declared checks plus a separate final production-mode build and test-vault reload; exact evidence and artifact hashes are in `release-notes/0.1.4.md`.

## 0.1.3

- Task and bullet previews now use file-identity ownership for every asynchronous vault read. A result may update the board only while it still owns the captured path and that path still resolves to the same Obsidian file.
- Modify, rename, delete/recreate, folder rename/delete, and view-unload invalidation can no longer let an older success or failure overwrite newer task state. Scheduled renders are also gated after unload.
- Concurrent bullet-preview requests for one file are now single-flight: the regression benchmark reduces 100 pending requests from 100 vault reads to one, then reuses the cached result.
- Parsing, filters, task ordering, overflow counts, failure semantics, settings, commands, and persisted data remain unchanged. Bullet-read failures are logged and remain retryable instead of being cached as an empty success.
- This backward-compatible reliability/performance patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration. Validation covers 70 declared checks, a separate final production-mode build/test-vault deployment, and an Obsidian 1.12.7 task-toggle/rerender/restoration smoke test; exact evidence and artifact hashes are in `release-notes/0.1.3.md`.

## 0.1.2

- Board rendering now waits until task-only synthetic lanes are known before building note parent relationships and lane trees, removing an earlier pair of indexes that was always discarded.
- Task, parent, and note-lane indexes are each built once while lane order, nesting, task identity, card output, settings, and persisted board state remain unchanged.
- This backward-compatible performance patch keeps the minimum supported Obsidian version at 1.10.0 and requires no migration.

## 0.1.1

- Each board render now builds synthesized task-lane rows once instead of repeating the same source-note or full-vault task traversal after empty lane groups are inserted.
- Empty task-only lanes, manual lane order, task identity/order, note-card grouping, settings, and persisted board state remain unchanged.
- This backward-compatible performance release keeps the minimum supported Obsidian version at 1.10.0 and requires no migration.
- Validation passed all 62 declared checks, the separate final build, isolated runtime deployment, Obsidian 1.12.7 reload, and loaded-plugin verification; exact evidence and hashes are in `release-notes/0.1.1.md`.

## 0.1.0

- Settings now use five clean destinations for rules/creation, cards, appearance, lanes/layout, and advanced diagnostics.
- A compact Base-rules guide and one optional full reference make creation rules discoverable; per-view lane/layout ownership remains in each board.
- Existing Kanban settings, per-view state, and frontmatter color compatibility are unchanged. This backward-compatible minor release keeps the minimum supported Obsidian version at 1.10.0 and requires no migration.

## Install with BRAT

This GitHub repository is public. BRAT 2.2.0 or newer can install `ZachTish/tps-kanban` without a private-repository token:

1. Add `ZachTish/tps-kanban` as a beta plugin.
2. Select **Latest** to follow numbered releases, or freeze a numeric version for controlled rollout.

## Development and deployment

Canonical source, tests, and Git metadata live in this repository at `Obsidian Plugin Test Vault/Plugin Development/TPS-Kanban (Dev)`. Rebuildable dependencies resolve through the test vault's local-only `.plugin-dev-cache.nosync`; from this folder, run `node ../prepare-dependencies.mjs "TPS-Kanban (Dev)"` if they need refreshing. `npm run build` and watch builds deploy byte-changed runtime artifacts by default only to `/Users/zachtisherman/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Plugin Test Vault/.obsidian/plugins/tps-kanban`; `npm test` is therefore isolated even though it ends with a production-mode build. Promotion to `/Users/zachtisherman/TishOS v0.1/.obsidian/plugins/tps-kanban` is an explicit guarded post-validation action. Neither target overwrites `data.json` or other runtime-owned state.

- 2026-07-16 isolation validation: all 51 declared tests and the required final `npm run build` passed with `[runtime-deploy] target=test ... unchanged`. Obsidian 1.12.7 loaded the plugin in the registered test vault, where the synthetic Kanban view rendered `todo` and `working` lanes with their expected task cards. No live promotion occurred, and production runtime checksums remained unchanged.
- 2026-07-18 contained-workspace validation: the declared suite passed 51/51 from the in-vault repository, and a standalone production-mode build reported `[runtime-deploy] target=test ... unchanged`. The isolated app was reloaded with `Reload app without saving`, and its file explorer showed `Plugin Development` with all nine source repositories and shared tools. No live promotion was requested.
- 2026-07-24 settings-release validation: all 61 declared contract, filter-composition, utility, and routed-settings tests passed, and source/shipped CSS remained byte-identical. The required final standalone build deployed only to `[runtime-deploy] target=test`. Obsidian 1.12.7 was reloaded with `Reload app without saving`; all five settings destinations, the compact Base guide, and its single full-reference disclosure were inspected in the registered test vault without changing a default or invoking a reset. Runtime-owned state remained absent and production was not accessed or promoted.
- 2026-07-28 render-efficiency validation: all 62 declared tests passed, including call-count and former-result equivalence coverage for the final parent, task, and note-lane indexes. The required standalone build deployed only to `[runtime-deploy] target=test`. After **Reload app without saving**, Obsidian 1.12.7 rendered the synthetic `Plugin QA.base` Kanban board with the expected `todo` and `working` cards and an empty ungrouped lane. No task, note, setting, or runtime state was changed; production was not accessed or promoted.
- 2026-07-30 task-cache efficiency validation: exact public `0.1.4` and `0.1.5` produced identical cache output across 17 parity scenarios while cold-source parser calls and line visits fell by 50%; median and p95 timings both improved by about 30%. All 75 declared checks and the required separate build passed. After **Reload app without saving**, Obsidian 1.12.7 rendered `Plugin QA.base` with its open, working, and completed synthetic task rows. The 71-byte runtime settings file remained byte-identical, no note or setting was changed, and production was not accessed or promoted.
- 2026-07-30 style-rule efficiency validation: exact public `0.1.5` and `0.1.6` selected the same rule in 200,000 deterministic note/task cases. Decisive 12 × 8 work fell by 87.5%, worst-case work stayed identical, and the five-rule one-condition guard did not regress. All 76 declared checks and the required separate build passed. After **Reload app without saving**, Obsidian 1.12.7 rendered `Plugin QA.base` with its open and working task lanes, retained the completed-task visibility control, and exposed the unchanged five priority rules under Appearance. The 71-byte runtime settings file remained byte-identical, no note or setting was changed, and production was not accessed or promoted.
- 2026-07-31 line-parser efficiency validation: exact public `0.1.6` and `0.1.7` produced identical task/bullet output across 800,000 randomized comparisons while source-line classifications fell exactly by 50%; controlled median and p95 timings improved 5.07% and 4.44%. All 77 declared checks and the required separate build passed. After **Reload app without saving**, Obsidian 1.12.7 rendered `Plugin QA.base` with unchanged `todo` and `working` task lanes and completed-task visibility off. The 71-byte runtime settings file remained byte-identical, no task, note, setting, or outbound action was invoked, and production was not accessed or promoted.
- 2026-07-31 (0.2.0) formula/entity validation: all 94 release-declared tests passed with zero skips, including 82 focused Kanban checks for additive Kind, exact formula/line/entity capabilities, tri-state fail-closed formula-reference detection under `not`/`or`, formula fields/filters/grouping/sort/search/styles, boolean rendering, read-only lanes, Base ownership, lifecycle recovery, and Entity Index revision/retry behavior. After the mandatory test-runtime deployment and `Reload app without saving` in Obsidian 1.12.7, an isolated formula Base settled atomically to two synthetic tasks in computed `todo` and `working` lanes; its boolean formula rendered as unchecked/checked native controls, estimates rendered as 30/45, and the undated completed task stayed excluded. The temporary Base was moved to `_archive`, the runtime settings SHA-256 remained `63aa45e09d7284b5357f879491c6cb9a6ccc2330a00e4e6f035b8f27359c29f3`, no mutation control was invoked, and production was untouched.

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
- Selected formula properties render on synthesized task and bullet cards with the same typed formatting used by note rows. Boolean results use native read-only checkboxes; formula-backed lanes disable add, rename, and drag mutations because computed values have no writable backing field.
- Formula-backed task/bullet rows participate in Base filters, lane grouping, sorting, search, and style rules through GCM's bounded formula session. Native note formula values remain owned by Obsidian.
- Bare `kind` combines structural and explicit identities: checkbox rows always include `task`, bullets include `bullet`, notes include `note`, and any authored frontmatter/inline `kind` values are added without replacing that identity. `itemKind` and `itemType` remain structural-only.
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

Settings uses a shallow five-destination hub. The route choice is transient and never written to plugin data, only the active destination is rendered, and each destination restores its own scroll position after a settings-triggered redraw.

| Destination | Contents |
|---|---|
| **Rules & creation** | Base filter guidance, card add behavior, the optional root-task destination, and whether that destination opens after creation |
| **Cards** | Card click behavior, open-task preview limit, and overflow count |
| **Appearance** | Icon/color property keys, frontmatter color handling, and JSON card style rules |
| **Lanes & layout** | Ungrouped position, global scale, and dynamic empty-lane width |
| **Advanced** | Debug logging |

**Rules & creation** starts with a compact Base rules guide. One optional full reference disclosure contains the complete variable list and examples; no other settings are nested behind disclosures. Keyboard focus moves to the destination heading after navigation, the route strip has a visible focus state, and the strip scrolls horizontally on narrow/mobile screens.

Per-view lane order, board/list mode, completed-task visibility, and lane labels remain saved per Base view and are changed from the Kanban view itself. The settings hub does not replace or reset those per-view controls.

| Destination | Setting | Default | Description |
|---|---|---|---|
| Rules & creation | Card add button default | `note` | Controls what `+ Add card` / `+ Add subitem` creates when board mode is mixed. `task` creates inline checkbox tasks in notes; `note` creates linked notes |
| Rules & creation | Default root task note path | `''` | Optional explicit sink for root task lines when no `task.path` Base/default exists. If empty, task creation is blocked and no implicit fallback note is created |
| Rules & creation | Open task destination after create | `true` | Auto-open the note that receives a newly created root task |
| Cards | Card click behavior | `open` | Normal card/list clicks open and focus the note. Hover Editor preview behavior is controlled by GCM's `Force previews for Base links` toggle |
| Cards | Open task preview limit | `5` | Maximum unchecked body tasks shown on a card; the adjacent reset restores `5` |
| Cards | Show task overflow count | `true` | Shows `+N more` when unchecked tasks exceed the preview limit |
| Appearance | Icon property | `icon` | Frontmatter key holding a Lucide icon name to show on the card |
| Appearance | Color property | `color` | Frontmatter key holding a CSS color value for the card accent |
| Appearance | Frontmatter color target | `card` | The UI continues to expose Card and Off. Stored `icon` and `both` remain load-compatible and survive reload until the user explicitly chooses a displayed option |
| Appearance | Frontmatter value style rules | bundled priority rules | JSON rules matching note frontmatter or task inline fields; an explicitly saved empty array remains empty |
| Lanes & layout | Ungrouped lane position | `Last` | Places cards without a group-by value before or after keyed lanes |
| Lanes & layout | Kanban scale | `100%` | Scales board sizing from 50% through 140%; the adjacent reset restores 100% |
| Lanes & layout | Dynamic empty lane width | `false` | Shrinks empty columns in board mode |
| Advanced | Enable debug logging | `false` | Enables concise developer-console traces for lifecycle, settings saves, Base filter reads, creation, and edit failures. Errors are always logged |

The `icon` and `color` defaults match the keys written by Notebook Navigator Companion, so cards automatically pick up whatever styling NNC has applied to each note.

Card click previews are gated by TPS Global Context Menu's `Force previews for Base links` setting. When that GCM toggle is off, cards open/focus notes normally even if Kanban's stored activation mode was previously `preview`.

An explicitly empty frontmatter style-rule list remains empty after reload. Bundled priority rules are used only when the stored setting is missing or is not an array.

Run `npm run test:settings` for the focused settings source contract. It checks route depth, control/key coverage, frontmatter color compatibility, reset actions, per-view ownership, accessibility, mobile CSS, and the README specification without invoking a build or runtime deployment.

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
- Bare `kind` filters use additive identity. Structural identity is always present (`task` for checkbox rows, `bullet` for bullet rows, and `note` for files), while explicit inline/frontmatter kinds are added in stable case-insensitive order. Thus `kind == "task"` includes checkbox rows and notes with `kind: task`, while `kind == "project"` includes notes and line rows explicitly authored as projects. Use `itemKind == "task"` for checkbox rows only. Positive explicit-kind filters still seed the same kind on creation; incomplete line metadata fails closed.
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
- 2026-07-09: Kept semantic TPS note kinds separate from Kanban's structural row kinds. This older note-only semantic was superseded by 0.2.0's additive Kind model, which preserves structural identity while also matching explicit note/line kinds.
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

## Version notes

- 0.2.0: Added supported formula/entity behavior for synthesized rows, additive Kind identity, typed boolean display, public GCM lifecycle capabilities, exact Base authority, and fail-closed read-only formula lanes.
- 0.1.7: Reused one Markdown line classification for hierarchy and emitted task/bullet data, halving parser calls without changing released output.
- 0.1.6: Short-circuited note/task card style-rule conditions without changing selected rules, worst-case work, or the released style-rule contract.
- 0.1.5: Reused one complete Markdown task parse to derive both task-lane data and bounded card previews, halving cold-source parser passes and line visits without changing results.
- 0.1.4: Routed tag-lane and card-nesting frontmatter mutations through GCM's supported service when available, with an exactly-once native standalone fallback.
- 0.1.3: Made task/bullet preview reads single-flight and identity-owned so stale async completions cannot overwrite modified, renamed, replaced, deleted, or unloaded board state.
- 0.1.2: Removed a discarded pre-synthesis parent index and note-lane tree from each board render, leaving one final build of every render index.
- 0.1.1: Removed the duplicate task-map construction from each board render while preserving synthetic task lanes and every existing board/task behavior.
- 0.1.0: Reorganized settings into five shallow accessible destinations, added a compact Base-rules guide, per-route scroll/focus restoration, and mobile navigation while preserving every global/per-view setting and compatibility path.
- 0.0.2: Preserved explicit empty style rules and all supported frontmatter color targets while making settings writes merge local intent into the newest synchronized data.

## Settings layout

The five-route hub documented above replaces the former root controls plus collapsed-group layout. A fresh settings open starts on **Rules & creation**; switching routes renders that destination alone, and only the full Base filter reference uses a disclosure.

- 2026-07-13: Promoted the two primary card interactions to the root and kept all optional settings collapsed. That historical layout was superseded by the shallow five-route settings hub.
