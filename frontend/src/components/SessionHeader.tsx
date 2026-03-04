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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#888] uppercase tracking-wider">
            Session ID
          </div>
          <div className="text-2xl font-mono text-[#00ff88]">{data.sessionId}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-mono text-[#888] uppercase tracking-wider">
            Total Participants
          </div>
          <div className="text-2xl font-mono text-white">{data.totalParticipants}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-mono text-[#888] uppercase tracking-wider">
            Average Attention Score
          </div>
          <div className="text-2xl font-mono text-[#00ff88]">{data.averageScore}%</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-mono text-[#888] uppercase tracking-wider">
            Session Duration
          </div>
          <div className="text-2xl font-mono text-white">{data.duration}</div>
        </div>
      </div>
    </div>
  );
}
