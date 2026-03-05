import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AttentionChart({ data }) {
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length);
  const maxScore = Math.max(...data.map((d) => d.score));
  const minScore = Math.min(...data.map((d) => d.score));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 animate-fadeIn">
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Attention Score Trend</h2>
            <p className="text-sm text-gray-400">Live aggregate attention monitoring</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">Average</p>
              <p className="text-2xl font-bold text-blue-400">{avgScore}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Peak</p>
              <p className="text-2xl font-bold text-green-400">{maxScore}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Low</p>
              <p className="text-2xl font-bold text-red-400">{minScore}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[400px] bg-gray-900/50 rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis dataKey="time" stroke="#888" style={{ fontSize: '12px' }} tick={{ fill: '#999' }} />
            <YAxis
              domain={[0, 100]}
              stroke="#888"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#999' }}
              label={{
                value: 'Score (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#999', fontSize: '12px' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#3b82f6' }}
              itemStyle={{ color: '#e0f2fe' }}
              cursor={{ stroke: 'rgba(59, 130, 246, 0.5)' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6, fill: '#60a5fa' }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full" />
            <span>Current Score</span>
          </div>
        </div>
        <span>Last updated: Just now</span>
      </div>
    </div>
  );
}
