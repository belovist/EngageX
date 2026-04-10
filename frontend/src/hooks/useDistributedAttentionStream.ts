import { useCallback, useEffect, useState } from 'react';
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

type UsersResponse = {
  count: number;
  users: DistributedUser[];
};

type ConnectionState = 'polling' | 'offline';

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
  const [connection, setConnection] = useState<ConnectionState>('polling');

  const fetchSnapshot = useCallback(async () => {
    try {
      const [usersResponse, analyticsResponse] = await Promise.all([
        fetch(apiUrl('/api/attention/users'), { cache: 'no-store' }),
        fetch(apiUrl('/api/attention/analytics'), { cache: 'no-store' }),
      ]);

      if (!usersResponse.ok || !analyticsResponse.ok) {
        setBackendOk(false);
        setConnection('offline');
        return false;
      }

      const usersPayload = (await usersResponse.json()) as UsersResponse;
      const analyticsPayload = (await analyticsResponse.json()) as DistributedAnalytics;
      setUsers(Array.isArray(usersPayload.users) ? usersPayload.users : []);
      setAnalytics(analyticsPayload ?? EMPTY_ANALYTICS);
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
    void fetchSnapshot();
    const timer = window.setInterval(() => {
      void fetchSnapshot();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [fetchSnapshot]);

  return { users, analytics, backendOk, connection };
}
