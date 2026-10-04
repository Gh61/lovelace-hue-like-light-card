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

---


## Fixes

### F4. Card keeps listening to the replaced controller

Repro: call `setConfig()` again on a connected card (e.g. the card editor preview while editing YAML); the card stops reacting to light changes.

Cause: [src/hue-like-light-card.ts](../src/hue-like-light-card.ts) - `useInitializedConfig()` replaces `_ctrl` with a new `AreaLightController`, but `_ctrlListenerRegistered` stays `true`. `setupListeners()` never registers on the new controller, and the old controller keeps the card's callback (and the card) alive.

Proposed: before replacing `_ctrl`, unregister from the old controller and reset `_ctrlListenerRegistered` (then `updated()` registers on the new one); add a Jest test (after a second `setConfig()`, the new controller has the card's callback and the old one doesn't).

Suggested commit: `fix: re-register card listener when the controller is replaced`

---
