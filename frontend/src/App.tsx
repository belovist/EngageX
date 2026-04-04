import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Clock3,
  Eye,
  FileJson,
  FileSpreadsheet,
  Printer,
  Target,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AlertPanel } from './components/AlertPanel';
import { AttentionChart } from './components/AttentionChart';
import { SessionHeader } from './components/SessionHeader';
import { Sidebar } from './components/Sidebar';
import { StatisticsCards } from './components/StatisticsCards';
import { UserDetailModal } from './components/UserDetailModal';
import { UserGrid } from './components/UserGrid';
import { ThemeProvider } from './context/ThemeContext';
import {
  type DistributedUser,
  useDistributedAttentionStream,
} from './hooks/useDistributedAttentionStream';

type DashboardUser = {
  id: string;
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

type AlertItem = {
  id: string;
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
};

type ExportOption = {
  format: string;
  desc: string;
  action: () => void;
  icon: ReactNode;
};

function clampScore(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDuration(start: number): string {
  const seconds = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatClock(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildCsv(history: Array<{ time: string; score: number }>): string {
  const rows = history.map((point) => `${point.time},${point.score}`);
  return ['time,score', ...rows].join('\n');
}

function buildPrintMarkup(args: {
  sessionId: string;
  connectionLabel: string;
  lastUpdatedLabel: string;
  durationLabel: string;
  averageScore: string;
  peakScore: string;
  latestScore: string;
  history: Array<{ time: string; score: number }>;
  activeUsers: number;
  lowAttentionUsers: string[];
}) {
  const rows = args.history
    .slice(-20)
    .map(
      (point) =>
        `<tr><td>${point.time}</td><td style="text-align:right;">${point.score}%</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Attention Session Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
      h1 { margin: 0 0 8px; }
      p { margin: 0 0 18px; color: #475569; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 24px 0; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
      .label { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
      .value { font-size: 24px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      td, th { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; }
      th { text-align: left; color: #475569; }
    </style>
  </head>
  <body>
    <h1>Attention Monitoring Report</h1>
    <p>Session ${args.sessionId} | ${args.connectionLabel} | Last updated ${args.lastUpdatedLabel}</p>
    <div class="grid">
      <div class="card"><div class="label">Duration</div><div class="value">${args.durationLabel}</div></div>
      <div class="card"><div class="label">Average Score</div><div class="value">${args.averageScore}</div></div>
      <div class="card"><div class="label">Peak Score</div><div class="value">${args.peakScore}</div></div>
      <div class="card"><div class="label">Latest Score</div><div class="value">${args.latestScore}</div></div>
      <div class="card"><div class="label">Active Users</div><div class="value">${args.activeUsers}</div></div>
      <div class="card"><div class="label">Low Attention Users</div><div class="value">${args.lowAttentionUsers.length}</div></div>
    </div>
    <table>
      <thead>
        <tr><th>Time</th><th style="text-align:right;">Score</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

function makeUserName(userId: string): string {
  return `Participant ${userId}`;
}

function formatUserState(state: string | null): string {
  if (!state || !state.trim()) return 'Tracking';
  return state;
}

function formatAnalyticsTime(timestampSec: number): string {
  if (!timestampSec) return 'Waiting for backend data';
  return formatClock(timestampSec * 1000);
}

function AppContent() {
  const { users, analytics, backendOk, connection } = useDistributedAttentionStream();
  const [chartData, setChartData] = useState<Array<{ time: string; score: number }>>([]);
  const [sessionStart] = useState(() => Date.now());
  const [durationLabel, setDurationLabel] = useState('0s');
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const lastChartTs = useRef(0);
  const userHistoryRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (typeof analytics.class_average !== 'number') return;
    const timestampMs = (analytics.updated_at || Date.now() / 1000) * 1000;
    if (timestampMs - lastChartTs.current < 350) return;
    lastChartTs.current = timestampMs;

    setChartData((prev) => {
      const next = [...prev, { time: formatClock(timestampMs), score: analytics.class_average }];
      return next.length > 90 ? next.slice(-90) : next;
    });
  }, [analytics.class_average, analytics.updated_at]);

  useEffect(() => {
    const nextHistory = { ...userHistoryRef.current };
    users.forEach((user) => {
      if (!Number.isFinite(user.score)) return;
      const list = nextHistory[user.user_id] ?? [];
      list.push(user.score);
      nextHistory[user.user_id] = list.length > 240 ? list.slice(-240) : list;
    });
    userHistoryRef.current = nextHistory;
  }, [users]);

  useEffect(() => {
    const intervalId = setInterval(() => setDurationLabel(formatDuration(sessionStart)), 1000);
    setDurationLabel(formatDuration(sessionStart));
    return () => clearInterval(intervalId);
  }, [sessionStart]);

  const historyValues = chartData.map((point) => point.score);
  const latestScore =
    clampScore(analytics.class_average) ?? clampScore(historyValues.at(-1));
  const averageScore =
    historyValues.length > 0
      ? Math.round(historyValues.reduce((sum, value) => sum + value, 0) / historyValues.length)
      : latestScore;
  const peakScore = historyValues.length > 0 ? Math.max(...historyValues) : latestScore;
  const lowScore = historyValues.length > 0 ? Math.min(...historyValues) : latestScore;
  const previousScore = historyValues.length > 1 ? historyValues[historyValues.length - 2] : null;
  const trendDelta =
    latestScore != null && previousScore != null ? Math.round(latestScore - previousScore) : undefined;

  const connectionLabel =
    connection === 'live'
      ? 'Live stream'
      : connection === 'polling'
        ? 'Polling fallback'
        : connection === 'connecting'
          ? 'Connecting'
          : 'Offline';

  const backendLabel = backendOk ? connectionLabel : 'Backend offline';
  const lastUpdatedLabel = formatAnalyticsTime(analytics.updated_at);
  const detectedParticipants = analytics.active_users;

  const liveStatus = useMemo(() => {
    if (!backendOk && users.length === 0) return 'Offline';
    if (connection === 'connecting' && users.length === 0) return 'Connecting';
    if (users.length === 0) return 'Waiting';
    return 'Tracking';
  }, [backendOk, connection, users.length]);

  const liveUsers = useMemo<DashboardUser[]>(() => {
    const mappedUsers = users
      .slice()
      .sort((a, b) => a.user_id.localeCompare(b.user_id))
      .map((user: DistributedUser) => {
        const userHistory = userHistoryRef.current[user.user_id] ?? [];
        const userAverage =
          userHistory.length > 0
            ? Math.round(userHistory.reduce((sum, value) => sum + value, 0) / userHistory.length)
            : null;
        const userPeak = userHistory.length > 0 ? Math.round(Math.max(...userHistory)) : null;
        const updatedLabel = formatAnalyticsTime(user.timestamp);

        return {
          id: user.user_id,
          name: makeUserName(user.user_id),
          status: formatUserState(user.state),
          score: clampScore(user.score),
          detail: `Score posted by edge client | Updated ${updatedLabel}`,
          source: user.source || 'edge-client',
          averageScore: userAverage,
          peakScore: userPeak,
          sessionDuration: durationLabel,
          lastUpdated: updatedLabel,
          posePercent: user.pose_score != null ? Math.round(user.pose_score * 100) : null,
          gazePercent: user.gaze_score != null ? Math.round(user.gaze_score * 100) : null,
          connectionLabel,
          personDetected: true,
          videoSrc: undefined,
        };
      });

    if (mappedUsers.length > 0) return mappedUsers;

    return [
      {
        id: 'no-users',
        name: 'No Active Users',
        status: liveStatus,
        score: latestScore,
        detail: 'Waiting for score events from distributed clients.',
        source: 'Distributed API',
        averageScore,
        peakScore,
        sessionDuration: durationLabel,
        lastUpdated: lastUpdatedLabel,
        posePercent: null,
        gazePercent: null,
        connectionLabel,
        personDetected: false,
        videoSrc: undefined,
      },
    ];
  }, [
    averageScore,
    connectionLabel,
    durationLabel,
    lastUpdatedLabel,
    latestScore,
    liveStatus,
    peakScore,
    users,
  ]);

  const selectedUser = useMemo(
    () => liveUsers.find((user) => user.id === selectedUserId) ?? null,
    [liveUsers, selectedUserId]
  );

  const rawAlerts = useMemo<AlertItem[]>(() => {
    const nextAlerts: AlertItem[] = [];

    if (!backendOk) {
      nextAlerts.push({
        id: 'backend-offline',
        type: 'critical',
        title: 'Backend offline',
        message: 'Start the FastAPI server to restore live metrics, SSE updates, and the video feed.',
        timestamp: 'Now',
      });
    }

    if (backendOk && connection === 'polling') {
      nextAlerts.push({
        id: 'polling-fallback',
        type: 'warning',
        title: 'Streaming fallback active',
        message: 'The dashboard is still receiving data, but it had to fall back from SSE to polling.',
        timestamp: 'Now',
      });
    }

    if (backendOk && analytics.active_users === 0) {
      nextAlerts.push({
        id: 'no-users',
        type: 'warning',
        title: 'No active clients',
        message: 'Backend is running, but no distributed clients are posting score events right now.',
        timestamp: lastUpdatedLabel,
      });
    }

    if (latestScore != null && latestScore < 50) {
      nextAlerts.push({
        id: 'low-class-attention',
        type: 'critical',
        title: 'Class attention dropped below threshold',
        message: `Current class attention is ${latestScore}%. Review participants listed in low-attention users.`,
        timestamp: lastUpdatedLabel,
      });
    }

    if (analytics.low_attention_users.length > 0) {
      nextAlerts.push({
        id: 'low-users',
        type: 'warning',
        title: 'Low-attention participants detected',
        message: analytics.low_attention_users.join(', '),
        timestamp: lastUpdatedLabel,
      });
    }

    return nextAlerts;
  }, [analytics.active_users, analytics.low_attention_users, backendOk, connection, lastUpdatedLabel, latestScore]);

  useEffect(() => {
    const activeIds = new Set(rawAlerts.map((alert) => alert.id));
    setDismissedAlertIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [rawAlerts]);

  const alerts = useMemo(
    () => rawAlerts.filter((alert) => !dismissedAlertIds.includes(alert.id)),
    [dismissedAlertIds, rawAlerts]
  );

  const sessionData = useMemo(
    () => ({
      sessionId: 'CAM-01',
      totalParticipants: detectedParticipants,
      averageScore: averageScore == null ? '--' : averageScore,
      duration: durationLabel,
      statusLabel: backendOk ? `${backendLabel} (${detectedParticipants} users)` : backendLabel,
      statusTone: backendOk ? (detectedParticipants > 0 ? 'live' : 'warning') : 'offline',
      sourceLabel: 'Distributed edge clients',
      lastUpdatedLabel,
    }),
    [averageScore, backendLabel, backendOk, detectedParticipants, durationLabel, lastUpdatedLabel]
  );

  const stats = useMemo(
    () => [
      {
        label: 'Backend',
        value: backendOk ? 'Live' : 'Offline',
        icon: backendOk ? <Wifi size={20} className="text-blue-300" /> : <WifiOff size={20} className="text-red-300" />,
        iconShellClass: backendOk
          ? 'bg-blue-500/10 border-blue-400/20'
          : 'bg-red-500/10 border-red-400/20',
        valueClass: backendOk ? 'text-white' : 'text-red-300',
      },
      {
        label: 'Active Users',
        value: String(detectedParticipants),
        icon: <Users size={20} className={detectedParticipants > 0 ? 'text-green-300' : 'text-amber-300'} />,
        iconShellClass: detectedParticipants > 0
          ? 'bg-green-500/10 border-green-400/20'
          : 'bg-amber-500/10 border-amber-400/20',
        valueClass: detectedParticipants > 0 ? 'text-white' : 'text-amber-200',
      },
      {
        label: 'Class Average',
        value: averageScore == null ? '--' : `${averageScore}%`,
        icon: <Target size={20} className="text-yellow-300" />,
        iconShellClass: 'bg-yellow-500/10 border-yellow-400/20',
        valueClass: 'text-white',
        trend: trendDelta,
      },
      {
        label: 'Session Duration',
        value: durationLabel,
        icon: <Clock3 size={20} className="text-violet-300" />,
        iconShellClass: 'bg-violet-500/10 border-violet-400/20',
        valueClass: 'text-white',
      },
      {
        label: 'Peak Class Score',
        value: peakScore == null ? '--' : `${peakScore}%`,
        icon: <TrendingUp size={20} className="text-cyan-300" />,
        iconShellClass: 'bg-cyan-500/10 border-cyan-400/20',
        valueClass: 'text-white',
        trend: peakScore != null && averageScore != null ? Math.max(peakScore - averageScore, 0) : undefined,
      },
    ],
    [averageScore, backendOk, detectedParticipants, durationLabel, peakScore, trendDelta]
  );

  const exportPayload = useMemo(
    () => ({
      session: sessionData,
      backendOk,
      connection,
      analytics,
      users,
      chartHistory: chartData,
      exportedAt: new Date().toISOString(),
    }),
    [analytics, backendOk, chartData, connection, sessionData, users]
  );

  const exportOptions = useMemo<ExportOption[]>(
    () => [
      {
        format: 'CSV',
        desc: 'Download the live score history as a spreadsheet-friendly CSV file.',
        action: () => downloadText('attention-history.csv', 'text/csv;charset=utf-8', buildCsv(chartData)),
        icon: <FileSpreadsheet size={20} className="text-emerald-300" />,
      },
      {
        format: 'JSON',
        desc: 'Export the full session snapshot including live metrics and chart history.',
        action: () =>
          downloadText('attention-session.json', 'application/json;charset=utf-8', JSON.stringify(exportPayload, null, 2)),
        icon: <FileJson size={20} className="text-blue-300" />,
      },
      {
        format: 'PDF',
        desc: 'Open a printable session report so you can save it as PDF from the browser.',
        action: () => {
          const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760');
          if (!reportWindow) return;
          reportWindow.document.write(
            buildPrintMarkup({
              sessionId: sessionData.sessionId,
              connectionLabel,
              lastUpdatedLabel,
              durationLabel,
              averageScore: averageScore == null ? '--' : `${averageScore}%`,
              peakScore: peakScore == null ? '--' : `${peakScore}%`,
              latestScore: latestScore == null ? '--' : `${latestScore}%`,
              history: chartData,
              activeUsers: analytics.active_users,
              lowAttentionUsers: analytics.low_attention_users,
            })
          );
          reportWindow.document.close();
          reportWindow.focus();
          reportWindow.print();
        },
        icon: <Printer size={20} className="text-fuchsia-300" />,
      },
    ],
    [
      analytics.active_users,
      analytics.low_attention_users,
      averageScore,
      chartData,
      connectionLabel,
      durationLabel,
      exportPayload,
      lastUpdatedLabel,
      latestScore,
      peakScore,
      sessionData.sessionId,
    ]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),radial-gradient(circle_at_right,_rgba(147,51,234,0.16),_transparent_35%),linear-gradient(180deg,_#111827_0%,_#020617_70%)] text-white">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="ml-0 min-h-screen px-5 py-6 lg:ml-64 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
                EngageX
              </span>
            </h1>
            <p className="text-sm text-slate-400">Real-time Attention Monitoring System</p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
              backendOk
                ? 'border-blue-400/30 bg-blue-500/10 text-blue-200'
                : 'border-red-400/30 bg-red-500/10 text-red-200'
            }`}
          >
            {backendOk ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{backendLabel}</span>
          </div>
        </header>

        {activeView === 'dashboard' && (
          <>
            <AlertPanel
              alerts={alerts}
              onDismiss={(id: string) =>
                setDismissedAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
              }
            />

            <StatisticsCards stats={stats} />

            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
              <AttentionChart
                data={chartData}
                connectionLabel={connectionLabel}
                lastUpdatedLabel={lastUpdatedLabel}
              />
              <SessionHeader data={sessionData} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              <UserGrid
                users={liveUsers.filter((user) => user.id !== 'no-users')}
                title="Participant Grid"
                description="Each card is a distributed client posting attention events to the central backend."
                emptyMessage="Waiting for distributed clients to post their first score."
                onUserSelect={(user) => setSelectedUserId(String(user.id))}
              />

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-blue-500/10 p-2 text-blue-300">
                    <Activity size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Pipeline Status</h2>
                    <p className="text-sm text-slate-400">Backend connection, model output, and refresh health.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Transport', value: connectionLabel },
                    { label: 'Class Average', value: analytics.class_average != null ? `${Math.round(analytics.class_average)}%` : '--' },
                    { label: 'Min Score', value: analytics.min_score != null ? `${Math.round(analytics.min_score)}%` : '--' },
                    { label: 'Max Score', value: analytics.max_score != null ? `${Math.round(analytics.max_score)}%` : '--' },
                    { label: 'Last Update', value: lastUpdatedLabel },
                    { label: 'Lowest Score', value: lowScore == null ? '--' : `${lowScore}%` },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
                    >
                      <span className="text-sm text-slate-400">{item.label}</span>
                      <span className="text-sm font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-dashed border-blue-400/20 bg-blue-500/5 p-4 text-sm text-slate-300">
                  Export-ready session snapshot includes class analytics and latest per-user metrics.
                </div>
              </div>
            </div>
          </>
        )}

        {activeView === 'monitor' && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-blue-500/10 p-2 text-blue-300">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Distributed Monitor</h2>
                    <p className="text-sm text-slate-400">Live per-user events from edge clients.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
                  <p className="mb-3 text-sm text-slate-300">
                    Low-attention users ({analytics.low_attention_users.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analytics.low_attention_users.length > 0 ? (
                      analytics.low_attention_users.map((userId) => (
                        <span
                          key={userId}
                          className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
                        >
                          {userId}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">No users below attention threshold.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-violet-500/10 p-2 text-violet-300">
                    <Activity size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Live Diagnostics</h2>
                    <p className="text-sm text-slate-400">Current class metrics from distributed aggregation.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Current', value: latestScore == null ? '--' : `${latestScore}%` },
                    { label: 'Average', value: averageScore == null ? '--' : `${averageScore}%` },
                    { label: 'Peak', value: peakScore == null ? '--' : `${peakScore}%` },
                    { label: 'Users', value: String(analytics.active_users) },
                    { label: 'Min', value: analytics.min_score != null ? `${Math.round(analytics.min_score)}%` : '--' },
                    { label: 'Max', value: analytics.max_score != null ? `${Math.round(analytics.max_score)}%` : '--' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-slate-950/45 p-4"
                    >
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                  Last updated {lastUpdatedLabel}. Connection mode: {connectionLabel}.
                </div>
              </div>
            </div>

            <AlertPanel
              alerts={alerts}
              onDismiss={(id: string) =>
                setDismissedAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
              }
            />

            <UserGrid
              users={liveUsers.filter((user) => user.id !== 'no-users')}
              title="Participant Analytics"
              description="Multi-user distributed monitoring with latest score and model breakdown per participant."
              emptyMessage="No distributed user metrics available yet."
              onUserSelect={(user) => setSelectedUserId(String(user.id))}
            />
          </>
        )}

        {activeView === 'export' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-bold text-white">Export Data</h2>
              <p className="text-sm text-slate-400">
                Save the current session without any dummy records. Exports use the live backend metrics and chart history.
              </p>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {exportOptions.map((option) => (
                <button
                  key={option.format}
                  onClick={option.action}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-slate-900"
                >
                  <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    {option.icon}
                  </div>
                  <p className="mb-2 text-lg font-semibold text-white">{option.format}</p>
                  <p className="text-sm leading-6 text-slate-400">{option.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {[
                { label: 'Session ID', value: sessionData.sessionId },
                { label: 'Samples Captured', value: chartData.length.toString() },
                { label: 'Current Score', value: latestScore == null ? '--' : `${latestScore}%` },
                  { label: 'Status', value: `${backendLabel} | ${analytics.active_users} users` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="text-xl font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <UserDetailModal user={selectedUser} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
