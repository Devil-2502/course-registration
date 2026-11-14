const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertTestDatabase } = require('./db-safety.cjs');

test('reset requires opt-in, test database and an existing seed', () => {
  const previous = process.env.ALLOW_TEST_DB_RESET;
  try {
    delete process.env.ALLOW_TEST_DB_RESET;
    assert.throws(() => assertTestDatabase('postgresql://localhost/course_test', __filename));
    process.env.ALLOW_TEST_DB_RESET = '1';
    assert.throws(() => assertTestDatabase('postgresql://localhost/course_registration', __filename));
    assert.throws(() => assertTestDatabase('postgresql://localhost/course_test', __filename + '.missing'));
    assert.doesNotThrow(() => assertTestDatabase('postgresql://localhost/course_test', __filename));
  } finally {
    if (previous === undefined) delete process.env.ALLOW_TEST_DB_RESET;
    else process.env.ALLOW_TEST_DB_RESET = previous;
  }
});
