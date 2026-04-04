import { useMemo } from "react";

import { LOW_ENGAGEMENT_THRESHOLD } from "../../shared/constants";
import { AttentionHeatmap } from "./components/AttentionHeatmap";
import { AlertBanner } from "./components/AlertBanner";
import { OBSControls } from "./components/OBSControls";
import { ScoreDashboard } from "./components/ScoreDashboard";
import { useAttentionScores } from "./hooks/useAttentionScores";
import { useOBSWebSocket } from "./hooks/useOBSWebSocket";

export default function HostApp() {
  const { participants, connected: scoreConnected } = useAttentionScores();
  const {
    connected: obsConnected,
    scenes,
    switchScene,
    setSceneItemVisible,
    alertAll,
  } = useOBSWebSocket();

  const participantList = useMemo(() => Object.values(participants), [participants]);
  const classAverage = useMemo(() => {
    if (!participantList.length) {
      return 0;
    }
    const sum = participantList.reduce((acc, item) => acc + item.attention_score, 0);
    return Math.round((sum / participantList.length) * 10) / 10;
  }, [participantList]);

  const lowAttentionCount = participantList.filter((p) => p.attention_score < LOW_ENGAGEMENT_THRESHOLD).length;
  const showAlert = lowAttentionCount > 0;

  const heatmapPoints = participantList
    .map((participant) => ({ x: participant.gaze_x ?? 0.5, y: participant.gaze_y ?? 0.5 }))
    .slice(-200);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/35 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">EngageX Host Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">Live Engagement Command Center</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Score Stream</p>
              <p className={`text-sm font-semibold ${scoreConnected ? "text-emerald-300" : "text-amber-300"}`}>
                {scoreConnected ? "Connected" : "Polling fallback"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Participants</p>
              <p className="text-sm font-semibold text-slate-100">{participantList.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
              <p className="text-xs text-slate-400">Class Average</p>
              <p className="text-sm font-semibold text-cyan-200">{classAverage}%</p>
            </div>
          </div>
        </header>

        <div className="mb-4">
          <AlertBanner
            visible={showAlert}
            message={`${lowAttentionCount} participant(s) are below ${LOW_ENGAGEMENT_THRESHOLD}% attention. Consider switching to an engagement-focused scene.`}
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <AttentionHeatmap points={heatmapPoints} />
          <OBSControls
            connected={obsConnected}
            scenes={scenes}
            onSwitchScene={switchScene}
            onToggleOverlay={setSceneItemVisible}
            onAlertAll={alertAll}
          />
        </div>

        <ScoreDashboard participants={participants} />
      </div>
    </main>
  );
}
