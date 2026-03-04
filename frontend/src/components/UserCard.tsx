interface UserCardProps {
  user: {
    id: number;
    name: string;
    status: string;
    score: number;
  };
}

export function UserCard({ user }: UserCardProps) {
  const isAttentive = user.score >= 70;
  const borderColor = isAttentive ? '#00ff88' : '#ff3333';
  const statusColor = user.status === 'Active' ? '#00ff88' : '#ff8800';

  return (
    <div
      className="bg-[#0f0f0f] rounded-lg p-4 transition-all duration-300"
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 10px ${borderColor}33`,
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-white">{user.name}</span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor }}
          ></div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-[#666]">STATUS</span>
            <span
              className="text-xs font-mono"
              style={{ color: statusColor }}
            >
              {user.status}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-[#666]">LAST 5 MIN</span>
            <span
              className="text-lg font-mono"
              style={{ color: borderColor }}
            >
              {user.score}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${user.score}%`,
              backgroundColor: borderColor,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
