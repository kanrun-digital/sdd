const { test } = require('node:test');
const assert = require('node:assert');
const { isEnabled } = require('./flags.js');

test('AC-01: a registered enabled flag reports enabled', () => {
  assert.strictEqual(isEnabled('beta_banner'), true);
});
