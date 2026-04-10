import { useEffect, useMemo, useState } from "react";

import { fetchScoresSnapshot, normalizeScorePayload } from "../../../shared/api";
import { POLL_INTERVAL_MS, SCORE_API_URL } from "../../../shared/constants";
import type { AttentionScoreMap, ParticipantsMap, ParticipantState } from "../../../shared/types";

type UseAttentionScoresOptions = {
  apiUrl?: string;
};

type UseAttentionScoresResult = {
  scores: AttentionScoreMap;
  participants: ParticipantsMap;
  connected: boolean;
};

function toMap(items: ParticipantState[]): ParticipantsMap {
  return items.reduce<ParticipantsMap>((acc, item) => {
    acc[item.participant_id] = item;
    return acc;
  }, {});
}

export function useAttentionScores(options: UseAttentionScoresOptions = {}): UseAttentionScoresResult {
  const apiUrl = options.apiUrl ?? SCORE_API_URL;
  const [participants, setParticipants] = useState<ParticipantsMap>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchScoresSnapshot(apiUrl);
        if (cancelled) return;

        const normalized = (snapshot.participants || []).map(normalizeScorePayload) as ParticipantState[];
        setParticipants(toMap(normalized));
        setConnected(true);
      } catch {
        if (!cancelled) {
          setConnected(false);
        }
      }
    };

    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiUrl]);

  const scores = useMemo<AttentionScoreMap>(() => {
    return Object.values(participants).reduce<AttentionScoreMap>((acc, participant) => {
      acc[participant.participant_id] = participant.attention_score;
      return acc;
    }, {});
  }, [participants]);

  return { scores, participants, connected };
}
