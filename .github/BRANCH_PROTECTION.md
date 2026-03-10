# Branch Protection Configuration

This file documents the **GitHub dashboard settings** that should be enabled for `main`.
It does **not** enforce anything by itself.

## Recommended `main` rule

1. Go to **GitHub → Settings → Branches**
2. Add or edit the rule for `main`
3. Enable these protections:

### Require a pull request before merging
- Require at least **1 approval**
- Dismiss stale approvals when new commits are pushed
- Require conversation resolution before merging

### Require status checks to pass before merging
- Require branches to be up to date before merging
- Mark these checks as **required**:
  - `Run Tests`
  - `Lint Code`
  - `Runtime Smoke Check`
  - `All Required Checks Passed`

### Additional safeguards
- Include administrators
- Do not allow bypassing the above settings

## What is blocking vs advisory

### Blocking checks
- `Run Tests`
- `Lint Code`
- `Runtime Smoke Check`
- `All Required Checks Passed`

### Advisory check
- `Security Audit (Advisory)`

`npm audit --audit-level=high` currently reports real dependency findings, so the audit job is intentionally **visible but non-blocking** until that backlog is fixed.

## What each CI job does

### `Run Tests`
- Runs the backend test suite on Node `22.x`
- Uses the GitHub Actions MongoDB service
- Uploads JUnit-style test results and coverage artifacts

### `Lint Code`
- Runs `npm run lint` in `server/`
- Fails the PR if ESLint fails

### `Runtime Smoke Check`
- Verifies `server.js` parses cleanly
- Imports critical runtime modules in a safe test-mode context
- Catches obvious boot-time regressions without pretending to run a real build

### `All Required Checks Passed`
- Aggregates the blocking jobs above
- Warns if the advisory audit fails
- Should be required in branch protection

## Local verification before pushing

Run these from the repo root:

```bash
cd server
npm run lint
npm test
node --check server.js
```

## Important note about direct pushes

If direct pushes to `main` are still possible, the GitHub branch rule is not configured strictly enough yet.
The checked-in workflow and this document improve visibility, but **GitHub Settings remain the actual enforcement point**.

