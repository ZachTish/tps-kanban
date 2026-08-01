# TPS-Kanban (Dev) — Audit

Scope
- Reviewed files: [`src/main.ts`](src/main.ts), [`src/task-creation-utils.ts`](src/task-creation-utils.ts), [`src/views/KanbanView.ts`](src/views/KanbanView.ts), [`src/tps-contracts.ts`](src/tps-contracts.ts).

Where issues are
- High: Root-task creation resolution currently merges multiple default layers in a precedence chain where filter-derived defaults can override user intent; this can send cards to unexpected notes.
- High: The lane `+ Add ...` action can resolve to note-mode indirectly when task-mode is expected, which creates inconsistent UX and violates AGENT constraints.
- High: Contract and API calls to external plugins use runtime casts plus legacy fallback probing rather than declared capability checks.
- Medium: Task-target and lane-default logic is duplicated with Calendar and Controller while using slightly different semantics.
- Medium: Route decisions happen in UI handlers and command handlers independently, increasing drift and difficult-to-reproduce mode bugs.
- Low: Recovery/invalid-target behavior is often late and user-facing messaging is minimal.

User interaction risks
- Card creates can appear successful but land in a wrong file with no warning path logged.
- Mode mismatches break muscle memory: user expects task, plugin creates note, or vice versa.
- Users can observe repeated task creation on rapid UI interactions.

Improvements
- Enforce explicit and typed creation mode at every lane-add entrypoint; remove inferred path in ambiguous states.
- Introduce one shared resolver for `task/notes` + target selection with explicit source priority and clear rationale returned to UI.
- Add preflight validation before creation (`target exists`, `mode supported`, `contract available`) and hard-fail with explicit notice.
- Isolate side effects into separate services: `resolver`, `validator`, `creator`.
- Add contract tests for lane-add matrix across active view/filter/default permutations.

How to simplify/centralize
- Remove duplicated target-path normalization logic by extracting shared modules for:
  - active-view-first defaults
  - root target enforcement
  - fallback mapping
- Route Kanban’s controller/API calls through the same adapter used by Calendar and Health for consistency.
- Add a shared task-creation debug namespace used across plugins with request ID + source metadata.
