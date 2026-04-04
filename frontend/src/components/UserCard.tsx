import { Camera, ChevronRight, Clock3, Radar, ScanFace } from 'lucide-react';

interface UserCardProps {
  user: {
    id: number | string;
    name: string;
    status: string;
    score: number | null;
    detail?: string;
    source?: string;
    averageScore?: number | null;
    peakScore?: number | null;
    sessionDuration?: string;
    lastUpdated?: string | null;
    posePercent?: number | null;
    gazePercent?: number | null;
    connectionLabel?: string;
    personDetected?: boolean;
    videoSrc?: string;
  };
  onClick?: () => void;
}

function scoreAccent(score: number | null): string {
  if (score == null) return '#94a3b8';
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

function statusAccent(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('offline') || normalized.includes('error')) return '#f87171';
  if (normalized.includes('connecting') || normalized.includes('waiting')) return '#facc15';
  if (normalized.includes('no person')) return '#fb923c';
  if (normalized.includes('distracted')) return '#f87171';
  return '#60a5fa';
}

function renderValue(value: number | null | undefined, suffix = '%') {
  if (value == null) return '--';
  return `${Math.round(value)}${suffix}`;
}

export function UserCard({ user, onClick }: UserCardProps) {
  const statusColor = statusAccent(user.status);
  const scoreColor = scoreAccent(user.score);
  const progressWidth = user.score == null ? 4 : Math.min(100, Math.max(4, user.score));
  const isInteractive = Boolean(onClick);

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!isInteractive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 transition-all duration-300 ${
        isInteractive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-400/35' : ''
      }`}
      style={{ boxShadow: `0 18px 42px -28px ${scoreColor}` }}
    >
      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="relative overflow-hidden border-b border-white/10 xl:border-b-0 xl:border-r">
          {user.videoSrc ? (
            <div className="aspect-video bg-slate-950">
              <img src={user.videoSrc} alt={user.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-slate-950 text-slate-500">
              <Camera size={28} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{user.name}</p>
                <p className="text-sm text-slate-300">{user.source || 'Live source'}</p>
              </div>

              <div
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: `${statusColor}55`,
                  color: statusColor,
                  backgroundColor: `${statusColor}18`,
                }}
              >
                {user.status}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.24em] text-slate-500">Current Attention</p>
              <p className="text-4xl font-semibold text-white" style={{ color: scoreColor }}>
                {renderValue(user.score)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Connection</p>
              <p className="text-sm font-medium text-slate-200">{user.connectionLabel || 'Live'}</p>
            </div>
          </div>

          <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressWidth}%`,
                background: `linear-gradient(90deg, ${scoreColor}, #8b5cf6)`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Average',
                value: renderValue(user.averageScore),
                icon: <Radar size={15} className="text-blue-300" />,
              },
              {
                label: 'Peak',
                value: renderValue(user.peakScore),
                icon: <ScanFace size={15} className="text-fuchsia-300" />,
              },
              {
                label: 'Pose',
                value: renderValue(user.posePercent),
                icon: <ScanFace size={15} className="text-emerald-300" />,
              },
              {
                label: 'Gaze',
                value: renderValue(user.gazePercent),
                icon: <Radar size={15} className="text-amber-300" />,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-2">
                  {item.icon}
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                </div>
                <p className="text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-400">
              <Clock3 size={14} />
              <span className="text-xs uppercase tracking-[0.2em]">Session</span>
            </div>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Duration</span>
              <span className="font-medium text-slate-200">{user.sessionDuration || '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">Last Updated</span>
              <span className="font-medium text-slate-200">{user.lastUpdated || '--'}</span>
            </div>
          </div>

          {user.detail ? <p className="mt-4 text-sm leading-6 text-slate-400">{user.detail}</p> : null}

          {isInteractive ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClick?.();
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition-all duration-300 hover:border-blue-300/50 hover:bg-blue-500/15"
            >
              View Details
              <ChevronRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
