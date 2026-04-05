export {}

declare global {
  interface Window {
    api?: {
      startClient: () => void
    }
  }
}