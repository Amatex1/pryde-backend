# Contributing to Pryde Backend

This guide keeps backend changes consistent, reviewable, and safe to release.

## Core rules

- Protect auth, admin authorization, and user-impact paths first.
- Prefer shared middleware/utilities over duplicated logic.
- Do not commit secrets, provider exports, or ad hoc debug artifacts.
- If you fix a security-sensitive bug, add or update a regression test.

## Common commands

### Local development

- `npm run dev`
- `cd server && npm test`
- `cd server && npm run lint`

### Security and release gates

- `npm run security:scan`
- `npm run audit:final`
- `npm run release:check`

### Git hook setup

- `npm run hooks:install`

This repo tracks a pre-commit hook that runs the secret scan. Each clone must opt in locally by running the install command once.

## Before opening a PR

- Run the smallest relevant test scope first.
- Re-run the broader affected suite if you touched auth, admin routes, cookies, CSRF, or shared middleware.
- Run `npm run security:scan` if docs, config, or env-related code changed.
- Confirm new logs do not emit tokens, cookies, or secret-like values.

## Before merging to main

- `npm run security:scan`
- `cd server && npm run lint`
- `cd server && npm test`
- `npm run audit:final`

Any failing release gate blocks the merge.

## Logging expectations

- Use the shared logger on backend code you touch.
- Avoid raw `console.*` calls in request handling, auth, or admin flows.
- Log enough for debugging and auditing, but never log tokens, cookies, passwords, reset links, or provider secrets.

## Security-sensitive changes

If you change any of the following, add focused regression coverage:

- auth/session lifecycle
- admin or moderator authorization
- sanitization or validation utilities
- request/response security helpers
- error handling on privileged or public routes

The current security regression suite lives under `server/test/unit/`.

## Release notes

If a change affects security posture, document:

- what changed
- why it changed
- how it was verified
- any required operator follow-up

Prefer small, auditable commits over sweeping mixed-purpose changes.

If both pass → release calmly.

---

## 🏁 Final Notes

- Do not bypass audits
- Downgrade checks to WARN only with intent
- Fix root causes, not symptoms

This file exists so future-you (or collaborators) never have to guess.

Welcome to a calm, well-governed codebase.

