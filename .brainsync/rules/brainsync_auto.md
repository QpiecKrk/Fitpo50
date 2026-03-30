

# Project Memory — Fitpo50
> 1408 notes | Score threshold: >40

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

## 📝 NOTE: 1 uncommitted file(s) in working tree.\n\n## Project Standards

- what-changed in img_69c950be419127.16387010.avif — confirmed 3x
- what-changed in img_69c950bc885014.16296533.avif — confirmed 3x
- what-changed in img_69c94f1b0281b1.68960703.avif — confirmed 3x
- what-changed in img_69c94995be17b3.80838490.avif — confirmed 3x
- what-changed in img_69c94996748582.14685994.avif — confirmed 3x
- what-changed in img_69c9499379b856.95244065.avif — confirmed 3x
- what-changed in img_69c938d06b83f2.21745720.avif — confirmed 3x
- what-changed in img_69c94994441361.71354714.avif — confirmed 3x

## Known Fixes

- ❌ $errors = []; → ✅ problem-fix in sync-manual.php
- ❌ $error = ''; → ✅ problem-fix in login.php
- ❌ if (!empty($_SESSION['flash_error'])) { ?> → ✅ problem-fix in flash.php
- ❌ - } catch (Exception $e) { → ✅ Fixed null crash in Regeneruj — prevents XSS injection attacks
- ❌ set -euo pipefail → ✅ problem-fix in export_site.sh

## Recent Decisions

- decision in .htaccess
- decision in .htaccess
- Optimized Aktualizacja — hardens HTTP security headers
- Optimized Plan — hardens HTTP security headers

## Learned Patterns

- Always: convention in motywacja-zniknela-po-50.html (seen 2x)
- Always: convention in badania-po-50.html (seen 2x)
- Always: convention in motywacja-po-50.html (seen 2x)
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
