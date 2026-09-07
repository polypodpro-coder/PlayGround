export function isApiEnabled(env = {}) {
  return env.VITE_API_ENABLED === 'true';
}
export const API_ENABLED = isApiEnabled(import.meta.env);
