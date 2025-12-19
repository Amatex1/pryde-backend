# XSS Protection Testing Guide

## 🧪 How to Test XSS Protection

This guide provides step-by-step instructions to verify that XSS protection is working correctly across all platforms (Desktop, Mobile, PWA).

---

## 🎯 Test Scenarios

### **1. Post Content XSS Test**

**Test:** Try to inject a script through post content

**Steps:**
1. Log in to Pryde Social
2. Create a new post with the following content:
   ```
   Hello! <script>alert('XSS')</script> This is a test post
   ```
3. Submit the post

**Expected Result:**
- ✅ Post is created successfully
- ✅ Content displays as: "Hello! This is a test post"
- ✅ Script tags are stripped
- ✅ No alert popup appears
- ✅ No JavaScript execution

---

### **2. Comment XSS Test**

**Test:** Try to inject HTML with event handlers through comments

**Steps:**
1. Find any post on the feed
2. Add a comment with:
   ```
   <img src=x onerror=alert('XSS')> Nice post!
   ```
3. Submit the comment

**Expected Result:**
- ✅ Comment is created successfully
- ✅ Content displays as: "Nice post!"
- ✅ Image tag is stripped
- ✅ No broken image icon appears
- ✅ No alert popup appears

---

### **3. User Bio XSS Test**

**Test:** Try to inject malicious code through user bio

**Steps:**
1. Go to your profile
2. Click "Edit Profile"
3. Set bio to:
   ```
   I love coding! <iframe src="https://evil.com"></iframe>
   ```
4. Save profile
5. View your profile

**Expected Result:**
- ✅ Profile is updated successfully
- ✅ Bio displays as: "I love coding!"
- ✅ Iframe tag is stripped
- ✅ No embedded content appears

---

### **4. Direct Message XSS Test**

**Test:** Try to inject scripts through direct messages

**Steps:**
1. Go to Messages
2. Select a conversation or start a new one
3. Send a message with:
   ```
   Hey! <script>document.location='https://evil.com'</script>
   ```
4. Check the message display

**Expected Result:**
- ✅ Message is sent successfully
- ✅ Content displays as: "Hey!"
- ✅ Script tags are stripped
- ✅ No redirect occurs
- ✅ Recipient sees sanitized message

---

### **5. Website URL XSS Test**

**Test:** Try to inject JavaScript through website URL field

**Steps:**
1. Go to your profile
2. Click "Edit Profile"
3. Set website to:
   ```
   javascript:alert('XSS')
   ```
4. Save profile
5. View your profile and click the website link

**Expected Result:**
- ✅ Profile is updated successfully
- ✅ Website field is empty or shows sanitized URL
- ✅ No JavaScript execution when clicking link
- ✅ Link is either removed or made safe

---

### **6. Display Name XSS Test**

**Test:** Try to inject HTML through custom display name

**Steps:**
1. Go to your profile
2. Click "Edit Profile"
3. Select "Custom" display name
4. Set custom display name to:
   ```
   <b>Bold Name</b><script>alert('XSS')</script>
   ```
5. Save profile

**Expected Result:**
- ✅ Profile is updated successfully
- ✅ Display name shows as: "Bold Name" (without bold formatting)
- ✅ Script tags are stripped
- ✅ HTML tags are stripped
- ✅ No JavaScript execution

---

### **7. Journal Entry XSS Test**

**Test:** Try to inject code through journal entries

**Steps:**
1. Go to Journals section
2. Create a new journal entry
3. Set title to:
   ```
   My Day <svg onload=alert('XSS')>
   ```
4. Set body to:
   ```
   Today was great! <object data="evil.swf"></object>
   ```
5. Save journal entry

**Expected Result:**
- ✅ Journal is created successfully
- ✅ Title displays as: "My Day"
- ✅ Body displays as: "Today was great!"
- ✅ SVG and object tags are stripped
- ✅ No JavaScript execution

---

### **8. Event Description XSS Test**

**Test:** Try to inject code through event descriptions

**Steps:**
1. Go to Events section
2. Create a new event
3. Set description to:
   ```
   Join us! <style>body{display:none}</style>
   ```
4. Save event

**Expected Result:**
- ✅ Event is created successfully
- ✅ Description displays as: "Join us!"
- ✅ Style tags are stripped
- ✅ Page remains visible (no CSS injection)

---

## 🔍 Advanced XSS Payloads to Test

Try these more sophisticated XSS payloads to ensure comprehensive protection:

1. **Encoded Script:**
   ```
   &#60;script&#62;alert('XSS')&#60;/script&#62;
   ```

2. **Mixed Case:**
   ```
   <ScRiPt>alert('XSS')</sCrIpT>
   ```

3. **Event Handler:**
   ```
   <div onmouseover="alert('XSS')">Hover me</div>
   ```

4. **Data URI:**
   ```
   <a href="data:text/html,<script>alert('XSS')</script>">Click</a>
   ```

5. **SVG with Script:**
   ```
   <svg><script>alert('XSS')</script></svg>
   ```

**Expected Result for ALL:**
- ✅ Content is sanitized
- ✅ No JavaScript execution
- ✅ Safe text content is preserved

---

## ✅ Success Criteria

XSS protection is working correctly if:

1. ✅ No alert popups appear from any test
2. ✅ No JavaScript code executes from user input
3. ✅ No HTML tags are rendered from user input
4. ✅ Safe text content is preserved and displayed
5. ✅ Line breaks are preserved in posts/comments
6. ✅ Links still work in posts/comments
7. ✅ User experience is not negatively impacted

---

## 🚨 What to Do If Tests Fail

If any test shows XSS vulnerability:

1. **DO NOT DEPLOY TO PRODUCTION**
2. Check which component/route is affected
3. Verify sanitization is applied in both:
   - Frontend (before rendering)
   - Backend (before database save)
4. Review `XSS_PROTECTION_IMPLEMENTATION.md` for implementation details
5. Fix the vulnerability
6. Re-run all tests

---

## 📱 Platform-Specific Testing

### **Desktop Browser:**
- Test in Chrome, Firefox, Safari, Edge
- Verify all scenarios above

### **Mobile Browser:**
- Test on iOS Safari and Android Chrome
- Verify all scenarios above
- Check touch interactions don't trigger XSS

### **PWA (Installed App):**
- Install app on mobile device
- Test all scenarios above
- Verify offline behavior doesn't bypass sanitization

---

## 🎉 Testing Complete

Once all tests pass across all platforms, XSS protection is verified and the platform is safe for production deployment.

**Document test results and keep this guide for future regression testing.**

