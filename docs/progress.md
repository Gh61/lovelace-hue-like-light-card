# Milestone 2.0 - progress

Working notes for the `milestone/2.0` branch: what differs from `main`, in which state each change is, and what is still open from the [v 2.0.0 milestone](https://github.com/Gh61/lovelace-hue-like-light-card/milestone/4). Update this file when a change is finished or its direction changes; remove items once they are merged into `main` and released.

Baseline: `main` at v1.11.0 (+ fixes), HA frontend source synced to release **20260826.7** (HA 2026.9.x, upstream commit `380e9b5a8`).

## Changes vs. `main`

Status: ✅ done · 🟡 implemented, not verified in HA · 🔧 prepared, unused · ⚠️ needs work

| # | Change | Status | Notes / risks |
|---|---|---|---|
| 1 | `custom-card-helpers` removed; `HomeAssistant` and other HA types come from `src/ha/types` | ✅ | `HomeAssistantEx`, `HassFloorInfo`, `HassAreaInfo` dropped; casts in `hass-ws-client.ts` gone. Leftover: `HassEntityInfo` in `types-hass.ts` is unused. HA split `HomeAssistant` into `HomeAssistantRegistries` / `HomeAssistantApi` / `HomeAssistantFormatters` / ... - our code only uses the combined `HomeAssistant`. |
| 2 | HA frontend source copied into `src/ha/` | ✅ | 93 files (pruned to what the card reaches + the preparations below: dialog manager, `hass-action`, card editor types), 27 of them with minimal local adaptations (commented-out HA-only imports, typing fixes) - `npm run ha-sync -- check` lists them. Unreachable copies (`weather.ts`, `selector.ts`, `cards/types.ts`, `validate-condition.ts`, `notification-manager.ts`, ...) were removed; re-add via the manifest when needed. Bundle: 445 kB (`main`) → 632 kB; the HA theme/font styles (`resources/theme/*`, pulled in by `applyThemesOnElement`) are the main cost. |
| 3 | `ha-sync` tool + vendor branch `ha-upstream` | ✅ | `scripts/ha-sync.mjs`, `src/ha/ha-sync.json`, workflow and baseline rules in [development.md](development.md#ha-source-sync). |
| 4 | #167 - tap/hold through the HA `actionHandler()` directive (card, light tile, scene tile) instead of hammerjs `Press`/`Tap` + `PreventGhostClick` | 🟡 | Not yet tested in HA. Known issues: (a) the directive relies on HA's global `<action-handler>` element - outside a Lovelace dashboard it is not registered and the render throws (`bind is not a function`; tests stub it in `tests/mockup-ha-elements.ts`); (b) `dialog-tile.ts` registers `this.handleAction` as an unbound method (works via `currentTarget`, fragile) while the card uses `@action=` in the template; (c) `actionHandlerConfig` getter duplicated in card and tile; (d) no unit tests for the tap/hold dispatch; (e) hammerjs stays for swipes. The directive copy is a local adaptation (HA's `ActionHandler` class removed, only the lookup of the global element kept); HA 20260826.7 added `resolve`/`keyboardOnly` options and double-tap target handling to the class - irrelevant as long as we use HA's element. |
| 5 | Haptics through HA `forwardHaptic` | ✅ | Local adaptation in `data/haptics.ts` (`node: HTMLElement \| Window`) for the color-temp marker. |
| 6 | Themes through HA `applyThemesOnElement` + `Themes` from `ws-themes` | ✅ | Pulls in `resources/theme/*` and `roboto.ts`; the HA build-time constant `__STATIC_PATH__` is defined in `rollup.config.mjs` (`haDefines`) - without it the card does not load. |
| 7 | HA `computeStateDisplay` as fallback in `hass-text-template.ts` (`ViewUtils.computeStateDisplay`) | ✅ / ⚠️ | Only used for HA < 2023.9 (otherwise `hass.formatEntityState`). Pulls in `format_number`, `format_date*`, `data/sensor*` (~460 lines of constants). Consider dropping the fallback (KISS). |
| 8 | #167 preparation - `handle-action.ts` reduced to firing the `hass-action` event | 🔧 | HA handles `hass-action` in `src/state/action-mixin.ts` (`handleAction`), so the direction is valid. Not used yet - `core/action-handler.ts` is still our own implementation. Local adaptation kept as-is during the HA update (upstream version pulls in dialogs, navigate, sanitize-url). |
| 9 | Native HA dialog - the Hue screen is an HA-managed dialog | 🟡 | `ActionHandler.openHueScreen` fires `show-dialog` (`dialogImport` resolves immediately, the element is in the bundle); `HueDialog` implements `HassDialog<HueDialogParams>` - one element per tag, re-shown with new params, `closeDialog(historyState)` unwinds the levels; the light detail pushes a `dialogData.lightDetail` history state (HA pattern, see `add-automation-element-dialog.ts`); own `history-state-manager.ts` removed. Verified with `npm run ha-test -- dialog`; forward does not re-open a closed dialog (HA semantics). card-mod verified in the testing instance (`npm run ha-test -- cardmod`: theme `card-mod-dialog` styles the `ha-dialog` with class `type-hue-dialog-test`; the previous implementation was not styled at all). Note: card-mod 4.2.1 `-yaml` theme variants are broken on HA 2026.9 (see `test-ha/config/themes/card-mod-test.yaml`). Internal HA API (`make-dialog-manager.ts`), changes between releases. |
| 10 | Build/tooling: `eslint .` + ignore list, babel `env.test`, jest `globals.__STATIC_PATH__`, `clean` script, culori warning filter | ✅ | The `CIRCULAR_DEPENDENCY` filter in `rollup.config.mjs` matches any message containing "culori". |
| 11 | Dependencies: `culori`, `color-name`, `memoize-one`, `superstruct` | ✅ | `superstruct` is used by the copied HA structs (#12); the others by reachable HA code. |
| 12 | Visual card editor (new 2.0 feature) - HA types prepared | 🔧 | Copied for the editor: `components/ha-form/types.ts` (`HaFormSchema`), `data/selector.ts` (selector types incl. `EntitySelector`), `panels/lovelace/types.ts` with `LovelaceCardEditor`, `LovelaceGenericElementEditor`, `LovelaceCardConstructor`, `LovelaceConfigForm` re-enabled, `panels/lovelace/editor/structs/{base-card-struct,action-struct}.ts`, `common/structs/{handle-errors,is-icon}.ts`. No editor code yet - see the work item below. |

## Cleanup backlog (found by the guard agents, not yet done)

- #4: shared constant for the action handler options, arrow-function listener (or `@action=` template binding) in `dialog-tile.ts`, guard for a missing `<action-handler>` element, unit tests for tap/hold on the card and the tiles.
- Formatting `){` in `dialog-tile.ts`, `hue-like-light-card.ts`, `view-utils.ts`; `const` in a `case` clause in `dialog-tile.ts`.
- `HassEntityInfo` (types-hass.ts) unused.
- `docs/coding-guidelines.md` §7: add a row for the HA helpers in `src/ha/`.
- Decide on #7 (drop the `computeStateDisplay` fallback) and on the HA version comments for the `formatEntityState` guards.

## Planned 2.0 work without an issue

### Visual card editor (basis: entity selection)

Goal: `HueLikeLightCard.getConfigElement()` returns an editor element (`hue-like-light-card-editor` + `Consts.ElementPostfix`) that renders HA's `<ha-form>` with a schema; `getStubConfig()` provides a sensible default (first light entity). Start with the entity selection (`entities`, `entity`, `area`, `floor`, `label`) and the title/icon, grow the schema later.

What is prepared in `src/ha/` (#12 above): `HaFormSchema` / selector types for the schema (`{ name: "entities", selector: { entity: { domain: ["light", "switch"], multiple: true } } }`), the `LovelaceCardEditor` / `LovelaceCardConstructor` interfaces, `baseLovelaceCardConfig` + `superstruct` for validating the incoming config (`assert(config, struct)`), `handleStructError` for user-friendly validation messages, `fireEvent` for the `config-changed` event.

Still needed in our code:
- `interface ConfigChangedEvent { config; error?; guiModeAvailable? }` + `HASSDomEvents["config-changed"]` declaration (HA defines it in `hui-element-editor.ts`, a full component - not copied).
- `<ha-form>` (and the selectors it renders, e.g. `ha-selector-entity`) are HA runtime elements loaded lazily by the dashboard editor. Other cards force-load them before rendering: `const helpers = await window.loadCardHelpers(); helpers.createCardElement({ type: "entities", entities: [] }).constructor.getConfigElement();` - isolate this HA-internals hack with the HA version comment (guidelines §6).
- The card's config parsing (`HueLikeLightCardConfig`) must stay the single source of truth; the editor only edits the raw YAML object (`HueLikeLightCardConfigInterface`) and the preview re-parses it. Mind the camelCase option names - HA's `computeLabel` needs our own labels (localization keys `editor.*`).
- Tests: schema/stub config, struct validation; browser test of the editor dialog on the testing dashboard.

## Open milestone issues not covered yet

Issues of the [v 2.0.0 milestone](https://github.com/Gh61/lovelace-hue-like-light-card/milestone/4) that have no implementation on this branch yet (due 2026-12-31):

| Issue | Summary | Relation to the current changes |
|---|---|---|
| [#167](https://github.com/Gh61/lovelace-hue-like-light-card/issues/167) Extend and standardize actions | `tap_action` / `hold_action` / `double_tap_action` with all HA actions (`more-info`, `toggle`, `call-service`, `navigate`, `url`, `assist`, `none`) plus card actions (`turn-on`, `turn-off`, `scene`, `hue-screen`); `on_` / `off_` prefixed variants; old options deprecated but working | Gesture detection is done (#4 above); the config options, the `hass-action` dispatch (#8) and the HA action set are still missing. |
| [#424](https://github.com/Gh61/lovelace-hue-like-light-card/issues/424) Frontend performance degradation | Dialog attached without the HA dialog manager (card_mod can't style it), work done on update without config/hass, a temporary `ha-card` created only to read styles, `--ha-dialog-border-radius` set globally | First point done by #9 (HA dialog manager); remaining: update work without config/hass, the temporary `ha-card` for reading styles, `--ha-dialog-border-radius` (set on the dialog element only - verify). |
| [#261](https://github.com/Gh61/lovelace-hue-like-light-card/issues/261) Brightness slider turns on lights that a scene switched off | Slider should only change lights that are currently on (Hue app behavior) | Not started - `AreaLightController` brightness handling. |
| [#361](https://github.com/Gh61/lovelace-hue-like-light-card/issues/361) Expand group members under Lights | With `groupEntity` / a light group entity, show the member lights instead of the group | Not started - entity resolution in `config.ts` (group `entity_id` attribute). |
| [#389](https://github.com/Gh61/lovelace-hue-like-light-card/issues/389) Frosted Glass theme | Card background does not follow the light color with that theme | Not started - theme / CSS variable interplay (`ThemeHelper`, `ViewUtils` background). |
| [#398](https://github.com/Gh61/lovelace-hue-like-light-card/issues/398) Disabled entities in areas | Area with disabled lights throws "Entity ... not found in states"; ignore (or gray out) disabled entities | Not started - `hass-ws-client.ts` / `config.init` area loading; `hass.entities[*].disabled_by` is available via the HA types now. |
| [#460](https://github.com/Gh61/lovelace-hue-like-light-card/issues/460) Correct entity icons | Use the entity's HA icon (incl. domain/device-class defaults) instead of the generic bulb | Not started - `IconHelper`; HA's `entity_icon` / `stateIcon` helpers could be added to the manifest. |
| [#358](https://github.com/Gh61/lovelace-hue-like-light-card/issues/358) Multiple rows of lights | Option to wrap light tiles into several rows instead of horizontal scroll | Not started - `HueDialog` layout / `horizontalScroll` directive. |
