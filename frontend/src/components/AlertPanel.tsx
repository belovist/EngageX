import { AlertCircle, AlertTriangle, Bell, X } from 'lucide-react';
import { useState } from 'react';

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

interface AlertPanelProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

export function AlertPanel({ alerts, onDismiss }: AlertPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 max-h-96 overflow-y-auto">
      {alerts.map((alert) => {
        const isWarning = alert.type === 'warning';
        const isCritical = alert.type === 'critical';

        return (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border flex items-start gap-3 animate-slideIn ${
              isCritical
                ? 'bg-red-900/20 border-red-500 text-red-300'
                : isWarning
                ? 'bg-yellow-900/20 border-yellow-500 text-yellow-300'
                : 'bg-blue-900/20 border-blue-500 text-blue-300'
            }`}
          >
            <div className="pt-0.5">
              {isCritical ? (
                <AlertCircle size={18} />
              ) : isWarning ? (
                <AlertTriangle size={18} />
              ) : (
                <Bell size={18} />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{alert.title}</p>
              <p className="text-xs opacity-90">{alert.message}</p>
              <p className="text-xs opacity-70 mt-1">{alert.timestamp}</p>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
