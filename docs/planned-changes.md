# Planned Changes

Backlog of changes identified during the codebase analysis that set up the AI development workflow.
Each item is meant to be done as a separate `/task` (unless stated otherwise) and removed from this file (or marked done) when finished.

Only necessary changes (bugs, duplication, rule enforcement) belong here - not feature ideas or optional cleanups.

Legend: **P1** = do next, **P2** = should do.

## Execution order

### Fixes
| # | Fix | Priority | Type |
|---|---|---|---|
| F2 | [Detached cards re-register their listeners](#f2-detached-cards-re-register-their-listeners) | P1 | `fix` |
| F3 | [Wheel tick lost at the row edge on fractional DPR](#f3-wheel-tick-lost-at-the-row-edge-on-fractional-dpr) | P2 | `fix` |

---


## Fixes

### F2. Detached cards re-register their listeners

Repro (touch emulation): open and close a card's Hue dialog; HA recreates the view's cards, and the old, disconnected `HueLikeLightCard` instances still have `_ctrlListenerRegistered`, the hammer `Manager`, `PreventGhostClick` and touch listeners on `.tap-area`. The controller registration keeps them alive.

Cause: [src/hue-like-light-card.ts:320-322](../src/hue-like-light-card.ts#L320-L322) - `updated()` calls `setupListeners()` unconditionally. A disconnected card that still receives `hass` updates re-registers everything after `disconnectedCallback()` has run `destroyListeners()`.

Proposed: register only while connected (`if (this.isConnected)` guard in `setupListeners()`); add a Jest test (setting `hass` on a disconnected card registers nothing). Browser check: after opening/closing the dialog, disconnected cards hold no listeners; tap/hold on the card still work after view changes.

Suggested commit: `fix: don't register card listeners while disconnected`

### F3. Wheel tick lost at the row edge on fractional DPR

Repro (DPR 1.5, narrow view): wheel a Hue dialog row to its end - `scrollLeft` settles at e.g. 96.67 with a max of 97, so `atEnd` in [src/directives/horizontal-scroll.ts](../src/directives/horizontal-scroll.ts) (`onWheel`) is false; the event is prevented, nothing scrolls, and one wheel tick is lost before the page scrolls.

Proposed: compare with a 1px tolerance (`scrollLeft <= 1` for the start, `scrollLeft >= maxScrollLeft - 1` for the end); extend `tests/horizontal-scroll.test.ts`.

Suggested commit: `fix: tolerate subpixel scroll position at the row edge`

---