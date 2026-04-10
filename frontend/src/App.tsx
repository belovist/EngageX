import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from './config'

type SystemInfo = {
  server_ip: string
  backend_url: string
  host: string
  port: number
  rest_only: boolean
}

type SessionSummary = {
  participant_count: number
  total_samples: number
  average_score: number
  last_updated: number
}

type SessionRecord = {
  session_id: string
  meeting_link: string
  created_at: number
  updated_at: number
  total_samples: number
  total_participants: number
}

type ParticipantSummary = {
  user_id: string
  latest_score: number
  average_score: number
  total_samples: number
  last_seen: number
  latest_state?: string | null
  pose_score?: number | null
  gaze_score?: number | null
  person_detected?: boolean | null
}

type ScoreRecord = {
  score: number
  timestamp: number
  state?: string | null
}

type SessionDetail = {
  session: SessionRecord
  summary: SessionSummary
  participants: ParticipantSummary[]
  scores_by_user: Record<string, ScoreRecord[]>
  server: SystemInfo
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

function formatLink(meetingLink: string): string {
  return meetingLink.length > 64 ? `${meetingLink.slice(0, 61)}...` : meetingLink
}

export default function App() {
  const [meetingLink, setMeetingLink] = useState('')
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState('Create a session from a meeting link to begin.')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const savedMeetingLink = window.localStorage.getItem('engagex.admin.meetingLink') || ''
    const savedSessionId = window.localStorage.getItem('engagex.admin.sessionId') || ''
    setMeetingLink(savedMeetingLink)
    setActiveSessionId(savedSessionId)
  }, [])

  useEffect(() => {
    if (meetingLink.trim()) {
      window.localStorage.setItem('engagex.admin.meetingLink', meetingLink.trim())
    }
  }, [meetingLink])

  useEffect(() => {
    if (activeSessionId.trim()) {
      window.localStorage.setItem('engagex.admin.sessionId', activeSessionId.trim())
    }
  }, [activeSessionId])

  useEffect(() => {
    let cancelled = false

    const loadSystemInfo = async () => {
      try {
        const response = await fetch(apiUrl('/api/system/info'), { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as SystemInfo
        if (!cancelled) {
          setSystemInfo(payload)
        }
      } catch {
        // keep last good value
      }
    }

    void loadSystemInfo()
    const timer = window.setInterval(() => {
      void loadSystemInfo()
    }, 15000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSessions = async () => {
      try {
        const response = await fetch(apiUrl('/api/admin/sessions'), { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as { sessions: SessionRecord[]; server: SystemInfo }
        if (cancelled) return

        setRecentSessions(payload.sessions)
        setSystemInfo(payload.server)

        if (!activeSessionId && payload.sessions.length > 0) {
          setActiveSessionId(payload.sessions[0].session_id)
        }
      } catch {
        // keep last good data
      }
    }

    void loadSessions()
    const timer = window.setInterval(() => {
      void loadSessions()
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeSessionId])

  useEffect(() => {
    if (!activeSessionId) {
      setSessionDetail(null)
      return
    }

    let cancelled = false

    const loadSession = async () => {
      try {
        const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(activeSessionId)}?limit_per_user=20`), {
          cache: 'no-store',
        })
        if (!response.ok) {
          if (!cancelled) {
            setSessionDetail(null)
          }
          return
        }

        const payload = (await response.json()) as SessionDetail
        if (cancelled) return

        setSessionDetail(payload)
        setStatusMessage(`Connected to ${payload.session.session_id}`)

        const selectedStillExists = payload.participants.some((participant) => participant.user_id === selectedUserId)
        if ((!selectedUserId || !selectedStillExists) && payload.participants.length > 0) {
          setSelectedUserId(payload.participants[0].user_id)
        } else if (payload.participants.length === 0) {
          setSelectedUserId('')
        }
      } catch {
        if (!cancelled) {
          setStatusMessage('Waiting for admin session data...')
        }
      }
    }

    void loadSession()
    const timer = window.setInterval(() => {
      void loadSession()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeSessionId, selectedUserId])

  const handleCreateSession = async () => {
    const trimmedLink = meetingLink.trim()
    if (!trimmedLink) {
      setStatusMessage('Enter a meeting link.')
      return
    }

    setBusy(true)
    try {
      const response = await fetch(apiUrl('/api/admin/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_link: trimmedLink }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        detail?: string
        server: SystemInfo
        session: SessionRecord
      }

      if (!response.ok) {
        setStatusMessage(payload.detail || 'Failed to create session.')
        return
      }

      setSystemInfo(payload.server)
      setActiveSessionId(payload.session.session_id)
      setStatusMessage(`Session ${payload.session.session_id} ready.`)
    } catch {
      setStatusMessage('Could not reach the local backend.')
    } finally {
      setBusy(false)
    }
  }

  const chartPoints = useMemo(() => {
    if (!sessionDetail || !selectedUserId) return []
    return (sessionDetail.scores_by_user[selectedUserId] || []).slice(-12)
  }, [selectedUserId, sessionDetail])

  const selectedParticipant = useMemo(() => {
    if (!sessionDetail || !selectedUserId) return null
    return sessionDetail.participants.find((participant) => participant.user_id === selectedUserId) || null
  }, [selectedUserId, sessionDetail])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Admin</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">EngageX LAN Control</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Backend is LAN-accessible over REST. Create a session from the meeting link, then share the server IP and session ID with participant laptops.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Server IP</p>
                <p className="mt-2 text-2xl font-semibold text-sky-300">{systemInfo?.server_ip || '--'}</p>
                <p className="mt-1 text-xs text-slate-500">{systemInfo?.backend_url || 'Waiting for backend'}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session ID</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-300">{activeSessionId || '--'}</p>
                <p className="mt-1 text-xs text-slate-500">{statusMessage}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <label className="text-xs uppercase tracking-[0.22em] text-slate-500">Meeting Link</label>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <input
                  value={meetingLink}
                  onChange={(event) => setMeetingLink(event.target.value)}
                  placeholder="Paste the Zoom / Meet / Teams link"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500"
                />
                <button
                  onClick={handleCreateSession}
                  disabled={busy}
                  className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {busy ? 'Creating...' : 'Create / Refresh Session'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recent Sessions</p>
              <div className="mt-3 space-y-2">
                {recentSessions.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                    No sessions yet.
                  </p>
                )}

                {recentSessions.map((session) => (
                  <button
                    key={session.session_id}
                    onClick={() => {
                      setActiveSessionId(session.session_id)
                      setMeetingLink(session.meeting_link)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      session.session_id === activeSessionId
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{session.session_id}</p>
                      <p className="text-xs text-slate-500">{formatLink(session.meeting_link)}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{session.total_participants} users</p>
                      <p>{session.total_samples} scores</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Participants</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Session Traffic</h2>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Average</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">
                  {sessionDetail ? `${sessionDetail.summary.average_score.toFixed(0)}%` : '--'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Users', value: sessionDetail?.summary.participant_count ?? 0, tone: 'text-sky-300' },
                { label: 'Scores', value: sessionDetail?.summary.total_samples ?? 0, tone: 'text-emerald-300' },
                { label: 'Last Update', value: formatClock(sessionDetail?.summary.last_updated), tone: 'text-amber-300' },
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
                    <th className="px-4 py-3 text-left font-medium">Samples</th>
                    <th className="px-4 py-3 text-left font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                  {(sessionDetail?.participants || []).map((participant) => (
                    <tr
                      key={participant.user_id}
                      onClick={() => setSelectedUserId(participant.user_id)}
                      className={`cursor-pointer transition hover:bg-slate-900 ${
                        selectedUserId === participant.user_id ? 'bg-slate-900/80' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{participant.user_id}</p>
                        <p className="text-xs text-slate-500">{participant.latest_state || 'No state'}</p>
                      </td>
                      <td className="px-4 py-3 text-emerald-300">{participant.latest_score.toFixed(0)}%</td>
                      <td className="px-4 py-3 text-slate-200">{participant.average_score.toFixed(0)}%</td>
                      <td className="px-4 py-3 text-slate-300">{participant.total_samples}</td>
                      <td className="px-4 py-3 text-slate-400">{formatClock(participant.last_seen)}</td>
                    </tr>
                  ))}

                  {!sessionDetail?.participants.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        Waiting for participant JSON payloads.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Selected Participant</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {selectedParticipant?.user_id || 'No participant selected'}
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Latest Score', value: selectedParticipant ? `${selectedParticipant.latest_score.toFixed(0)}%` : '--', tone: 'text-emerald-300' },
                { label: 'Average Score', value: selectedParticipant ? `${selectedParticipant.average_score.toFixed(0)}%` : '--', tone: 'text-sky-300' },
                { label: 'Pose', value: selectedParticipant?.pose_score != null ? `${Math.round(selectedParticipant.pose_score * 100)}%` : '--', tone: 'text-violet-300' },
                { label: 'Gaze', value: selectedParticipant?.gaze_score != null ? `${Math.round(selectedParticipant.gaze_score * 100)}%` : '--', tone: 'text-amber-300' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Recent Samples</p>
                <p className="text-xs text-slate-500">{chartPoints.length} stored locally</p>
              </div>
              <div className="mt-4 space-y-2">
                {chartPoints.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-800 px-3 py-6 text-center text-sm text-slate-500">
                    Select a participant after data arrives.
                  </p>
                )}

                {chartPoints.map((point, index) => (
                  <div key={`${point.timestamp}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-100">{point.score.toFixed(0)}%</p>
                      <p className="text-xs text-slate-500">{formatClock(point.timestamp)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{point.state || 'No state label'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
