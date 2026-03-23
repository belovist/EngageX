interface SessionHeaderData {
  sessionId: string;
  totalParticipants: number | string;
  averageScore: number | string;
  duration: string;
  statusLabel: string;
  statusTone?: 'live' | 'warning' | 'offline';
  sourceLabel?: string;
  lastUpdatedLabel?: string;
}

interface SessionHeaderProps {
  data: SessionHeaderData;
}

function formatAverageScore(value: number | string) {
  if (typeof value === 'number') return `${value}%`;
  if (value === '--') return value;
  return String(value).includes('%') ? String(value) : `${value}%`;
}

function toneClasses(tone: SessionHeaderData['statusTone']) {
  if (tone === 'offline') {
    return {
      dot: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]',
      text: 'text-red-300',
    };
  }

  if (tone === 'warning') {
    return {
      dot: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]',
      text: 'text-amber-300',
    };
  }

  return {
    dot: 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]',
    text: 'text-blue-300',
  };
}

export function SessionHeader({ data }: SessionHeaderProps) {
  const statusTone = toneClasses(data.statusTone);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-purple-500/15 opacity-80" />

      <div className="relative">
        <h3 className="mb-6 text-2xl font-semibold text-white">Session Details</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: 'Session ID', value: data.sessionId, color: 'text-blue-300' },
            { label: 'Total Participants', value: String(data.totalParticipants), color: 'text-indigo-300' },
            {
              label: 'Average Score',
              value: formatAverageScore(data.averageScore),
              color: 'text-fuchsia-300',
            },
            { label: 'Duration', value: data.duration, color: 'text-sky-300' },
          ].map((item, index) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 hover:border-blue-400/30 hover:bg-white/[0.06]"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
              <p className={`text-2xl font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Session Status</span>

            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${statusTone.dot}`} />
              <span className={`text-sm font-semibold ${statusTone.text}`}>{data.statusLabel}</span>
            </div>
          </div>

          <div className="space-y-2 text-sm text-slate-400">
            {data.sourceLabel ? (
              <div className="flex items-center justify-between gap-4">
                <span>Source</span>
                <span className="font-medium text-slate-200">{data.sourceLabel}</span>
              </div>
            ) : null}

            {data.lastUpdatedLabel ? (
              <div className="flex items-center justify-between gap-4">
                <span>Last Updated</span>
                <span className="font-medium text-slate-200">{data.lastUpdatedLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
