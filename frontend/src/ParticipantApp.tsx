import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Server,
  UserRound,
  Video,
  XCircle,
} from 'lucide-react';

type ConnectState = 'idle' | 'loading' | 'ok' | 'error';

function stateLabel(state: ConnectState, okText: string, idleText: string, errorText: string) {
  if (state === 'loading') return 'Checking';
  if (state === 'ok') return okText;
  if (state === 'error') return errorText;
  return idleText;
}

function StatusPill({ state, okText, idleText, errorText }: { state: ConnectState; okText: string; idleText: string; errorText: string }) {
  const label = stateLabel(state, okText, idleText, errorText);

  if (state === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
        <CheckCircle2 size={12} /> {label}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
        <XCircle size={12} /> {label}
      </span>
    );
  }

  if (state === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
        <Loader2 size={12} className="animate-spin" /> {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
      <Circle size={12} /> {label}
    </span>
  );
}

export function ParticipantApp() {
  const [meetingCode, setMeetingCode] = useState('ENGAGEX-ROOM-01');
  const [userId, setUserId] = useState('student-01');
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');
  const [obsWsUrl, setObsWsUrl] = useState('ws://127.0.0.1:4455');

  const [joinState, setJoinState] = useState<ConnectState>('idle');
  const [backendState, setBackendState] = useState<ConnectState>('idle');
  const [obsState, setObsState] = useState<ConnectState>('idle');
  const [statusMsg, setStatusMsg] = useState('Complete checks, then join and start your virtual camera pipeline.');

  const participantCommand = useMemo(() => {
    const escapedUser = userId.trim() || 'student-01';
    const escapedBackend = backendUrl.trim() || 'http://127.0.0.1:8000';
    return `python attention-monitor/client-desktop/run_virtual_cam.py --user-id ${escapedUser} --backend-url ${escapedBackend}`;
  }, [userId, backendUrl]);

  async function checkBackend() {
    setBackendState('loading');
    try {
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/health`);
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      setBackendState('ok');
      setStatusMsg('Backend connection is healthy.');
    } catch (error) {
      setBackendState('error');
      setStatusMsg(`Backend check failed: ${(error as Error).message}`);
    }
  }

  async function checkObs() {
    setObsState('loading');
    try {
      const ws = new WebSocket(obsWsUrl);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('OBS WebSocket timed out'));
        }, 2500);

        ws.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve();
        };

        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Cannot reach OBS WebSocket')); 
        };
      });

      setObsState('ok');
      setStatusMsg('OBS WebSocket is reachable.');
    } catch (error) {
      setObsState('error');
      setStatusMsg(`OBS check failed: ${(error as Error).message}`);
    }
  }

  async function joinMeeting() {
    if (!userId.trim() || !meetingCode.trim()) {
      setJoinState('error');
      setStatusMsg('Meeting code and user id are required.');
      return;
    }

    setJoinState('loading');

    const now = Date.now() / 1000;
    const payload = {
      user_id: userId.trim(),
      score: 100,
      timestamp: now,
      state: 'Joined',
      source: `participant-ui:${meetingCode.trim()}`,
    };

    try {
      const res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/attention/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Join failed with ${res.status}`);

      setJoinState('ok');
      setStatusMsg(`${userId} joined ${meetingCode}. Start your virtual camera command now.`);
    } catch (error) {
      setJoinState('error');
      setStatusMsg(`Join failed: ${(error as Error).message}`);
    }
  }

  async function copyRunCommand() {
    await navigator.clipboard.writeText(participantCommand);
    setStatusMsg('Command copied. Run it in your terminal to start score publishing and OBS feed pipeline.');
  }

  const readyToStart = backendState === 'ok' && obsState === 'ok' && joinState === 'ok';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">EngageX Participant Console</p>
          <h1 className="mt-2 text-3xl font-semibold">Join Session</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Use this app on each participant device. It verifies backend and OBS connectivity, registers participant presence, and provides the exact command to start the local virtual camera + score pipeline.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-medium"><UserRound size={18} /> Participant Setup</h2>

            <label className="mb-1 block text-sm text-slate-300">Meeting Code</label>
            <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={meetingCode} onChange={(e) => setMeetingCode(e.target.value)} />

            <label className="mb-1 block text-sm text-slate-300">Participant ID</label>
            <input className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} />

            <button
              onClick={joinMeeting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400"
            >
              {joinState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Join Meeting
            </button>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill state={joinState} okText="Joined" idleText="Not joined" errorText="Join failed" />
              <StatusPill state={backendState} okText="Backend OK" idleText="Backend unchecked" errorText="Backend offline" />
              <StatusPill state={obsState} okText="OBS OK" idleText="OBS unchecked" errorText="OBS unreachable" />
            </div>

            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-200">Connectivity</h3>

              <label className="mb-1 block text-sm text-slate-300">Backend URL</label>
              <div className="mb-3 flex gap-2">
                <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
                <button
                  onClick={checkBackend}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/20 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/30"
                >
                  {backendState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />} Test
                </button>
              </div>

              <label className="mb-1 block text-sm text-slate-300">OBS WebSocket URL</label>
              <div className="flex gap-2">
                <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={obsWsUrl} onChange={(e) => setObsWsUrl(e.target.value)} />
                <button
                  onClick={checkObs}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  {obsState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />} Test
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-200">Run Pipeline Command</p>
                <button
                  onClick={copyRunCommand}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
              <code className="block break-all rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-sky-300">{participantCommand}</code>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => window.open('https://obsproject.com/', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
              >
                <ExternalLink size={14} /> Open OBS Download
              </button>
            </div>
          </section>

          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 text-lg font-medium">Session Readiness</h2>

            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Current Status</p>
              <p className={`mt-2 text-xl font-semibold ${readyToStart ? 'text-emerald-300' : 'text-amber-300'}`}>
                {readyToStart ? 'Ready To Stream' : 'Action Required'}
              </p>
              <p className="mt-2 text-sm text-slate-300">{statusMsg}</p>
            </div>

            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>Check backend connectivity.</li>
              <li>Check OBS WebSocket connectivity.</li>
              <li>Click Join Meeting.</li>
              <li>Run copied command in participant terminal.</li>
              <li>Select OBS Virtual Camera in Zoom/Meet/Teams.</li>
            </ol>

            <div className="mt-4 grid gap-2">
              <button
                onClick={joinMeeting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
              >
                {joinState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Join Now
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
