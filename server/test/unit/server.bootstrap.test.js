import { describe, it } from 'mocha';
import { strict as assert } from 'assert';

describe('Server bootstrap in test mode', function() {
  it('does not start listening when imported under NODE_ENV=test', async function() {
    const serverModule = await import('../../server.js');

    assert.ok(serverModule.app, 'named app export should exist');
    assert.ok(serverModule.server, 'named server export should exist');
    assert.strictEqual(serverModule.server.listening, false);
  });
});