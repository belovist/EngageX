import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../config';

export type AttentionMetrics = {
  timestamp: number;
  person_detected: boolean;
  attention_percent: number | null;
  instantaneous_percent: number | null;
  label: string;
  pose_score: number | null;
  gaze_score: number | null;
  smoothed_score: number | null;
  instantaneous_score: number | null;
};

type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

export function useAttentionStream() {
  const [metrics, setMetrics] = useState<AttentionMetrics | null>(null);
  const [backendOk, setBackendOk] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPayload = useCallback((raw: string) => {
    try {
      const payload = JSON.parse(raw) as AttentionMetrics;
      setMetrics(payload);
      setBackendOk(true);
    } catch {
      /* ignore malformed SSE payloads */
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/metrics'), { cache: 'no-store' });
      if (!response.ok) {
        setBackendOk(false);
        return false;
      }

      const payload = (await response.json()) as AttentionMetrics;
      setMetrics(payload);
      setBackendOk(true);
      return true;
    } catch {
      setBackendOk(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;

    const startPolling = () => {
      if (pollRef.current) return;

      const tick = async () => {
        const ok = await fetchMetrics();
        setConnection(ok ? 'polling' : 'offline');
      };

      setConnection('polling');
      void tick();
      pollRef.current = setInterval(() => {
        void tick();
      }, 500);
    };

    const tryHealth = async () => {
      try {
        const response = await fetch(apiUrl('/health'), { cache: 'no-store' });
        setBackendOk(response.ok);
        return response.ok;
      } catch {
        setBackendOk(false);
        return false;
      }
    };

    (async () => {
      const healthy = await tryHealth();
      if (!healthy) {
        setConnection('offline');
        startPolling();
        return;
      }

      await fetchMetrics();
      setConnection('connecting');
      es = new EventSource(apiUrl('/api/attention/stream'));

      es.onopen = () => {
        setConnection('live');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      es.onmessage = (event) => applyPayload(event.data);

      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    })();

    return () => {
      es?.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [applyPayload, fetchMetrics]);

  return { metrics, backendOk, connection };
}
