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
| Lint | ESLint 9 flat config (`eslint.config.mjs`) |
| CI | GitHub Actions (`.github/workflows/`) |
| Distribution | HACS (`hacs.json`) - single file `hue-like-light-card.js` |

## Setup

```shell
npm ci
```

Node.js LTS is expected (CI uses the default of `actions/setup-node`).

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
- extra debug logging (guarded by `if (Consts.Dev)`) is enabled,
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

The AI workflow (`/task`) asks for the testing dashboard URL once and stores it together with the dev server URL in `.claude/testing-dashboard.local.json` (gitignored, per developer). Later tasks reuse it without asking and print it in the task plan - tell the AI if you want to test elsewhere.

`control-test.html` is a standalone sandbox for the color/temperature picker, mode selector and brightness rollup (open it through the dev server).

## Unit tests

- Location: `tests/<subject>.test.ts` (flat folder), one `describe` per file, `it('should ...')`.
- Helpers: `tests/test.helper.ts` (`createLightEntity`), `tests/mockup-hass-states.ts` (`hassMockup`), `tests/mockup-general.ts`.
- Lit elements are only constructed and their pure methods called - no DOM rendering in tests.
- Covered: config parsing, colors, color-temp picker math, text templates, light features, localization, card smoke test.
- Not covered (verify in the browser): rendering of controls, dialog, gestures, scenes, API provider, WebSocket client.

## Architecture overview

Repository folders: `src/` (card source), `tests/` (Jest), `docs/` (developer documentation - this folder), `doc_img/` (screenshots linked from README), `hue_ref/` (reference images), `.claude/` (AI skills and agents), `.github/` (CI and release workflows).

```
src/
├─ hue-like-light-card.ts   Card entry point (custom element, config + hass lifecycle)
├─ version-notifier.ts      Console banner
├─ core/                    Logic: controllers, actions, API, helpers
│  ├─ light-controller.ts         One light/switch entity (state, optimistic updates, service calls)
│  ├─ area-light-controller.ts    Group of LightControllers (what the card controls)
│  ├─ global-lights.ts            Shared LightController cache (one per entity across all cards)
│  ├─ notify-base.ts              Property-changed notification base
│  ├─ action-handler.ts           Click / hold actions
│  ├─ api-provider.ts             window.hue_card JS + URL API
│  ├─ hass-ws-client.ts           WebSocket queries (areas, floors, labels, scenes)
│  ├─ colors/                     Color, ColorExtended, Background, resolvers
│  └─ ...                         view-utils, icon-helper, limited-timeout, effect-queue, ...
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
5. Click/hold → `ActionHandler` → opens `HueDialog` (the "Hue screen") or HA more-info.

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
