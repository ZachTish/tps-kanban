TPS Kanban (Dev)

A Kanban board view that integrates with Obsidian's **Bases** plugin. It appears as a selectable view type alongside Table, Calendar, etc. in any `.base` file.

## Features

- **Lanes are driven by the base's Group By setting** — one lane per distinct value of the grouped property
- Cards inside each lane are the base's query results, sorted by the base's multi-level Sort setting
- Click a card to open the linked note
- **Drag a card between lanes** — updates the groupBy frontmatter property on the note to the new lane's value
- Right-click a card for quick open and move-to-lane actions
- **Add card** button per lane creates either:
  - a task-line in the target note when the board is task-only (`kind == "task"`), or
  - a linked note for note/mixed boards, unless **Card add button default** is set to `task`.
  - When task creation is used, lane/group values and simple Base task filters are written into the new task line so it immediately matches the column it was added from.
  - When note creation is used, simple positive Base note filters such as `file.folder == "Projects"` or `file.path == "Projects/New card.md"` seed the creation target so the new note starts inside the board criteria instead of at the vault root.
- **+ Add subitem** on each note card creates either a linked subitem or an inline task depending on the same defaulting rules.
- Root task cards expose a real checkbox control for completion; clicking the title still opens the task, and dragging still starts from the drag handle/card gesture.
- Re-renders automatically whenever the base data or configuration changes
- **Card icon** — shows a Lucide icon on each card read from a configurable frontmatter property (default: `icon`)
- **Card color accent** — applies a left-border color strip to each card from a configurable frontmatter property (default: `color`)
- **Ungrouped lane position** — configure whether cards with no group-by value appear in the first or last lane

## Usage

1. Enable **TPS Kanban (Dev)** in Obsidian community plugins.
2. Open or create a `.base` file (*File → New base*).
3. In the view toolbar, click the view-type selector and choose **Kanban**.
4. Use the base toolbar's **Group By** picker to select which property defines the lanes (e.g. `status`, `priority`).
5. Use the base toolbar's **Sort** picker to control the order of cards within each lane.
6. Drag cards between lanes — this writes the new value back to the note's frontmatter.

## Settings

| Setting | Default | Description |
|---|---|---|
| Icon property | `icon` | Frontmatter key holding a Lucide icon name to show on the card |
| Color property | `color` | Frontmatter key holding a CSS color value (hex, rgb, named) for the card's left-border accent |
| Card add button default | `note` | Controls what `+ Add card` / `+ Add subitem` creates when board mode is mixed. `task` creates inline checkbox tasks in notes; `note` creates linked notes |
| Ungrouped lane position | `Last` | Whether cards with no group-by value appear before or after the keyed lanes |
| Default root task note path | `''` | Optional explicit sink for root task lines when no `task.path` base/default exists. If empty, task creation is blocked and no implicit fallback note is created |
| Open task destination after create | `true` | Auto-open the note that receives a newly created root task |

The `icon` and `color` defaults match the keys written by Notebook Navigator Companion, so cards automatically pick up whatever styling NNC has applied to each note.

Card click previews are gated by TPS Global Context Menu's `Force previews for Base links` setting. When that GCM toggle is off, cards open/focus notes normally even if Kanban's stored activation mode was previously `preview`.

## Behaviour Matrix

| Board mode | `Card add button default` | Lane add action |
|---|---|---|
| `tasks` | any | Always create task item |
| `notes` | any | Always create linked note/subitem |
| `mixed` | `note` | Create linked note/subitem |
| `mixed` | `task` | Create task line in the target note |

## Verification notes
- Root task creation now requires an explicit target path from either `task.path` filter/defaults or `Default root task note path`. If no target can be resolved, creation is aborted and no implicit fallback note is created.
- Even when the board is mixed-mode without explicit `task.*` directives, explicit `task.path`/root-task defaults are now treated as task scan sources so board rendering can include newly created tasks in that target note.
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
- Embedded daily-note scheduled boards should express all-day creation through their Base filter defaults. Use an ordered `or` inside the scheduled branch with `allDay == true` first, followed by `allDay == false` and `allDay.isEmpty()`. Kanban writes the first branch as `[allDay:: true]` through the generic inline-default path while still showing timed or missing-`allDay` scheduled tasks.
- Embedded note templates can use current-note tokens in task filters:
  - `task.path == this.file.path` resolves root task creation to the note containing the embedded Base.
  - `scheduled == this.scheduled` resolves against the containing note's frontmatter and can force a scheduled-date lane for daily-note boards.
  - ordered `allDay` alternatives in the same scheduled branch can default newly created scheduled tasks to all-day without hiding timed/intraday tasks.
- Daily-note scratchpad boards should include an explicit task target such as `task.path == this.file.path` when lane add should create task lines in the containing note. Global scratchpad boards can still be built, but they must provide an explicit `Default root task note path` instead of relying on an implicit fallback note.
- Reading-mode embedded boards hide editing chrome but keep card layout stable. Task cards use a two-column checkbox/title grid when drag handles are hidden, clamp titles to two lines, and suppress internal sync fields such as `tpsInlineProps` from card metadata chips. Board-mode embedded lanes stretch to the tallest lane in the row so shorter lanes still occupy their allotted grid height.
- Reading-mode embedded boards hide the global view controls and bottom `+ Add task` / `+ Add card` buttons so they behave like compact inline content on mobile. Lane headers keep compact add and collapse controls with forced SVG visibility, and the add control uses the same lane-add resolution as the full board button. Embedded Base wrappers are marked and compacted so the board sits close to the note title/properties, mobile embedded board lanes fit the note width, colored card accents are preserved, and Kanban mobile chrome suppression stays scoped to Kanban controls so GCM/property headers remain visible while swiping.
- Live-preview embedded boards keep editing controls available while editing a note. The compact toolbar can switch between board/list mode, and embedded lane headers also expose a first-lane board/list toggle plus lane rename/add/collapse controls so the controls remain reachable when Obsidian's embedded Bases chrome is constrained. Reading-mode embeds intentionally keep global controls hidden.
- Mobile and iPad controls use inline SVG fallbacks for toolbar and lane buttons so Obsidian does not render blank control pills when native icon injection fails.
- Bases header result counts are synced after Kanban finishes rendering and use the actual displayed note cards plus displayed task cards, so mixed note/task boards do not show the pre-render native row count.
- Kanban search matching is scoped to the current Base/embed leaf. Global Obsidian sidebar search text must not filter embedded task boards.
- Embedded Kanban source resolution prefers the containing markdown note before neighboring or hidden `.base` tabs in the same workspace leaf. This keeps daily-note filters and `this.scheduled` context stable after tab switches/reloads.
- Task inline property parsing is delimiter-aware: bracketed fields such as `[tpsInlineProps:: ...]` are stripped through the closing `]`, so encoded calendar metadata containing parentheses does not leak into the visible card title.
- Embedded daily scheduled/unscheduled task boards only use the daily fallback when the parsed filter tree contains the expected task kind, `scheduled == this.scheduled`, and empty-scheduled branch. More complex Base filters stay on the structured evaluator instead of being treated as broad daily boards.
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
  - note creation can derive a matching folder/path target from positive Base note filters.
  - root task cards expose native checkbox controls that toggle completion without opening the task.
  - column-created tasks preserve target note, status, tags, lane property, and custom inline defaults.
  - embedded daily/project templates can use `this.scheduled` and `this.file.path` for scoped Kanban task creation.
  - reading-mode embedded task cards keep horizontal titles and filtered metadata while using the same task records as live preview.
  - live-preview embedded boards retain the list/board switcher and lane rename/add controls while reading-mode embeds stay compact.
- Rebuild this plugin and reload Obsidian before validating behavior in the Kanban view.

## Notes

- Lanes are read-only columns: they are determined by the distinct values of the Group By property in the base. To add a new lane, use a property value that doesn't exist yet.
- If no Group By is configured, the board shows a single ungrouped lane.
- Only `frontmatter` properties support drag-to-move. Computed or file properties are displayed but dragging between lanes is disabled when the Group By targets a non-frontmatter property.
