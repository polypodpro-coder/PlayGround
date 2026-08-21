/**
 * Persistence.
 *
 * Settings live in `storage.local` (survive browser restarts). The active run
 * lives in `storage.session` (cleared when Chrome closes, which is right — a
 * half-finished run against a page you no longer have open is not worth
 * resuming).
 *
 * Why persist the run at all: an MV3 service worker is killed after ~30s idle,
 * and a step-by-step approval loop is idle by definition while it waits for the
 * user. The port from the side panel keeps the worker alive in practice, but a
 * kill must not lose the run — so every state transition writes through.
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS, STATUS } from '../shared/protocol.js';

export async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

export function emptyRun() {
  return {
    id: null,
    goal: '',
    tabId: null,
    status: STATUS.IDLE,
    step: 0,
    maxSteps: DEFAULT_SETTINGS.maxSteps,
    provider: DEFAULT_SETTINGS.provider,
    approvalMode: DEFAULT_SETTINGS.approvalMode,
    history: [],
    pending: null,
    snapshot: null,
    answer: null,
    error: null,
    startedAt: null,
  };
}

export async function loadRun() {
  const stored = await chrome.storage.session.get(STORAGE_KEYS.RUN);
  return stored[STORAGE_KEYS.RUN] || emptyRun();
}

export async function saveRun(run) {
  await chrome.storage.session.set({ [STORAGE_KEYS.RUN]: run });
}

export async function clearRun() {
  await chrome.storage.session.remove(STORAGE_KEYS.RUN);
}
