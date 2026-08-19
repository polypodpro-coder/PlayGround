import { chat, parseJsonObject } from './llm.js';
import { SYSTEM_PROMPT, goalMessage, observationMessage } from './prompt.js';
import { domainAllowed } from './settings.js';

// Keeps the prompt bounded: old observations collapse to a one-liner, recent ones stay full.
const FULL_OBSERVATIONS = 3;

export class AgentRun {
  constructor({ goal, tabId, settings, emit }) {
    this.goal = goal;
    this.tabId = tabId;
    this.settings = settings;
    this.emit = emit;
    this.controller = new AbortController();
    this.messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: goalMessage(goal) }
    ];
    this.step = 0;
    this.stopped = false;
    this.pendingAnswer = null;
    this.answerResolver = null;
  }

  stop(reason = 'stopped by user') {
    this.stopped = true;
    this.stopReason = reason;
    this.controller.abort();
    if (this.answerResolver) this.answerResolver(null);
  }

  // The side panel calls this when the user replies to an "ask" action.
  provideAnswer(text) {
    if (this.answerResolver) {
      const resolve = this.answerResolver;
      this.answerResolver = null;
      resolve(text);
    }
  }

  async run() {
    let lastResult = null;
    try {
      while (!this.stopped) {
        if (this.step >= this.settings.maxSteps) {
          this.emit({ type: 'finished', status: 'limit', message: `Stopped after ${this.settings.maxSteps} steps.` });
          return;
        }
        this.step++;

        const snapshot = await this.observe();
        if (!domainAllowed(snapshot.url, this.settings.allowedDomains)) {
          this.emit({
            type: 'finished',
            status: 'blocked',
            message: `${new URL(snapshot.url).hostname} is not in your allowed-domains list.`
          });
          return;
        }

        this.pushObservation(observationMessage(snapshot, lastResult));
        this.emit({ type: 'observation', step: this.step, url: snapshot.url, elements: snapshot.elements.length });

        const raw = await this.think();
        const decision = this.parseDecision(raw);
        this.messages.push({ role: 'assistant', content: JSON.stringify(decision) });
        this.emit({ type: 'thought', step: this.step, thought: decision.thought, action: decision.action });

        const outcome = await this.execute(decision.action);
        if (outcome.terminal) return;
        lastResult = outcome.result;
      }
      this.emit({ type: 'finished', status: 'stopped', message: this.stopReason || 'Stopped.' });
    } catch (err) {
      if (this.stopped) {
        this.emit({ type: 'finished', status: 'stopped', message: this.stopReason || 'Stopped.' });
      } else {
        this.emit({ type: 'finished', status: 'error', message: String(err?.message || err) });
      }
    }
  }

  async think() {
    const timeout = setTimeout(() => this.controller.abort(), this.settings.stepTimeoutMs);
    try {
      return await chat(this.messages, this.settings, this.controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  parseDecision(raw) {
    const obj = parseJsonObject(raw);
    const action = obj.action || obj.tool || obj;
    if (!action || typeof action.name !== 'string') {
      throw new Error(`model did not return an action: ${String(raw).slice(0, 200)}`);
    }
    return { thought: String(obj.thought || '').slice(0, 300), action };
  }

  async execute(action) {
    try {
      switch (action.name) {
        case 'done':
          this.emit({ type: 'finished', status: 'done', message: action.answer || 'Goal complete.' });
          return { terminal: true };

        case 'ask': {
          this.emit({ type: 'question', question: action.question || 'What should I do next?' });
          const answer = await new Promise((resolve) => {
            this.answerResolver = resolve;
          });
          if (answer === null) return { terminal: true };
          return { result: `The user replied: ${answer}` };
        }

        case 'navigate': {
          const url = normalizeUrl(action.url);
          if (!domainAllowed(url, this.settings.allowedDomains)) {
            return { result: `Refused: ${url} is outside the allowed domains.` };
          }
          await chrome.tabs.update(this.tabId, { url });
          await this.waitForLoad();
          return { result: `navigated to ${url}` };
        }

        case 'back': {
          await chrome.tabs.goBack(this.tabId).catch(() => {});
          await this.waitForLoad();
          return { result: 'went back' };
        }

        case 'wait': {
          const ms = Math.min(Number(action.ms) || 1000, 10000);
          await sleep(ms);
          return { result: `waited ${ms}ms` };
        }

        default: {
          const result = await this.sendToContent({ type: 'act', action });
          await this.waitForLoad();
          return { result };
        }
      }
    } catch (err) {
      if (this.stopped) return { terminal: true };
      const message = String(err?.message || err);
      this.emit({ type: 'action-error', message });
      return { result: `ERROR: ${message}` };
    }
  }

  async observe() {
    await this.ensureContentScript();
    return this.sendToContent({ type: 'snapshot' }, 'snapshot');
  }

  async sendToContent(message, field = 'result') {
    const response = await chrome.tabs.sendMessage(this.tabId, { ...message, target: 'content' });
    if (!response?.ok) throw new Error(response?.error || 'content script did not respond');
    return response[field];
  }

  async ensureContentScript() {
    try {
      const pong = await chrome.tabs.sendMessage(this.tabId, { target: 'content', type: 'ping' });
      if (pong?.ok) return;
    } catch {
      /* not injected yet (e.g. the tab pre-dates the extension install) */
    }
    await chrome.scripting.executeScript({ target: { tabId: this.tabId }, files: ['content/content.js'] });
    await sleep(150);
  }

  // Actions often trigger navigation; give the tab a moment to settle before the next observation.
  async waitForLoad(timeoutMs = 15000) {
    const start = Date.now();
    await sleep(400);
    while (Date.now() - start < timeoutMs) {
      const tab = await chrome.tabs.get(this.tabId).catch(() => null);
      if (!tab) throw new Error('the tab was closed');
      if (tab.status === 'complete') break;
      await sleep(250);
    }
    await sleep(300);
  }

  pushObservation(content) {
    this.messages.push({ role: 'user', content });
    const observationIndexes = [];
    for (let i = 2; i < this.messages.length; i++) {
      if (this.messages[i].role === 'user') observationIndexes.push(i);
    }
    for (const i of observationIndexes.slice(0, -FULL_OBSERVATIONS)) {
      const msg = this.messages[i];
      if (msg.collapsed) continue;
      msg.collapsed = true;
      msg.content = '(earlier page observation omitted)';
    }
  }
}

function normalizeUrl(url) {
  const s = String(url || '').trim();
  if (!s) throw new Error('navigate requires a url');
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
  throw new Error(`refusing to navigate to "${s}"`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
