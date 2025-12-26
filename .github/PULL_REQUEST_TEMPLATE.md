## Description
<!-- What does this change do? -->


## Type of Change
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] ♻️ Refactor (code change that neither fixes a bug nor adds a feature)
- [ ] 📝 Documentation (changes to documentation only)
- [ ] 🚨 Breaking change (fix or feature that would cause existing functionality to change)

## Risk Category
- [ ] **A (Low)** - Documentation, styling, isolated new features
- [ ] **B (Medium)** - API changes, schema changes, auth changes
- [ ] **C (High)** - Security, payments, migrations, third-party integrations

---

## 🧪 Testing Checklist

### Core Functionality (Required for ALL merges)
- [ ] Login / Logout works
- [ ] Feed loads and displays posts
- [ ] Can create, edit, delete posts
- [ ] Comments work correctly
- [ ] Messages send and receive
- [ ] Notifications appear correctly
- [ ] Settings can be updated
- [ ] Admin actions work (if applicable)

### Technical Checks
- [ ] No console errors in browser dev tools
- [ ] No failed network requests
- [ ] Tested on mobile device or responsive mode
- [ ] All existing tests pass

### For Medium/High Risk (Category B/C)
- [ ] Tested on staging environment first
- [ ] Database backup taken before deploy
- [ ] Rollback plan documented below

---

## 🔄 Rollback Plan
<!-- How would you revert this change if something goes wrong? -->
```
Rollback method: 
Command/steps: 
Estimated time: 
```

---

## 📸 Screenshots (if applicable)
<!-- Add screenshots for UI changes -->


---

## 📋 Final Checklist
- [ ] I have performed the manual smoke test (see docs/MANUAL_SMOKE_CHECKLIST.md)
- [ ] I have read the change discipline policy (see docs/CHANGE_DISCIPLINE.md)
- [ ] My code follows the project's coding standards
- [ ] I have updated documentation if needed
- [ ] This PR has been reviewed by at least one other person

---

**Reviewer Notes:**
<!-- Any special instructions for the reviewer? -->


