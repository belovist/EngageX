import { SCORE_API_URL, SCORE_WS_URL } from "./constants";
import type { AttentionSnapshotResponse, AttentionScorePayload } from "./types";

export async function fetchScoresSnapshot(apiUrl: string = SCORE_API_URL): Promise<AttentionSnapshotResponse> {
  const res = await fetch(apiUrl, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch scores: ${res.status}`);
  }

  return (await res.json()) as AttentionSnapshotResponse;
}

export function getScoresWebSocketUrl(url: string = SCORE_WS_URL): string {
  return url;
}

export function normalizeScorePayload(payload: AttentionScorePayload): AttentionScorePayload {
  return {
    ...payload,
    attention_score: Math.max(0, Math.min(100, payload.attention_score)),
    timestamp: payload.timestamp ?? Date.now() / 1000,
  };
}
