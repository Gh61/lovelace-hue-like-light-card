# Coding Guidelines

Rules every change (human or AI) must follow. They describe how this codebase is actually written - when in doubt, look at the surrounding code and match it.
Rules marked **[lint]** are enforced by ESLint/TypeScript; the rest are checked in review (and by the `conventions-reviewer` / `consistency-checker` agents).

## 1. Principles

- **English only** - code, identifiers, comments, docs, commit messages.
- **KISS** - the simplest solution that works. No speculative abstractions, options or "future-proofing" (YAGNI).
- **DRY** - before writing a helper, search for an existing one (see [§7 Reuse](#7-reuse-before-you-write)). Do not add another copy of duplicated code; if you touch duplicated code, prefer consolidating it.
- **OOP** - logic lives in classes with clear responsibility and encapsulated state. Program against interfaces (`types/types-interface.ts`) where they exist.
- **Small, focused changes** - one concern per change. Don't reformat or refactor unrelated code.
- **Backward compatibility** - existing YAML configurations must keep working. A removed option stays documented (strikethrough) in README.
- **README is for users** - it describes what the user sees and configures (options, behavior, examples), never internal technical solutions (how values are queued, cached, synchronized, ...). Internals belong to code comments and `docs/`. A behavior change that the user doesn't notice needs no README update.
- **Home Assistant compatibility** - HA frontend changes often; workarounds for a specific HA version must have a comment with the HA version (e.g. `// since HA 2026.5`).

## 2. Formatting

- 4 spaces indentation, `SwitchCase: 1` **[lint]**
- LF line endings **[lint]**; final newline (`.editorconfig` only, not linted)
- Single quotes for strings (double quotes only to avoid escaping) **[lint]**
- Semicolons at statement ends **[lint]**
- No trailing commas **[lint]**
- Stroustrup brace style - `else` / `catch` on a new line after `}` **[lint]**
- Single-statement guard `if`s may omit braces (`if (!hass)\n    return;`); multi-line bodies use braces
- `===` / `!==`; `== null` / `!= null` is allowed for "null or undefined" checks **[lint]**
- Type assertions: `value as Type`, never `<Type>value` **[lint]**
- Comments: `// text` (with a space) for regular comments; `//code()` (no space) only for commented-out code
- Regions: `//#region Name` ... `//#endregion` to group larger classes
- Run `npm run lintfix` before finishing

## 3. Naming

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case; type-only files `types-*.ts` | `area-light-controller.ts`, `types-config.ts` |
| Classes | PascalCase; UI/feature classes often `Hue` prefix | `HueDialog`, `LightController` |
| Behavioral interfaces | `I` prefix | `ILightContainer`, `INotify` |
| Data/HA shape interfaces | no prefix | `HassLightAttributes` |
| Event detail interfaces | `I...EventDetail` | `ITileEventDetail` |
| Unions / aliases | `type` | `ColorMode`, `MaybeArray<T>` |
| Methods / functions | camelCase, verb first | `getTitle`, `isOn`, `tryLoadAreaInfo`, `ensureHass` |
| Private / protected instance fields | `_camelCase` | `_hass`, `_elementId` |
| Static constants (`static readonly` values, public or private) | PascalCase, no underscore | `Consts.HueBorderRadius`, `IconHelper.DefaultOneIcon` |
| Static state (mutable static fields, mutated static collections, singletons) | `_camelCase` | `HueHistoryStateManager._instance`, `GlobalLights._containers` |
| Enums | PascalCase name & members, kebab-case string values | `ClickAction.TurnOn = 'turn-on'` |
| Unused parameters | `_` prefix **[lint]** | `(_ev) => ...` |
| YAML config keys | camelCase | `offClickAction`, `sceneProvider` |
| HA-derived names | keep HA snake_case | `entity_id` |
| Custom events | kebab-case / DOM-like | `selected-change`, `immediate-value-change` |
| CSS custom properties | `--hue-` prefix | `--hue-tile-accent-color` |

A new **static** `_field` must be added to the `no-underscore-dangle` allow-list in `eslint.config.mjs` **[lint]** - the rule only allows `_x` after `this`, and static members are accessed as `ClassName._x`.

## 4. TypeScript & OOP

- Explicit accessibility on every member, constructors included (`public constructor`) **[lint]**
- `override` keyword on overridden members **[lint]** (`noImplicitOverride`)
- Static members accessed via `ClassName.member`, never `this.member` **[lint]**
- Encapsulate state: private `_field` + public getter/setter; `readonly` for anything that does not change
- Static-only helper classes (`ViewUtils`, `ThemeHelper`, `IconHelper`) for grouped utilities; free functions only in small utility modules (`types/extensions.ts`, `types/functions.ts`)
- Use the shared function types `Action`, `Action1<T>`, `Func<T>`, ... from `types/functions.ts` instead of inline function types
- Use `nameof<T>('prop')` instead of string literals for property names (`requestUpdate`, `raisePropertyChanged`)
- Explicit `T | null` return types where null is possible; `?.` / `??` for null handling
- No `any` unless unavoidable (and then commented)
- JSDoc (`/** ... */`, with `@param` / `@returns` / `@throws` where useful) on public API, interfaces and non-obvious methods; short `//` comments explain **why**, not what

## 5. Error handling & logging

- Invalid input → `throw new Error(...)` with a descriptive message that includes the bad value (and allowed values for enums - see `tryParseEnum` in `types/config.ts`)
- The card renders errors through `ErrorInfo` / `catchErrors` - don't swallow errors from config parsing
- Async loaders: log the original error (`log.error(message, error)`), rethrow a user-friendly `Error`; non-critical loaders may only log
- All logging goes through `ConsoleLogger` (`core/console-logger.ts`) - one module-level `const log = new ConsoleLogger('Category');` per file (plus sub-category loggers derived from it for noisy detail, e.g. `const hassLog = log.subCategory('Hass');`); direct `console.*` calls are not allowed **[lint]** (exceptions: the logger itself and the version banner)
- Categories are hierarchical, separated by `.` (`HueNotify.Hass`) - a category without its own level inherits the level of its nearest parent, then `default`
- Levels per category are configured in `src/logging.json` (`dev` / `prod` variant picked by `Consts.Dev`); noisy detail goes into a sub-category that can be switched off on its own
- Messages that are expensive to build (frequent calls, string interpolation) are passed lazily: `log.debug(() => \`...\`)`

## 6. Lit components

- Register with `@customElement(X.ElementName)` and `public static readonly ElementName = 'hue-<name>' + Consts.ElementPostfix;` - never hard-code a tag name
- Render child custom elements via `unsafeStatic(X.ElementName)` with `html` from `lit/static-html.js`
- Subclassed elements extend the parent name (`HueDialogTile.ElementName + '-light'`)
- Elements that subscribe to controllers extend `IdLitElement` and use `this._elementId` as the subscription id
- Subscribe in `connectedCallback` / `updated`, **always** unsubscribe in `disconnectedCallback` (controllers are shared globally via `GlobalLights`)
- Every `addEventListener` needs a matching `removeEventListener` in the teardown path; directives that hold resources must be `AsyncDirective` with `disconnected()` cleanup (see `horizontalScroll()`)
- Styles: `static override styles = css\`...\`` (or a getter composing base styles); values from `Consts` via `unsafeCSS(...)`; inline styles only for runtime values (`styleMap`, `style.setProperty`)
- CSS custom properties: `--hue-*` prefix and always a fallback: `var(--hue-x, ${unsafeCSS(Consts.Y)})`
- **Never name a method `updateStyles`** (HA calls it) - use `updateStylesInner`
- Custom events: `this.dispatchEvent(new CustomEvent<IXEventDetail>('kebab-name', { detail }))`; export the detail interface
- Gestures: hammerjs `Manager` + `PreventGhostClick`; drag via `PointerDragHelper`; horizontal wheel scroll via the `horizontalScroll()` directive; back-button support via `HueHistoryStateManager`
- Hacks reaching into HA internals (shadow roots, private APIs) must be isolated, commented with the HA version and fail gracefully

## 7. Reuse before you write

| Need | Use |
|---|---|
| Colors, conversions, luminance, foreground | `core/colors/color.ts` (`Color`), `color-extended.ts`, `color-resolvers.ts` |
| Gradients / tile background | `core/colors/background.ts` |
| Switch / slider templates, background & shadow calculation, icon size | `core/view-utils.ts` (`ViewUtils`) |
| Theme handling | `types/theme-helper.ts` (`ThemeHelper`) |
| Auto icons | `core/icon-helper.ts` |
| Text templates `{{entity.attr}}` | `core/hass-text-template.ts` |
| Light capabilities | `core/light-features.ts` |
| HA WebSocket queries | `core/hass-ws-client.ts` |
| Wait until an element is displayed (has size) | `core/display-observer.ts` (`DisplayObserver`) |
| Live updates while dragging (one call in flight, newest value wins, value pinning) | `core/live-update-session.ts` (`LiveUpdateSession`) |
| Sequenced animations | `core/effect-queue.ts` (`HueEffectQueue`) |
| Unique element id | `core/id-lit-element.ts` |
| Property change notifications | `core/notify-base.ts` |
| Console logging with categories and levels | `core/console-logger.ts` (`ConsoleLogger`), config `src/logging.json` |
| Array/entity helpers, `nameof` | `types/extensions.ts` |
| Function types, `noop` | `types/functions.ts` |
| Constants, colors, element names | `types/consts.ts` (`Consts`) |
| Dialog tiles | subclass `HueDialogTile` / `HueDialogSceneTile` |
| Embedded images | `controls/control-resources.ts` |
| Translations | `localize()` in `localize/localize.ts` |

## 8. Configuration options

A new or changed YAML option touches, together:

1. `src/types/types-config.ts` - `readonly option?:` in the raw config interface (+ enum if needed)
2. `src/types/config.ts` - `public readonly` field on the parsed class, default (from `Consts`) and validation in the constructor
3. The consumer in `core/` / `controls/`
4. `tests/config-parse.test.ts` - default, valid, invalid values
5. `README.md` - row in the HTML `<table>` (`Key | Type | Required | Since | Default | Description`), `Since` = next version without `v` (e.g. `1.12.0`); optional subsection with `*Since version x.y.z*` and YAML example; removed options stay with `<s>` strikethrough and "removed in x"

## 9. Localization

- `localize(hassOrLanguage, 'key', search?, replace?)`; the key type comes from `en_us.json`
- Keys: flat dotted names (`dialog.lights`, `card.description.someLightsAreOn`), files kept alphabetically sorted, 2-space indent, final newline
- A new key is added to **`en_us.json` only** during development. English is the per-key fallback for every language.
- Translations into the other languages are done **only on request, as the last step** of a change (when texts are final), typically as the last commit.
- `en_gb.json` follows `en_us.json` unless British spelling differs.
- Keys `effects.*` and `scenes.preset.*` are **reserved** - prepared texts for a future effects implementation. They are intentionally unused; don't remove or report them.

## 10. Tests

- Add/extend Jest tests for logic: config parsing, colors, controllers, helpers, pure methods of controls
- `tests/<subject>.test.ts`, `describe` + `it('should ...')`, reuse `test.helper.ts` / `mockup-*.ts`
- UI behavior that can't be unit tested is verified in the browser on the testing dashboard

## 11. Never

- Change `Consts.Dev`, `var dev` in `rollup.config.mjs` or version strings
- Add, remove or reorder keys above `version` in `package.json` / `package-lock.json` (the release workflow replaces the version by line number)
- Commit `dist/` or `release/`
- Hard-code custom element tag names
- Leave listeners / subscriptions without teardown
- Add a dependency without a strong reason (the card ships as a single bundle)
- Use non-testing Home Assistant dashboards or change HA configuration while testing (the testing dashboard may be edited, but must always be restored to its original state)
- Skip the browser test when the change can affect the UI (design or behavior) - the browser test exists exactly for such changes; it may be skipped only for changes that cannot touch the UI at all (docs, tests, build config)
