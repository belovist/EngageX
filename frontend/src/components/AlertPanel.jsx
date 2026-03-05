import { AlertCircle, AlertTriangle, Bell, X } from 'lucide-react';

export function AlertPanel({ alerts, onDismiss }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3 max-h-96 overflow-y-auto">
      {alerts.map((alert) => {
        const isWarning = alert.type === 'warning';
        const isCritical = alert.type === 'critical';

        return (
          <div
            key={alert.id}
            className={`relative p-4 rounded-xl border flex items-start gap-3 animate-slideIn
            bg-white/[0.03] backdrop-blur-xl border-white/10
            hover:border-white/20 transition-all duration-300 hover:shadow-xl`}
          >
            
            {/* LEFT GLOW BAR */}
            <div
              className={`absolute left-0 top-0 h-full w-[3px] rounded-l-xl ${
                isCritical
                  ? "bg-gradient-to-b from-red-400 to-pink-500"
                  : isWarning
                  ? "bg-gradient-to-b from-amber-300 to-orange-500"
                  : "bg-gradient-to-b from-blue-400 to-cyan-400"
              }`}
            />

            {/* ICON BADGE */}
            <div
              className={`pt-0.5 flex items-center justify-center w-8 h-8 rounded-lg
              ${
                isCritical
                  ? "bg-red-500/10 text-red-400"
                  : isWarning
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-blue-500/10 text-blue-400"
              }`}
            >
              {isCritical ? (
                <AlertCircle size={18} />
              ) : isWarning ? (
                <AlertTriangle size={18} />
              ) : (
                <Bell size={18} />
              )}
            </div>

            {/* TEXT */}
            <div className="flex-1">
              <p className="font-semibold text-sm tracking-wide text-white">
                {alert.title}
              </p>

              <p className="text-xs text-gray-400 mt-0.5">
                {alert.message}
              </p>

              <p className="text-[11px] text-gray-500 mt-1">
                {alert.timestamp}
              </p>
            </div>

            {/* CLOSE BUTTON */}
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-gray-500 hover:text-white transition-all duration-200 hover:scale-110"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}