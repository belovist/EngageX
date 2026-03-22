import { Activity, Users } from 'lucide-react';
import { UserCard } from './UserCard';

interface User {
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
}

interface UserGridProps {
  users: User[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  onUserSelect?: (user: User) => void;
}

export function UserGrid({
  users,
  title = 'Tracked Feed',
  description,
  emptyMessage = 'No live feeds available.',
  onUserSelect,
}: UserGridProps) {
  const trackedFeeds = users.length;
  const visibleSubjects = users.filter((user) => user.personDetected).length;
  const scores = users.map((user) => user.score).filter((value): value is number => value != null);
  const averageScore =
    scores.length > 0 ? `${Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)}%` : '--';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-blue-500/10 p-2 text-blue-300">
              <Users size={18} />
            </div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>

          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-slate-300">
            <span className="font-semibold text-white">{trackedFeeds}</span> feed
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-slate-300">
            <span className="font-semibold text-emerald-300">{visibleSubjects}</span> visible
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/45 px-4 py-2 text-slate-300">
            <span className="font-semibold text-blue-300">{averageScore}</span> avg score
          </div>
        </div>
      </div>

      {users.length > 0 ? (
        <div className="grid grid-cols-1 gap-5">
          {users.map((user) => (
            <UserCard key={user.id} user={user} onClick={() => onUserSelect?.(user)} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-6 text-center">
          <div className="mb-4 rounded-full border border-white/10 bg-white/[0.04] p-3 text-slate-400">
            <Activity size={18} />
          </div>
          <p className="text-base font-medium text-white">{emptyMessage}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
            Once the backend starts sending data, the live feed card will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
