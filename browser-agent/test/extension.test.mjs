/**
 * End-to-end over the real unpacked extension: service worker, agent loop,
 * content scripts and the mock model server, all wired together.
 *
 * It drives the background over the same port the side panel uses, from inside
 * the side panel's own page. Chrome offers no way to open a side panel
 * programmatically, so the panel's DOM is covered by the DOM tests and its
 * *protocol* is covered here.
 *
 *   node --test test/extension.test.mjs
 *
 * Skips itself (rather than failing) if this Chromium refuses to load an
 * unpacked extension, which some sandboxed CI images do.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { startMockServer } from './mock-llm-server.mjs';

const file = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const EXTENSION_DIR = file('../');

const PRESET_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PRESET_CHROMIUM) ? PRESET_CHROMIUM : undefined;

/** Content scripts do not run on file:// without an extra permission, so serve. */
async function startFixtureServer() {
  const html = await readFile(file('./fixtures/login.html'), 'utf8');
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/login.html`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    executablePath,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });

  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }
  // Worker.url is a method in Playwright's API, not a property.
  return { context, extensionId: new URL(worker.url()).host };
}

test('the agent runs a scripted goal end to end', async (t) => {
  const fixture = await startFixtureServer();
  const mock = await startMockServer({ port: 0 });

  mock.setScript([
    { reasoning: 'Fill in the email address.', tool: 'type', ref: 1, text: 'agent@fixture.test' },
    { reasoning: 'Submit the form.', tool: 'click', ref: 5 },
    { reasoning: 'Signed in.', tool: 'done', summary: 'Signed in as agent@fixture.test' },
  ]);

  let context;
  let extensionId;
  try {
    ({ context, extensionId } = await launchWithExtension());
  } catch (error) {
    await Promise.all([fixture.close(), mock.close()]);
    return t.skip(`this Chromium cannot load an unpacked extension: ${error.message}`);
  }

  try {
    const target = await context.newPage();
    await target.goto(fixture.url);

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/panel.html`);

    // Point the extension at the mock model and open our own port to the
    // background — the same protocol the panel's own code speaks.
    await panel.evaluate(async (endpoint) => {
      await chrome.storage.local.set({
        settings: { endpoint, model: 'mock-model', temperature: 0, maxSteps: 10, requestTimeoutMs: 15000, allowlist: [] },
      });

      window.__states = [];
      window.__port = chrome.runtime.connect({ name: 'agent-panel' });
      window.__port.onMessage.addListener((message) => {
        if (message.type === 'bg:state') window.__states.push(message.state);
      });
    }, `http://127.0.0.1:${mock.port}/v1`);

    const tabId = await panel.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return tab.id;
    }, fixture.url);
    assert.ok(tabId, 'fixture tab should be findable');

    const latest = () => panel.evaluate(() => window.__states.at(-1));
    const stateCount = () => panel.evaluate(() => window.__states.length);

    /**
     * Wait for a *new* state with this status. The `after` cursor matters: the
     * loop returns to awaiting_approval on every step, so waiting on the status
     * alone would match the step we just approved and race ahead.
     */
    const waitForStatus = (status, after) =>
      panel.waitForFunction(
        ([wanted, from]) =>
          window.__states.length > from && window.__states.at(-1)?.status === wanted,
        [status, after],
        { timeout: 20000 },
      );

    await panel.evaluate(
      ([goal, id]) => window.__port.postMessage({ type: 'panel:start', goal, tabId: id }),
      ['Sign in to the fixture site', tabId],
    );

    // Step 1: the type action is proposed and the loop BLOCKS.
    await waitForStatus('awaiting_approval', 0);
    const typeStep = await latest();
    assert.equal(typeStep.pending.action.tool, 'type');
    assert.match(typeStep.pending.description, /Type "agent@fixture\.test" into \[1\]/);
    assert.equal(
      await target.inputValue('#email'),
      '',
      'nothing may touch the page before approval',
    );

    // The element is highlighted for the user while we wait.
    await target.waitForFunction(() => {
      const overlay = document.getElementById('__local-agent-highlight');
      return overlay && overlay.style.display === 'block';
    });

    let seen = await stateCount();
    await panel.evaluate(() => window.__port.postMessage({ type: 'panel:approve' }));

    // Step 2: the click is proposed only after the type actually landed.
    await waitForStatus('awaiting_approval', seen);
    const clickStep = await latest();
    assert.equal(clickStep.pending.action.tool, 'click');
    assert.match(clickStep.pending.description, /Click \[5\] button "Sign in"/);
    assert.equal(await target.inputValue('#email'), 'agent@fixture.test');

    seen = await stateCount();
    await panel.evaluate(() => window.__port.postMessage({ type: 'panel:approve' }));

    // Step 3: done needs no approval — nothing happens to the page.
    await waitForStatus('done', seen);
    const final = await latest();
    assert.equal(final.answer, 'Signed in as agent@fixture.test');
    assert.equal(final.history.length, 2);
    assert.ok(final.history.every((entry) => entry.result.ok));
    assert.equal(await target.title(), 'Signed in — Fixture');

    // The model saw a real page snapshot, and never saw the password.
    const prompts = mock.requests.map((r) => r.messages.at(-1).content);
    assert.match(prompts[0], /\[1\] input type=email "Email"/);
    assert.match(prompts[0], /password — do not type into this/);
    assert.ok(!prompts.join('').includes('hunter2'));
    assert.match(prompts[1], /1\. Type "agent@fixture\.test" into \[1\].*→ ok/);
  } finally {
    await context?.close();
    await Promise.all([fixture.close(), mock.close()]);
  }
});

test('checkpoint mode runs ordinary actions unattended and only pauses on a sensitive one', async (t) => {
  const fixture = await startFixtureServer();
  const mock = await startMockServer({ port: 0 });

  mock.setScript([
    { reasoning: "I'll fill in the email first.", tool: 'type', ref: 1, text: 'agent@fixture.test' },
    { reasoning: "I'll submit the form now.", tool: 'click', ref: 5, sensitive: true },
    { reasoning: 'Signed in.', tool: 'done', summary: 'Signed in as agent@fixture.test' },
  ]);

  let context;
  let extensionId;
  try {
    ({ context, extensionId } = await launchWithExtension());
  } catch (error) {
    await Promise.all([fixture.close(), mock.close()]);
    return t.skip(`this Chromium cannot load an unpacked extension: ${error.message}`);
  }

  try {
    const target = await context.newPage();
    await target.goto(fixture.url);

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/panel.html`);

    await panel.evaluate(async (endpoint) => {
      await chrome.storage.local.set({
        settings: {
          provider: 'local',
          endpoint,
          model: 'mock-model',
          temperature: 0,
          maxSteps: 10,
          requestTimeoutMs: 15000,
          allowlist: [],
          // Force checkpoint mode regardless of provider, so this test exercises
          // the approval-gating logic itself rather than a provider default.
          approvalMode: 'checkpoints',
        },
      });
      window.__states = [];
      window.__port = chrome.runtime.connect({ name: 'agent-panel' });
      window.__port.onMessage.addListener((message) => {
        if (message.type === 'bg:state') window.__states.push(message.state);
      });
    }, `http://127.0.0.1:${mock.port}/v1`);

    const tabId = await panel.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return tab.id;
    }, fixture.url);

    const allStates = () => panel.evaluate(() => window.__states);
    const latest = () => panel.evaluate(() => window.__states.at(-1));

    await panel.evaluate(
      ([goal, id]) => window.__port.postMessage({ type: 'panel:start', goal, tabId: id }),
      ['Sign in to the fixture site', tabId],
    );

    // The sensitive click is the first (and only) approval pause in this run.
    await panel.waitForFunction(
      () => window.__states.at(-1)?.status === 'awaiting_approval',
      null,
      { timeout: 20000 },
    );

    // By the time it pauses, the type action has already run unattended — no
    // approval step for it at all.
    const states = await allStates();
    assert.ok(
      !states.some((s) => s.status === 'awaiting_approval' && s.pending?.action?.tool === 'type'),
      'a non-sensitive action must never pause for approval in checkpoint mode',
    );
    assert.equal(await target.inputValue('#email'), 'agent@fixture.test');

    const pause = await latest();
    assert.equal(pause.pending.action.tool, 'click');
    assert.equal(pause.pending.action.sensitive, true);
    assert.equal(pause.history.length, 1, 'the type step is already recorded');
    assert.equal(pause.history[0].tool, 'type');

    const seen = await panel.evaluate(() => window.__states.length);
    await panel.evaluate(() => window.__port.postMessage({ type: 'panel:approve' }));

    await panel.waitForFunction(
      ([from]) => window.__states.length > from && window.__states.at(-1)?.status === 'done',
      [seen],
      { timeout: 20000 },
    );

    const final = await latest();
    assert.equal(final.answer, 'Signed in as agent@fixture.test');
    assert.equal(final.history.length, 2);
    assert.equal(await target.title(), 'Signed in — Fixture');
  } finally {
    await context?.close();
    await Promise.all([fixture.close(), mock.close()]);
  }
});

test('rejecting an action leaves the page untouched and tells the model why', async (t) => {
  const fixture = await startFixtureServer();
  const mock = await startMockServer({ port: 0 });

  mock.setScript([
    { reasoning: 'Fill in the email.', tool: 'type', ref: 1, text: 'wrong@fixture.test' },
    { reasoning: 'The user refused; stop and report.', tool: 'done', summary: 'Stopped at user request' },
  ]);

  let context;
  let extensionId;
  try {
    ({ context, extensionId } = await launchWithExtension());
  } catch (error) {
    await Promise.all([fixture.close(), mock.close()]);
    return t.skip(`this Chromium cannot load an unpacked extension: ${error.message}`);
  }

  try {
    const target = await context.newPage();
    await target.goto(fixture.url);

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/panel.html`);

    await panel.evaluate(async (endpoint) => {
      await chrome.storage.local.set({
        settings: { endpoint, model: 'mock-model', temperature: 0, maxSteps: 10, requestTimeoutMs: 15000, allowlist: [] },
      });
      window.__states = [];
      window.__port = chrome.runtime.connect({ name: 'agent-panel' });
      window.__port.onMessage.addListener((message) => {
        if (message.type === 'bg:state') window.__states.push(message.state);
      });
    }, `http://127.0.0.1:${mock.port}/v1`);

    const tabId = await panel.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return tab.id;
    }, fixture.url);

    await panel.evaluate(
      ([goal, id]) => window.__port.postMessage({ type: 'panel:start', goal, tabId: id }),
      ['Sign in', tabId],
    );

    await panel.waitForFunction(
      () => window.__states.at(-1)?.status === 'awaiting_approval',
      null,
      { timeout: 20000 },
    );
    await panel.evaluate(() => window.__port.postMessage({ type: 'panel:skip' }));

    await panel.waitForFunction(
      () => window.__states.at(-1)?.status === 'done',
      null,
      { timeout: 20000 },
    );

    assert.equal(await target.inputValue('#email'), '', 'a rejected action must not run');

    const final = await panel.evaluate(() => window.__states.at(-1));
    assert.equal(final.history[0].result.ok, false);
    assert.match(final.history[0].result.message, /user rejected this action/);

    // And the rejection is fed back so the model does not simply retry it.
    const secondPrompt = mock.requests[1].messages.at(-1).content;
    assert.match(secondPrompt, /FAILED — the user rejected this action/);
  } finally {
    await context?.close();
    await Promise.all([fixture.close(), mock.close()]);
  }
});
