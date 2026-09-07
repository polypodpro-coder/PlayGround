const DEFAULT_REFERRAL = 'https://www.meshy.ai/?via=PolyPodPro';

export function safeMeshyReferral(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['meshy.ai', 'www.meshy.ai'].includes(url.hostname) && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export const MESHY_PORTAL = Object.freeze({
  workspaceUrl: 'https://www.meshy.ai/workspace',
  referralUrl: safeMeshyReferral(import.meta.env?.VITE_MESHY_REFERRAL_URL) || DEFAULT_REFERRAL,
});
