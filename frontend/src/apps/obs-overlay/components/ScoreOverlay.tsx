type ScoreOverlayProps = {
  score: number;
};

export function ScoreOverlay({ score }: ScoreOverlayProps) {
  const tone = score >= 75 ? "bg-emerald-500/85" : score >= 55 ? "bg-amber-500/85" : "bg-rose-500/85";

  return (
    <div className={`rounded-md px-2 py-1 text-xs font-semibold text-white backdrop-blur ${tone}`}>
      {score.toFixed(0)}%
    </div>
  );
}
