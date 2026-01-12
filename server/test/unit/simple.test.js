/**
 * Simple Test - Verify test framework works
 */

import { expect } from 'chai';

describe('Simple Test Suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).to.equal(2);
  });

  it('should handle strings', () => {
    expect('hello').to.equal('hello');
  });

  it('should handle objects', () => {
    const obj = { name: 'test' };
    expect(obj).to.have.property('name', 'test');
  });
});

