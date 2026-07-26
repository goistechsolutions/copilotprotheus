import { useState, useEffect, useCallback } from 'react';

// Em produção, usa VITE_API_BASE_URL; em dev, usa URL relativa (nginx proxy local)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}${url}`, { credentials: 'include', ...options });
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
  const res = await fetch(`${BASE_URL}${url}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
  return json;
}
