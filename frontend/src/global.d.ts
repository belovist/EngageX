export {}

declare global {
  type EngageXLanResponse<T> = {
    ok: boolean
    status: number
    data?: T | null
    error?: string
  }

  interface Window {
    api?: {
      fetchSession: (config: {
        sessionId: string
        serverUrl: string
        limitPerUser?: number
      }) => Promise<EngageXLanResponse<unknown>>
      fetchHealth: (config: {
        serverUrl: string
      }) => Promise<EngageXLanResponse<unknown>>
      startClient: (config: {
        sessionId: string
        userId: string
        serverUrl: string
        cameraId?: number
        intervalSec?: number
        preview?: boolean
      }) => { ok: boolean; error?: string }
      startVirtualCamera: (config: {
        sessionId: string
        userId: string
        serverUrl: string
        cameraId?: number
        intervalSec?: number
        preview?: boolean
      }) => { ok: boolean; error?: string }
      stopClient: () => { ok: boolean }
    }
  }
}
