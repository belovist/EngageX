export function SessionHeader({ data }) {
  return (
    <div className="relative glass-card glass-card-hover p-6 animate-fadeIn">

      {/* subtle glow background */}
      <div className="absolute inset-0 rounded-xl opacity-20 blur-3xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 pointer-events-none"></div>

      <div className="relative">

        <h3 className="text-lg font-semibold text-white mb-6">
          Session Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {[
            { label: 'Session ID', value: data.sessionId, color: 'text-blue-400' },
            { label: 'Total Participants', value: data.totalParticipants, color: 'text-indigo-400' },
            { label: 'Average Score', value: `${data.averageScore}%`, color: 'text-purple-400' },
            { label: 'Duration', value: data.duration, color: 'text-blue-300' },
          ].map((item, idx) => (

            <div
              key={idx}
              className="
                bg-white/[0.04]
                backdrop-blur-lg
                border border-white/10
                rounded-xl
                p-4
                transition-all
                duration-300
                hover:border-blue-400/40
                hover:shadow-[0_0_20px_rgba(109,140,255,0.25)]
                animate-slideUp
              "
              style={{ animationDelay: `${idx * 0.1}s` }}
            >

              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                {item.label}
              </p>

              <p className={`text-2xl font-semibold ${item.color}`}>
                {item.value}
              </p>

            </div>

          ))}

        </div>


        <div className="mt-6 pt-6 border-t border-white/10">

          <div className="flex items-center justify-between">

            <span className="text-xs text-gray-400">
              Session Status
            </span>

            <div className="flex items-center gap-2">

              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(109,140,255,0.7)]"></div>

              <span className="text-xs font-semibold text-blue-400">
                Live
              </span>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}