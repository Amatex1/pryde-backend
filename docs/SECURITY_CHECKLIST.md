# Backend Security Runbook

This file is the maintained backend security runbook for Pryde. It replaces older notes that mixed real incident details with stale deployment guidance.

## Repo-enforced controls

- [x] Secrets are expected in managed environment variables, not tracked files.
- [x] `npm run security:scan` scans the repo for likely leaked credentials.
- [x] CI includes a required **Secret Scan** job before the overall status check passes.
- [x] A tracked pre-commit hook is available via `npm run hooks:install`.
- [x] Touched admin route families are centralized behind shared authorization middleware.
- [x] Touched sanitization/error paths use the shared logger instead of raw console leakage.
- [x] Privileged-route deny-path regression coverage exists in `server/test/unit/security-hardening.test.js`.

## Secret ownership and storage rules

- Store live secrets only in local untracked env files and the hosting provider's secret manager.
- Use separate credentials for local, staging, and production.
- Never paste live credentials into docs, issues, PRs, screenshots, or logs.
- Treat JWT, refresh, CSRF, database, Redis, email, push, and storage credentials as rotation candidates.
- If a credential might have been copied into a tracked file, rotate it even if the commit never reached production.

## Rotation procedure

Use this order whenever a secret is rotated:

1. Rotate the credential in the provider dashboard.
2. Update the managed environment variable for every active environment.
3. Update local untracked env files for authorized operators.
4. Invalidate sessions or tokens if the rotated secret affects auth.
5. Redeploy the backend.
6. Run the smoke checks in `docs/DEPLOYMENT_CHECKLIST.md`.
7. Record the date, owner, and reason for rotation.

## Git and history review procedure

Run these checks whenever a secret-like file appears locally or before a sensitive release:

- `npm run security:scan`
- `git log --all --full-history -- .env`
- `git log -p --all -- path/to/suspect-file`

If anything sensitive appears in history:

1. Rotate the affected credentials first.
2. Review who had access during the exposure window.
3. Clean the history only after rotation and communication are complete.
4. Capture the incident in the internal ops log.

## Provider hardening expectations

### Database and cache

- Restrict access to approved application and operator origins only.
- Do not use overly broad network allowances for production administration.
- Enable provider-side backups, encryption, and audit logging when available.
- Use least-privilege database users.

### Email, push, and storage providers

- Use separate keys per environment.
- Remove unused keys and service accounts.
- Prefer scoped or revocable credentials over long-lived general-purpose keys.

## Recurring review cadence

### Before each merge to main

- Run `npm run security:scan`.
- Run the relevant backend tests.
- Review changed docs/config for accidental credential disclosure.

### Monthly

- Review provider access lists and operator access.
- Review auth/admin logs for unusual behavior.
- Review dependency audit output and backlog.

### Quarterly

- Rotate high-impact credentials on schedule.
- Review authorization surfaces and privileged route families.
- Reconfirm incident response contacts and ownership.

## Incident response checklist

If credentials or privileged access are suspected to be exposed:

1. Rotate the affected credential set immediately.
2. Revoke unused tokens, sessions, or provider keys.
3. Review backend logs, provider audit logs, and recent admin actions.
4. Assess whether user notification is required.
5. Document the scope, timeline, and remediation.
6. Add or update a regression control if the issue came from code or CI drift.

## Useful commands

- `npm run security:scan`
- `npm run hooks:install`
- `cd server && npm test`
- `cd server && npm run lint`
- `npm run audit:final`

