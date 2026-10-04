# Planned Changes

Backlog of changes identified during the codebase analysis that set up the AI development workflow.
Each item is meant to be done as a separate `/task` (unless stated otherwise) and removed from this file (or marked done) when finished.

Only necessary changes (bugs, duplication, rule enforcement) belong here - not feature ideas or optional cleanups.

Legend: **P1** = do next, **P2** = should do.

## Execution order

| # | Item | Priority | Type |
|---|---|---|---|
| 1 | [ESLint tightening + style fix](#1-eslint-tightening--style-fix) | P1 | `style` / `chore` |
| 2 | [Listener leak bugs (pilot `/task`)](#2-listener-leak-bugs-pilot-task) | P1 | `fix` |
| 3 | [Deduplicate `tryLoad*Info` in config](#3-deduplicate-tryloadinfo-in-config) | P2 | `refactor` |
| 4 | [Centralize the HA 2026.5 `ha-switch` margin hack](#4-centralize-the-ha-20265-ha-switch-margin-hack) | P2 | `refactor` |
| 5 | [Move README images from `doc/` to `doc_img/`](#5-move-readme-images-from-doc-to-doc_img) | P2 | `doc` |

---

## 1. ESLint tightening + style fix

**Why:** make rules from [coding-guidelines.md](coding-guidelines.md) machine-checked instead of review-only.
**When:** after the AI docs (CLAUDE.md, docs/, agents, skills) are reviewed and committed.
**How:** a single commit containing the `eslint.config.mjs` change **and** the resulting fixes of existing code (`npm run lintfix` + manual fixes).

Proposed rules:

| Rule | Setting | Guideline |
|---|---|---|
| `@typescript-eslint/consistent-type-assertions` | `{ assertionStyle: 'as' }` | §2 - `value as Type` (converts ~26 `<Type>value` casts) |
| `eqeqeq` | `['error', 'smart']` | §2 - `===`, `== null` allowed |
| `@/quotes` | `['error', 'single', { avoidEscape: true }]` | §2 - single quotes |
| `@/semi` | `['error', 'always']` | §2 - semicolons |
| `spaced-comment` | `['error', 'always', { markers: ['#region', '#endregion'] }]` | §2 - `//#region` style (verify it accepts `//#region` and rejects `// #region`, otherwise drop) |
| `no-console` | `['warn', { allow: ['warn', 'error', 'info'] }]` *(to discuss)* | §5 - no stray `console.log` (Dev-guarded logs would need `console.info` or a disable comment) |

Steps:
1. Add the rules, run `npm run lint` and review the count of violations per rule.
2. `npm run lintfix`, fix the rest manually - **no behavior changes**.
3. `==` → `===` changes must be checked one by one (`==` between different types may be intentional).
4. Update [coding-guidelines.md](coding-guidelines.md): mark the newly enforced rules with **[lint]**.
5. `npm run lint && npm run rollup && npm test` + quick browser smoke test on the testing dashboard.

Suggested commit: `style: tighten eslint rules and fix existing code`

## 2. Listener leak bugs (pilot `/task`)

First real run of the `/task` workflow - used to tune the guard agents.

| File | Problem | Fix |
|---|---|---|
| [src/types/prevent-ghostclick.ts:41-44](../src/types/prevent-ghostclick.ts#L41-L44) | `destroy()` calls `addEventListener` instead of `removeEventListener` → listeners are added again on every reconnect | use `removeEventListener` with the same arguments (capture `true`) |
| [src/controls/color-temp-mode-selector.ts:200-203](../src/controls/color-temp-mode-selector.ts#L200-L203) | `unregisterColorPickerEvent` calls `addEventListener` instead of `removeEventListener` | use `removeEventListener`; check that `onColorPickerModeChange` is a stable reference (arrow property / bound) |
| [src/directives/horizontal-scroll.ts](../src/directives/horizontal-scroll.ts) | plain `Directive` - `_cleanup` is never called, wheel listener and `requestAnimationFrame` survive element removal | convert to `AsyncDirective`, call cleanup in `disconnected()`, re-attach in `reconnected()` |

Verification: unit tests where possible (listener add/remove counts with jsdom spies), browser: open/close the Hue dialog repeatedly, scroll scenes/lights with wheel, switch color/temp modes, tap/hold the card - no duplicated actions, no console errors.

Suggested commit: `fix: remove event listeners on teardown`

## 3. Deduplicate `tryLoad*Info` in config

[src/types/config.ts:428-568](../src/types/config.ts#L428-L568) - `tryLoadFloorInfo`, `tryLoadAreaInfo`, `tryLoadLabelInfo` are near-copies (load entities via `HassWsClient`, guard by a `_xxxLoaded` flag, map errors to a user-friendly `Error`).

Proposed: one generic private method parametrized by the differing parts (loader function, target fields, error message), keeping the public behavior and error messages identical. Covered by `tests/config-parse.test.ts` + browser check of cards configured with `area`, `floor`, `label`.

Suggested commit: `refactor(config): unify area/floor/label loading`

## 4. Centralize the HA 2026.5 `ha-switch` margin hack

`ha-switch { margin-inline-end: -0.5em; }` is copied in 3 places:
- [src/hue-like-light-card.ts:305](../src/hue-like-light-card.ts#L305)
- [src/controls/dialog.ts:398](../src/controls/dialog.ts#L398)
- [src/controls/dialog-light-tile.ts:115](../src/controls/dialog-light-tile.ts#L115)

Proposed: a shared `css` fragment (e.g. in `ViewUtils` or `ThemeHelper`) with one comment explaining the HA version, composed into the three `styles`. Browser check: switch alignment on the card, in the dialog header and on light tiles.

Suggested commit: `refactor: share ha-switch compatibility styles`

## 5. Move README images from `doc/` to `doc_img/`

**Why:** `doc/` (README screenshots) and `docs/` (developer documentation) differ by one letter and are easy to confuse - for humans and for AI agents.

**How:**
1. `git mv doc doc_img`.
2. Update the 22 image references in [README.md](../README.md): 17 relative (`/doc/<file>.png`) and 5 absolute (`https://github.com/Gh61/lovelace-hue-like-light-card/raw/main/doc/<file>.png`, used in `<img>` tags with a `height`) - replace `/doc/` with `/doc_img/` in both forms.
3. Grep the whole repository (incl. `.github/`) for other `doc/` references.
4. Update the folder list in [development.md](development.md) (remove the "planned to move" note).

**Be aware:** the absolute URLs in the README of already released versions (as rendered by HACS or on the release tags) point to `main/doc/...`, so those 5 images break after the move until the next release. The README on `main` and the next release are fine.

No code change - `/task` with "Skip browser test"; verification = README preview on GitHub after push.

Suggested commit: `doc: move README images to doc_img`
