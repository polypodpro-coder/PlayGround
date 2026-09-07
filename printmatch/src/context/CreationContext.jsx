import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { API_ENABLED } from '../config/runtime';
import { creationApi, encodeModel } from '../services/creationApi';
import { getSession } from '../services/platformApi';
import { validateSTLBuffer, validateSTLGeometry, MAX_STL_BYTES } from '../lib/stlValidation';

const CreationContext = createContext(null);
export function CreationProvider({ children }) {
  const { printers, myShop } = useApp();
  const [mode, setMode] = useState(API_ENABLED ? 'unavailable' : 'preview');
  const [loading, setLoading] = useState(API_ENABLED), [error, setError] = useState('');
  const [sharingEnabled, setSharingEnabled] = useState(!API_ENABLED);
  const [entries, setEntries] = useState([]), [remoteFarms, setRemoteFarms] = useState([]), [remoteInbox, setRemoteInbox] = useState([]);
  const localEntries = useRef([]), localFiles = useRef(new Map()), csrf = useRef(null), generation = useRef(0);
  const farms = useMemo(() => API_ENABLED ? remoteFarms : printers.filter(farm => !farm.pausedUntil).map(({ id, name }) => ({ id, name })), [remoteFarms, printers]);
  const refresh = useCallback(async () => {
    if (!API_ENABLED) return;
    const ticket = ++generation.current;
    setLoading(true); setError('');
    try {
      const [session, status] = await Promise.all([getSession(), creationApi.status()]);
      if (ticket !== generation.current) return;
      csrf.current = null;
      if (!status.configured || !session?.available && !session?.authenticated) {
        setMode('unavailable'); setSharingEnabled(false); setEntries([]); setRemoteInbox([]); setRemoteFarms([]); return;
      }
      if (!session.authenticated) { setMode('signed-out'); setSharingEnabled(false); setEntries([]); setRemoteInbox([]); setRemoteFarms([]); return; }
      if (session.accountStatus !== 'active') throw new Error('An active account with a verified email is required for private sharing.');
      const [library, farmList, requests] = await Promise.all([creationApi.list(), creationApi.farms(), creationApi.inbox()]);
      if (ticket !== generation.current) return;
      csrf.current = session.csrfToken;
      setEntries(library.creations); setRemoteFarms(farmList.farms); setRemoteInbox(requests.inbox);
      setMode('connected'); setSharingEnabled(Boolean(status.enabled));
    } catch (cause) {
      if (ticket !== generation.current) return;
      csrf.current = null; setMode('unavailable'); setSharingEnabled(false); setEntries([]); setRemoteInbox([]); setRemoteFarms([]); setError(cause.message);
    } finally { if (ticket === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const requestGeneration = generation;
    // Synchronize the session and remote library; invalidate pending work on unmount.
    void Promise.resolve().then(() => { if (active) void refresh(); });
    return () => { active = false; requestGeneration.current++; };
  }, [refresh]);
  const inbox = useMemo(() => API_ENABLED ? remoteInbox : entries.flatMap(creation => (creation.shares || []).filter(share => share.sellerId === myShop?.id).map(share => ({ ...share, creationId: creation.id, creation, buyerLabel: 'Buyer in this preview tab' }))), [entries, remoteInbox, myShop?.id]);
  function updatePreview(next) { localEntries.current = next; setEntries(next); }
  function writable() { if (!sharingEnabled || !['preview', 'connected'].includes(mode)) throw new Error('New imports, shares and estimates are not available right now.'); }
  async function run(action) { setError(''); try { return await action(); } catch (cause) { setError(cause.message); throw cause; } }
  async function saveCreation({ file, title, sourceUnits }) {
    return run(async () => {
      writable();
      if (!file || !/\.stl$/i.test(file.name) || !file.size || file.size > MAX_STL_BYTES) throw new Error('Choose a non-empty STL file up to 10 MB.');
      if (!['mm', 'cm', 'in'].includes(sourceUnits)) throw new Error('Confirm the STL source units.');
      const name = title?.trim(); if (!name || name.length > 120) throw new Error('Use a creation title of 1–120 characters.');
      const buffer = await file.arrayBuffer(); const count = validateSTLBuffer(buffer);
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const geometry = new STLLoader().parse(buffer);
      try { validateSTLGeometry(geometry, count); } finally { geometry.dispose(); }
      if (API_ENABLED) {
        const result = await creationApi.create({ modelBase64: await encodeModel(file), title: name, source: 'meshy', sourceUnits, consent: true }, csrf.current);
        await refresh(); return result.creation;
      }
      if (localEntries.current.length >= 5) throw new Error('This preview holds up to five creations. Download your models before refreshing to start again.');
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const entry = { id: crypto.randomUUID(), title: name, fileName: file.name, sourceUnits, sha256, byteLength: file.size, createdAt: new Date().toISOString(), source: 'meshy', shares: [] };
      localFiles.current.set(entry.id, file); updatePreview([entry, ...localEntries.current]); return entry;
    });
  }
  async function shareCreation(creationId, { sellerId, notes = '' }) {
    return run(async () => {
      writable();
      if (API_ENABLED) { const result = await creationApi.share(creationId, { sellerId, notes, consent: true }, csrf.current); await refresh(); return result.share; }
      const creation = localEntries.current.find(entry => entry.id === creationId), farm = farms.find(entry => entry.id === sellerId);
      if (!creation || !farm) throw new Error('Choose an available farm and a saved creation.');
      if (notes.length > 2000) throw new Error('Use no more than 2,000 characters for your brief.');
      if (creation.shares.some(share => share.sellerId === sellerId)) throw new Error('This creation is already in that sample farm inbox.');
      const share = { id: crypto.randomUUID(), sellerId, sellerName: farm.name, notes: notes.trim(), requestVersion: 1, createdAt: new Date().toISOString(), offer: null };
      updatePreview(localEntries.current.map(entry => entry.id === creationId ? { ...entry, shares: [...entry.shares, share] } : entry)); return share;
    });
  }
  async function respondToRequest(shareId, input) {
    return run(async () => {
      writable();
      if (API_ENABLED) { const result = await creationApi.respond(shareId, input, csrf.current); await refresh(); return result.offer; }
      if (!Number.isInteger(input.productionCents) || input.productionCents < 1 || input.productionCents > 10000000 || !Number.isInteger(input.fulfillmentCents) || input.fulfillmentCents < 0 || input.fulfillmentCents > 100000 || !Number.isInteger(input.leadDays) || input.leadDays < 1 || input.leadDays > 90 || (input.notes || '').length > 2000) throw new Error('Check the estimate amounts, lead time and notes.');
      const current = inbox.find(share => share.id === shareId);
      if (!current) throw new Error('This request is not assigned to the sample farm.');
      if (current.requestVersion !== input.requestVersion) throw new Error('This request changed. Review the latest brief before estimating.');
      const offer = { ...input, createdAt: new Date().toISOString() };
      updatePreview(localEntries.current.map(entry => ({ ...entry, shares: entry.shares.map(share => share.id === shareId ? { ...share, offer } : share) }))); return offer;
    });
  }
  async function revokeShare(shareId) {
    return run(async () => {
      if (API_ENABLED) { await creationApi.revoke(shareId, csrf.current); await refresh(); return; }
      updatePreview(localEntries.current.map(entry => ({ ...entry, shares: entry.shares.filter(share => share.id !== shareId) })));
    });
  }
  async function loadModel(creationId) {
    return run(async () => {
      if (!API_ENABLED) { const file = localFiles.current.get(creationId); if (!file) throw new Error('Model not found in this preview tab.'); return file; }
      const entry = entries.find(item => item.id === creationId) || remoteInbox.find(item => item.creationId === creationId)?.creation;
      const blob = await creationApi.model(creationId); return new File([blob], entry?.fileName || 'creation.stl', { type: 'model/stl' });
    });
  }
  return <CreationContext.Provider value={{ mode, loading, error, entries, farms, inbox, sharingEnabled, saveCreation, shareCreation, respondToRequest, revokeShare, loadModel, refresh, clearError: () => setError('') }}>{children}</CreationContext.Provider>;
}
// oxlint-disable-next-line react/only-export-components -- Shared hook beside its provider.
export function useCreations() { const context = useContext(CreationContext); if (!context) throw new Error('CreationProvider is required'); return context; }
