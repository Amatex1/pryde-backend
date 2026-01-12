# Testing Guide - Pryde Backend

## Overview
Comprehensive testing strategy for all critical fixes and features.

## Test Structure

```
server/tests/
├── unit/                    # Unit tests for utilities
│   ├── messageDeduplication.test.js
│   ├── notificationDeduplication.test.js
│   ├── errorResponse.test.js
│   ├── reactionCache.test.js
│   ├── feedRanking.test.js
│   └── rtlDetection.test.js
├── integration/             # Integration tests
│   ├── socketErrorHandling.test.js
│   ├── authMiddleware.test.js
│   ├── messageFlow.test.js
│   └── notificationFlow.test.js
├── e2e/                     # End-to-end tests
│   ├── userJourney.test.js
│   └── realTimeFeatures.test.js
└── runTests.js              # Test runner
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode (Development)
```bash
npm run test:watch
```

## Test Categories

### 1. Unit Tests
Test individual functions and utilities in isolation.

**Example: Message Deduplication**
```javascript
describe('generateMessageFingerprint', () => {
  it('should generate consistent fingerprints', () => {
    const fp1 = generateMessageFingerprint('user1', 'user2', 'Hello');
    const fp2 = generateMessageFingerprint('user1', 'user2', 'Hello');
    expect(fp1).toBe(fp2);
  });
});
```

### 2. Integration Tests
Test how components work together.

**Example: Socket Error Handling**
```javascript
describe('send_message error handling', () => {
  it('should return error for invalid data', (done) => {
    socket.emit('send_message', null);
    socket.on('message:error', (error) => {
      expect(error.code).toBe('INVALID_DATA');
      done();
    });
  });
});
```

### 3. E2E Tests
Test complete user flows from start to finish.

**Example: Message Flow**
```javascript
describe('Complete message flow', () => {
  it('should send, receive, and display message', async () => {
    // Login
    const token = await login('user1', 'password');
    
    // Send message
    const message = await sendMessage(token, 'user2', 'Hello');
    
    // Verify received
    const messages = await getMessages(token, 'user2');
    expect(messages).toContainEqual(message);
  });
});
```

## Manual Testing Checklist

### Sprint 1: Critical Fixes

#### Socket Error Handlers
- [ ] Send null data → Receive INVALID_DATA error
- [ ] Send missing recipientId → Receive MISSING_RECIPIENT error
- [ ] Send empty message → Receive EMPTY_MESSAGE error
- [ ] Verify error includes timestamp
- [ ] Verify socket doesn't disconnect on error

#### Auth 500 Prevention
- [ ] Invalid token → 401 with INVALID_TOKEN
- [ ] Expired token → 401 with TOKEN_EXPIRED
- [ ] Malformed token → 401 with MALFORMED_TOKEN
- [ ] Missing token → 401 with UNAUTHORIZED
- [ ] Verify NEVER returns 500

#### API Error Standardization
- [ ] All errors have `message` and `code` fields
- [ ] Development mode includes `details`
- [ ] Production mode excludes `details`
- [ ] Mongoose errors are handled correctly
- [ ] JWT errors are handled correctly

#### DM Deduplication
- [ ] Send same message twice within 5 seconds
- [ ] Verify only 1 message created
- [ ] Verify same message ID returned
- [ ] Wait 60 seconds, send again
- [ ] Verify new message created

#### Notification Idempotency
- [ ] Like same post twice within 60 seconds
- [ ] Verify only 1 notification created
- [ ] Verify unread count is correct
- [ ] Wait 5 minutes, like again
- [ ] Verify new notification created

### Sprint 2: Medium Priority

#### Reaction Caching
- [ ] First reaction query → Cache miss
- [ ] Second reaction query → Cache hit
- [ ] Verify cache expires after 5 minutes
- [ ] Verify cache invalidates on new reaction

#### Database Migrations
- [ ] Run `npm run migrate:status`
- [ ] Run `npm run migrate`
- [ ] Verify migrations applied
- [ ] Check database for changes

#### Comment Threading
- [ ] Create top-level comment
- [ ] Create reply to comment
- [ ] Verify reply count updates
- [ ] Delete parent comment
- [ ] Verify replies also deleted

### Sprint 3: Low Priority

#### Feed Ranking
- [ ] Create posts with different engagement
- [ ] Verify high-engagement posts rank higher
- [ ] Verify recent posts rank higher than old
- [ ] Verify followed users get boost

#### API Versioning
- [ ] Request /api/v1/posts → Success
- [ ] Request /api/v2/posts → Success (if implemented)
- [ ] Request /api/v99/posts → 400 error
- [ ] Verify X-API-Version header in response

#### RTL Detection
- [ ] Post Arabic text → direction: 'rtl'
- [ ] Post English text → direction: 'ltr'
- [ ] Post mixed text → correct direction
- [ ] Verify sanitization removes direction overrides

## Performance Testing

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run tests/load/socket-load.yml
```

### Stress Testing
```bash
# Test message deduplication under load
artillery run tests/load/message-stress.yml
```

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit Tests | 80% | TBD |
| Integration Tests | 70% | TBD |
| E2E Tests | 60% | TBD |
| Overall | 75% | TBD |

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v2
```

## Debugging Tests

### Enable Debug Logs
```bash
DEBUG=* npm test
```

### Run Single Test File
```bash
npm test -- messageDeduplication.test.js
```

### Run Single Test Case
```bash
npm test -- -t "should generate consistent fingerprints"
```

## Best Practices

1. **Arrange-Act-Assert** pattern
2. **One assertion per test** (when possible)
3. **Descriptive test names**
4. **Clean up after tests** (clear caches, close connections)
5. **Mock external dependencies**
6. **Test edge cases** (null, undefined, empty, large values)
7. **Test error paths** (not just happy paths)

## Next Steps

1. ✅ Create test files
2. ⚠️ Implement all test cases
3. ⚠️ Set up CI/CD pipeline
4. ⚠️ Achieve 75% coverage
5. ⚠️ Add performance tests
6. ⚠️ Add security tests

