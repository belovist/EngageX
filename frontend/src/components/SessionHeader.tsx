interface SessionHeaderProps {
  data: {
    sessionId: string;
    totalParticipants: number;
    averageScore: number;
    duration: string;
  };
}

export function SessionHeader({ data }: SessionHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-6 animate-fadeIn">
      <h3 className="text-lg font-bold text-white mb-6">Session Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Session ID', value: data.sessionId, color: 'text-blue-400' },
          { label: 'Total Participants', value: data.totalParticipants, color: 'text-green-400' },
          { label: 'Average Score', value: `${data.averageScore}%`, color: 'text-yellow-400' },
          { label: 'Duration', value: data.duration, color: 'text-purple-400' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 animate-slideUp"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Session Status</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-green-400">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
