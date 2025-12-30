# Contributing to Pryde Social

Welcome! This document is the **operator’s manual** for working on Pryde Social. It exists to reduce guesswork, protect quality, and keep the platform calm, stable, and boring (in the best way).

If you follow this guide, you won’t accidentally break auth, theme integrity, or release discipline.

---

## 🧭 Core Principles

- **Audit before release** — no exceptions
- **No silent regressions** (theme, auth, user paths)
- **Structure over vibes**
- **Fix once, lock forever**

---

## 🚀 Daily Development

### Start development mode
```bash
npm run dev
```

Starts frontend + backend with:
- hot reload
- dev-only logging rules
- DOM order warnings

---

### Production build (local test)
```bash
npm run build
npm start
```

Use this to verify:
- prod auth behaviour
- console silence
- dark mode correctness

---

## 🔍 Audits & Quality Gates (Most Important)

### 🔐 Full Final Audit (Required before release)
```bash
npm run audit:final
```

Runs:
- Security & auth checks
- API structure audit
- Theme leak detection
- User-impact paths
- Code health scan
- Runtime auth & cookie verification
- Generates `AUDIT_REPORT.md`

**Rule:** Any ❌ FAIL blocks release.

---

### 🧱 Core structural audit (quick confidence check)
```bash
npm run audit:pryde
```

Checks:
- Auth routes & middleware
- Architecture presence
- Feature existence
- Backup scripts

---

### 🎨 Theme leak audit (dark mode safety)
```bash
node scripts/themeLeakAudit.js
```

Scans for:
- `#fff`, `#000`
- `rgb()`, `rgba()`
- `white`, `black`

---

### 🎨 Auto-fix easy theme leaks
```bash
npm run polish:theme
```

- Converts obvious colors → CSS variables
- Flags files needing manual review

Safe to run repeatedly.

---

### 🔍 Static code health scan
```bash
node scripts/codeHealthAudit.js
```

Finds:
- `TODO:` / `FIXME:`
- stray `console.log`
- unfinished signals

---

### 🔔 User-impact audit (critical paths)
```bash
node scripts/userImpactAudit.js
```

Verifies that real user journeys exist:
- signup
- login
- profile
- feed
- posting
- auth lifecycle

---

### 🔐 Runtime auth & API audit (reality check)
```bash
node scripts/runtimeAuthAudit.js
```

Tests:
- cookies are set
- HttpOnly refresh token
- access token issuance
- refresh works
- logout invalidates session

This is the **Facebook-grade auth check**.

---

## 🧪 Polish & Safety Tools

### 🔇 Production console guard
Automatically active in production.

Test locally with:
```bash
NODE_ENV=production npm start
```

Confirms:
- no stray logs
- errors only
- clean DevTools

---

### 🧭 DOM order sanity warnings
Runs automatically in dev:
```bash
npm run dev
```

Warnings appear if layout structure drifts.

---

## 🚀 Release Management (Locked Mode)

### 🧪 Release readiness check
```bash
npm run release:check
```

Blocks release if:
- `AUDIT_REPORT.md` missing
- version not bumped
- changelog not updated

No bypassing this step.

---

### 📝 Changelog requirement

Ensure `CHANGELOG.md` exists and includes the current version:

```md
## x.y.z
- Summary of changes
```

---

## 🔄 Maintenance & Migrations

### 👥 Friends → Followers migration (one-time)
```bash
node server/scripts/migrateFriendsToFollowers.js
```

⚠️ Run once only. Archive after execution.

---

### 💾 Backup verification
```bash
node server/scripts/backupCheck.js
```

(if present)

---

## 🧠 Debugging & Diagnostics

### Logging rules (dev)
Allowed output:
- `console.warn`
- `console.error`
- `console.log('[Pryde] ...')`

Everything else is suppressed.

---

### Auth lifecycle sanity test

Manual check:
1. Log in
2. Leave tab idle (30+ minutes)
3. Refocus tab
4. Create a post

If this works, auth is healthy.

---

## 🧭 Recommended Workflow

### While developing
```bash
npm run dev
```

### Before committing
```bash
npm run audit:pryde
```

### Before releasing
```bash
npm run audit:final
npm run release:check
```

If both pass → release calmly.

---

## 🏁 Final Notes

- Do not bypass audits
- Downgrade checks to WARN only with intent
- Fix root causes, not symptoms

This file exists so future-you (or collaborators) never have to guess.

Welcome to a calm, well-governed codebase.

