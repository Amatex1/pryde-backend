# Change Discipline Policy

**Version:** 1.0  
**Last Updated:** 2025-12-26  
**Purpose:** Maintain platform stability and prevent regression bugs

---

## 🎯 Core Principles

1. **Stability First** - Working features are never broken by new changes
2. **Verified Changes** - Every merge is tested before deployment
3. **Safe Rollbacks** - Emergency patches always have a rollback plan
4. **Confidence** - The team trusts that changes won't break production

---

## 📋 Pre-Merge Requirements

### Standard Feature Merges

Before ANY feature merge to main:

| Requirement | Description | Required? |
|-------------|-------------|-----------|
| Smoke Test Complete | All items in MANUAL_SMOKE_CHECKLIST.md passed | ✅ Yes |
| No Console Errors | Browser dev tools show no red errors | ✅ Yes |
| No Network Failures | All API calls succeed (check Network tab) | ✅ Yes |
| Mobile Tested | Tested on at least one mobile device | ✅ Yes |
| Code Review | At least one other person reviewed | ✅ Yes |
| Tests Pass | All automated tests pass | ✅ Yes |

### High-Risk Changes

Additional requirements for database, auth, or core feature changes:

| Requirement | Description |
|-------------|-------------|
| Rollback Plan | Document how to revert if issues occur |
| Backup Verified | Database backup taken before deployment |
| Staged Rollout | Deploy to staging first, verify, then production |
| Monitor Period | 30 minutes of monitoring after deployment |

---

## 🚨 Emergency Patch Protocol

### When to Use

- Production is down
- Critical security vulnerability
- Data loss occurring
- Users cannot log in

### Required Steps

1. **Document the Issue**
   ```
   Issue: [Brief description]
   Impact: [Number of users affected]
   Severity: [Critical/High/Medium]
   Time Discovered: [Timestamp]
   ```

2. **Create Rollback Plan BEFORE Patching**
   ```
   Rollback Method: [git revert / database restore / config change]
   Rollback Command: [Exact command to run]
   Rollback Time Estimate: [X minutes]
   ```

3. **Apply Fix with Minimal Scope**
   - Fix ONLY the immediate issue
   - No refactoring
   - No "while we're here" changes

4. **Deploy and Monitor**
   - Deploy the fix
   - Monitor for 30 minutes minimum
   - Verify rollback works if needed

5. **Post-Incident Review**
   - Within 24 hours
   - Document what happened
   - Identify prevention measures

---

## 🛑 Merge Blockers

A merge MUST be blocked if any of these are true:

| Blocker | Reason |
|---------|--------|
| Smoke test fails | Core functionality broken |
| Unresolved conflicts | Code may not work as intended |
| Failing tests | Automated checks found issues |
| No code review | Bugs may slip through |
| Console errors | JavaScript errors affect UX |
| API failures | Backend integration broken |

---

## 📊 Change Categories

### Category A: Low Risk
- Documentation updates
- CSS/styling changes (visual only)
- Adding new isolated features

**Requirements:** Basic smoke test, code review

### Category B: Medium Risk
- API endpoint changes
- Database schema changes
- Authentication flow changes
- Core component refactoring

**Requirements:** Full smoke test, rollback plan, staging test

### Category C: High Risk
- Security-related changes
- Payment/billing changes
- Data migration
- Third-party integration changes

**Requirements:** Full smoke test, rollback plan, staged rollout, monitoring period

---

## 📝 Merge Request Template

```markdown
## Description
[What does this change do?]

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation

## Risk Category
- [ ] A (Low)
- [ ] B (Medium)
- [ ] C (High)

## Testing
- [ ] Smoke test completed
- [ ] Mobile tested
- [ ] No console errors
- [ ] No network errors

## Rollback Plan
[How to revert if issues occur]

## Checklist
- [ ] Code reviewed
- [ ] Tests pass
- [ ] Documentation updated (if needed)
```

---

## 🔄 Rollback Procedures

### Git Revert (Code Changes)
```bash
git revert <commit-hash>
git push origin main
```

### Database Rollback
1. Identify the backup timestamp
2. Contact database admin
3. Restore from backup
4. Verify data integrity

### Feature Flag Disable
```javascript
// If feature flags are used
await updateFeatureFlag('feature-name', false);
```

---

## 📈 Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Regression bugs per month | < 2 | - |
| Rollbacks required | < 1/month | - |
| Mean time to recovery | < 30 min | - |
| Failed deployments | < 5% | - |

---

**Remember:** A slower, careful deployment is always better than a fast, broken one.

