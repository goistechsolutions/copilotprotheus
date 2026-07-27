import { useState, useEffect, useCallback } from 'react';

function getSanitizedBaseUrl() {
  let url = import.meta.env.VITE_API_BASE_URL ?? '';
  // Se o site estiver rodando via HTTPS, impede requisições inseguras via HTTP (Mixed Content)
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
      const res = await fetch(`${baseUrl}${url}`, { credentials: 'include', ...options });
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
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const baseUrl = getSanitizedBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
  return json;
}
