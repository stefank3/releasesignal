# Release Signal

Release Signal is an AI-assisted QA workspace for turning a feature idea into release-ready testing signal. It helps teams refine requirements, generate test coverage, review test-suite quality, ingest execution results, and reason about release health from structured workflow artifacts.

The product is built around a strict architecture rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

AI can help draft and normalize useful QA inputs, but durable product behavior must flow through parsed, typed artifacts and deterministic services before it reaches the interface.

## Current Capabilities

- Requirement and strategy refinement through Coach/Strategy workflows.
- Guided feature workspace summaries for the current requirement, test suite, review, execution, and health state.
- Structured refined requirement artifacts with objective, scope, business rules, acceptance criteria, edge cases, non-functional constraints, risk areas, coverage targets, minimal repro scenarios, and open questions.
- Test case generation from feature descriptions or refined requirements.
- Persisted test-suite artifacts with versions, case IDs, priorities, types, steps, expected results, duplicate detection, and requirement lineage.
- Deterministic review scoring from structured requirement and suite artifacts.
- Review outputs with score, verdict, category breakdown, risk gaps, anti-patterns, and improvements.
- Execution result ingestion for sources such as Playwright, Selenium, Postman, CI, or unknown sources.
- Deterministic failure classification buckets for locator issues, flaky behavior, environment issues, real defects, and unknown failures.
- Release health artifacts computed from requirement, suite, review, execution, and failure-classification state.
- Session history with stored artifacts so work can continue across chat sessions.
- Auth0 authentication, admin/metrics views, rate limiting, credit accounting, telemetry, and replay/idempotency safeguards.

## Core Architecture Principle

Release Signal should never make important product decisions directly from rendered assistant text.

The intended flow is:

1. AI produces a response for a bounded workflow.
2. Server-side parsers extract or repair the response into a known contract.
3. Structured artifacts are persisted on the session.
4. Deterministic services compute review scores, suite analysis, workflow guidance, release health, stale-state detection, and UI-ready state.
5. React components render the resulting state.

Important boundaries:

- AI output is an input, not the source of truth.
- `lib/chat/artifact.ts` defines the main structured artifact surface.
- `lib/server/chat/modelResponseParser.ts` owns parsing and normalization of model responses.
- `lib/domain/deterministicReviewService.ts` builds review results from artifacts only.
- UI components should consume artifact-backed state instead of reinterpreting model prose.
- Source-of-truth workflow behavior belongs in server/domain logic, not in client-only rendering code.

## Local Setup

Use Node 24.x, matching `package.json`.

Install dependencies:

```bash
npm install
```

Create a local environment file with the required server variables:

```text
DATABASE_URL=
DIRECT_URL=
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=
APP_BASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
OPENAI_API_KEY=
```

Generate Prisma client if needed:

```bash
npx prisma generate
```

Apply database migrations to a configured database:

```bash
npx prisma migrate deploy
```

Start the local development server:

```bash
npm run dev
```

Then open the app at the local Next.js URL printed by the dev server.

## Validation Commands

Run linting:

```bash
npm run lint
```

Run the production build:

```bash
npm run build
```

Regenerate Prisma client:

```bash
npx prisma generate
```

Apply migrations against the configured database:

```bash
npx prisma migrate deploy
```

## Roadmap

- Continue tightening the artifact contracts for refined requirements, suites, reviews, execution intelligence, and release health.
- Expand deterministic review explainability so scores, gaps, and recommendations remain traceable to specific requirement units and test cases.
- Improve execution-ingestion ergonomics for common CI, browser automation, and API testing outputs.
- Strengthen stale-state and lineage visibility when requirements, suites, reviews, or execution results drift.
- Broaden release-health guidance while preserving deterministic computation.
- Add deeper validation coverage around artifact parsing, suite normalization, review scoring, and workflow branching.
- Improve admin and telemetry views for operational insight into usage, cost, quality, and failure trends.

## AI-Agent and Codex Safety Rules

When using an AI coding agent in this repository:

- Preserve the core rule: `AI -> parsed -> structured artifacts -> deterministic system logic -> UI`.
- Do not make workflow, scoring, release-health, or review decisions directly from assistant prose.
- Do not bypass artifact parsing, validation, normalization, versioning, or lineage checks.
- Keep deterministic logic deterministic: same artifacts should produce the same result.
- Keep UI components focused on rendering state and user interactions.
- Do not modify TypeScript, React, API routes, Prisma files, artifact contracts, review scoring, workflow logic, environment files, or package configuration when the task is documentation-only.
- For README-only tasks, edit `README.md` only.
- Before changing behavior, inspect the relevant artifact contracts and workflow services.
- Prefer small, explicit changes over broad rewrites.
- Run validation commands after code changes when the environment supports them.
- Never commit secrets, local environment values, generated build output, or dependency folders.
