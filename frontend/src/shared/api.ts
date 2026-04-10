import { SCORE_API_URL } from "./constants";
import type { AttentionSnapshotResponse, AttentionScorePayload } from "./types";

export async function fetchScoresSnapshot(apiUrl: string = SCORE_API_URL): Promise<AttentionSnapshotResponse> {
  const response = await fetch(apiUrl, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scores: ${response.status}`);
  }

  return (await response.json()) as AttentionSnapshotResponse;
}

export function normalizeScorePayload(payload: AttentionScorePayload): AttentionScorePayload {
  return {
    ...payload,
    attention_score: Math.max(0, Math.min(100, payload.attention_score)),
    timestamp: payload.timestamp ?? Date.now() / 1000,
  };
}
