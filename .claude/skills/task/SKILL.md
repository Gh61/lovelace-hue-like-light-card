---
name: task
description: The standard AI development workflow for the Hue-Like Light Card - investigate, ask questions, implement, verify with guard agents (including the browser test on the HA testing dashboard), hand off for developer review. Use for every code change in this repository.
argument-hint: "<task description or GitHub issue>"
---

# /task

Task: `$ARGUMENTS`

Follow the phases in order. Keep the developer informed with short status lines between phases. Write everything into the repository in English; talk to the developer in their language.

## Phase 1 - Investigate

1. Re-read `CLAUDE.md` and `docs/coding-guidelines.md` (the rules are mandatory).
2. If the task references a GitHub issue (`#123`), read it with `gh issue view 123`.
3. Find all relevant code. Use the `Explore` agent for broad searches (several in parallel for independent areas); read the key files yourself.
4. Identify: affected files, existing helpers to reuse (guidelines §7), change sets that must move together (§8 config, §9 localization, tests, README), risks (HA compatibility, shared controllers, listeners teardown).

## Phase 2 - Questions

Use **AskUserQuestion** for every decision that is genuinely the developer's (behavior, UX, naming of config options, scope, trade-offs). Put the recommended option first. Don't ask what the code or guidelines already answer.

Testing environment (`.claude/testing-dashboard.local.json`, gitignored, per developer: `{ "dashboardUrl": "...", "devServerUrl": "http://127.0.0.1:5500" }`):
- If the file exists, use its values **without asking** - the developer's environment does not change between tasks. The dashboard URL is printed in the plan below so the developer sees it; if they want to test elsewhere, they say so and you update the file.
- If the file does not exist, ask for the testing dashboard URL with AskUserQuestion and save it (together with `devServerUrl`, which is where `npm start` serves the build - it only changes together with `rollup.config.mjs`).
- Offer "Skip browser test" **only** if the change cannot affect anything observable in the UI (design or behavior) - e.g. docs, tests, build config.

Also ask (when relevant): the GitHub issue number for the commit scope.

Then present a short plan (files to change, approach, tests, docs, browser scenarios, **testing dashboard URL that will be used**) - as a normal message, not a question.

## Phase 3 - Implement

- Follow the coding guidelines; match surrounding code.
- Keep the change focused (no unrelated refactoring/reformatting).
- Add/extend Jest tests for logic; update README for user-visible changes / options (user view only, no internals - guidelines §1); new UI texts only into `en_us.json`.
- If a new decision appears mid-way, **stop and ask** with AskUserQuestion - don't guess.
- Run `npm run lintfix` at the end of implementation.

## Phase 4 - Verify (guard agents + browser test)

Run `/verify` - it launches all four guard agents (build-test-verifier, conventions-reviewer, consistency-checker, browser-tester) and handles the dev server check. Pass:

- `--browser <dashboard URL from Phase 2> <scenarios>` - what changed and concrete scenarios with expected results, including regression scenarios for nearby features and a narrow viewport when layout is affected; or
- `--no-browser <reason>` - only when the developer chose "Skip browser test" in Phase 2.

Fix every blocker and major finding, then re-run the agents whose checks failed (browser-tester again after any UI-relevant fix). Repeat until clean (max 3 rounds - then report the remaining issues to the developer instead of looping). Minor findings: fix if trivial, otherwise list them in the hand-off.

## Phase 5 - Translations (only if `en_us.json` changed)

Ask with AskUserQuestion whether to translate the new/changed keys into the other languages now (recommended only when texts are final - usually as the last commit) or leave the English fallback.

## Phase 6 - Hand-off for developer review

Finish with a concise report:

1. **What changed** - files with clickable links and one line each.
2. **Decisions made** - including answers from the question rounds.
3. **Verification** - lint / build / tests / guard agents / browser results (honest: what failed, what was skipped and why).
4. **Please check manually** - concrete checklist for the developer:
   - code spots worth a careful look (link to lines),
   - browser scenarios to try on the testing dashboard (including edge cases the agent could not cover: other themes, mobile, HA more-info, back button).
5. **Suggested commit(s)** per `COMMIT.md` (e.g. `fix(#123): ...`, separate `doc(#123): ...` for README).

If you discovered new **necessary** issues out of scope (bugs, duplication, rule violations - not feature ideas or optional cleanups), list them in the hand-off so the developer can decide how to track them.

Do **not** commit or push unless the developer asks.
