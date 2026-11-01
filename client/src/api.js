// Same origin in production (the API serves the built app) and via Vite's proxy in dev.
// Set VITE_API_URL only if the API is hosted on a different domain.
const BASE = import.meta.env.VITE_API_URL || '';

let token = null;
try {
  token = localStorage.getItem('sm_token');
} catch {
  /* storage blocked: the session just won't survive a reload */
}

export const getToken = () => token;

export function setToken(next) {
  token = next;
  try {
    if (next) localStorage.setItem('sm_token', next);
    else localStorage.removeItem('sm_token');
  } catch {
    /* ignore */
  }
}

export const apiBase = BASE;
export const fileUrl = (path) => (path ? BASE + path : null);

/**
 * api('/groups/1')
 * api('/groups', { method: 'POST', body: { name } })   -> JSON
 * api('/groups/1/expenses', { method: 'POST', form })  -> multipart (receipt upload)
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth')) {
      window.dispatchEvent(new Event('sm:unauthorized'));
    }
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}
