export {}

declare global {
  type EngageXLanResponse<T> = {
    ok: boolean
    status: number
    data?: T | null
    error?: string
  }

  type EngageXStartProcessResult = {
    ok: boolean
    error?: string
  }

  type EngageXVirtualCameraStartResult = EngageXStartProcessResult & {
    mode?: 'virtual-camera'
    camera_id?: number
    camera_backend?: string
    virtual_camera_backend?: string
    virtual_camera_device?: string
    width?: number
    height?: number
    fps?: number
    note?: string
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
      }) => Promise<EngageXStartProcessResult>
      startVirtualCamera: (config: {
        sessionId: string
        userId: string
        serverUrl: string
        cameraId?: number
        intervalSec?: number
        preview?: boolean
      }) => Promise<EngageXVirtualCameraStartResult>
      stopClient: () => { ok: boolean }
    }
  }
}
