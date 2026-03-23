interface AttentionChartProps {
  data: Array<{ time: string; score: number }>;
  connectionLabel?: string;
  lastUpdatedLabel?: string;
}

const CHART_WIDTH = 840;
const CHART_HEIGHT = 420;
const PADDING = { top: 24, right: 28, bottom: 42, left: 52 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const xc = (current.x + next.x) / 2;
    const yc = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${xc} ${yc}`;
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  d += ` Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;

  return d;
}

export function AttentionChart({
  data,
  connectionLabel = 'Connecting',
  lastUpdatedLabel = 'Waiting for data',
}: AttentionChartProps) {
  const averageScore =
    data.length > 0
      ? Math.round(data.reduce((sum, point) => sum + clamp(point.score, 0, 100), 0) / data.length)
      : null;
  const peakScore = data.length > 0 ? Math.max(...data.map((point) => clamp(point.score, 0, 100))) : null;
  const lowScore = data.length > 0 ? Math.min(...data.map((point) => clamp(point.score, 0, 100))) : null;

  if (data.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 opacity-80" />

        <div className="relative">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="mb-1 text-2xl font-semibold text-white">Attention Score Trend</h2>
              <p className="text-sm text-slate-400">Live aggregate attention monitoring</p>
            </div>

            <div className="flex gap-6">
              {[
                { label: 'Average', value: '--', valueClass: 'text-blue-300' },
                { label: 'Peak', value: '--', valueClass: 'text-fuchsia-300' },
                { label: 'Low', value: '--', valueClass: 'text-rose-300' },
              ].map((item) => (
                <div key={item.label} className="text-right">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className={`text-2xl font-semibold ${item.valueClass}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-[400px] items-center justify-center rounded-2xl border border-white/5 bg-black/25 text-center text-sm text-slate-400">
            Waiting for live attention metrics from the backend.
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>Current Score</span>
            <span>
              {connectionLabel} | Last updated {lastUpdatedLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const sampleCount = Math.max(data.length - 1, 1);

  const points = data.map((point, index) => {
    const x = PADDING.left + (index / sampleCount) * innerWidth;
    const y = PADDING.top + ((100 - clamp(point.score, 0, 100)) / 100) * innerHeight;
    return { ...point, x, y };
  });

  const linePath = smoothPath(points);
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${CHART_HEIGHT - PADDING.bottom} L ${points[0].x} ${CHART_HEIGHT - PADDING.bottom} Z`;
  const axisLevels = [0, 25, 50, 75, 100];
  const labelStep = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 opacity-80" />

      <div className="relative">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-semibold text-white">Attention Score Trend</h2>
            <p className="text-sm text-slate-400">Live aggregate attention monitoring</p>
          </div>

          <div className="flex gap-6">
            {[
              { label: 'Average', value: averageScore == null ? '--' : `${averageScore}%`, valueClass: 'text-blue-300' },
              { label: 'Peak', value: peakScore == null ? '--' : `${peakScore}%`, valueClass: 'text-fuchsia-300' },
              { label: 'Low', value: lowScore == null ? '--' : `${lowScore}%`, valueClass: 'text-rose-300' },
            ].map((item) => (
              <div key={item.label} className="text-right">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className={`text-2xl font-semibold ${item.valueClass}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[400px] rounded-2xl border border-white/5 bg-black/25 p-4">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-full w-full"
            role="img"
            aria-label="Live attention score over time"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6d8cff" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(109,140,255,0.35)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
              </linearGradient>
            </defs>

            {axisLevels.map((level) => {
              const y = PADDING.top + ((100 - level) / 100) * innerHeight;
              return (
                <g key={level}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={CHART_WIDTH - PADDING.right}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={PADDING.left - 10}
                    y={y + 4}
                    fill="#94a3b8"
                    fontSize="12"
                    textAnchor="end"
                  >
                    {level}
                  </text>
                </g>
              );
            })}

            {points.map((point, index) => (
              <line
                key={`${point.time}-grid`}
                x1={point.x}
                y1={PADDING.top}
                x2={point.x}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="4 4"
              />
            ))}

            <text
              x={18}
              y={CHART_HEIGHT / 2}
              fill="#94a3b8"
              fontSize="12"
              textAnchor="middle"
              transform={`rotate(-90 18 ${CHART_HEIGHT / 2})`}
            >
              Score (%)
            </text>

            <path d={areaPath} fill="url(#fillGradient)" />
            <path
              d={linePath}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <circle cx={lastPoint.x} cy={lastPoint.y} r="7" fill="#8b5cf6" fillOpacity="0.22" />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#8b5cf6" />

            {points.map(
              (point, index) =>
                (index % labelStep === 0 || index === points.length - 1) && (
                  <text
                    key={`${point.time}-label`}
                    x={point.x}
                    y={CHART_HEIGHT - 10}
                    fill="#94a3b8"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {point.time}
                  </text>
                )
            )}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
            <span>Current Score</span>
          </div>

          <span>
            {connectionLabel} | Last updated {lastUpdatedLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
