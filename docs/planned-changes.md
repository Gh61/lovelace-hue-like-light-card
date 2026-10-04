# Planned Changes

Backlog of changes identified during the codebase analysis that set up the AI development workflow.
Each item is meant to be done as a separate `/task` (unless stated otherwise) and removed from this file (or marked done) when finished.

Only necessary changes (bugs, duplication, rule enforcement) belong here - not feature ideas or optional cleanups.

Legend: **P1** = do next, **P2** = should do.

## Execution order

### Fixes
| # | Fix | Priority | Type |
|---|---|---|---|
| F1 | [Browser Back does not close the Hue dialog](#f1-browser-back-does-not-close-the-hue-dialog) | P1 | `fix` |

---


## Fixes

### F1. Browser Back does not close the Hue dialog

Found on HA 2026.9.4. Repro: open any card's Hue dialog → browser Back → the dialog stays open, history has already moved back, console: `TypeError: haDialog.close is not a function` (`HueDialog.close` ← `HueHistoryStep._onExit` ← `HueHistoryStateManager.resolvePopstate`).

Cause: [src/controls/dialog.ts:254-268](../src/controls/dialog.ts#L254-L268) - `close()` calls `haDialog.close()`, but the current `ha-dialog` (built on `wa-dialog`) has no `close` method (only `open` / `_open` / `_handleHide`). The X button still works - it goes through ha-dialog's own `closed` event.

Proposed: close via the `open` property (`haDialog.open = false`, as `showInternal()` opens it) and verify that `closed` is still fired so `onDialogClose()` runs exactly once; keep compatibility with older HA versions that still have `close()` (call it only when it exists), with an HA version comment. Browser check: Back closes the dialog (also from the light detail: first Back → list, second Back → closed), X button, reopen, no console errors.

Suggested commit: `fix: close the Hue dialog on browser back in new HA`

---