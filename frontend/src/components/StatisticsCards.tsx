import { TrendingUp, TrendingDown, Users, Target, Clock } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  color: string;
}

interface StatisticsCardsProps {
  stats: StatCard[];
}

export function StatisticsCards({ stats }: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded ${stat.color}`}>
              {stat.icon}
            </div>
            {stat.trend !== undefined && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                stat.trend >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stat.trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(stat.trend)}%
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">{stat.label}</p>
          <p className="text-2xl font-bold text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
