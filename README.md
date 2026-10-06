# TPS Kanban

> **Deprecated — October 6, 2026.** TPS Kanban has been retired in favor of
> Obsidian's native Kanban workflow. Do not install this plugin for new use.
> This repository is archived and receives no further updates. Existing tags,
> releases, and the documentation below are retained only as historical records.

Kanban and list layouts for Obsidian Bases, with shared TPS note and task behavior.

Current release: [0.2.3](https://github.com/ZachTish/tps-kanban/releases/tag/0.2.3) · Obsidian 1.10.0+ · Desktop and mobile.

## Install with BRAT

Add `ZachTish/tps-kanban` to BRAT. Use manual updates with `Latest`, or freeze an exact numeric tag for a controlled rollout. Each release supplies `main.js`, `manifest.json`, and `styles.css`; release notes record validation and artifact hashes. A published release is not evidence that any device has installed it.

## Use a board

Enable Bases and TPS Global Context Menu, then select the Kanban layout. Base filters select cards and supply creation defaults. Lane and card add actions resolve Atomic note/Atomic line intent consistently. Inline root tasks require an explicit `task.path` or configured root-task destination; no implicit fallback note is created.

GCM owns status and checkbox mappings. Unmapped structural checkboxes stay discoverable and use Ungrouped rather than receiving an invented status. Lane movement, creation, and task completion use the shared contract.

## Settings

The destinations are **Rules & creation** (default), **Cards**, **Appearance**, **Lanes & layout**, and **Advanced**. Only the active destination is rendered; route choice is transient. Rules & creation contains a compact Base rules guide with one optional full reference. Native controls retain focus behavior and a horizontally scrollable route strip on narrow screens.

Lane order, board/list mode, completed visibility, and lane labels are saved per Base view. Color modes `icon` and `both` remain load-compatible even where the current UI exposes Card and Off. Run `npm run test:settings` for the focused settings contract.

See [the detailed reference](REFERENCE.md) for settings/default tables, the behavior matrix, commands, and historical verification. This maintenance pass changes no plugin behavior.

## Development and repository policy

`main` is the stable source line. Numeric tags identify immutable released artifacts. `optimization` is an unreleased work-in-progress lane; do not install it through BRAT or merge it into stable without separate validation.

The supported build lives inside `Obsidian Plugin Test Vault/Plugin Development`, with `TPS-Kanban (Dev)` as the mapped stable source. These repositories depend on adjacent shared tooling including `deploy-runtime.mjs`; a standalone clone is not currently self-contained.

From the contained workspace, prepare dependencies using the shared helper, then run tests and a separate final build:

```sh
# From Plugin Development:
node ./prepare-dependencies.mjs "TPS-Kanban (Dev)"
cd "TPS-Kanban (Dev)"
npm test
npm run build
```

Dependencies stay in the vault's `.plugin-dev-cache.nosync` through a relative `node_modules` symlink. Use a clean, current checkout; preserve unrelated changes and never build an old dirty worktree into the test runtime. Stable builds deploy only shipped artifacts to the test vault. Optimization builds are build-only. Runtime `data.json`, secrets, caches, and session state never belong in Git.

Documentation-only maintenance does not create a new plugin version. Published release tags and assets are preserved. Do not rely on legacy version/release scripts without reviewing their current behavior. Production updates remain the user's BRAT handoff.

For prior feature details and release-specific evidence, see [REFERENCE.md](REFERENCE.md) and [GitHub releases](https://github.com/ZachTish/tps-kanban/releases). The September 16 cleanup changes documentation and repository metadata, not shipped behavior.
