export type AttentionScorePayload = {
  participant_id: string;
  name: string;
  attention_score: number;
  gaze_x?: number;
  gaze_y?: number;
  timestamp: number;
};

export type AttentionScoreMap = Record<string, number>;

export type ParticipantState = {
  participant_id: string;
  name: string;
  attention_score: number;
  gaze_x?: number;
  gaze_y?: number;
  timestamp: number;
};

export type ParticipantsMap = Record<string, ParticipantState>;

export type AttentionSnapshotResponse = {
  participants: ParticipantState[];
};

export type ObsConnectionConfig = {
  url: string;
  password?: string;
};
