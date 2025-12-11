/**
 * Pryde Social - Mobile Testing Suite
 * Automated tests for mobile responsiveness and functionality
 * 
 * Run with: npm test
 * Or: node tests/mobile-test-suite.js
 */

import axios from 'axios';

const API_URL = process.env.VITE_API_URL || 'https://pryde-social.onrender.com/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://prydeapp.com';

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper function to log test results
function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (message) console.log(`   ${message}`);
  
  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {}
    };
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
}

// Test Suite
async function runTests() {
  console.log('\n🧪 Starting Pryde Social Mobile Test Suite...\n');
  console.log('='.repeat(60));
  
  // Test 1: API Health Check
  console.log('\n📡 API Health Tests\n');
  const healthCheck = await apiRequest('GET', '/health');
  logTest('API is reachable', healthCheck.success);
  
  // Test 2: Registration Endpoint
  console.log('\n🔐 Authentication Tests\n');
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    birthday: '1995-06-15'
  };
  
  const register = await apiRequest('POST', '/auth/register', testUser);
  logTest('User registration works', register.success, register.error);
  
  let authToken = null;
  if (register.success && register.data.token) {
    authToken = register.data.token;
  }
  
  // Test 3: Login Endpoint
  const login = await apiRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  logTest('User login works', login.success, login.error);
  
  if (login.success && login.data.token) {
    authToken = login.data.token;
  }
  
  // Test 4: Username vs ObjectId Routes
  console.log('\n🔍 Username/ObjectId Route Tests\n');
  
  if (authToken) {
    // Test photo essays by username
    const photoEssaysByUsername = await apiRequest('GET', `/photo-essays/user/${testUser.username}`, null, authToken);
    logTest('Photo essays by username works', photoEssaysByUsername.success, photoEssaysByUsername.error);
    
    // Test journals by username
    const journalsByUsername = await apiRequest('GET', `/journals/user/${testUser.username}`, null, authToken);
    logTest('Journals by username works', journalsByUsername.success, journalsByUsername.error);
    
    // Test longform by username
    const longformByUsername = await apiRequest('GET', `/longform/user/${testUser.username}`, null, authToken);
    logTest('Longform by username works', longformByUsername.success, longformByUsername.error);
  } else {
    logTest('Photo essays by username works', false, 'No auth token available');
    logTest('Journals by username works', false, 'No auth token available');
    logTest('Longform by username works', false, 'No auth token available');
  }
  
  // Test 5: Mobile-Specific Headers
  console.log('\n📱 Mobile Compatibility Tests\n');
  
  // Test viewport meta tag
  try {
    const frontendResponse = await axios.get(FRONTEND_URL);
    const hasViewport = frontendResponse.data.includes('viewport');
    const hasMinScale = frontendResponse.data.includes('minimum-scale');
    logTest('Viewport meta tag present', hasViewport);
    logTest('Viewport prevents zoom', hasMinScale);
  } catch (error) {
    logTest('Frontend accessibility', false, error.message);
  }
  
  // Test 6: API Response Times
  console.log('\n⚡ Performance Tests\n');
  
  const startTime = Date.now();
  await apiRequest('GET', '/health');
  const responseTime = Date.now() - startTime;
  
  logTest('API response time < 500ms', responseTime < 500, `${responseTime}ms`);
  logTest('API response time < 1000ms', responseTime < 1000, `${responseTime}ms`);
  
  // Test 7: Error Handling
  console.log('\n🚨 Error Handling Tests\n');
  
  const invalidLogin = await apiRequest('POST', '/auth/login', {
    email: 'nonexistent@example.com',
    password: 'wrongpassword'
  });
  logTest('Invalid login returns error', !invalidLogin.success && invalidLogin.status === 401);
  
  const unauthorizedAccess = await apiRequest('GET', '/journals/me');
  logTest('Unauthorized access blocked', !unauthorizedAccess.success && unauthorizedAccess.status === 401);
  
  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`📝 Total: ${results.tests.length}`);
  
  const passRate = ((results.passed / results.tests.length) * 100).toFixed(1);
  console.log(`\n🎯 Pass Rate: ${passRate}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}: ${t.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

