# Backend Deployment & Release Checklist

Use this checklist for every backend release. It is intentionally security-first.

## 1. Local release gates

- [ ] `npm run security:scan`
- [ ] `cd server && npm run lint`
- [ ] `cd server && npm test`
- [ ] `cd server && node --check server.js`
- [ ] `npm run audit:final`

## 2. Environment review

- [ ] `NODE_ENV` is set to production.
- [ ] Database, Redis, email, push, and storage credentials are set in provider-managed env vars.
- [ ] Auth secrets are present and current.
- [ ] `FRONTEND_URL`, `API_DOMAIN`, and `ROOT_DOMAIN` match the intended deployment.
- [ ] Only required integrations are enabled.
- [ ] Debug or local-only environment variables are absent.

## 3. Platform hardening checks

- [ ] Provider access is limited to approved operators.
- [ ] Database and cache access rules are intentionally restricted.
- [ ] HTTPS termination is active.
- [ ] Backups and provider audit logs are enabled where supported.
- [ ] Unused provider keys have been revoked.

## 4. Application security checks

- [ ] Public, authenticated, privileged, and development-only routes are still intentionally separated.
- [ ] Privileged route families use centralized authorization middleware.
- [ ] Cookie, CSRF, CORS, and rate-limit settings match the current domain layout.
- [ ] Request-size and upload limits remain enabled.
- [ ] Error responses do not expose stack traces or internal details.

## 5. Smoke tests after deploy

- [ ] Health endpoint returns successfully.
- [ ] Unauthenticated access to a privileged route is denied.
- [ ] A privileged account can still access allowed admin paths.
- [ ] Login, refresh, and logout flows work.
- [ ] CSRF-protected mutations succeed from the real frontend and fail when the token is missing or invalid.
- [ ] Logs do not contain raw tokens, cookies, or secrets.

## 6. Recommended manual checks

- [ ] Review provider logs for startup errors.
- [ ] Review auth/admin logs for unusual spikes after deploy.
- [ ] Confirm background jobs and queues reconnect correctly.
- [ ] Confirm media/storage integrations fail closed if credentials are removed.

## 7. Rollback readiness

- [ ] Previous known-good deploy is identified.
- [ ] Database backup / restore path is known.
- [ ] The on-call owner knows how to rotate auth secrets quickly if rollback is auth-related.

## Notes

- Do not use broad production admin/network access when a narrower rule is possible.
- If any auth secret changes, plan for session invalidation and communicate the blast radius.
- If a release changes auth, cookies, CSRF, or admin authorization, the smoke checks above are mandatory.

