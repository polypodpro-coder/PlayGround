import { API_ENABLED as enabled } from '../config/runtime';
async function read(path) {
  if (!enabled) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Service unavailable');
    return await response.json();
  } finally { clearTimeout(timer); }
}
export const getPlatformStatus = () => read('/api/status');
export const getSession = () => read('/api/session');
export function startSignIn() { if (enabled) window.location.assign('/auth/login'); }
export function startSignOut(csrfToken) {
  if (!enabled || !csrfToken) return;
  const form=document.createElement('form');form.method='POST';form.action='/auth/logout';
  const input=document.createElement('input');input.type='hidden';input.name='csrfToken';input.value=csrfToken;
  form.append(input);document.body.append(form);form.submit();
}

