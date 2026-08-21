/**
 * Browser-side coverage for the content scripts, which is where the agent
 * actually meets the page.
 *
 * The three content scripts are injected into a plain Chromium page rather than
 * loaded as a real extension: they touch no chrome.* APIs (only
 * src/content/index.js does, and that is just a message router), so this
 * exercises the real code paths without the friction of loading an unpacked
 * extension in CI.
 *
 *   node --test test/dom.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const file = (relative) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Use a pre-installed Chromium when one is present (CI images often ship one
 * whose build number does not match the npm package's expectation), otherwise
 * let Playwright resolve its own.
 */
const PRESET_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PRESET_CHROMIUM)
  ? { executablePath: PRESET_CHROMIUM, args: ['--no-sandbox'] }
  : {};

const SCRIPTS = ['../src/content/highlight.js', '../src/content/observer.js', '../src/content/actuator.js'];
const FIXTURE = `file://${file('./fixtures/login.html')}`;

let browser;
let sources;

test.before(async () => {
  sources = await Promise.all(SCRIPTS.map((path) => readFile(file(path), 'utf8')));
  browser = await chromium.launch(launchOptions);
});

test.after(async () => {
  await browser?.close();
});

/** Fresh page with the content scripts injected and one snapshot taken. */
async function openFixture() {
  const page = await browser.newPage();
  await page.goto(FIXTURE);
  for (const content of sources) await page.addScriptTag({ content });
  return page;
}

const observe = (page) => page.evaluate(() => window.__localAgent.observe());
const execute = (page, action, snapshotId) =>
  page.evaluate(
    ([a, s]) => window.__localAgent.execute(a, s),
    [action, snapshotId],
  );
const events = (page) => page.evaluate(() => window.__events);

test('the snapshot lists interactive elements with stable refs', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);

  assert.match(snapshot.title, /Sign in/);
  assert.ok(snapshot.snapshotId);

  const byLabel = Object.fromEntries(snapshot.elements.map((e) => [e.label, e]));
  assert.equal(byLabel.Email.tag, 'input');
  assert.equal(byLabel.Email.type, 'email');
  assert.equal(byLabel.Plan.tag, 'select');
  assert.deepEqual(byLabel.Plan.options, ['free', 'pro', 'team']);
  assert.equal(byLabel['Sign in'].tag, 'button');
  assert.equal(byLabel['Forgot password?'].tag, 'link');

  // Refs are 1..n with no gaps, which is what the prompt promises the model.
  assert.deepEqual(
    snapshot.elements.map((e) => e.ref),
    snapshot.elements.map((_, i) => i + 1),
  );

  await page.close();
});

test('a password value never reaches the snapshot', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);

  const password = snapshot.elements.find((e) => e.type === 'password');
  assert.equal(password.secret, true);
  assert.equal(password.value, '(set)');
  assert.ok(!JSON.stringify(snapshot).includes('hunter2'));

  await page.close();
});

test('invisible elements are left out', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  assert.ok(!snapshot.elements.some((e) => e.label === 'Invisible'));
  await page.close();
});

test('typing fires the events a framework listens for', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const email = snapshot.elements.find((e) => e.label === 'Email');

  const result = await execute(
    page,
    { tool: 'type', ref: email.ref, text: 'agent@fixture.test' },
    snapshot.snapshotId,
  );

  assert.equal(result.ok, true);
  assert.equal(await page.inputValue('#email'), 'agent@fixture.test');
  // Not just the value — the input/change events too, which is the part a naive
  // `element.value = x` gets wrong and React ignores.
  assert.deepEqual(await events(page), [
    'input:email:agent@fixture.test',
    'change:email:agent@fixture.test',
  ]);

  await page.close();
});

test('clicking reports a resulting title change', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const button = snapshot.elements.find((e) => e.label === 'Sign in');

  const result = await execute(page, { tool: 'click', ref: button.ref }, snapshot.snapshotId);

  assert.equal(result.ok, true);
  assert.match(result.message, /page title is now "Signed in — Fixture"/);
  assert.deepEqual(await events(page), ['click:submit']);

  await page.close();
});

test('select matches an option by its visible text', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const plan = snapshot.elements.find((e) => e.label === 'Plan');

  const result = await execute(
    page,
    { tool: 'select', ref: plan.ref, value: 'Pro' },
    snapshot.snapshotId,
  );

  assert.equal(result.ok, true);
  assert.equal(await page.inputValue('#plan'), 'pro');
  await page.close();
});

test('an unmatched option lists what was actually available', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const plan = snapshot.elements.find((e) => e.label === 'Plan');

  const result = await execute(
    page,
    { tool: 'select', ref: plan.ref, value: 'Enterprise' },
    snapshot.snapshotId,
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Available: Free, Pro, Team/);
  await page.close();
});

test('an action from a stale snapshot is refused, not guessed at', async () => {
  const page = await openFixture();
  const stale = await observe(page);
  await observe(page); // any re-read invalidates the previous refs

  const result = await execute(
    page,
    { tool: 'click', ref: stale.elements[0].ref },
    stale.snapshotId,
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /page changed since this action was planned/);
  assert.deepEqual(await events(page), []);
  await page.close();
});

test('a ref whose element has been removed fails cleanly', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const forgot = snapshot.elements.find((e) => e.label === 'Forgot password?');

  await page.evaluate(() => document.getElementById('forgot').remove());
  const result = await execute(page, { tool: 'click', ref: forgot.ref }, snapshot.snapshotId);

  assert.equal(result.ok, false);
  assert.match(result.message, /no longer on the page|was removed/);
  await page.close();
});

test('scrolling reports where it ended up', async () => {
  const page = await openFixture();
  await page.setViewportSize({ width: 800, height: 300 });
  await page.evaluate(() => {
    document.body.style.height = '4000px';
  });
  const snapshot = await observe(page);

  const down = await execute(page, { tool: 'scroll', direction: 'down' }, snapshot.snapshotId);
  assert.equal(down.ok, true);
  assert.match(down.message, /scrolled down, now at y=\d+/);
  assert.ok(await page.evaluate(() => window.scrollY > 0));

  const top = await execute(page, { tool: 'scroll', direction: 'top' }, snapshot.snapshotId);
  assert.match(top.message, /now at y=0/);
  await page.close();
});

test('a submit button inside a form is flagged formSubmit; a plain button is not', async () => {
  const page = await browser.newPage();
  await page.setContent(`
    <form><button id="a" type="submit">Save</button></form>
    <form><input id="b" type="submit" value="Go" /></form>
    <form><button id="c" type="button">Cancel</button></form>
    <button id="d">Outside any form</button>
  `);
  for (const content of sources) await page.addScriptTag({ content });
  const snapshot = await observe(page);

  const flagged = snapshot.elements.filter((e) => e.formSubmit);
  assert.equal(flagged.length, 2);
  assert.ok(flagged.some((e) => e.label === 'Save'));
  // The value-as-label input has no text label, so check by absence of the others.
  assert.ok(!snapshot.elements.find((e) => e.label === 'Cancel')?.formSubmit);
  assert.ok(!snapshot.elements.find((e) => e.label === 'Outside any form')?.formSubmit);

  await page.close();
});

test('the highlight ring lands over the element it names', async () => {
  const page = await openFixture();
  const snapshot = await observe(page);
  const button = snapshot.elements.find((e) => e.label === 'Sign in');

  const shown = await page.evaluate(
    (ref) => window.__localAgent.highlight(window.__localAgent.resolveRef(ref), `click [${ref}]`),
    button.ref,
  );
  assert.equal(shown, true);

  await page.waitForFunction(() => {
    const overlay = document.getElementById('__local-agent-highlight');
    return overlay && overlay.style.display === 'block';
  });

  const [overlayBox, buttonBox] = await Promise.all([
    page.locator('#__local-agent-highlight').boundingBox(),
    page.locator('#submit').boundingBox(),
  ]);
  assert.ok(Math.abs(overlayBox.x - buttonBox.x) < 4);
  assert.ok(Math.abs(overlayBox.y - buttonBox.y) < 4);

  await page.evaluate(() => window.__localAgent.clearHighlight());
  assert.equal(
    await page.evaluate(() => document.getElementById('__local-agent-highlight').style.display),
    'none',
  );

  await page.close();
});
