import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AttentionChart({ data }) {

  const avgScore = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length);
  const maxScore = Math.max(...data.map((d) => d.score));
  const minScore = Math.min(...data.map((d) => d.score));

  return (

    <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl p-6 animate-fadeIn">

      {/* subtle glow */}
      <div className="absolute inset-0 opacity-20 blur-3xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

      <div className="relative">

        {/* Header */}
        <div className="mb-6">

          <div className="flex items-start justify-between mb-4">

            <div>
              <h2 className="text-lg font-semibold text-white mb-1">
                Attention Score Trend
              </h2>

              <p className="text-sm text-gray-400">
                Live aggregate attention monitoring
              </p>
            </div>

            <div className="flex gap-6">

              <div className="text-right">
                <p className="text-xs text-gray-400">Average</p>
                <p className="text-2xl font-semibold text-blue-400">
                  {avgScore}%
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">Peak</p>
                <p className="text-2xl font-semibold text-purple-400">
                  {maxScore}%
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">Low</p>
                <p className="text-2xl font-semibold text-red-400">
                  {minScore}%
                </p>
              </div>

            </div>

          </div>

        </div>


        {/* Chart Container */}
        <div className="h-[400px] bg-black/30 border border-white/5 rounded-xl p-4">

          <ResponsiveContainer width="100%" height="100%">

            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>

              {/* Gradient Line */}
              <defs>

                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6d8cff"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>

              </defs>

              {/* Grid */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />

              {/* X Axis */}
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
              />

              {/* Y Axis */}
              <YAxis
                domain={[0, 100]}
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
                label={{
                  value: 'Score (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#94a3b8', fontSize: '12px' },
                }}
              />

              {/* Tooltip */}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,15,35,0.95)',
                  border: '1px solid rgba(109,140,255,0.4)',
                  borderRadius: '10px',
                }}
                labelStyle={{ color: '#6d8cff' }}
                itemStyle={{ color: '#e2e8f0' }}
                cursor={{ stroke: 'rgba(109,140,255,0.4)' }}
              />

              {/* Line */}
              <Line
                type="monotone"
                dataKey="score"
                stroke="url(#lineGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={false}
                isAnimationActive
              />

            </LineChart>

          </ResponsiveContainer>

        </div>


        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">

          <div className="flex items-center gap-2">

            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>

            <span>Current Score</span>

          </div>

          <span className="text-gray-500">
            Last updated: Just now
          </span>

        </div>

      </div>

    </div>

  );
}