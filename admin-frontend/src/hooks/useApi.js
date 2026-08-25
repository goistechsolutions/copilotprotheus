/**
 * useApi  — hook de leitura de dados
 * apiCall — função para mutations (POST / PUT / DELETE)
 *
 * Ambos usam o axios centralizado (auth Basic + baseURL relativa).
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export function useApi(url, _options = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export async function apiCall(url, method = 'GET', body = null) {
  const config = { method, url };
  if (body) config.data = body;
  const res = await api.request(config);
  return res.data;
}
