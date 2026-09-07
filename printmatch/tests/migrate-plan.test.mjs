import test from 'node:test';
import assert from 'node:assert/strict';
import { planMigration } from '../server/migrate.mjs';

test('default migration applies only the base schema', () => {
  const steps = planMigration([], {});
  assert.deepEqual(steps.map((s) => s.file), ['./schema.sql']);
});

test('creation schema is opt-in via --with-creations flag', () => {
  const steps = planMigration(['--with-creations'], {});
  assert.deepEqual(steps.map((s) => s.file), ['./schema.sql', './creations.sql']);
});

test('creation schema is opt-in via CREATION_SHARING_ENABLED=true', () => {
  const steps = planMigration([], { CREATION_SHARING_ENABLED: 'true' });
  assert.deepEqual(steps.map((s) => s.file), ['./schema.sql', './creations.sql']);
});

test('non-true CREATION_SHARING_ENABLED does not add the creation schema', () => {
  for (const value of ['false', '1', 'yes', '', undefined]) {
    const steps = planMigration([], { CREATION_SHARING_ENABLED: value });
    assert.deepEqual(steps.map((s) => s.file), ['./schema.sql']);
  }
});

test('base schema is always applied before the creation schema', () => {
  const steps = planMigration(['--with-creations'], { CREATION_SHARING_ENABLED: 'true' });
  assert.equal(steps[0].file, './schema.sql');
  assert.equal(steps.at(-1).file, './creations.sql');
  // each step carries a distinct advisory-lock key
  assert.equal(new Set(steps.map((s) => s.lock)).size, steps.length);
});
