import { Activity, Clock3, Eye, ScanFace, TrendingUp, X } from 'lucide-react';

function renderValue(value, suffix = '%') {
  if (value === null || value === undefined) return '--';
  return `${Math.round(value)}${suffix}`;
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('offline') || normalized.includes('error')) {
    return 'text-red-300 bg-red-500/10 border-red-400/20';
  }

  if (normalized.includes('connecting') || normalized.includes('waiting')) {
    return 'text-amber-300 bg-amber-500/10 border-amber-400/20';
  }

  if (normalized.includes('no person')) {
    return 'text-orange-300 bg-orange-500/10 border-orange-400/20';
  }

  return 'text-blue-300 bg-blue-500/10 border-blue-400/20';
}

export function UserDetailModal({ user, onClose }) {
  if (!user) return null;

  const stats = [
    { label: 'Current Score', value: renderValue(user.score), icon: <Activity size={16} className="text-emerald-300" /> },
    { label: 'Session Duration', value: user.sessionDuration || '--', icon: <Clock3 size={16} className="text-sky-300" /> },
    { label: 'Average Score', value: renderValue(user.averageScore), icon: <TrendingUp size={16} className="text-fuchsia-300" /> },
    { label: 'Peak Score', value: renderValue(user.peakScore), icon: <Eye size={16} className="text-amber-300" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl shadow-blue-950/40">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-transparent to-violet-500/15" />

        <div className="relative">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="mb-2 text-3xl font-bold text-white">{user.name}</h2>
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(user.status)}`}>
                {user.status}
              </div>
              <p className="mt-3 text-sm text-slate-400">{user.detail || 'Real-time feed details from the active monitoring session.'}</p>
            </div>

            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                {user.videoSrc ? (
                  <div className="aspect-video">
                    <img src={user.videoSrc} alt={user.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center text-slate-500">
                    <ScanFace size={26} />
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      {stat.icon}
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
                <h3 className="mb-4 text-lg font-semibold text-white">Feed Summary</h3>

                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Source', value: user.source || '--' },
                    { label: 'Connection', value: user.connectionLabel || '--' },
                    { label: 'Person Detected', value: user.personDetected ? 'Yes' : 'No' },
                    { label: 'Last Updated', value: user.lastUpdated || '--' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="font-medium text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
                <h3 className="mb-4 text-lg font-semibold text-white">Model Breakdown</h3>

                <div className="space-y-4">
                  {[
                    { label: 'Pose Score', value: user.posePercent, color: 'from-emerald-400 to-teal-400' },
                    { label: 'Gaze Score', value: user.gazePercent, color: 'from-amber-400 to-orange-400' },
                  ].map((item) => {
                    const percent = item.value == null ? 0 : Math.max(0, Math.min(100, item.value));

                    return (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="font-medium text-slate-200">{renderValue(item.value)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                            style={{ width: `${Math.max(percent, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full rounded-2xl border border-blue-400/30 bg-blue-500/10 py-3 font-semibold text-blue-200 transition hover:border-blue-300/45 hover:bg-blue-500/15"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
