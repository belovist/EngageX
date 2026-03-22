import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatisticsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`
          rounded-xl
          p-4
          transition-all duration-300
          hover:border-blue-400/40
          ${stat.cardClass ?? "bg-[#020617] border border-white/10"}
        `}
        >
          <div className="flex items-start justify-between mb-3">

            {/* ICON */}
            <div
              className={`
              p-2 rounded-lg border
              ${stat.iconShellClass ?? "bg-blue-500/10 border-blue-400/20"}
            `}
            >
              {stat.icon}
            </div>

            {/* TREND */}
            {stat.trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${
                  stat.trend >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stat.trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(stat.trend)}%
              </div>
            )}
          </div>

          {/* LABEL */}
          <p className="text-gray-400 text-sm mb-2">
            {stat.label}
          </p>

          {/* VALUE */}
          <p className={`text-2xl font-bold ${stat.valueClass ?? 'text-white'}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
