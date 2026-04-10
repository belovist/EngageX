const { contextBridge } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')

function resolvePythonExecutable() {
  const isWindows = process.platform === 'win32'
  const candidates = [
    path.join(repoRoot, '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
    path.join(repoRoot, 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return isWindows ? 'python' : 'python3'
}

let clientProcess = null

function stopClientProcess() {
  if (!clientProcess || clientProcess.killed) {
    clientProcess = null
    return false
  }

  clientProcess.kill()
  clientProcess = null
  return true
}

contextBridge.exposeInMainWorld('api', {
  startClient: (config = {}) => {
    const sessionId = String(config.sessionId || '').trim()
    const userId = String(config.userId || '').trim()
    const serverUrl = String(config.serverUrl || '').trim()
    const cameraId = Number.isFinite(Number(config.cameraId)) ? String(Number(config.cameraId)) : '0'
    const interval = Number.isFinite(Number(config.intervalSec)) ? String(Number(config.intervalSec)) : '3'
    const preview = Boolean(config.preview)

    if (!sessionId || !userId || !serverUrl) {
      return { ok: false, error: 'sessionId, userId, and serverUrl are required.' }
    }

    stopClientProcess()

    const pythonExe = resolvePythonExecutable()
    const args = [
      '-m',
      'clients.distributed_client',
      '--session-id',
      sessionId,
      '--user-id',
      userId,
      '--server-url',
      serverUrl,
      '--camera-id',
      cameraId,
      '--interval',
      interval,
    ]

    if (preview) {
      args.push('--display')
    }

    clientProcess = spawn(pythonExe, args, {
      cwd: repoRoot,
      shell: false,
      windowsHide: false,
    })

    clientProcess.stdout?.on('data', (data) => {
      console.log(`[participant-client] ${String(data).trim()}`)
    })

    clientProcess.stderr?.on('data', (data) => {
      console.error(`[participant-client] ${String(data).trim()}`)
    })

    clientProcess.on('exit', (code) => {
      console.log(`participant client exited with code ${code}`)
      clientProcess = null
    })

    return { ok: true }
  },
  stopClient: () => ({ ok: stopClientProcess() }),
})
