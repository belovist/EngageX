import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function TrendIndicator({ value, label }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div
      className="
      flex items-center gap-1
      px-2 py-1
      rounded-md
      text-xs font-semibold
      bg-[#020617]
      border border-white/10
      "
    >
      {isPositive ? (
        <TrendingUp size={14} className="text-blue-400" />
      ) : isNeutral ? (
        <Minus size={14} className="text-gray-400" />
      ) : (
        <TrendingDown size={14} className="text-purple-400" />
      )}

      <span className="text-white">{Math.abs(value)}%</span>

      {label && (
        <span className="text-gray-400">
          ({label})
        </span>
      )}
    </div>
  );
}