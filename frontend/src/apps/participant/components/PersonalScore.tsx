import { LOW_ENGAGEMENT_THRESHOLD } from "../../../shared/constants";
import type { ParticipantState } from "../../../shared/types";

type PersonalScoreProps = {
  participant?: ParticipantState;
};

export function PersonalScore({ participant }: PersonalScoreProps) {
  const score = participant?.attention_score ?? 0;
  const name = participant?.name || participant?.participant_id || "You";

  const tone = score >= 75 ? "text-emerald-600" : score >= LOW_ENGAGEMENT_THRESHOLD ? "text-amber-600" : "text-rose-600";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Live Attention</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-800">{name}</h2>
      <p className={`mt-3 text-4xl font-bold ${tone}`}>{score.toFixed(0)}%</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${score >= 75 ? "bg-emerald-500" : score >= LOW_ENGAGEMENT_THRESHOLD ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">Keep your gaze on content and maintain an upright pose for better engagement signals.</p>
    </section>
  );
}
