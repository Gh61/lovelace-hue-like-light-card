# Live updates while dragging - progress

Working notes for the `feat/live-updates` branch. Delete this file before merging.

Inspired by PR #474 (Thomas Mutzl), rewritten from scratch - credit him in the final commit:
`Co-authored-by: Thomas Mutzl <thomas@mutzl.com>`

## Current state (implemented, verified)

- Config option `liveUpdateInterval` (ms, default `Consts.LiveUpdateInterval` = 300, `0` = only the final value on release; negative / non-number throws). README row + "Live updates" section (Since 1.12.0).
- `src/core/live-update-throttle.ts` - `LiveUpdateThrottle<T>`:
  - `update(value, apply)` during drag: pins the value, applies at most once per interval (leading + trailing, latest value wins).
  - `commit(value, apply)` on release: cancels pending update, applies immediately, keeps the value pinned for `Consts.LiveUpdateHoldTime` (1500 ms; also a watchdog when the drag never finishes).
  - `stop()` on teardown. Interval 0 = old behavior (no pin, only commit).
- Wiring:
  - Card + dialog header slider: `ViewUtils.createSlider(..., throttle)`; ha-slider `input`, mushroom `current-change`. Card and dialog own their throttle and stop it on teardown.
  - Light detail: brightness rollup (drag + wheel) and color picker markers (one throttle per light in `LightMarkerManager`, marker state from HA ignored while pinned; only `immediate-value-change` of a dragged marker counts).
  - Brightness 0 is never sent during sliding (groups + `allowZero` would turn on lights that were off) - only on release.
  - Commit skips the service call when the controller already has the value (single click fired `input` + `change`).
  - Rollup: external value set no longer fires `immediate-value-change`; external value is ignored during interaction; wheel submit timeout id is reset after firing (was a bug).
- Tests: `live-update-throttle.test.ts`, `brightness-rollup.test.ts`, `config-parse.test.ts`. Lint / rollup / test pass; guard agents + browser test passed on the testing dashboard.

## Decisions made with the developer

- Option name `liveUpdateInterval` (generic - covers slider, color picker and rollup, not only the slider).
- All three controls get live updates in one change, one shared throttle class.
- Groups / `allowZero`: never send 0 while sliding (chosen over "live updates only for single lights").
- Hold the shown value ~1.5 s after release (`Consts.LiveUpdateHoldTime`, internal, not configurable).
- On release the final value is sent **immediately** (commit cancels the pending trailing update, no waiting for the interval).
- Commits without scope (`feat: ...`, not `feat(#474): ...`).
- Throttle state is owned by the rendering element (card, dialog, light detail), not global state (the reason PR #474's `WeakMap` in `ViewUtils` was rejected).

## Changed files

`src/core/live-update-throttle.ts` (new), `src/core/view-utils.ts`, `src/hue-like-light-card.ts`, `src/controls/dialog.ts`, `src/controls/light-detail.ts`, `src/controls/brightness-rollup.ts`, `src/types/{config,types-config,consts}.ts`, `tests/{live-update-throttle,brightness-rollup,config-parse}.test.ts`, `README.md`, `docs/{coding-guidelines,development}.md`.

## Testing tips

- Ctrl+Shift+R does not refresh the dev-server script in HA - use `fetch('<devServerUrl>/hue-like-light-card.js', {cache:'reload'})` in the page, then reload. Check that cards have `_config.liveUpdateInterval`.
- To see what is sent to HA: hook `hass.connection.sendMessagePromise` and log `call_service` messages with timestamps (also measure when each promise resolves - needed for next step 1).
- The browser tool can't do a slow real drag - slow drags are simulated with pointer/mouse events; the developer has to verify real dragging by hand.

## Open questions

- Is "Pracovna" a single Hue light or a Hue group (room/zone, `grouped_light`)? Groups are limited to ~1 command/s by the bridge.

## Feedback from real testing (developer's home HA, single light "Pracovna")

1. 300 ms is too fast (or something else goes wrong on top of it).
2. 500 ms is better, but after a while HA / Hue seems flooded: sliding 80 -> 20 -> 80 -> 20 ends with the slider on 20 and the light on 80 (or the other way round), taking ~5 s to settle.
3. Repeating it queues the changes somewhere - the light keeps "blinking" through old values for 15+ s.
4. Possibly worse with DevTools open (lots of console noise - ~450 `[Hue.LimitedTimeout] Maximum timeout limit 20 reached` warnings per test run, from `updateStylesInner` retrying on hidden cards).

## Research - likely root cause

- Hue bridge handles ~10 commands/s to `/lights` (≥100 ms gap) and only **~1 command/s to groups** (`grouped_light` = Hue rooms/zones). The limit is bridge-wide (all apps together). Over the limit the bridge answers HTTP 429.
  - https://huelog.app/help/philips-hue-bridge-api-429-too-many-requests
  - https://github.com/home-assistant/core/issues/60745
- HA's Hue integration (aiohue) **does not drop** a refused command: on 429/503 it retries up to 25× with growing backoff over a pool of 3 connections, so a backlog builds up and drains **in no guaranteed order** - exactly the "settles on an old value seconds later / blinks for 15 s" symptom.
  - https://github.com/home-assistant/core/issues/126796
  - https://github.com/silverShnoop/ha-spectra-cards/pull/16 (same problem in another card, solved below)
- Fire-and-forget at a fixed rate cannot work reliably: the safe rate depends on the bridge, other apps and whether the entity is a group.

## Next steps

1. **Backpressure instead of a fixed rate** (main fix): per entity at most **one service call in flight**; the next one is sent only after the previous `callService` promise resolves (WS `call_service` is blocking in HA, so it resolves after the integration finished the call). Values in between are **skipped, newest wins**; `liveUpdateInterval` stays as a minimum gap. The final value on release joins the same chain (sent after the in-flight call, never overtaken by older steps).
   - Needs the controllers to expose the service-call promise (`LightController` setters are fire-and-forget now; `AreaLightController` fans out to several lights - wait for all).
   - Check whether the entity is a Hue group (`grouped_light`, `is_hue_group` attribute) - may need a bigger minimum gap.
2. Re-test on the developer's HA with DevTools closed and open; measure call -> response times (the browser-tester hook on `hass.connection.sendMessagePromise` works well for this).
3. Reduce console noise: the `LimitedTimeout` warning flood from `updateStylesInner` on hidden cards (existing issue, made much worse by live updates).
4. **Instant UI propagation** (after 1-3 work): every value change during drag should update all other sliders/cards on the page immediately (optimistic local state via the shared controller in `GlobalLights` + property-changed notification), while only the real service call is throttled. Needs a controller API that sets the optimistic state without calling HA.
5. Minor leftovers: merged color marker lights differ slightly mid-drag (own timer per light); mouse wheel over the open rollup also scrolls the dashboard behind the dialog (check if pre-existing).
6. Before merge: delete this file, update README if behavior/defaults change, final commit(s) with the co-author line.
