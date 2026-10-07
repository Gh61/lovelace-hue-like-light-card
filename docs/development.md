# Development Guide

How to build, run, test and release the Hue-Like Light Card.
For code rules see [coding-guidelines.md](coding-guidelines.md).

## Tech stack

| Area | Tool |
|---|---|
| Language | TypeScript (strict, `noImplicitOverride`, `experimentalDecorators`) |
| UI | [Lit 3](https://lit.dev) web components |
| HA helpers | `home-assistant-js-websocket`; HA frontend source copied into `src/ha/` (see [HA source sync](#ha-source-sync)) |
| Gestures | `@egjs/hammerjs` |
| Bundler | Rollup (`rollup.config.mjs`) |
| Tests | Jest + ts-jest + jsdom |
| Lint | ESLint 10 flat config (`eslint.config.mjs`) |
| CI | GitHub Actions (`.github/workflows/`) |
| Distribution | HACS (`hacs.json`) - single file `hue-like-light-card.js` |

## Setup

```shell
npm ci
```

Node.js `^22.18.0` or `>=24.11.0` is required (Babel 8); CI uses Node 24.

`@emnapi/core` and `@emnapi/runtime` are listed in `devDependencies` on purpose. They are optional peers of `@napi-rs/wasm-runtime` (jest → `unrs-resolver` wasm fallback). npm on Windows does not write them to the lockfile root, but `npm ci` on Linux (CI) requires them there - keep them so a lockfile generated on Windows passes CI.

## npm scripts

| Script | What it does |
|---|---|
| `npm start` | Rollup in watch mode + dev server serving `./dist` on `http://127.0.0.1:5500` (CORS enabled) |
| `npm run lint` | ESLint over the repository (`eslint .`; ignores in `eslint.config.mjs` - `src/ha/`, `scripts/`, configs) |
| `npm run lintfix` | ESLint with `--fix` |
| `npm run rollup` | Build into `./dist` (dev) |
| `npm run build` | `lint` + `rollup` |
| `npm test` | Jest test suite |
| `npm run clean` | Removes `node_modules/.cache` (TypeScript build cache, ha-sync upstream cache) |
| `npm run ha-sync -- <command>` | Syncs `src/ha/` with the Home Assistant frontend source (see [HA source sync](#ha-source-sync)) |

CI (`validation.yml`) runs on every push/PR: `npm ci` → `lint` → `rollup` → `test` → HACS validation.
**All of `lint`, `rollup` and `test` must pass before any change is considered done.**

## Dev vs. release build

`src/types/consts.ts` contains `Consts.Dev = true` and `rollup.config.mjs` contains `var dev = true;`. Both stay `true` in the repository.

In dev mode:

- every custom element gets the `-test` postfix (`Consts.ElementPostfix`) - the card is `custom:hue-like-light-card-test`,
- the JS API is published as `window.hue_card_test` (instead of `window.hue_card`),
- the card name/description get a ` [TEST]` suffix,
- logging uses the `dev` levels from `src/logging.json` (debug logging enabled; the release build uses the `prod` levels - warnings and errors only),
- output goes to `./dist` unminified.

This lets the dev build run **side by side** with the released card in the same Home Assistant instance.

The release workflow flips both flags with `sed` - **never change them manually and never change the version string format** (`public static readonly Version = 'vX.Y.Z';`), the release regex depends on it.

The same workflow replaces the version in `package.json` (line 3) and `package-lock.json` (lines 3 and 9) **by line number**. Never add, remove or reorder keys above `version` in these files (`npm install` of a new dependency keeps them intact; manual edits of the header might not).

## Testing in Home Assistant

1. Run `npm start` (serves `http://127.0.0.1:5500/hue-like-light-card.js`).
2. In your **testing** Home Assistant instance add a dashboard resource (JavaScript module) pointing to `http://127.0.0.1:5500/hue-like-light-card.js`.
3. Use a dedicated testing dashboard with cards of type `custom:hue-like-light-card-test`.
4. After a rebuild, hard-refresh the browser (cache may hold the old module).

> **Safety rule:** browser testing (manual or AI driven) happens **only on the dedicated testing dashboard and its views**. Never use production dashboards, never change HA settings, entities or other dashboards.

The AI workflow (`/task`) asks for the testing dashboard URL once and stores it together with the dev server URL in `.claude/testing-dashboard.local.json` (gitignored, per developer). Later tasks reuse it without asking and print it in the task plan - tell the AI if you want to test elsewhere. In a cloud session (no file, no local HA) the browser test uses the Docker instance described below.

`control-test.html` is a standalone sandbox for the color/temperature picker, mode selector and brightness rollup (open it through the dev server).

### Testing in a cloud session (Docker Home Assistant)

A Claude Code cloud session has no access to the developer's Home Assistant, so it runs its own throwaway instance in Docker (`test-ha/`), driven by Playwright with the pre-installed Chromium. The same setup works on a developer machine with Docker.

| Command | What it does |
|---|---|
| `npm run ha-test -- start` | Starts the Docker daemon when none runs (cloud container), pulls `ghcr.io/home-assistant/home-assistant:<homeAssistantVersion from src/ha/ha-sync.json>` when missing, starts the container with `test-ha/config` as `/config` and `./dist` as `/config/www`, waits for the dashboard and seeds the registry (floor, areas, label for the demo lights). |
| `npm run ha-test -- smoke` | Playwright smoke test (`test-ha/browser/smoke.mjs`): all cards of the testing dashboard render, tap opens the Hue dialog, browser back closes it, no console errors. Screenshots in `test-ha/browser/out/`. |
| `npm run ha-test -- dialog` | Playwright test of the Hue dialog lifecycle (`test-ha/browser/dialog.mjs`): open / re-open, browser back closes the light detail first and the dialog second, X / Escape leave no dialog history state, more-info stacks on the dialog. |
| `npm run ha-test -- actions` | Playwright test of the card actions (`test-ha/browser/actions.mjs`, view `actions`): toggle / navigate / scene by state / double tap / deprecated options. |
| `npm run ha-test -- area-disabled` | Playwright test of an area with a disabled light (`test-ha/browser/area-disabled.mjs`, view `styles`, #398): disables `light.bed_light` for the test, the Area card renders the remaining lights and warns in the console, the entity is enabled again at the end. |
| `npm run ha-test -- card-shadow` | Playwright test of the card shadow (`test-ha/browser/card-shadow.mjs`, view `styles`, #424): the "Plain borders" card (default theme, `hueBorders: false`) shows only the card's inset shadow, the "Theme shadow" card (theme `card-shadow-test` from `test-ha/config/themes/`) adds the theme's `ha-card-box-shadow`, and no `ha-card` is appended to `document.body`. |
| `npm run ha-test -- stop` / `status` / `logs` | Container lifecycle and the HA log. |

Facts about the instance:

- URL `http://127.0.0.1:8123`, testing dashboard `http://127.0.0.1:8123/lovelace-testing` (views `basic`, `hue-screen`, `styles`, `actions` in `test-ha/config/dashboards/testing.yaml` - add a card there when a change needs a new configuration).
- Entities come from the `demo` integration (`light.bed_light`, `light.ceiling_lights`, `light.kitchen_lights` with color temperature + hs, `light.office_rgbw_lights`, `light.living_room_rgbww_lights`, `light.entrance_color_white_lights`, `switch.decorative_lights`) plus two YAML scenes (`scene.evening`, `scene.bright`); `ha-test start` assigns them to the areas `living_room` / `kitchen` on the floor `ground_floor` and the label `accent`.
- Login is automatic: the only auth provider is `trusted_networks` with `allow_bypass_login` and the single user `Tester` pre-seeded in `test-ha/config/.storage/auth` (no password, reachable from the container host only). Onboarding is pre-completed (`.storage/onboarding`). Everything else HA writes into `test-ha/config` is ignored by git.
- `src/ha/ha-sync.json` → `homeAssistantVersion` is the HA release whose frontend is copied into `src/ha/`; update it together with the manifest commit when syncing.
- `test-ha/browser/helpers.mjs` has the Playwright helpers (open a view, find elements through shadow roots, tap / hold, dialog checks, console errors) for the browser-tester agent and ad-hoc scripts.
- In a cloud session the SessionStart hook (`.claude/hooks/session-start.sh`) installs npm dependencies, starts the Docker daemon and pulls the image in the background; the environment's network access must allow `ghcr.io` and `pkg-containers.githubusercontent.com`.

## Unit tests

- Location: `tests/<subject>.test.ts` (flat folder), one `describe` per file, `it('should ...')`.
- Helpers: `tests/test.helper.ts` (`createLightEntity`), `tests/mockup-hass-states.ts` (`hassMockup`), `tests/mockup-general.ts`.
- Lit elements are only constructed and their pure methods called - no DOM rendering in tests.
- Covered: config parsing, colors, color-temp picker math, text templates, light features, localization, card smoke test, action dispatch (`show-dialog` / `hass-more-info`).
- Not covered (verify in the browser): rendering of controls, dialog, gestures, scenes, API provider, WebSocket client.

## Architecture overview

Repository folders: `src/` (card source), `tests/` (Jest), `docs/` (developer documentation - this folder), `doc_img/` (screenshots linked from README), `hue_ref/` (reference images), `.claude/` (AI skills and agents), `.github/` (CI and release workflows).

```
src/
├─ hue-like-light-card.ts   Card entry point (custom element, config + hass lifecycle)
├─ version-notifier.ts      Console banner
├─ logging.json             Log levels per category (dev / prod)
├─ core/                    Logic: controllers, actions, API, helpers
│  ├─ light-controller.ts         One light/switch entity (state, optimistic updates, service calls)
│  ├─ area-light-controller.ts    Group of LightControllers (what the card controls)
│  ├─ global-lights.ts            Shared LightController cache (one per entity across all cards)
│  ├─ notify-base.ts              Property-changed notification base
│  ├─ console-logger.ts           Logging with hierarchical categories (levels in src/logging.json)
│  ├─ action-handler.ts           Click / hold actions
│  ├─ api-provider.ts             window.hue_card JS + URL API
│  ├─ hass-ws-client.ts           WebSocket queries (areas, floors, labels, scenes)
│  ├─ colors/                     Color, ColorExtended, Background, resolvers
│  └─ ...                         view-utils, icon-helper, display-observer, live-update-session, effect-queue, ...
├─ controls/                Lit UI elements (dialog, tiles, light detail, pickers, switches, sliders)
├─ directives/              Lit directives (horizontal-scroll)
├─ ha/                      Home Assistant frontend source (copied, managed by ha-sync - see below)
├─ localize/                localize() + languages/*.json
└─ types/                   Config parsing, Consts, interfaces, HA types, helpers
```

### Data flow

1. HA calls `setConfig(plain)` → `HueLikeLightCardConfig` parses and validates it (async part - areas/floors/labels/scenes - runs in `config.init(hass)` once `hass` is available).
2. HA sets `hass` → card → `AreaLightController.hass` → each `LightController.hass` → `raisePropertyChanged('hass')`.
3. UI elements subscribe via `registerOnPropertyChanged(this._elementId, cb)` (`NotifyBase`) and re-render; they unsubscribe in `disconnectedCallback`.
4. User interaction → controller setter → optimistic local state update → `hass.callService(...)`.
5. Click/hold → `ActionHandler` → fires `show-dialog` for `HueDialog` (the "Hue screen", an HA-managed dialog: one element per tag, `showDialog(params)` / `closeDialog(historyState)`, HA owns the browser history) or `hass-more-info`.

## HA source sync

`src/ha/` contains source files copied from the [Home Assistant frontend](https://github.com/home-assistant/frontend) (types, `HomeAssistant` interface, `fireEvent`, `forwardHaptic`, `applyThemesOnElement`, the `actionHandler()` directive, `computeStateDisplay`, ...). Using HA's own code instead of third-party helper packages keeps the card close to HA's behavior and typing.

The copies are managed by `npm run ha-sync` (`scripts/ha-sync.mjs`) and the manifest `src/ha/ha-sync.json` (upstream repository, synced commit, list of copied files - paths relative to the upstream `src/`, the local copy is `src/ha/<path>`).

| Command | What it does |
|---|---|
| `npm run ha-sync -- check [<ref>]` | Compares `src/ha/` with upstream at the manifest commit (or `<ref>`): identical / locally modified / missing files. Exit code 1 when anything differs. |
| `npm run ha-sync -- update <ref>` | Writes pristine copies of all manifest files at `<ref>` (commit, tag or branch, e.g. `dev`) into the vendor branch `ha-upstream` as one commit, together with the updated manifest. |

Workflow for updating to a newer HA version:

1. On the development branch: `npm run ha-sync -- update dev` (needs a clean `src/ha/`).
2. `git merge ha-upstream` - Git does a 3-way merge (previous upstream → new upstream vs. our copy), so the local adaptations in `src/ha/` survive; conflicts appear only where HA changed the same lines.
3. Fix compile errors (HA may have added imports that need a new file in the manifest or a stub), run lint / build / tests.

Rules for `src/ha/`:

- The vendor branch `ha-upstream` holds only pristine upstream files - never commit anything else to it and never merge the development branch into it. `npm run ha-sync -- check` on that branch must report no differences.
- The rest of the repository on `ha-upstream` is whatever it inherited when the branch was created; the only non-HA change made there is the `branches-ignore` of `ha-upstream` in `.github/workflows/validation.yml` (CI cannot build the pristine copies alone). Keep that file identical on both branches.
- Local adaptations in the copies (commented-out imports of HA-only modules, removed unused parts, type fixes) are kept minimal and never reformat the file - every changed line is a potential merge conflict. New HA files are added by appending them to the manifest and running `update`.
- `src/ha/` is excluded from ESLint (`eslint.config.mjs`) and keeps HA's formatting (2 spaces, double quotes).
- HA build-time constants used by the copies (`__STATIC_PATH__`, ...) are defined in `rollup.config.mjs` (`haDefines`, via `@rollup/plugin-replace`) and in `jest.config.js` (`globals`); add new ones to both places.
- The upstream repository is cached in `node_modules/.cache/ha-frontend` (`npm run clean` removes it).

### Baseline between a branch and `ha-upstream`

The 3-way merge works only when the branch has a merge with `ha-upstream` in its history (the *baseline*: the last pristine upstream state Git can compare against). The vendor branch is never rewritten (no rebase, no force-push with content changes), so the baseline can only get lost on the development side:

- a `git rebase` of the development branch drops the baseline merge commit (a plain rebase skips merges; `--rebase-merges` replays the vendor commit under a new sha) - prefer merging `main` into a long-lived branch over rebasing it,
- a squash merge into `main` drops the whole history including the baseline.

Recreate the baseline on the affected branch - content does not change, only the merge is recorded again:

```shell
git branch -f ha-upstream HEAD          # vendor branch restarts from the current branch state
npm run ha-sync -- update <commit from src/ha/ha-sync.json>
git merge -s ours --no-ff ha-upstream -m "build(ha): record HA frontend <short sha> as the ha-sync baseline"
git push -f origin ha-upstream          # the vendor branch is generated content, nobody builds on it
```

A regular merge (merge commit, not squash) of a development branch into `main` keeps the baseline; `ha-upstream` stays as a permanent vendor branch and later HA updates follow the workflow above on `main` or on the next development branch.

## Commits

Follow [COMMIT.md](../COMMIT.md): `type(scope): summary` - lowercase, present tense, no trailing period.
The scope is usually the GitHub issue (`fix(#465): ellipsis not working`). README documentation of a feature typically goes into a separate `doc(#n): ...` commit.
The release changelog groups commits by type, so pick the type carefully.

## Release

Releases are created only by the **Create Release** workflow (`workflow_dispatch` with `new_version`). It bumps the version in `consts.ts`, `package.json`, `package-lock.json`, tags, flips Dev flags, builds `release/hue-like-light-card.js`, generates changelogs and creates a **draft** GitHub release. Never bump versions by hand.

## AI-assisted development

AI work is driven by the `/task` skill and verified by the `/verify` skill with guard agents in `.claude/agents/` (build, conventions, consistency and the browser test on the testing dashboard). See [CLAUDE.md](../CLAUDE.md).
