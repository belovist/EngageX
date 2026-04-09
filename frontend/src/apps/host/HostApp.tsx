import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "../../components/ui/sidebar";
import { SidebarProvider } from "../../components/ui/sidebar";
import { SessionHeader } from "../../components/SessionHeader";
import { StatisticsCards } from "../../components/StatisticsCards";
import { UserGrid } from "../../components/UserGrid";
import { AlertPanel } from "../../components/AlertPanel";
import { AttentionChart } from "../../components/AttentionChart";
import { SearchBar } from "../../components/SearchBar";
import { ProgressBar } from "../../components/ProgressBar";
import { StatusIndicator } from "../../components/StatusIndicator";
import { TrendIndicator } from "../../components/TrendIndicator";
import { useAttentionScores } from "./hooks/useAttentionScores";

export default function HostApp() {
  const { participants, connected } = useAttentionScores();
  const [searchQuery, setSearchQuery] = useState("");
  const [chartData, setChartData] = useState<{ time: string; score: number }[]>([]);
  const [alerts, setAlerts] = useState([
    {
      id: "1",
      type: "info",
      title: "Attention stream connected",
      message: "Live attention data is now available.",
      timestamp: "Just now",
    },
  ]);

  const participantList = Object.values(participants);

  const averageScore =
    participantList.length > 0
      ? Math.round(
          participantList.reduce((sum: any, p: any) => sum + p.attention_score, 0) /
            participantList.length
        )
      : 0;

  // Build real chart data from live scores
  useEffect(() => {
    if (participantList.length === 0) return;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setChartData((prev) => {
      const next = [...prev, { time: timeLabel, score: averageScore }];
      return next.length > 60 ? next.slice(-60) : next;
    });
  }, [averageScore]);

  // Add alert when attention drops
  useEffect(() => {
    const lowAttention = participantList.filter((p: any) => p.attention_score < 40);
    if (lowAttention.length > 0) {
      const alertId = `low-${Date.now()}`;
      setAlerts((prev) => [
        ...prev.filter((a) => !a.id.startsWith("low-")),
        {
          id: alertId,
          type: "warning",
          title: "Low attention detected",
          message: `${lowAttention.length} participant(s) have attention below 40%.`,
          timestamp: "Just now",
        },
      ]);
    }
  }, [participantList.length]);

  const users = participantList.map((p: any) => ({
    id: p.participant_id,
    name: p.name || p.participant_id,
    status: p.attention_score > 40 ? "Active" : "Idle",
    score: p.attention_score,
  }));

  const filteredUsers = useMemo(
    () => users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery, users]
  );

  const sessionData = {
    sessionId: "session-123",
    totalParticipants: participantList.length,
    averageScore,
    duration: "Live",
    statusLabel: connected ? "Live" : "Offline",
    statusTone: (connected ? "live" : "offline") as "live" | "offline",
    sourceLabel: "WebSocket",
    lastUpdatedLabel: connected ? "Just now" : "Disconnected",
  };

  const stats = [
    {
      label: "Participants",
      value: participantList.length,
      valueClass: "text-blue-300",
      icon: null,
    },
    {
      label: "Average Attention",
      value: `${averageScore}%`,
      valueClass: averageScore >= 60 ? "text-green-300" : "text-red-300",
      icon: null,
    },
    {
      label: "Connection",
      value: connected ? "Live" : "Offline",
      valueClass: connected ? "text-green-300" : "text-red-300",
      icon: null,
    },
  ];

  const trendValue =
    participantList.length > 1
      ? Math.round(
          ((participantList[participantList.length - 1].attention_score -
            participantList[0].attention_score) /
            (participantList[0].attention_score || 1)) *
            100
        )
      : 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen bg-slate-950 text-white">
        <Sidebar />
        <div className="flex-1 w-full p-6 space-y-6 overflow-auto">
          <SessionHeader data={sessionData} />
          <StatusIndicator status={sessionData.statusLabel} />
          <StatisticsCards stats={stats} />
          <TrendIndicator value={trendValue} label="trend" />
          <ProgressBar value={averageScore} label="Class Attention" />
          <AttentionChart data={chartData} />
          <AlertPanel
            alerts={alerts}
            onDismiss={(id: string) =>
              setAlerts((current) => current.filter((alert) => alert.id !== id))
            }
          />
          <SearchBar onSearch={setSearchQuery} />
          <UserGrid users={filteredUsers} />
        </div>
      </div>
    </SidebarProvider>
  );
}
