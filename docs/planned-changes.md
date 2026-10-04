# Planned Changes

Backlog of changes identified during the codebase analysis that set up the AI development workflow.
Each item is meant to be done as a separate `/task` (unless stated otherwise) and removed from this file (or marked done) when finished.

Only necessary changes (bugs, duplication, rule enforcement) belong here - not feature ideas or optional cleanups.

Legend: **P1** = do next, **P2** = should do.

## Execution order

### Fixes
| # | Fix | Priority | Type |
|---|---|---|---|
| F4 | [Card keeps listening to the replaced controller](#f4-card-keeps-listening-to-the-replaced-controller) | P1 | `fix` |
| F3 | [Wheel tick lost at the row edge on fractional DPR](#f3-wheel-tick-lost-at-the-row-edge-on-fractional-dpr) | P2 | `fix` |

---


## Fixes

### F4. Card keeps listening to the replaced controller

Repro: call `setConfig()` again on a connected card (e.g. the card editor preview while editing YAML); the card stops reacting to light changes.

Cause: [src/hue-like-light-card.ts](../src/hue-like-light-card.ts) - `useInitializedConfig()` replaces `_ctrl` with a new `AreaLightController`, but `_ctrlListenerRegistered` stays `true`. `setupListeners()` never registers on the new controller, and the old controller keeps the card's callback (and the card) alive.

Proposed: before replacing `_ctrl`, unregister from the old controller and reset `_ctrlListenerRegistered` (then `updated()` registers on the new one); add a Jest test (after a second `setConfig()`, the new controller has the card's callback and the old one doesn't).

Suggested commit: `fix: re-register card listener when the controller is replaced`

### F3. Wheel tick lost at the row edge on fractional DPR

Repro (DPR 1.5, narrow view): wheel a Hue dialog row to its end - `scrollLeft` settles at e.g. 96.67 with a max of 97, so `atEnd` in [src/directives/horizontal-scroll.ts](../src/directives/horizontal-scroll.ts) (`onWheel`) is false; the event is prevented, nothing scrolls, and one wheel tick is lost before the page scrolls.

Proposed: compare with a 1px tolerance (`scrollLeft <= 1` for the start, `scrollLeft >= maxScrollLeft - 1` for the end); extend `tests/horizontal-scroll.test.ts`.

Suggested commit: `fix: tolerate subpixel scroll position at the row edge`

---