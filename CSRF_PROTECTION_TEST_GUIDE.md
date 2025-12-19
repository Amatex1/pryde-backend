# CSRF Protection Testing Guide

## 🧪 How to Verify CSRF Protection is Working

This guide provides step-by-step instructions to verify that CSRF protection is active and working correctly.

---

## 🎯 Quick Verification Tests

### **Test 1: Verify CSRF Token is Set**

**Steps:**
1. Start the backend server: `cd server && npm start`
2. Open browser DevTools (F12)
3. Go to Application/Storage → Cookies
4. Navigate to `http://localhost:5000` or your API URL
5. Make any API request (e.g., GET /api/health)

**Expected Result:**
- ✅ Cookie named `XSRF-TOKEN` should be present
- ✅ Cookie value should be a 64-character hexadecimal string
- ✅ Cookie should have `SameSite=Strict` attribute
- ✅ Cookie should have `Max-Age=3600` (1 hour)

**Example:**
```
Name: XSRF-TOKEN
Value: a1b2c3d4e5f6...  (64 chars)
Domain: localhost
Path: /
SameSite: Strict
Max-Age: 3600
HttpOnly: false
Secure: false (dev) / true (prod)
```

---

### **Test 2: Verify CSRF Token is Sent in Requests**

**Steps:**
1. Open browser DevTools → Network tab
2. Log in to Pryde Social
3. Create a new post or comment
4. Click on the POST request in Network tab
5. Check Request Headers

**Expected Result:**
- ✅ Header `X-XSRF-TOKEN` should be present
- ✅ Header value should match the `XSRF-TOKEN` cookie value
- ✅ Header `Authorization` should also be present (JWT token)

**Example:**
```
Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-XSRF-TOKEN: a1b2c3d4e5f6...
Content-Type: application/json
```

---

### **Test 3: Verify CSRF Protection Blocks Invalid Requests**

**Steps:**
1. Open browser DevTools → Console
2. Try to make a POST request WITHOUT CSRF token:

```javascript
fetch('http://localhost:5000/api/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ content: 'Test post' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected Result:**
- ❌ Request should be rejected with 403 Forbidden
- ❌ Response should contain: `"message": "CSRF token missing"`
- ✅ Post should NOT be created

---

### **Test 4: Verify CSRF Protection Allows Valid Requests**

**Steps:**
1. Open browser DevTools → Console
2. Get CSRF token from cookie:

```javascript
function getCsrfToken() {
  const name = 'XSRF-TOKEN=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return null;
}

const csrfToken = getCsrfToken();
console.log('CSRF Token:', csrfToken);
```

3. Make POST request WITH CSRF token:

```javascript
fetch('http://localhost:5000/api/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'X-XSRF-TOKEN': csrfToken
  },
  credentials: 'include',
  body: JSON.stringify({ content: 'Test post with CSRF token' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected Result:**
- ✅ Request should succeed with 200/201 status
- ✅ Post should be created successfully
- ✅ Response should contain the created post data

---

### **Test 5: Verify GET Requests Don't Require CSRF Token**

**Steps:**
1. Open browser DevTools → Console
2. Make GET request WITHOUT CSRF token:

```javascript
fetch('http://localhost:5000/api/posts', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected Result:**
- ✅ Request should succeed (GET is exempted from CSRF check)
- ✅ Posts should be returned
- ✅ No CSRF error

---

### **Test 6: Verify CSRF Token Expiration**

**Steps:**
1. Get current CSRF token from cookie
2. Wait 1 hour (or modify `maxAge` in `csrf.js` to 60 seconds for testing)
3. Try to make a POST request with the expired token

**Expected Result:**
- ❌ Request should be rejected with 403 Forbidden
- ❌ Response should contain: `"message": "CSRF token expired"`
- ✅ Frontend should automatically retry and get new token

---

### **Test 7: Verify Automatic Token Refresh**

**Steps:**
1. Log in to Pryde Social
2. Open browser DevTools → Network tab
3. Create a post (should work)
4. Delete the `XSRF-TOKEN` cookie manually
5. Try to create another post

**Expected Result:**
- ✅ First request fails with CSRF error
- ✅ Frontend automatically retries
- ✅ Backend sets new CSRF token
- ✅ Second request succeeds
- ✅ User doesn't see any error

---

## 🔍 Advanced Testing

### **Test 8: Simulate CSRF Attack**

**Steps:**
1. Create a malicious HTML file on a different domain:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Malicious Site</title>
</head>
<body>
  <h1>Click the button to attack!</h1>
  <button onclick="attack()">Attack</button>
  
  <script>
    function attack() {
      // Try to create a post on victim's behalf
      fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Send victim's cookies
        body: JSON.stringify({ content: 'Hacked!' })
      })
      .then(r => r.json())
      .then(data => {
        console.log('Attack result:', data);
        alert('Attack result: ' + JSON.stringify(data));
      })
      .catch(err => {
        console.error('Attack failed:', err);
        alert('Attack failed: ' + err.message);
      });
    }
  </script>
</body>
</html>
```

2. Open this file in browser while logged into Pryde Social
3. Click the "Attack" button

**Expected Result:**
- ❌ Attack should FAIL
- ❌ Response: `"message": "CSRF token missing"`
- ✅ Post should NOT be created
- ✅ CSRF protection successfully blocked the attack

**Why it fails:**
- Attacker cannot read the CSRF token from victim's cookies (Same-Origin Policy)
- Attacker cannot set the `X-XSRF-TOKEN` header without knowing the token
- SameSite=Strict prevents cookies from being sent cross-site

---

## ✅ Success Criteria

CSRF protection is working correctly if:

1. ✅ CSRF token cookie is set on all requests
2. ✅ CSRF token header is sent on POST/PUT/PATCH/DELETE requests
3. ✅ Requests without CSRF token are rejected (403)
4. ✅ Requests with valid CSRF token are accepted
5. ✅ GET requests don't require CSRF token
6. ✅ Expired tokens are rejected and refreshed automatically
7. ✅ CSRF attacks from external sites are blocked
8. ✅ User experience is not negatively impacted

---

## 🚨 What to Do If Tests Fail

If any test fails:

1. **Check backend logs** - Look for CSRF-related errors
2. **Verify middleware order** - CSRF middleware must be after cookie-parser
3. **Check cookie settings** - Ensure `httpOnly: false` to allow JS to read
4. **Verify frontend code** - Ensure `getCsrfToken()` is working
5. **Check CORS settings** - Ensure `withCredentials: true` in axios config
6. **Review browser console** - Look for CSRF-related errors

---

## 📊 Testing Checklist

- [ ] CSRF token cookie is set
- [ ] CSRF token header is sent on mutations
- [ ] Invalid requests are blocked
- [ ] Valid requests are allowed
- [ ] GET requests are exempted
- [ ] Token expiration works
- [ ] Automatic refresh works
- [ ] CSRF attacks are blocked
- [ ] Works in Desktop browser
- [ ] Works in Mobile browser
- [ ] Works in PWA

---

## ✅ TESTING COMPLETE

Once all tests pass, CSRF protection is verified and the platform is secure against CSRF attacks.

