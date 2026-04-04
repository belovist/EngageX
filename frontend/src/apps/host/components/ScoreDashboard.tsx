import type { ParticipantsMap } from "../../../shared/types";
import { ParticipantCard } from "./ParticipantCard";

type ScoreDashboardProps = {
  participants: ParticipantsMap;
};

export function ScoreDashboard({ participants }: ScoreDashboardProps) {
  const values = Object.values(participants).sort((a, b) => b.attention_score - a.attention_score);

  if (!values.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        No participants yet. Waiting for incoming scores...
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {values.map((participant) => (
        <ParticipantCard key={participant.participant_id} participant={participant} />
      ))}
    </section>
  );
}
