import { useEffect, useMemo, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { fetchScoresSnapshot, getScoresWebSocketUrl, normalizeScorePayload } from "../../../shared/api";
import { POLL_INTERVAL_MS, SCORE_API_URL, SCORE_WS_URL, WS_RECONNECT_INTERVAL_MS } from "../../../shared/constants";
import type { AttentionScoreMap, AttentionScorePayload, ParticipantsMap, ParticipantState } from "../../../shared/types";

type UseAttentionScoresOptions = {
  wsUrl?: string;
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

function extractPayloads(raw: unknown): AttentionScorePayload[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw as AttentionScorePayload[];
  }

  if ("participants" in raw && Array.isArray((raw as { participants?: unknown[] }).participants)) {
    return (raw as { participants: AttentionScorePayload[] }).participants;
  }

  if ("participant_id" in raw && "attention_score" in raw) {
    return [raw as AttentionScorePayload];
  }

  return [];
}

export function useAttentionScores(options: UseAttentionScoresOptions = {}): UseAttentionScoresResult {
  const wsUrl = options.wsUrl ?? SCORE_WS_URL;
  const apiUrl = options.apiUrl ?? SCORE_API_URL;

  const [participants, setParticipants] = useState<ParticipantsMap>({});

  const { lastJsonMessage, readyState } = useWebSocket(getScoresWebSocketUrl(wsUrl), {
    shouldReconnect: () => true,
    reconnectAttempts: Number.POSITIVE_INFINITY,
    reconnectInterval: WS_RECONNECT_INTERVAL_MS,
    share: true,
  });

  useEffect(() => {
    const payloads = extractPayloads(lastJsonMessage);
    if (!payloads.length) {
      return;
    }

    setParticipants((prev) => {
      const next = { ...prev };
      for (const raw of payloads) {
        const normalized = normalizeScorePayload(raw);
        next[normalized.participant_id] = normalized;
      }
      return next;
    });
  }, [lastJsonMessage]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const snapshot = await fetchScoresSnapshot(apiUrl);
        setParticipants(toMap(snapshot.participants));
      } catch {
        // Keep previous state while polling fallback retries.
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [apiUrl, readyState]);

  const scores = useMemo<AttentionScoreMap>(() => {
    return Object.values(participants).reduce<AttentionScoreMap>((acc, participant) => {
      acc[participant.participant_id] = participant.attention_score;
      return acc;
    }, {});
  }, [participants]);

  return {
    scores,
    participants,
    connected: readyState === ReadyState.OPEN,
  };
}
