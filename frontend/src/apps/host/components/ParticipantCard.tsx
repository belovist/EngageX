import type { ParticipantState } from "../../../shared/types";

type ParticipantCardProps = {
  participant: ParticipantState;
};

function scoreTone(score: number): string {
  if (score >= 75) return "text-emerald-300 border-emerald-500/40";
  if (score >= 55) return "text-amber-300 border-amber-500/40";
  return "text-rose-300 border-rose-500/40";
}

export function ParticipantCard({ participant }: ParticipantCardProps) {
  const gazeX = participant.gaze_x ?? 0.5;
  const gazeY = participant.gaze_y ?? 0.5;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{participant.name || participant.participant_id}</h3>
          <p className="text-xs text-slate-400">{participant.participant_id}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreTone(participant.attention_score)}`}>
          {participant.attention_score.toFixed(0)}%
        </span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(30,41,59,0.7),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(15,23,42,0.8),transparent_45%)]" />
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]"
          style={{ left: `${Math.max(0, Math.min(1, gazeX)) * 100}%`, top: `${Math.max(0, Math.min(1, gazeY)) * 100}%` }}
        />
      </div>
    </article>
  );
}
