import { X, TrendingUp, Award } from 'lucide-react';

export function UserDetailModal({ user, onClose }) {
  if (!user) return null;

  const stats = [
    { label: 'Current Score', value: user.score, unit: '/100' },
    { label: 'Session Duration', value: 45, unit: 'mins' },
    { label: 'Attention Rate', value: 87, unit: '%' },
    { label: 'Peak Score', value: 95, unit: '/100' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 animate-fadeIn">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4 animate-slideUp">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
            <p className={`text-sm font-semibold ${user.status === 'Active' ? 'text-green-400' : 'text-yellow-400'}`}>
              {user.status}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-2">{stat.label}</p>
              <p className="text-lg font-bold text-white">
                {stat.value}
                <span className="text-xs text-gray-400">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg p-4 mb-6">
          <p className="text-sm text-white/80 mb-2">Performance</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-white" size={20} />
              <span className="font-bold text-white">+5%</span>
            </div>
            <Award className="text-white" size={20} />
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
