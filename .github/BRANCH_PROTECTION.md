# Branch Protection Configuration

This document describes how to configure branch protection rules to enforce CI checks before merging.

## Required Configuration

### Step 1: Enable Branch Protection

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Branches**
3. Click **Add rule** under "Branch protection rules"
4. Enter `main` as the branch name pattern

### Step 2: Configure Protection Rules

Enable the following settings:

#### ✅ Require a pull request before merging
- **Required approvals:** 1 (recommended)
- ☑ Dismiss stale pull request approvals when new commits are pushed
- ☑ Require review from Code Owners (optional)

#### ✅ Require status checks to pass before merging
- ☑ Require branches to be up to date before merging
- **Required status checks:**
  - `Run Tests (18.x)`
  - `Run Tests (20.x)`
  - `Lint Code`
  - `Build Check`
  - `All Checks Passed`

#### ✅ Require conversation resolution before merging
- ☑ All conversations must be resolved

#### ✅ Do not allow bypassing the above settings
- ☑ Include administrators (recommended for strict enforcement)

### Step 3: Save Changes

Click **Create** or **Save changes** to apply the branch protection rules.

---

## What This Enforces

### 🚫 Blocked Actions
- Direct pushes to `main` (must use pull requests)
- Merging PRs with failing tests
- Merging PRs with unresolved conversations
- Bypassing CI checks

### ✅ Required Actions
- All code must go through pull requests
- All tests must pass (67 tests)
- CI pipeline must complete successfully
- Code review required (if configured)

---

## CI Pipeline Checks

The CI pipeline runs the following checks on every push and pull request:

### 1. **Run Tests** (Node 18.x and 20.x)
- Runs all 67 tests
- Fails if ANY test fails
- Tests message deduplication
- Tests error responses
- Tests authentication
- Tests database indexes
- Tests search functionality

### 2. **Lint Code**
- Runs ESLint (if configured)
- Checks code style and quality
- Continues even if not configured

### 3. **Security Audit**
- Runs `npm audit`
- Checks for high-severity vulnerabilities
- Continues even if issues found (warning only)

### 4. **Build Check**
- Verifies dependencies install correctly
- Ensures no build errors
- Confirms deployment readiness

### 5. **All Checks Passed**
- Final status check
- Fails if any previous check failed
- Required for merge

---

## Local Development Workflow

### Before Pushing

```bash
# Run tests locally
cd server
npm test

# Expected output:
# 67 passing (6s)
# 7 pending
```

### Creating a Pull Request

```bash
# Create a new branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/my-feature

# Create PR on GitHub
# CI will run automatically
```

### Merging

1. Wait for CI checks to pass ✅
2. Request code review (if required)
3. Resolve all conversations
4. Click **Merge pull request**
5. Delete branch after merge

---

## Troubleshooting

### CI Fails on Push

**Problem:** Tests fail in CI but pass locally

**Solutions:**
- Ensure you're using Node 18.x or 20.x locally
- Run `npm ci` instead of `npm install`
- Check environment variables
- Review CI logs for specific errors

### Cannot Merge PR

**Problem:** Merge button is disabled

**Checklist:**
- [ ] All CI checks passed?
- [ ] All conversations resolved?
- [ ] Branch up to date with main?
- [ ] Required reviews approved?

### Bypass Protection (Emergency Only)

**When:** Critical hotfix needed immediately

**Steps:**
1. Temporarily disable branch protection
2. Push fix directly to main
3. Re-enable branch protection immediately
4. Create follow-up PR to add tests

**⚠️ Warning:** Only use in true emergencies!

---

## Benefits

### 🛡️ Regression Prevention
- No code reaches production without passing tests
- Invariants enforced automatically
- Breaking changes caught before merge

### 📊 Quality Assurance
- Consistent code quality
- Automated testing
- Security vulnerability detection

### 🤝 Team Collaboration
- Code review process
- Conversation resolution
- Shared responsibility

### 🚀 Deployment Confidence
- All code tested before deployment
- Render auto-deploys only tested code
- Reduced production incidents

---

## Maintenance

### Adding New Tests

When you add new tests:
1. Tests run automatically in CI
2. No configuration changes needed
3. CI fails if new tests fail

### Updating Node Version

To test against a new Node version:
1. Edit `.github/workflows/ci.yml`
2. Add version to `matrix.node-version`
3. Update branch protection to require new check

### Disabling Checks (Not Recommended)

To disable a check:
1. Remove from `.github/workflows/ci.yml`
2. Remove from branch protection required checks
3. Document reason in commit message

---

## Status Badge

Add this to your README.md to show CI status:

```markdown
![CI Status](https://github.com/Amatex1/pryde-backend/workflows/CI%20Pipeline/badge.svg)
```

---

## Summary

✅ **CI enforces quality**  
✅ **No untested code in production**  
✅ **Automated regression prevention**  
✅ **Team collaboration enabled**  
✅ **Deployment confidence maximized**

**Result:** Pryde Social is regression-proof and production-safe.

