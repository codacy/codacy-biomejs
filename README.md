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
| `biome-no-var` | `lint_style_noVar` |
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
