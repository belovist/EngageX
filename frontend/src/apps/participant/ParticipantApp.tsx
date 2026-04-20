import { useEffect, useMemo, useState } from 'react'

type ParticipantSummary = {
  user_id: string
  latest_score: number
  average_score: number
  total_samples: number
  last_seen: number
  latest_state?: string | null
  pose_score?: number | null
  gaze_score?: number | null
}

type SessionDetail = {
  session: {
    session_id: string
    meeting_link: string
  }
  summary: {
    participant_count: number
    total_samples: number
    average_score: number
    last_updated: number
  }
  participants: ParticipantSummary[]
}

type RunMode = 'local-client' | 'virtual-camera'

type VirtualCameraInfo = {
  cameraId: number
  cameraBackend: string
  device: string
  backend: string
  width: number
  height: number
  fps: number
  note?: string
}

function normalizeServerUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
    const url = new URL(withScheme)
    if (!url.port) {
      url.port = '8000'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp) return '--'
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

async function fetchSessionDetail(serverUrl: string, sessionId: string, limitPerUser = 10) {
  const trimmedSessionId = sessionId.trim()
  if (!serverUrl || !trimmedSessionId) {
    return { ok: false, status: 0, error: 'Missing server URL or session ID.' }
  }

  if (window.api?.fetchSession) {
    const response = await window.api.fetchSession({
      serverUrl,
      sessionId: trimmedSessionId,
      limitPerUser,
    })

    if (response.ok && response.data) {
      return { ok: true, status: response.status, data: response.data as SessionDetail }
    }

    return { ok: false, status: response.status, error: response.error || 'Request failed.' }
  }

  try {
    const response = await fetch(`${serverUrl}/api/sessions/${encodeURIComponent(trimmedSessionId)}?limit_per_user=${limitPerUser}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      return {
        ok: false,
        status: response.status,
        error: payload?.detail || `Request failed with status ${response.status}.`,
      }
    }

    const payload = (await response.json()) as SessionDetail
    return { ok: true, status: response.status, data: payload }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.'
    return { ok: false, status: 0, error: message }
  }
}

export default function ParticipantApp() {
  const [serverInput, setServerInput] = useState(() => window.localStorage.getItem('engagex.participant.server') || '127.0.0.1:8000')
  const [sessionId, setSessionId] = useState(() => window.localStorage.getItem('engagex.participant.sessionId') || '')
  const [userId, setUserId] = useState(() => window.localStorage.getItem('engagex.participant.userId') || 'student-1')
  const [showPreview, setShowPreview] = useState(() => window.localStorage.getItem('engagex.participant.preview') === '1')
  const [statusMessage, setStatusMessage] = useState('Enter server IP, session ID, and user ID.')
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [runningMode, setRunningMode] = useState<RunMode | null>(null)
  const [virtualCameraInfo, setVirtualCameraInfo] = useState<VirtualCameraInfo | null>(null)

  useEffect(() => {
    window.localStorage.setItem('engagex.participant.server', serverInput)
  }, [serverInput])

  useEffect(() => {
    window.localStorage.setItem('engagex.participant.sessionId', sessionId)
  }, [sessionId])

  useEffect(() => {
    window.localStorage.setItem('engagex.participant.userId', userId)
  }, [userId])

  useEffect(() => {
    window.localStorage.setItem('engagex.participant.preview', showPreview ? '1' : '0')
  }, [showPreview])

  const serverUrl = useMemo(() => normalizeServerUrl(serverInput), [serverInput])

  useEffect(() => {
    if (!serverUrl || !sessionId.trim()) {
      setSessionDetail(null)
      return
    }

    let cancelled = false

    const pollSession = async () => {
      const result = await fetchSessionDetail(serverUrl, sessionId, 10)
      if (!result.ok) {
        if (!cancelled) {
          setSessionDetail(null)
        }
        return
      }

      if (!cancelled) {
        setSessionDetail(result.data)
      }
    }

    void pollSession()
    const timer = window.setInterval(() => {
      void pollSession()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [serverUrl, sessionId])

  const me = useMemo(() => {
    if (!sessionDetail) return null
    return sessionDetail.participants.find((participant) => participant.user_id === userId.trim()) || null
  }, [sessionDetail, userId])

  const handleStart = async (mode: RunMode) => {
    const trimmedSessionId = sessionId.trim()
    const trimmedUserId = userId.trim()

    if (!serverUrl || !trimmedSessionId || !trimmedUserId) {
      setStatusMessage('All fields are required.')
      return
    }

    const validation = await fetchSessionDetail(serverUrl, trimmedSessionId, 5)
    if (!validation.ok) {
      if (validation.status === 404) {
        setStatusMessage('Session not found on admin laptop.')
      } else {
        setStatusMessage(`Could not reach the admin laptop at ${serverUrl}.`)
      }
      setRunningMode(null)
      setVirtualCameraInfo(null)
      return
    }

    if (mode === 'virtual-camera') {
      const result = await window.api?.startVirtualCamera({
        sessionId: trimmedSessionId,
        userId: trimmedUserId,
        serverUrl,
        intervalSec: 3,
        cameraId: 0,
        preview: showPreview,
      })

      if (!result?.ok) {
        setStatusMessage(result?.error || 'Virtual camera did not finish starting.')
        setRunningMode(null)
        setVirtualCameraInfo(null)
        return
      }

      const info: VirtualCameraInfo = {
        cameraId: Number(result.camera_id ?? 0),
        cameraBackend: result.camera_backend || 'unknown',
        device: result.virtual_camera_device || 'OBS Virtual Camera',
        backend: result.virtual_camera_backend || 'unknown',
        width: Number(result.width ?? 0),
        height: Number(result.height ?? 0),
        fps: Number(result.fps ?? 0),
        note: result.note,
      }

      setVirtualCameraInfo(info)
      setRunningMode(mode)
      setStatusMessage(`Virtual camera running for ${trimmedUserId}. In Meet, Zoom, or Teams choose "${info.device}".`)
      return
    }

    const result = await window.api?.startClient({
      sessionId: trimmedSessionId,
      userId: trimmedUserId,
      serverUrl,
      intervalSec: 3,
      cameraId: 0,
      preview: showPreview,
    })

    if (!result?.ok) {
      setStatusMessage(result?.error || 'Desktop client bridge is unavailable.')
      setRunningMode(null)
      setVirtualCameraInfo(null)
      return
    }

    setVirtualCameraInfo(null)
    setRunningMode(mode)
    setStatusMessage(`Client running for ${trimmedUserId} in ${trimmedSessionId}.`)
  }

  const handleStop = () => {
    const stopped = window.api?.stopClient()
    const activeMode = runningMode
    setRunningMode(null)
    setVirtualCameraInfo(null)

    if (stopped?.ok) {
      setStatusMessage(activeMode === 'virtual-camera' ? 'Virtual camera stopped.' : 'Client stopped.')
      return
    }

    setStatusMessage('No participant process is running.')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-6 lg:px-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Participant</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">EngageX Participant Client</h1>
          <p className="mt-2 text-sm text-slate-400">
            Connect to the admin laptop over the same Wi-Fi, then either send lightweight JSON attention scores or publish a virtual camera feed for meeting apps.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">Server IP</label>
              <input
                value={serverInput}
                onChange={(event) => setServerInput(event.target.value)}
                placeholder="192.168.0.25:8000"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">Session ID</label>
              <input
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="SES-XXXXXXXXXX"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">User ID</label>
              <input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="student-1"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void handleStart('local-client')}
              className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Start Local Client (Scores Only)
            </button>
            <button
              onClick={() => void handleStart('virtual-camera')}
              className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
            >
              Start Virtual Camera (Meeting Feed)
            </button>
            <button
              onClick={handleStop}
              className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            >
              Stop Running Mode
            </button>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(event) => setShowPreview(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-400 focus:ring-emerald-500"
            />
            Show local preview window while the model is running
          </label>

          <p className="mt-3 text-xs text-slate-500">
            Use local client mode for score-only LAN updates. For meeting video, the status below must say Virtual Camera and the preview window title should say EngageX Virtual Camera Preview. If it says Local Client or the preview window title says EngageX Participant, the virtual camera is not running yet.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
            <p className={`mt-2 text-lg font-semibold ${runningMode ? 'text-emerald-300' : 'text-amber-300'}`}>
              {statusMessage}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
              Active Mode: {runningMode === 'virtual-camera' ? 'Virtual Camera' : runningMode === 'local-client' ? 'Local Client' : 'Idle'}
            </p>
            <p className="mt-2 text-xs text-slate-500">{serverUrl || 'Waiting for a valid backend URL'}</p>

            {runningMode === 'virtual-camera' && virtualCameraInfo && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Output Device</p>
                  <p className="mt-2 text-sm font-semibold text-sky-300">{virtualCameraInfo.device}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {virtualCameraInfo.width}x{virtualCameraInfo.height} @ {virtualCameraInfo.fps} FPS
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Capture Path</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-300">
                    Webcam {virtualCameraInfo.cameraId} via {virtualCameraInfo.cameraBackend}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Virtual camera backend: {virtualCameraInfo.backend}</p>
                </div>
              </div>
            )}

            {runningMode === 'virtual-camera' && virtualCameraInfo?.note && (
              <p className="mt-4 text-xs text-amber-300">{virtualCameraInfo.note}</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {sessionDetail?.session.session_id || 'Waiting for admin session'}
            </h2>
            <p className="mt-2 break-all text-sm text-slate-400">
              {sessionDetail?.session.meeting_link || 'The admin laptop has not exposed this session yet.'}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Participants', value: sessionDetail?.summary.participant_count ?? 0, tone: 'text-sky-300' },
                { label: 'Scores', value: sessionDetail?.summary.total_samples ?? 0, tone: 'text-emerald-300' },
                { label: 'Updated', value: formatClock(sessionDetail?.summary.last_updated), tone: 'text-amber-300' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/80 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Latest</th>
                    <th className="px-4 py-3 text-left font-medium">Average</th>
                    <th className="px-4 py-3 text-left font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {(sessionDetail?.participants || []).map((participant) => (
                    <tr key={participant.user_id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{participant.user_id}</p>
                        <p className="text-xs text-slate-500">{participant.latest_state || 'No state'}</p>
                      </td>
                      <td className="px-4 py-3 text-emerald-300">{participant.latest_score.toFixed(0)}%</td>
                      <td className="px-4 py-3 text-slate-200">{participant.average_score.toFixed(0)}%</td>
                      <td className="px-4 py-3 text-slate-400">{formatClock(participant.last_seen)}</td>
                    </tr>
                  ))}

                  {!sessionDetail?.participants.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                        Waiting for the admin session to appear.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Your Latest Score</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{me?.user_id || userId || 'Unknown user'}</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Latest', value: me ? `${me.latest_score.toFixed(0)}%` : '--', tone: 'text-emerald-300' },
                { label: 'Average', value: me ? `${me.average_score.toFixed(0)}%` : '--', tone: 'text-sky-300' },
                { label: 'Pose', value: me?.pose_score != null ? `${Math.round(me.pose_score * 100)}%` : '--', tone: 'text-violet-300' },
                { label: 'Gaze', value: me?.gaze_score != null ? `${Math.round(me.gaze_score * 100)}%` : '--', tone: 'text-amber-300' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session Instructions</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-300">
                <li>1. Get the server IP and session ID from the admin laptop.</li>
                <li>2. Enter them here with your user ID.</li>
                <li>3. Start Local Client for score-only LAN mode.</li>
                <li>4. Start Virtual Camera before opening the meeting app that should use the EngageX camera feed, then pick the Output Device shown above.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
