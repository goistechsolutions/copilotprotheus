import { useState, useEffect, useCallback } from 'react';

const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'admin';
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

function basicAuthHeader() {
  return 'Basic ' + btoa(`${ADMIN_USER}:${ADMIN_PASS}`);
}

function getSanitizedBaseUrl() {
  let url = import.meta.env.VITE_API_BASE_URL ?? '';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

export function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getSanitizedBaseUrl();
      const res = await fetch(`${baseUrl}${url}`, {
        credentials: 'include',
        headers: { Authorization: basicAuthHeader() },
        ...options,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export async function apiCall(url, method = 'GET', body = null) {
  const baseUrl = getSanitizedBaseUrl();
  const opts = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${url}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
  return json;
}
