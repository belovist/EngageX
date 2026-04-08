import { useMemo, useState } from "react";
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
  const { participants } = useAttentionScores();

  const [searchQuery, setSearchQuery] = useState("");
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

  // Map backend → UI
  const users = participantList.map((p: any) => ({
    id: p.participant_id,
    name: p.name || p.participant_id,
    status: p.attention_score > 40 ? "Active" : "Idle",
    score: p.attention_score,
  }));

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, users]
  );

  const sessionData = {
    sessionId: "session-123",
    totalParticipants: participantList.length,
    averageScore:
      participantList.length > 0
        ? Math.round(
            (participantList.reduce((sum: any, p: any) => sum + p.attention_score, 0) /
              participantList.length) * 10
          ) / 10
        : 0,
    duration: "00:30:00",
    statusLabel: participantList.length > 0 ? "Live" : "Offline",
    statusTone: (participantList.length > 0 ? "live" : "offline") as "live" | "offline",
    sourceLabel: "WebRTC",
    lastUpdatedLabel: "Just now",
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
      value: sessionData.averageScore,
      valueClass: "text-green-300",
      icon: null,
    },
  ];

  const trendValue = participantList.length > 1
    ? Math.round(
        ((participantList[participantList.length - 1].attention_score - participantList[0].attention_score) /
          (participantList[0].attention_score || 1)) * 100
      )
    : 0;

  // Chart data (demo for now)
  const chartData = [
    { time: "00:00", score: 50 },
    { time: "00:05", score: 60 },
    { time: "00:10", score: 70 },
    { time: "00:15", score: 65 },
    { time: "00:20", score: 80 },
    { time: "00:25", score: 75 },
    { time: "00:30", score: 85 },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen bg-slate-950 text-white">
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 w-full p-6 space-y-6 overflow-auto">
          
          {/* Header */}
          <SessionHeader data={sessionData} />
          <StatusIndicator status={sessionData.statusLabel} />

          {/* Stats */}
          <StatisticsCards stats={stats} />
          <TrendIndicator value={trendValue} label="trend" />

          {/* Progress */}
          <ProgressBar value={75} label="Attention Progress" />

          {/* Chart */}
          <AttentionChart data={chartData} />

          {/* Alerts */}
          <AlertPanel
            alerts={alerts}
            onDismiss={(id: string) =>
              setAlerts((current) => current.filter((alert) => alert.id !== id))
            }
          />

          {/* Search */}
          <SearchBar onSearch={setSearchQuery} />

          {/* Users */}
          <UserGrid users={filteredUsers} />

        </div>
      </div>
    </SidebarProvider>
  );
}