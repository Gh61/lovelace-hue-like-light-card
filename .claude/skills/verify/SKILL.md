---
name: verify
description: Run the guard agents (build-test-verifier, conventions-reviewer, consistency-checker, browser-tester) on the current changes of the Hue-Like Light Card and produce one consolidated report.
argument-hint: "[base-ref] (--browser <dashboard-url> <scenarios> | --no-browser <reason>)"
---

# /verify

Verify the current changes with the guard agents in `.claude/agents/`. Arguments: `$ARGUMENTS`

## 1. Scope

- Default scope: uncommitted changes (`git status --porcelain`, `git diff HEAD`).
- If a base ref is given in the arguments (e.g. `main`), the scope is `git diff <base>...HEAD` plus uncommitted changes.
- If there are no changes in scope, say so and stop.

## 2. Browser test inputs

The browser test is a **regular part** of `/verify`, not an optional extra. It is skipped only when the change cannot affect anything observable in the UI (design or behavior) - e.g. docs, tests, build config, comments.

- `--browser <dashboard-url> <scenarios>` - run `browser-tester` with this URL and these scenarios.
- `--no-browser <reason>` - skip the browser test; the reason is printed in the report.
- Neither given and the change can affect the UI: take `dashboardUrl` from `.claude/testing-dashboard.local.json` (the developer's stored testing dashboard) and derive the scenarios from the diff; print the URL you are going to use. If the file does not exist, **stop and ask** for the URL - never invent one.
- Neither given and the change cannot affect the UI: treat it as `--no-browser` and state the reason yourself.

Before launching `browser-tester`, make sure the dev server runs: read `devServerUrl` from `.claude/testing-dashboard.local.json` (fallback `http://127.0.0.1:5500`) and request `<devServerUrl>/hue-like-light-card.js`. If it does not respond, start `npm start` in the background and wait for the first build to finish.

## 3. Run the guard agents in parallel

Launch all agents **in a single message** (parallel), each with the scope description and a one-paragraph summary of the intent of the change (when known):

- `build-test-verifier`
- `conventions-reviewer`
- `consistency-checker`
- `browser-tester` (unless skipped per §2) - pass the dashboard URL, the dev server URL, the scenarios and the expected behavior.

If `browser-tester` reports it has no access to the browser tools, perform the browser test yourself in the main session following `.claude/agents/browser-tester.md` exactly (including all safety rules).

## 4. Consolidated report

```
## /verify result: PASS | ISSUES

| Agent | Verdict | Blockers | Major | Minor |
|---|---|---|---|---|
| build-test-verifier | ... | | | |
| conventions-reviewer | ... | | | |
| consistency-checker | ... | | | |
| browser-tester | PASS / ISSUES / BLOCKED / skipped (<reason>) | | | |

### Blockers & major findings
- [agent] path:line - finding → fix

### Minor findings
- ...
```

Deduplicate findings reported by more than one agent. Do **not** fix anything in `/verify` itself - fixing is the caller's job (`/task` fixes and re-runs).
