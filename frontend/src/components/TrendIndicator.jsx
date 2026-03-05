import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function TrendIndicator({ value, label }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
        isPositive ? 'bg-green-900/30 text-green-400' : isNeutral ? 'bg-gray-700/30 text-gray-400' : 'bg-red-900/30 text-red-400'
      }`}
    >
      {isPositive ? <TrendingUp size={14} /> : isNeutral ? <Minus size={14} /> : <TrendingDown size={14} />}
      <span>{Math.abs(value)}%</span>
      {label && <span className="text-gray-400">({label})</span>}
    </div>
  );
}
