import type { AuthTokens } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let tokens: AuthTokens | null = null;

export function setTokens(t: AuthTokens | null) {
  tokens = t;
  if (t) {
    localStorage.setItem('pumps_tokens', JSON.stringify(t));
  } else {
    localStorage.removeItem('pumps_tokens');
  }
}

export function getTokens(): AuthTokens | null {
  if (tokens) return tokens;
  const saved = localStorage.getItem('pumps_tokens');
  if (saved) {
    try {
      tokens = JSON.parse(saved) as AuthTokens;
      return tokens;
    } catch {
      return null;
    }
  }
  return null;
}

export function getAccessToken(): string | null {
  return getTokens()?.accessToken || null;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamelCase(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = convertKeysToCamelCase(value);
  }
  return result;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Try refresh
    const current = getTokens();
    if (current?.refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTokens({ ...current, accessToken: data.accessToken });
        // Retry original request
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        const retryRes = await fetch(url, { ...options, headers });
        return retryRes;
      } else {
        setTokens(null);
        window.location.href = '/login';
      }
    } else {
      setTokens(null);
      window.location.href = '/login';
    }
  }

  return res;
}

export async function getJson<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return convertKeysToCamelCase(data) as T;
}

export async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return convertKeysToCamelCase(data) as T;
}

export async function patchJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return convertKeysToCamelCase(data) as T;
}

export async function fetchBlob(path: string): Promise<Blob> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.blob();
}
