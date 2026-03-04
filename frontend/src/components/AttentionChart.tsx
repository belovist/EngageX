import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AttentionChartProps {
  data: Array<{ time: string; score: number }>;
}

export function AttentionChart({ data }: AttentionChartProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-sm font-mono text-[#888] uppercase tracking-wider">
          Aggregate Attention Score — Live Feed
        </h2>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="time"
              stroke="#666"
              style={{ fontSize: '12px', fontFamily: 'monospace' }}
              tick={{ fill: '#888' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#666"
              style={{ fontSize: '12px', fontFamily: 'monospace' }}
              tick={{ fill: '#888' }}
              label={{
                value: 'Attention Score (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#888', fontSize: '12px', fontFamily: 'monospace' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
              labelStyle={{ color: '#00ff88' }}
              itemStyle={{ color: '#fff' }}
            />
            <Line
              type="stepAfter"
              dataKey="score"
              stroke="#00ff88"
              strokeWidth={3}
              dot={{ fill: '#00ff88', r: 4 }}
              activeDot={{ r: 6, fill: '#00ff88' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#00ff88] rounded-full"></div>
          <span className="text-[#888]">High Focus (70-100%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#ff3333] rounded-full"></div>
          <span className="text-[#888]">Low Focus (0-69%)</span>
        </div>
      </div>
    </div>
  );
}
