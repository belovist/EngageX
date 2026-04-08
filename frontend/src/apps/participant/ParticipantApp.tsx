import { useEffect, useMemo, useState } from "react";

import { DEFAULT_PARTICIPANT_ID } from "../../shared/constants";
import { useAttentionScores } from "../host/hooks/useAttentionScores";
import { PersonalScore } from "./components/PersonalScore";
import { WebcamPreview } from "./components/WebcamPreview";

export default function ParticipantApp() {
  const [participantId, setParticipantId] = useState(DEFAULT_PARTICIPANT_ID);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  const { participants, connected } = useAttentionScores();

  // 🔥 Start Python client (Electron)
  const handleJoin = () => {
    window.api?.startClient();
  };

  const participantList = useMemo(() => Object.values(participants), [participants]);

  useEffect(() => {
    if (participants[participantId]) return;

    if (participantList.length > 0) {
      setParticipantId(participantList[0].participant_id);
    }
  }, [participantId, participantList, participants]);

  const me = useMemo(
    () => participants[participantId] ?? participantList[0],
    [participantId, participantList, participants]
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        
        {/* HEADER */}
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            EngageX Participant View
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            Personal Focus Monitor
          </h1>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Participant ID
              <input
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
              />
            </label>

            <span
              className={`text-xs font-semibold ${
                connected ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {connected ? "Realtime connected" : "Waiting for AI..."}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {me
              ? `Showing score for ${me.participant_id}`
              : "Waiting for attention score from AI model..."}
          </p>

          {/* CAMERA WARNING */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">
              Turn OFF preview for accurate AI scoring.
            </p>
            <button
              onClick={() => setPreviewEnabled((prev) => !prev)}
              className="ml-3 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900"
            >
              {previewEnabled ? "Disable Preview" : "Enable Preview"}
            </button>
          </div>

          {/* 🔥 JOIN BUTTON */}
          <div className="mt-4">
            <button
              onClick={handleJoin}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start Camera & Join Session
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <div className="grid gap-4">
          {previewEnabled && <WebcamPreview />}
          <PersonalScore participant={me} />
        </div>
      </div>
    </main>
  );
}