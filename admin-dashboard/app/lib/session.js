export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const TOKEN_KEY = 'lifebacktax_token';

export function readPayload(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

export function isTokenValid(token) {
  try {
    const payload = readPayload(token);
    return Boolean(payload && payload.exp) && payload.exp * 1000 > Date.now();
  } catch (_err) {
    return false;
  }
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token || !isTokenValid(token)) return '';
  return token;
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.replace('/');
  }

  return response;
}
