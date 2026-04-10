import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ScoreRecord = {
  score: number
  timestamp: number
  state?: string | null
}

type AdminParticipantTrendChartProps = {
  histories: Record<string, ScoreRecord[]>
  selectedUserId?: string
  threshold?: number
}

const SERIES_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#fb7185', '#22d3ee', '#facc15']
const BUCKET_SIZE_SECONDS = 15

function formatClock(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function AdminParticipantTrendChart({
  histories,
  selectedUserId,
  threshold = 25,
}: AdminParticipantTrendChartProps) {
  const { chartData, series } = useMemo(() => {
    const populatedUsers = Object.entries(histories)
      .filter(([, history]) => history.length > 0)
      .map(([userId]) => userId)
      .sort((left, right) => left.localeCompare(right))

    const resolvedSeries = populatedUsers.map((userId, index) => ({
      userId,
      key: `series_${index}`,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    }))

    const bucketMap = new Map<number, Record<string, number | string | null>>()
    for (const item of resolvedSeries) {
      const history = histories[item.userId] || []
      for (const point of history) {
        const bucketTimestamp = Math.floor(point.timestamp / BUCKET_SIZE_SECONDS) * BUCKET_SIZE_SECONDS
        const existing = bucketMap.get(bucketTimestamp) || {
          timestamp: bucketTimestamp,
          label: formatClock(bucketTimestamp),
        }
        existing[item.key] = point.score
        bucketMap.set(bucketTimestamp, existing)
      }
    }

    const resolvedData = [...bucketMap.values()].sort(
      (left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0)
    )

    return {
      chartData: resolvedData,
      series: resolvedSeries,
    }
  }, [histories])

  if (series.length === 0 || chartData.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Graph</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">All Participant Trends</h2>
          </div>
          <p className="text-sm text-slate-500">Waiting for enough score history to draw the chart.</p>
        </div>
        <div className="mt-5 flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 text-sm text-slate-500">
          Live history appears here as participant scores arrive.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Graph</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">All Participant Trends</h2>
          <p className="mt-2 text-sm text-slate-400">
            Recent attention scores across the current session. The red line marks the low-attention alert threshold.
          </p>
        </div>
        <p className="text-sm text-slate-500">{series.length} participant line{series.length === 1 ? '' : 's'}</p>
      </div>

      <div className="mt-5 h-[360px] rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              minTickGap={28}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(51, 65, 85, 1)',
                borderRadius: '12px',
                color: '#e2e8f0',
              }}
              labelStyle={{ color: '#f8fafc', marginBottom: 6 }}
              formatter={(value: number | string, _name: string, item) => {
                const scoreValue = typeof value === 'number' ? value : Number(value)
                return [`${Math.round(scoreValue)}%`, item.name || 'Participant']
              }}
            />
            <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
            <ReferenceLine
              y={threshold}
              stroke="#f43f5e"
              strokeDasharray="5 5"
              label={{ value: `${threshold}% alert`, fill: '#fda4af', fontSize: 12 }}
            />

            {series.map((item) => {
              const isSelected = selectedUserId === item.userId
              const fadeOtherLines = Boolean(selectedUserId) && !isSelected
              return (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.userId}
                  stroke={item.color}
                  strokeWidth={isSelected ? 3 : 2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  opacity={fadeOtherLines ? 0.32 : 1}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
