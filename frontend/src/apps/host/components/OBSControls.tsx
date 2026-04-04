import { useMemo, useState } from "react";

type OBSControlsProps = {
  connected: boolean;
  scenes: string[];
  onSwitchScene: (sceneName: string) => Promise<void>;
  onToggleOverlay: (sceneName: string, sourceName: string, visible: boolean) => Promise<void>;
  onAlertAll: (sceneName: string, sourceName: string) => Promise<void>;
};

const OVERLAY_SOURCE = "engagement_overlay";

export function OBSControls({
  connected,
  scenes,
  onSwitchScene,
  onToggleOverlay,
  onAlertAll,
}: OBSControlsProps) {
  const [selectedScene, setSelectedScene] = useState("");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeScene = useMemo(() => selectedScene || scenes[0] || "", [scenes, selectedScene]);

  async function handleSceneSwitch(sceneName: string) {
    setSelectedScene(sceneName);
    if (!sceneName) {
      return;
    }

    setBusy(true);
    try {
      await onSwitchScene(sceneName);
    } finally {
      setBusy(false);
    }
  }

  async function handleOverlayToggle(nextVisible: boolean) {
    if (!activeScene) {
      return;
    }

    setOverlayVisible(nextVisible);
    setBusy(true);
    try {
      await onToggleOverlay(activeScene, OVERLAY_SOURCE, nextVisible);
    } finally {
      setBusy(false);
    }
  }

  async function handleAlertAll() {
    if (!activeScene) {
      return;
    }

    setBusy(true);
    try {
      await onAlertAll(activeScene, OVERLAY_SOURCE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">OBS Scene Controls</h3>
        <span className={`text-xs font-semibold ${connected ? "text-emerald-300" : "text-rose-300"}`}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <label className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Scene</label>
      <select
        value={activeScene}
        onChange={(event) => {
          void handleSceneSwitch(event.target.value);
        }}
        className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      >
        {!scenes.length && <option value="">No scenes available</option>}
        {scenes.map((scene) => (
          <option key={scene} value={scene}>
            {scene}
          </option>
        ))}
      </select>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void handleOverlayToggle(true);
          }}
          disabled={busy || !activeScene}
          className="flex-1 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 disabled:opacity-50"
        >
          Show Overlay
        </button>
        <button
          type="button"
          onClick={() => {
            void handleOverlayToggle(false);
          }}
          disabled={busy || !activeScene}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
        >
          Hide Overlay
        </button>
      </div>

      <div className="mb-3 text-xs text-slate-400">Overlay state: {overlayVisible ? "Visible" : "Hidden"}</div>

      <button
        type="button"
        onClick={() => {
          void handleAlertAll();
        }}
        disabled={busy || !activeScene}
        className="w-full rounded-lg border border-rose-500/40 bg-rose-500/25 px-3 py-2 text-sm font-semibold text-rose-100 disabled:opacity-50"
      >
        Alert All
      </button>
    </section>
  );
}
