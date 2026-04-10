import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../config';

export type AttentionMetrics = {
  session_id?: string | null;
  timestamp: number;
  participant_count?: number;
  attention_percent: number | null;
  label: string;
};

type ConnectionState = 'polling' | 'offline';

export function useAttentionStream() {
  const [metrics, setMetrics] = useState<AttentionMetrics | null>(null);
  const [backendOk, setBackendOk] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('polling');

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/metrics'), { cache: 'no-store' });
      if (!response.ok) {
        setBackendOk(false);
        setConnection('offline');
        return false;
      }

      const payload = (await response.json()) as AttentionMetrics;
      setMetrics(payload);
      setBackendOk(true);
      setConnection('polling');
      return true;
    } catch {
      setBackendOk(false);
      setConnection('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
    const timer = window.setInterval(() => {
      void fetchMetrics();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [fetchMetrics]);

  return { metrics, backendOk, connection };
}
