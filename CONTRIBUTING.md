# Contributing to Hive

Thanks for your interest in Hive. This document covers the basics for getting set up and the conventions we follow.

## Local setup

```bash
npm install
cp projects.config.example.json projects.config.json
npm run dev
```

Open <http://localhost:3000>, then paste your `ANTHROPIC_API_KEY` in `/settings`.

## Project layout

- `src/app/` — App Router pages and route handlers.
- `src/components/` — React UI components.
- `src/lib/` — Server-side logic: DB, providers, workflows, assistant, scheduler.
- `workflows/` — YAML workflow definitions (examples committed).
- `data/` — Local SQLite database (gitignored).
- `docs/` — Plan, contracts, screenshots.

## Coding standards

- TypeScript strict mode. ESM only.
- No `any`. Prefer explicit types and discriminated unions.
- Anything under `src/lib/` that touches the DB, filesystem, or external APIs must be `import "server-only"`.
- Avoid comments unless the code is non-obvious — name things clearly first.
- No emojis in source code (README branding is the single exception).
- Use the `@/` path alias for all internal imports.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…). Commit messages in any language are fine; keep them short and descriptive.

## Adding an agent provider

1. Implement the `AgentProvider` interface in `src/lib/providers/AgentProvider.ts`.
2. Register your provider in `src/lib/providers/registry.ts`.
3. Reuse the existing `claudeCode.ts` provider as a reference.

## Adding a workflow

Drop a YAML file in `workflows/`. The schema lives in `src/lib/workflows/schema.ts`. Use `workflows/nightly-status.example.yaml` as a starting point. The scheduler picks up scheduled workflows automatically on next boot; manual ones appear immediately under `/workflows`.

## Filing issues

Use GitHub Issues: <https://github.com/your-org/hive/issues> (placeholder — update once the repo is published).

---

_ES — Sigue las mismas reglas: TS strict, ESM, sin `any`, sin emojis en código, Conventional Commits. Reporta bugs en Issues. ¡Gracias por contribuir!_
