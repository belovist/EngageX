import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../config';

export type DistributedUser = {
  user_id: string;
  score: number;
  timestamp: number;
  state: string | null;
  pose_score: number | null;
  gaze_score: number | null;
  source: string | null;
};

export type DistributedAnalytics = {
  active_users: number;
  class_average: number | null;
  min_score: number | null;
  max_score: number | null;
  low_attention_users: string[];
  updated_at: number;
};

type DistributedPayload = {
  users: DistributedUser[];
  analytics: DistributedAnalytics;
};

type UsersResponse = {
  count: number;
  users: DistributedUser[];
};

type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

const EMPTY_ANALYTICS: DistributedAnalytics = {
  active_users: 0,
  class_average: null,
  min_score: null,
  max_score: null,
  low_attention_users: [],
  updated_at: 0,
};

export function useDistributedAttentionStream() {
  const [users, setUsers] = useState<DistributedUser[]>([]);
  const [analytics, setAnalytics] = useState<DistributedAnalytics>(EMPTY_ANALYTICS);
  const [backendOk, setBackendOk] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPayload = useCallback((payload: DistributedPayload) => {
    setUsers(Array.isArray(payload.users) ? payload.users : []);
    setAnalytics(payload.analytics ?? EMPTY_ANALYTICS);
    setBackendOk(true);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const [usersResponse, analyticsResponse] = await Promise.all([
        fetch(apiUrl('/api/attention/users'), { cache: 'no-store' }),
        fetch(apiUrl('/api/attention/analytics'), { cache: 'no-store' }),
      ]);

      if (!usersResponse.ok || !analyticsResponse.ok) {
        setBackendOk(false);
        return false;
      }

      const usersPayload = (await usersResponse.json()) as UsersResponse;
      const analyticsPayload = (await analyticsResponse.json()) as DistributedAnalytics;
      applyPayload({
        users: Array.isArray(usersPayload.users) ? usersPayload.users : [],
        analytics: analyticsPayload,
      });
      return true;
    } catch {
      setBackendOk(false);
      return false;
    }
  }, [applyPayload]);

  useEffect(() => {
    let es: EventSource | null = null;

    const startPolling = () => {
      if (pollRef.current) return;

      const tick = async () => {
        const ok = await fetchSnapshot();
        setConnection(ok ? 'polling' : 'offline');
      };

      setConnection('polling');
      void tick();
      pollRef.current = setInterval(() => {
        void tick();
      }, 1000);
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

      await fetchSnapshot();
      setConnection('connecting');
      es = new EventSource(apiUrl('/api/attention/distributed/stream'));

      es.onopen = () => {
        setConnection('live');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as DistributedPayload;
          applyPayload(payload);
        } catch {
          // Ignore malformed events and keep stream alive.
        }
      };

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
  }, [applyPayload, fetchSnapshot]);

  return { users, analytics, backendOk, connection };
}
