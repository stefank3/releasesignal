# Release Signal

Release Signal is an AI-assisted QA workspace that helps teams move from a feature idea to a refined requirement, a risk-aware testing strategy, and executable test cases.

The system combines guided requirement refinement with AI-driven QA reasoning so teams can design **higher-quality tests earlier in the development lifecycle**.

Release Signal focuses on three primary workflows:

- Requirement refinement
- QA strategy coaching
- Test case generation


## Core Workflows

### Coach Mode

Coach mode helps transform an initial feature description into a **risk-aware QA strategy**.

The system analyzes the feature and generates:

- assumptions
- risk matrix
- high-signal test ideas
- optional clarification questions

When the requirement becomes sufficiently refined, Coach mode produces a **Technical Requirement artifact** that can be reused across the QA workflow.


### Review Mode

Review mode evaluates an existing set of test cases or a test strategy.

It produces a structured QA scorecard that includes:

- overall quality score
- risk coverage
- test design quality
- diagnostic value
- improvement suggestions

This mode is intended for **QA leads or senior engineers reviewing test coverage**.


### Cases Mode

Cases mode generates structured test cases from a feature description or refined requirement.

Output is:

- plain text
- copy-paste ready for Jira / Xray / test management tools
- balanced across positive, negative, and edge cases

When a **Refined Requirement artifact** exists in the session, Cases mode automatically aligns generated tests with that requirement.


## Requirement Refinement

Release Signal includes a **Strategy Panel** that helps refine feature descriptions before generating tests.

The panel allows users to provide structured information such as:

- Objective
- Primary Risk
- Integrations
- Constraints
- Scope
- Success Criteria

Submitting these answers produces a **Technical Requirement response** containing:

- Objective
- Context
- Scope
- Acceptance Criteria
- Risk Focus
- Recommended Test Strategy
- High-Signal Test Ideas

This requirement can then be copied and used directly to generate aligned test cases.


## Key Features

### Authentication

Authentication is handled through **Auth0** to ensure only authorized users can access the application.

---

### Session History

Conversations are stored as sessions. Users can:

- reopen previous sessions
- rename sessions
- delete sessions
- continue refining requirements over time

---

### Requirement Artifacts

Refined requirements are stored inside each session and reused during later workflow steps.

This allows teams to move naturally through the QA process:

Feature idea  
→ Refined requirement  
→ QA strategy  
→ Test case generation

---

### Cost and Abuse Protection

The system includes operational safeguards such as:

- API rate limiting
- token usage tracking
- credit accounting
- replay protection for requests

These mechanisms ensure predictable operational cost and stable API usage.


## Technology Stack

Frontend

- Next.js (App Router)
- React
- TypeScript

Backend

- Next.js API routes
- OpenAI API
- Prisma ORM

Infrastructure

- Auth0 authentication
- Upstash Redis rate limiting
- PostgreSQL database