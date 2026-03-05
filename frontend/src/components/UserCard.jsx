import { ProgressBar } from './ProgressBar';
import { StatusIndicator } from './StatusIndicator';
import { TrendIndicator } from './TrendIndicator';

export function UserCard({ user, onClick }) {
  const isAttentive = user.score >= 70;
  const borderColor = isAttentive ? 'border-green-500' : 'border-red-500';
  const shadowColor = isAttentive ? 'shadow-green-500/20' : 'shadow-red-500/20';
  const trend = Math.floor(Math.random() * 20) - 10;

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border ${borderColor} rounded-lg p-4 transition-all duration-300 cursor-pointer hover:shadow-xl ${shadowColor} hover:scale-105 group animate-fadeIn`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{user.name}</p>
            <StatusIndicator status={user.status} animated />
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-bold ${
              isAttentive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}
          >
            {user.score}%
          </div>
        </div>

        <div className="space-y-3">
          <ProgressBar value={user.score} max={100} animated />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Trend</span>
            <TrendIndicator value={trend} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-700/50 rounded p-2">
              <span className="text-gray-400">Peak</span>
              <p className="font-bold text-white">{user.score + Math.floor(Math.random() * 20)}%</p>
            </div>
            <div className="bg-gray-700/50 rounded p-2">
              <span className="text-gray-400">Avg</span>
              <p className="font-bold text-white">{Math.floor(user.score * 0.95)}%</p>
            </div>
          </div>
        </div>

        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-semibold transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
