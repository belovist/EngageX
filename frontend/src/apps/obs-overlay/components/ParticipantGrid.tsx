import type { ParticipantsMap } from "../../../shared/types";
import { ScoreOverlay } from "./ScoreOverlay";

type ParticipantGridProps = {
  participants: ParticipantsMap;
};

export function ParticipantGrid({ participants }: ParticipantGridProps) {
  const values = Object.values(participants);

  return (
    <div className="grid h-full grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4">
      {values.map((participant) => (
        <div key={participant.participant_id} className="relative overflow-hidden rounded-xl border border-white/20 bg-slate-900/30">
          <div className="aspect-video bg-[linear-gradient(145deg,rgba(15,23,42,0.72),rgba(30,41,59,0.62))]" />
          <div className="absolute left-2 top-2 text-[11px] font-medium text-white/95">{participant.name || participant.participant_id}</div>
          <div className="absolute right-2 top-2">
            <ScoreOverlay score={participant.attention_score} />
          </div>
        </div>
      ))}
    </div>
  );
}
