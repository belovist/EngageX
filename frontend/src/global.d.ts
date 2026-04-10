export {}

declare global {
  interface Window {
    api?: {
      startClient: (config: {
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
