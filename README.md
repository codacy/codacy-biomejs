# Codacy Biome

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/)](https://app.codacy.com/gh/codacy/codacy-biomejs/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![CircleCI](https://circleci.com/gh/codacy/codacy-biomejs.svg?style=svg)](https://circleci.com/gh/codacy/codacy-biomejs)

A Codacy tool wrapper for [Biome](https://biomejs.dev/) — a fast linter and formatter for JavaScript, TypeScript, JSX, and JSON.

## Getting started

Install dependencies:

```shell
npm run init
```

## Generating documentation

```shell
npm start -w docs-generator
```

This fetches Biome's rule metadata from GitHub, then generates:

- `docs/patterns.json` — all Biome lint rules with Codacy category/level mappings
- `docs/description/description.json` — rule titles and descriptions
- `docs/description/<patternId>.md` — individual rule documentation pages
- `docs/multiple-tests/all-patterns/patterns.xml` — test helper listing all patterns

## Pattern ID mapping

Biome rule IDs follow the format `lint/<group>/<ruleName>` (e.g. `lint/suspicious/noDoubleEquals`).
Codacy uses underscores as separators, so the Codacy pattern ID is `lint_suspicious_noDoubleEquals`.

Biome rule groups and their Codacy mappings:

| Biome group    | Codacy category  | Codacy level |
|----------------|------------------|--------------|
| `correctness`  | ErrorProne       | Error        |
| `suspicious`   | ErrorProne       | Warning      |
| `security`     | Security         | Error        |
| `complexity`   | CodeStyle        | Warning      |
| `style`        | CodeStyle        | Info         |
| `performance`  | Performance      | Warning      |
| `a11y`         | Compatibility    | Warning      |
| `nursery`      | BestPractice     | Warning      |

## Building the Docker image

```shell
npm run build:docker:dev
```

## Testing locally

The `workspaces/docs-generator/docs/multiple-tests/` directory contains test cases.
Each test has:

- `patterns.xml` — the Codacy patterns to enable for this test
- `results.xml` — expected lint results in checkstyle format
- `src/` — source files to lint, plus a `_codacyrc` config file

Biome-specific tests:

| Test | Patterns tested |
|------|-----------------|
| `biome-no-double-equals` | `lint_suspicious_noDoubleEquals` |
| `biome-no-debugger` | `lint_suspicious_noDebugger` |
| `biome-no-var` | `lint_suspicious_noVar` |
| `biome-use-const` | `lint_style_useConst` |

## How it works

1. The Codacy platform sends a `_codacyrc` config specifying which patterns to enable and which files to analyse.
2. The engine generates a `biome.json` config at `/tmp/codacy-biome-config/biome.json` with those patterns enabled (or uses the repo's own `biome.json` when no patterns are specified).
3. Biome is invoked as `biome lint --reporter=json --config-path=<dir> <files>`.
4. The JSON output is parsed; byte-offset spans are converted to line numbers by reading source files.
5. Results are returned as Codacy `Issue` and `FileError` objects.

If the repository already contains a `biome.json` or `biome.jsonc` at its root and no Codacy patterns are configured, the tool uses that config directly.

## Test changes to codacy-seed locally

You may need to test changes that come from [codacy-engine-typescript-seed](https://github.com/codacy/codacy-engine-typescript-seed).

1. Create a package with your changes on the seed:
    - Don't forget to update the dependencies: `npm install`
    - Compile the library: `npm run compile`
    - Package the library: `npm pack`
    > This should generate a `codacy-seed-0.0.1.tgz` in your codacy-seed repository

2. Copy `codacy-seed-0.0.1.tgz` into the root of this repository.

3. Install the package: `npm install codacy-seed-0.0.1.tgz`

4. Update `Dockerfile` and `.dockerignore` so the tarball is copied into the image:
    - Add `!codacy-seed-0.0.1.tgz` to `.dockerignore`
    - Add `COPY codacy-seed-0.0.1.tgz ./` before `RUN npm install`

5. Build the Docker image: `npm run build:docker:dev`

## Agent Playbook: Updating This Repository End-to-End

This section is written for an AI coding agent (or a human) tasked with updating this repo — most commonly bumping the wrapped [Biome](https://biomejs.dev/) version, but also base image / orb / dependency bumps. Follow it top to bottom; it tells you what to change, how to regenerate derived files, how to test locally, and how to interpret CI so you can iterate on failures without guessing.

### 1. What this repository is

This is a **Codacy engine**: a Node/TypeScript wrapper (npm workspaces, no bundler — run via `ts-node`/`tsx` directly) built on `codacy-seed` (the TypeScript port of the Codacy engine SDK, from [codacy-engine-typescript-seed](https://github.com/codacy/codacy-engine-typescript-seed)) that packages the [Biome](https://biomejs.dev/) CLI as a Docker image Codacy's platform can run against a customer's source code. The engine shells out to the installed `biome` binary (`workspaces/codacy/src/engineImpl.ts` runs `biome lint --reporter=json --config-path=<dir> <files>`) and parses its JSON output.

The `docs/` directory (generated at `workspaces/docs-generator/docs/`, then copied to `/docs` in the Docker image) **is** machine-consumed configuration, same as other Codacy pattern-engines:

- `docs/patterns.json` — every Biome lint rule Codacy knows about ("patterns"), with Codacy category/level mappings and which are enabled (recommended) by default. Generated file, do not hand-edit.
- `docs/description/description.json` + `docs/description/<patternId>.md` — human-readable titles/descriptions per pattern, used in the Codacy UI. Generated file, do not hand-edit.
- `docs/multiple-tests/<name>/{patterns.xml,results.xml,src/}` — fixtures used by `codacy-plugins-test`'s "multiple" test mode to validate real lint output against real source files (see the existing "Testing locally" section above). There is currently no `pattern`/`json` single-pattern fixture set — only the `multiple` style.

All the generated artifacts above come from the **`docs-generator` npm workspace** (`workspaces/docs-generator/src/docsGenerator.ts`, invoked via `npm start -w docs-generator`), which calls the GitHub API/raw content for `biomejs/website` (the `src/content/docs/linter/rules/*.mdx` files) to scrape each rule's diagnostic category, recommended status, and description. This means the generator needs **network access** to GitHub at doc-generation time — it does not read anything from the installed `@biomejs/biome` package itself, only the version string (see below). The rule-to-Codacy mapping tables (group -> category/level, ID blacklist) live in `lib/models/biomeRules.ts`, `lib/models/patterns.ts`, and `lib/models/blacklist.ts` — check these if a bump adds a brand-new rule group Biome didn't have before.

### 2. Files that encode versions — check all of these on every update

| File | What it controls | What to check |
|---|---|---|
| `package.json` → `dependencies["@biomejs/biome"]` | The Biome CLI version installed at the repo root and bundled into the Docker image; also what `lib/utils/metadata.ts` reports as `toolVersion` (it reads `@biomejs/biome/package.json` at runtime) | Bump to the target version. Recent bumps pin this **exactly** (e.g. `"2.4.10"`, no `^`) rather than as a range — follow that convention. |
| `workspaces/codacy/package.json` → `dependencies["@biomejs/biome"]` | A second declaration of the Biome dependency for the `codacy` workspace | Keep in sync with the root version. Note: as of the last bump in history this file was left on a caret range (`^2.4.7`) while root moved to an exact `2.4.10` — check current drift and align both to the same exact version to avoid the workspace resolving a different Biome than the root/Docker image. |
| `package-lock.json` | Locked/resolved version and integrity hashes for `@biomejs/biome` and its platform-specific `@biomejs/cli-*` optional dependencies | Regenerate by running `npm install` (or `npm run upgrade`) after bumping the `package.json` files — do not hand-edit. |
| `entrypoint.sh` | Node runtime flags for the container process (not a Biome version, but touched incidentally in past bumps — e.g. a trailing whitespace/newline change slipped into the "Bump Biome" commit) | Usually untouched by a pure version bump; don't change unless the task specifically involves the Node runtime. |
| `Dockerfile` → base image (`node:lts-alpine3.22`) | Node runtime the whole engine runs on | Only bump if the new Biome release raises its minimum Node requirement (check Biome's release notes) or if asked explicitly — don't bump opportunistically. |
| `.circleci/config.yml` → `codacy/base` and `codacy/plugins-test` orbs | Shared CircleCI steps (checkout, versioning, docker build/publish, tagging) and the `codacy-plugins-test` runner | Check orb versions only if asked to update CI tooling itself; not tied to Biome version bumps. |

Look at recent bump commits for the shape of a typical diff: `git log --oneline --all | grep -iE "bump|update|upgrade|version"`, then `git show <hash>`. This repo's history shows two very different shapes:
- A **major** bump (`12ddce8`, Biome `1.9.4` → `2.4.7`) that touched `package.json`, `workspaces/codacy/package.json`, `package-lock.json`, **and required source changes** in `workspaces/codacy/src/configCreator.ts`, `convertResults.ts`, and `engineImpl.ts` (Biome 2.x changed CLI/config/output shape enough that the wrapper code itself needed updates), plus a large `docs/` regeneration (new/changed rules, including new `nursery` rules).
- A **patch** bump (`a7e6207`, `2.4.7` → `2.4.10`) that only touched `package.json` (root) and `package-lock.json`, with no source or docs changes needed, plus incidental cleanup of stale `_codacyrc` test fixtures.

Expect patch/minor bumps to be mechanical (dependency file + regenerated docs); expect major bumps to require reading Biome's changelog and possibly patching `workspaces/codacy/src/*.ts` if the CLI's JSON output or flags changed.

### 3. Step-by-step update procedure

1. **Bump the version** in `package.json` (`dependencies["@biomejs/biome"]`) and `workspaces/codacy/package.json` (`dependencies["@biomejs/biome"]`), keeping both in sync.
2. **Install dependencies** to regenerate the lockfile: `npm run init` (first time) or `npm run upgrade` (subsequent bumps — this runs `npm install --legacy-peer-deps -ws --root`).
3. **Regenerate the docs.** Requires network access to `api.github.com`/`raw.githubusercontent.com` (no auth token needed for this endpoint at the time of writing, but GitHub API rate limits can bite in CI/sandboxed environments):
   ```bash
   npm start -w docs-generator
   ```
   (The `postupgrade` npm script runs this automatically after `npm run upgrade`.) This fetches the current `biomejs/website` rule docs and rewrites `workspaces/docs-generator/docs/patterns.json`, `workspaces/docs-generator/docs/description/description.json`, and `workspaces/docs-generator/docs/description/*.md`. Review the diff for new/removed/renamed rules and stale fixture references in `workspaces/docs-generator/docs/multiple-tests/`.
4. **Type-check.** Each workspace's `start`/`start:dev` script runs `tsc --noEmit` first — run `npm start -w docacy` locally, or just `npx tsc --noEmit` in each workspace, to catch compile errors before building Docker (this is how a major bump like `1.9.4` → `2.4.7` surfaces the need for source changes in `engineImpl.ts`/`convertResults.ts`/`configCreator.ts`).
5. **Build the Docker image** (same as CI): `npm run build:docker:dev` (equivalent to `docker build -t codacy-biomejs:dev .`).
6. **Run `codacy-plugins-test` locally** before pushing — clone https://github.com/codacy/codacy-plugins-test and run its "multiple" DockerTest command against your local image tag, exercising the fixtures under `workspaces/docs-generator/docs/multiple-tests/` (this repo's CI job runs with `run_multiple_tests: true`, i.e. only the multiple-pattern mode — there is no separate `pattern`/`json` single-pattern fixture set to run here).
7. **Iterate on failures**, re-running the relevant DockerTest command after each fix.
8. **Commit** the version bump(s) together with the regenerated `workspaces/docs-generator/docs/` files and any required source changes in one change (or a small logical series of commits).
9. **Push and open a PR.** CI (`.circleci/config.yml`) runs `codacy/checkout_and_version` -> `publish_docker_local` (builds and saves the image) -> `plugins_test` (runs `codacy-plugins-test` with `run_multiple_tests: true`) -> `codacy/publish_docker` (master only) -> `codacy/tag_version` (master only).
10. **Poll the PR's real CI checks until they all pass — local validation is NOT the finish line.** After every push, run `gh pr checks <pr-url>` and keep re-polling (short sleep while any check is `pending`) until all checks finish. If a check fails, fetch its actual log (CircleCI API/UI for the failing job — don't guess), find the true root cause, fix it, push again (never `--no-verify`, never force-push), and re-poll. Repeat until every check is green. The CI environment's toolchain and network access can differ from your local one (for example, the GitHub API calls the `docs-generator` makes during the Docker build could be rate-limited or blocked in ways your local shell isn't), so a clean local run does not guarantee CI passes. Only stop iterating when every check passes, or you hit a genuine product/infra decision that needs a human — in which case explain it in the PR rather than guessing.

### 4. Common failure modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `docs-generator` run produces far fewer rules than expected, or fails to fetch | GitHub API rate-limited, or `biomejs/website` restructured its rules doc path (`src/content/docs/linter/rules`) | Retry with a delay/auth if rate-limited; if the path changed upstream, update `BIOME_RULES_DOCS_PATH`/`GITHUB_RAW_BASE` in `workspaces/docs-generator/src/docsGenerator.ts` |
| `multiple` DockerTest fails on a specific fixture folder under `workspaces/docs-generator/docs/multiple-tests/` | Rule behavior changed upstream, or a pattern was renamed/removed between Biome versions | Confirm the change against Biome's release notes/changelog, then update the fixture's `results.xml` (and `patterns.xml` if the pattern ID changed) to match the new, verified-correct output |
| Docker build or `tsc --noEmit` fails after bumping to a new Biome major version | Biome's CLI flags, config schema (`biome.json`), or JSON lint-result shape changed between majors | Read `workspaces/codacy/src/configCreator.ts` (builds the `biome.json` Codacy passes to the CLI) and `convertResults.ts`/`engineImpl.ts` (parses CLI output) and adapt them to the new CLI contract — this is exactly what the `1.9.4` → `2.4.7` bump had to do |
| Two different `@biomejs/biome` versions end up installed (root vs. `workspaces/codacy`) | `package.json` and `workspaces/codacy/package.json` were not bumped together, or one is a caret range that resolved differently | Pin both to the same exact version and re-run `npm install` |

### 5. Definition of done

- Biome version bumped consistently in `package.json` and `workspaces/codacy/package.json`, with `package-lock.json` regenerated via `npm install`/`npm run upgrade`.
- `workspaces/docs-generator/docs/patterns.json`, `docs/description/description.json`, and `docs/description/*.md` regenerated via `npm start -w docs-generator`, with any fixture inconsistencies in `docs/multiple-tests/` resolved.
- Any source changes needed for a new Biome major (CLI flags/config/output shape) made in `workspaces/codacy/src/*.ts` and type-checked (`tsc --noEmit`).
- Docker image builds successfully (`npm run build:docker:dev`).
- `codacy-plugins-test`'s multiple-pattern DockerTest passes locally against the freshly built image.
- **After pushing and opening/updating the PR, every CI check on it is green.** Poll `gh pr checks <pr-url>` and iterate on any failure (fetch the real CI log, fix, push, re-poll) until all pass — a passing local build is not sufficient, because the CI environment's toolchain and network access can differ from your local one (see step 10).

## What is Codacy

[Codacy](https://www.codacy.com/) is an Automated Code Review Tool that monitors your technical debt, helps you improve your code quality, teaches best practices to your developers, and helps you save time in Code Reviews.

### Among Codacy's features

- Identify new Static Analysis issues
- Commit and Pull Request Analysis with GitHub, BitBucket/Stash, GitLab (and also direct git repositories)
- Auto-comments on Commits and Pull Requests
- Integrations with Slack, HipChat, Jira, YouTrack
- Track issues in Code Style, Security, Error Proneness, Performance, Unused Code and other categories

Codacy also helps keep track of Code Coverage, Code Duplication, and Code Complexity.

### Free for Open Source

Codacy is free for Open Source projects.
