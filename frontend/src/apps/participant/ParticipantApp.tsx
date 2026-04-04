import { useEffect, useMemo, useState } from "react";

import { DEFAULT_PARTICIPANT_ID } from "../../shared/constants";
import { useAttentionScores } from "../host/hooks/useAttentionScores";
import { PersonalScore } from "./components/PersonalScore";
import { WebcamPreview } from "./components/WebcamPreview";

export default function ParticipantApp() {
  const [participantId, setParticipantId] = useState(DEFAULT_PARTICIPANT_ID);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [publishEnabled, setPublishEnabled] = useState(true);
  const [fallbackScore, setFallbackScore] = useState(72);
  const { participants, connected } = useAttentionScores();

  const participantList = useMemo(() => Object.values(participants), [participants]);

  useEffect(() => {
    if (participants[participantId]) {
      return;
    }

    if (participantList.length > 0) {
      setParticipantId(participantList[0].participant_id);
    }
  }, [participantId, participantList, participants]);

  const me = useMemo(() => participants[participantId] ?? participantList[0], [participantId, participantList, participants]);

  useEffect(() => {
    if (!publishEnabled) {
      return;
    }

    const userId = participantId.trim() || DEFAULT_PARTICIPANT_ID;

    const timer = window.setInterval(async () => {
      const dynamicScore = fallbackScore + Math.sin(Date.now() / 1800) * 3;
      const payload = {
        user_id: userId,
        score: Math.max(0, Math.min(100, Number(dynamicScore))),
        timestamp: Date.now() / 1000,
        state: previewEnabled ? "Browser participant active" : "Browser participant (preview off)",
        source: "participant-client",
      };

      try {
        await fetch("/api/attention/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Keep retrying in the next tick.
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [fallbackScore, participantId, previewEnabled, publishEnabled]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">EngageX Participant View</p>
          <h1 className="mt-2 text-2xl font-semibold">Personal Focus Monitor</h1>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Participant ID
              <input
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                value={participantId}
                onChange={(event) => setParticipantId(event.target.value)}
              />
            </label>
            <span className={`text-xs font-semibold ${connected ? "text-emerald-600" : "text-amber-600"}`}>
              {connected ? "Realtime connected" : "Fallback polling"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {me
              ? `Showing score for ${me.participant_id}`
              : "Waiting for attention score packets from the backend..."}
          </p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">
              Local browser preview can block the Python inference camera. Keep preview off when running the Python participant client.
            </p>
            <button
              type="button"
              onClick={() => setPreviewEnabled((prev) => !prev)}
              className="ml-3 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900"
            >
              {previewEnabled ? "Disable Preview" : "Enable Preview"}
            </button>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Browser Score Publisher</p>
              <button
                type="button"
                onClick={() => setPublishEnabled((prev) => !prev)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {publishEnabled ? "Publishing On" : "Publishing Off"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              This keeps host + participant dashboards live even without the Python client. For real AI scoring, run the Python participant pipeline.
            </p>
            <label className="mt-3 block text-xs text-slate-600">
              Fallback Score: <span className="font-semibold">{Math.round(fallbackScore)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={fallbackScore}
              onChange={(event) => setFallbackScore(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </div>
        </header>

        <div className="grid gap-4">
          {previewEnabled ? <WebcamPreview /> : null}
          <PersonalScore participant={me} />
        </div>
      </div>
    </main>
  );
}
