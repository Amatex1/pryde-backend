/**
 * Test Error Handling
 * 
 * Quick script to verify error handling improvements
 * Run with: node test-error-handling.js
 */

const API_URL = 'https://pryde-backend.onrender.com';

async function testEndpoint(name, url, expectedStatus) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    
    const data = await response.json();
    const status = response.status;
    const passed = status === expectedStatus;
    
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    console.log(`   Expected: ${expectedStatus}, Got: ${status}`);
    console.log(`   Response:`, data);
    console.log('');
    
    return passed;
  } catch (error) {
    console.log(`❌ ${name} - Network Error`);
    console.log(`   Error:`, error.message);
    console.log('');
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Error Handling\n');
  console.log('='.repeat(50));
  console.log('');
  
  const results = [];
  
  // Test 1: Health endpoint (should work)
  results.push(await testEndpoint(
    'Health Endpoint',
    `${API_URL}/api/health`,
    200
  ));
  
  // Test 2: Non-existent route (should return 404, not 500)
  results.push(await testEndpoint(
    'Non-existent Route (404)',
    `${API_URL}/api/this-does-not-exist`,
    404
  ));
  
  // Test 3: /api/v4/user (should return 404, not 500)
  results.push(await testEndpoint(
    'Cloudflare API Route (404)',
    `${API_URL}/api/v4/user`,
    404
  ));
  
  // Test 4: Protected route without auth (should return 401, not 500)
  results.push(await testEndpoint(
    'Protected Route Without Auth (401)',
    `${API_URL}/api/notifications`,
    401
  ));
  
  // Test 5: Another non-existent route
  results.push(await testEndpoint(
    'Another Non-existent Route (404)',
    `${API_URL}/api/v4/accounts/test`,
    404
  ));
  
  console.log('='.repeat(50));
  console.log('');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }
}

// Run tests
runTests().catch(console.error);

