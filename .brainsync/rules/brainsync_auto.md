

# Project Memory — Fitpo50
> 383 notes | Score threshold: >40

## Safety — Never Run Destructive Commands

> Dangerous commands are actively monitored.
> Critical/high risk commands trigger error notifications in real-time.

- **NEVER** run `rm -rf`, `del /s`, `rmdir`, `format`, or any command that deletes files/directories without EXPLICIT user approval.
- **NEVER** run `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any destructive database operation.
- **NEVER** run `git push --force`, `git reset --hard`, or any command that rewrites history.
- **NEVER** run `npm publish`, `docker rm`, `terraform destroy`, or any irreversible deployment/infrastructure command.
- **NEVER** pipe remote scripts to shell (`curl | bash`, `wget | sh`).
- **ALWAYS** ask the user before running commands that modify system state, install packages, or make network requests.
- When in doubt, **show the command first** and wait for approval.

**Stack:** TypeScript

## 📝 NOTE: 1 uncommitted file(s) in working tree.\n\n## Important Warnings

- **gotcha in siedzenie-po-50.html** — -           <span class="article-quote__source">Źródło: Dunstan DW et 
- **gotcha in siedzenie-po-50.html** — -           <li>[1] <a href="https://doi.org/10.1038/s41569-021-00571-
- **gotcha in siedzenie-po-50.html** — -           <li>[1] Dunstan DW et al. (2021). Sit less and move more f

## Project Standards

- Strengthened types Moje
- what-changed in siedzenie-po-50.html — confirmed 3x
- what-changed in nawodnienie-na-treningu-po-50.html — confirmed 3x
- what-changed in jak-zaczac-na-silowni-po-50.html — confirmed 3x
- what-changed in trening-maszynowy-po-50.html — confirmed 3x
- what-changed in sila-chwytu-po-50.html — confirmed 3x
- what-changed in badania-po-50.html — confirmed 3x
- what-changed in silownia-dla-ludzi.html — confirmed 3x

## Recent Decisions

- decision in tsconfig.json
- decision in jedz-wiecej-po-50.html

## Learned Patterns

- Always: convention in motywacja-zniknela-po-50.html (seen 2x)
- Always: what-changed in sila-chwytu-po-50.html — confirmed 3x (seen 2x)
- Always: convention in badania-po-50.html (seen 2x)
- Agent generates new migration for every change (squash related changes)
- Agent installs packages without checking if already installed

### 📚 Core Framework Rules: [tinybirdco/tinybird-typescript-sdk-guidelines]
# Tinybird TypeScript SDK Guidelines

Guidance for using the `@tinybirdco/sdk` package to define Tinybird resources in TypeScript with complete type inference.

## When to Apply

- Installing or configuring @tinybirdco/sdk
- Defining datasources or pipes in TypeScript
- Creating typed Tinybird clients
- Using type-safe ingestion or queries
- Running tinybird dev/build/deploy commands for TypeScript projects
- Migrating from legacy .datasource/.pipe files to TypeScript
- Defining connections (Kafka, S3, GCS)
- Creating materialized views, copy pipes, or sink pipes

## Rule Files

- `rules/getting-started.md`
- `rules/configuration.md`
- `rules/defining-datasources.md`
- `rules/defining-endpoints.md`
- `rules/typed-client.md`
- `rules/low-level-api.md`
- `rules/cli-commands.md`
- `rules/connections.md`
- `rules/materialized-views.md`
- `rules/copy-sink-pipes.md`
- `rules/tokens.md`

## Quick Reference

- Install: `npm install @tinybirdco/sdk`
- Initialize: `npx tinybird init`
- Dev mode: `tinybird dev` (uses configured `devMode`, typically branch)
- Build: `tinybird build` (builds against configured dev target)
- Deploy: `tinybird deploy` (deploys to main/production)
- Preview in CI: `tinybird preview`
- Server-side only; never expose tokens in browsers

- [JavaScript/TypeScript] Use === not == (strict equality prevents type coercion bugs)
- [JavaScript/TypeScript] Use const by default, let when reassignment needed, never var

## Available Tools (ON-DEMAND only)
- `query(q)` — Deep search when stuck
- `find(query)` — Full-text lookup
> Context above IS your context. Do NOT call load() at startup.
