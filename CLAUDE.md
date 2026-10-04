# CLAUDE.md

Hue-Like Light Card - a Home Assistant Lovelace custom card (TypeScript + Lit, bundled by Rollup, distributed via HACS).

- Development guide (setup, scripts, architecture, release): [docs/development.md](docs/development.md)
- Coding rules (mandatory): [docs/coding-guidelines.md](docs/coding-guidelines.md)
- Commit messages: [COMMIT.md](COMMIT.md)
- Backlog of known issues and planned cleanups: [docs/planned-changes.md](docs/planned-changes.md)

## Language & written rules

Everything written into the repository is **English**: code, comments, docs, commit messages, agent/skill instructions. (The conversation with the developer may be in any language.)

Documentation, agent and skill files state only the **currently valid** rules - no dates, no "decided that ..." remarks, no changelog-style notes. When a rule changes, rewrite the sentence; the history is in git.

Rules that apply to the repository as a whole live in the repository (`CLAUDE.md`, `docs/`, `.claude/`), not in the AI's local memory - if something seems worth remembering, put it into the matching file here. The local memory is only for preferences of the individual developer (e.g. their language, their environment).

## Workflow - always use `/task`

All AI development in this repository is done through the **`/task`** skill:
investigate → ask questions (AskUserQuestion) → implement → `/verify` (guard agents incl. browser test on the testing dashboard) → hand-off for developer review.

Allowed exceptions (state the reason when skipping `/task`):
- answering questions / explaining code without changing it,
- trivial non-code edits (typo in docs, comment wording),
- the developer explicitly asks to skip it.

`/verify` runs the guard agents on the current changes:

| Agent | Checks |
|---|---|
| `build-test-verifier` | `npm run lint`, `npm run rollup`, `npm test`, test coverage of changed logic |
| `conventions-reviewer` | diff vs. [coding-guidelines](docs/coding-guidelines.md) (OOP, DRY, KISS, naming, Lit rules, teardown) |
| `consistency-checker` | config option ↔ types/parsing/tests/README, localization keys, `Consts`, Dev flags/version untouched |
| `browser-tester` | changed behavior and design on the HA testing dashboard, console errors - a regular part for every change that can affect the UI; skipped only for changes that can't (docs, tests, build config) |

## Hard rules

- **Browser testing scope:** in Home Assistant, navigate **only** within the developer's testing dashboard and its views. Never open other dashboards, settings, entity/device configuration, or anything else - regardless of the URL given. The testing dashboard itself may be edited (e.g. temporary test cards), but must always be restored exactly to its original state. The testing URL comes from the developer: stored in `.claude/testing-dashboard.local.json` (asked once, then reused and printed in every task plan) - never guess one.
- Never change `Consts.Dev`, `var dev` in `rollup.config.mjs`, or version strings - the release workflow does that. Never add, remove or reorder keys above `version` in `package.json` / `package-lock.json` - the workflow replaces the version by line number.
- Don't commit or push unless the developer asks. Commit format per [COMMIT.md](COMMIT.md).
- New UI texts go into `src/localize/languages/en_us.json` only; translations into other languages only on request as the last step.
- `npm run lint`, `npm run rollup` and `npm test` must pass before a task is done.

## Commands

```shell
npm start          # watch build + dev server http://127.0.0.1:5500 (dev card: custom:hue-like-light-card-test)
npm run lint       # / npm run lintfix
npm run rollup     # build to ./dist
npm test           # jest
```
