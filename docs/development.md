# Development Guide

How to build, run, test and release the Hue-Like Light Card.
For code rules see [coding-guidelines.md](coding-guidelines.md).

## Tech stack

| Area | Tool |
|---|---|
| Language | TypeScript (strict, `noImplicitOverride`, `experimentalDecorators`) |
| UI | [Lit 3](https://lit.dev) web components |
| HA helpers | `custom-card-helpers`, `home-assistant-js-websocket` |
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

## npm scripts

| Script | What it does |
|---|---|
| `npm start` | Rollup in watch mode + dev server serving `./dist` on `http://127.0.0.1:5500` (CORS enabled) |
| `npm run lint` | ESLint over `src/` and `tests/` |
| `npm run lintfix` | ESLint with `--fix` |
| `npm run rollup` | Build into `./dist` (dev) |
| `npm run build` | `lint` + `rollup` |
| `npm test` | Jest test suite |

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
├─ localize/                localize() + languages/*.json
└─ types/                   Config parsing, Consts, interfaces, HA types, helpers
```

### Data flow

1. HA calls `setConfig(plain)` → `HueLikeLightCardConfig` parses and validates it (async part - areas/floors/labels/scenes - runs in `config.init(hass)` once `hass` is available).
2. HA sets `hass` → card → `AreaLightController.hass` → each `LightController.hass` → `raisePropertyChanged('hass')`.
3. UI elements subscribe via `registerOnPropertyChanged(this._elementId, cb)` (`NotifyBase`) and re-render; they unsubscribe in `disconnectedCallback`.
4. User interaction → controller setter → optimistic local state update → `hass.callService(...)`.
5. Click/hold → `ActionHandler` → opens `HueDialog` (the "Hue screen") or HA more-info.

## Commits

Follow [COMMIT.md](../COMMIT.md): `type(scope): summary` - lowercase, present tense, no trailing period.
The scope is usually the GitHub issue (`fix(#465): ellipsis not working`). README documentation of a feature typically goes into a separate `doc(#n): ...` commit.
The release changelog groups commits by type, so pick the type carefully.

## Release

Releases are created only by the **Create Release** workflow (`workflow_dispatch` with `new_version`). It bumps the version in `consts.ts`, `package.json`, `package-lock.json`, tags, flips Dev flags, builds `release/hue-like-light-card.js`, generates changelogs and creates a **draft** GitHub release. Never bump versions by hand.

## AI-assisted development

AI work is driven by the `/task` skill and verified by the `/verify` skill with guard agents in `.claude/agents/` (build, conventions, consistency and the browser test on the testing dashboard). See [CLAUDE.md](../CLAUDE.md).
