## GETTING STARTED

Only use the following Git Commit Messages. A simple and small footprint is critical here.

1. 🌟 `feat` Use when you add something entirely new. E.g: `feat(Button): add type props.`
2. 🐞 `fix` Use when you fix a bug — need I say more? E.g. `fix: Case conversion.`
3. 📖 `doc`/`docs` Use when you add documentation like README.md, or even inline docs. E.g. `doc(Color): API Interface.`
4. 💄 `chore` Changes to the build process or auxiliary tools. E.g. `chore(Color): API Interface.`
5. 🎨 `style` Format (changes that do not affect code execution). E.g. `style(Alert): API Interface.`
6. 🆎 `type` Typescript type bug fixes. E.g. `type(Alert): fix type error.`
7. ⛑ `test` Add and modify test cases. E.g. `test(Alert): Add test case.`
8. 🐝 `refactor` Refactoring (i.e. code changes that are not new additions or bug fixes). E.g. `refactor(Alert): API Interface.`
9. 🌍 `website` Documentation website changes. E.g. `website(Alert): Add example.`
10. 🔙 `revert` Revert last commit. E.g. `revert: Add test case.`
11. 💊 `clean` clean up. E.g. `clean: remove comment code.`
12. 📈 `perf` Change the code to improve performance. E.g. `perf: optimalize search.`
13. 💢 `ci` Continuous integration related file modification. E.g. `ci: Update workflows config.`
14. 🧯 `build` Changes that affect the build system or external dependencies (example scopes: gulp, webpack, vite, npm)

```shell
<type>(<scope>): <short summary>
  │       │             │
  │       │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │
  │       └─⫸ Commit Scope: animations|bazel|benchpress|common|compiler|compiler-cli|core|
  │                          elements|forms|http|language-service|localize|platform-browser|
  │                          platform-browser-dynamic|platform-server|router|service-worker|
  │                          upgrade|zone.js|packaging|changelog|docs-infra|migrations|ngcc|ve|
  │                          devtools....
  │
  └─⫸ Commit Type: build|ci|doc|docs|feat|fix|perf|refactor|test
                    website|chore|style|type|revert
```

## Scope

The scope is the GitHub issue the change belongs to, written as `#<number>` - GitHub then links the commit to the issue:

- `fix(#398): skip entities without a state when loading an area`
- `feat(#167): standard HA actions for the card`
- `doc(#167): README.md formatting`

A change without an issue uses a short area name as the scope (e.g. `doc(progress)`, `build(ha)`) or no scope at all.

Source: https://github.com/jaywcjlove/changelog-generator#getting-started