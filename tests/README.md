# 🧪 Pryde Social - Testing Suite

## 📋 Overview

This directory contains automated and manual testing tools for Pryde Social, with a focus on mobile UX and cross-platform compatibility.

---

## 🚀 Quick Start

### Run Automated Tests

```bash
# Install dependencies (if not already installed)
npm install

# Run the automated test suite
npm run test:mobile

# Or run directly
node tests/mobile-test-suite.js
```

### Manual Testing

Use the comprehensive checklist:
```bash
# Open the checklist
cat tests/mobile-testing-checklist.md

# Or open in your editor
code tests/mobile-testing-checklist.md
```

---

## 📁 Files

### `mobile-test-suite.js`
Automated API and functionality tests:
- ✅ API health checks
- ✅ Authentication flow (register, login)
- ✅ Username vs ObjectId route handling
- ✅ Mobile compatibility checks
- ✅ Performance benchmarks
- ✅ Error handling validation

**Usage:**
```bash
node tests/mobile-test-suite.js
```

**Environment Variables:**
```bash
VITE_API_URL=https://pryde-social.onrender.com/api
FRONTEND_URL=https://prydeapp.com
```

### `mobile-testing-checklist.md`
Comprehensive manual testing checklist covering:
- 📱 Authentication flows
- 📰 Feed and posts
- 💬 Chat and messaging
- 👤 Profile management
- 🔔 Notifications
- 🎨 UI/UX elements
- 🚀 Performance
- 🐛 Edge cases

**Usage:**
Print it out or use it as a guide while testing on real devices.

---

## 🎯 Testing Strategy

### 1. Automated Tests (CI/CD)
Run on every commit to catch regressions:
- API endpoint functionality
- Response time benchmarks
- Error handling
- Authentication flows

### 2. Manual Tests (Pre-Release)
Perform before major releases:
- Real device testing (iOS, Android)
- Touch interaction testing
- Visual regression testing
- Accessibility testing

### 3. User Acceptance Testing (UAT)
Beta testing with real users:
- Gather feedback
- Identify edge cases
- Validate UX decisions

---

## 📱 Device Testing Matrix

### Minimum Supported Devices

| Device Type | OS | Browser | Screen Size |
|-------------|-----|---------|-------------|
| iPhone | iOS 15+ | Safari | 375x667+ |
| Android Phone | Android 11+ | Chrome | 360x640+ |
| iPad | iOS 15+ | Safari | 768x1024+ |
| Android Tablet | Android 11+ | Chrome | 800x1280+ |

### Recommended Test Devices

**iOS:**
- iPhone 12 (6.1", 390x844)
- iPhone 13 Pro Max (6.7", 428x926)
- iPad Air (10.9", 820x1180)

**Android:**
- Samsung Galaxy S21 (6.2", 360x800)
- Google Pixel 6 (6.4", 412x915)
- Samsung Galaxy Tab S7 (11", 800x1280)

---

## 🔧 Setup for Testing

### 1. Create Test Accounts

```bash
# User A (Follower)
Username: testuser_a
Email: testuser_a@example.com
Password: TestPassword123!

# User B (Followed)
Username: testuser_b
Email: testuser_b@example.com
Password: TestPassword123!
```

### 2. Prepare Test Data

```bash
# Create test posts
- 1 text-only post
- 1 post with single image
- 1 post with multiple images (4+)
- 1 post with long text (500+ chars)
- 1 post with emoji and special characters

# Create test content
- 1 photo essay (5+ photos)
- 1 journal entry (private)
- 1 longform post (1000+ words)
```

### 3. Configure Test Environment

```bash
# .env.test
VITE_API_URL=https://pryde-social.onrender.com/api
VITE_SOCKET_URL=https://pryde-social.onrender.com
FRONTEND_URL=https://prydeapp.com
```

---

## 📊 Test Results

### Latest Test Run

**Date:** _____________  
**Tester:** _____________  
**Environment:** Production

**Results:**
- ✅ Passed: _____ / _____
- ❌ Failed: _____ / _____
- ⏭️ Skipped: _____ / _____

**Pass Rate:** _____%

---

## 🐛 Bug Reporting

### Bug Report Template

```markdown
**Title:** [Component] Brief description

**Severity:** P0 / P1 / P2 / P3

**Device:** iPhone 13, iOS 16.2, Safari

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Screenshots:**
[Attach screenshots]

**Additional Context:**

```

### Severity Levels

- **P0 - Critical:** App crashes, data loss, security issue
- **P1 - High:** Major feature broken, poor UX
- **P2 - Medium:** Minor feature issue, cosmetic bug
- **P3 - Low:** Enhancement, nice-to-have

---

## 🎯 Success Criteria

### Mobile UX Goals

- ✅ All touch targets ≥ 44px
- ✅ No horizontal scrolling
- ✅ Input fields don't trigger zoom (16px font)
- ✅ Page load time < 3 seconds
- ✅ Smooth scrolling (60fps)
- ✅ Responsive on all screen sizes
- ✅ Works offline (basic functionality)
- ✅ Accessible (WCAG 2.1 AA)

### Performance Benchmarks

- ✅ API response time < 500ms (p95)
- ✅ Time to Interactive < 3s
- ✅ First Contentful Paint < 1.5s
- ✅ Largest Contentful Paint < 2.5s
- ✅ Cumulative Layout Shift < 0.1

---

## 📚 Resources

### Testing Tools

- **BrowserStack:** Cross-browser testing
- **Chrome DevTools:** Mobile emulation
- **Lighthouse:** Performance audits
- **axe DevTools:** Accessibility testing

### Documentation

- [Mobile Testing Best Practices](https://web.dev/mobile/)
- [Touch Target Sizing](https://web.dev/accessible-tap-targets/)
- [Responsive Design](https://web.dev/responsive-web-design-basics/)

---

## 🤝 Contributing

To add new tests:

1. Add test case to `mobile-test-suite.js`
2. Update `mobile-testing-checklist.md`
3. Document in this README
4. Run tests and verify
5. Submit PR with test results

---

## 📞 Support

Questions? Issues?
- Open an issue on GitHub
- Contact: [Your contact info]

---

**Last Updated:** December 11, 2025  
**Version:** 1.0.0

