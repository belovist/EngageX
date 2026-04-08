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

contextBridge.exposeInMainWorld('api', {
  startClient: () => {
    if (clientProcess && !clientProcess.killed) {
      return
    }

    const pythonExe = resolvePythonExecutable()
    clientProcess = spawn(
      pythonExe,
      [
        '-m',
        'clients.distributed_client',
        '--user-id',
        'student-1',
        '--server-url',
        'http://127.0.0.1:8000',
        '--camera-id',
        '0',
        '--interval',
        '1.5',
      ],
      {
        cwd: repoRoot,
        shell: false,
        windowsHide: false,
      }
    )

    clientProcess.stdout?.on('data', (data) => {
      console.log(`[participant-client] ${data}`.trim())
    })

    clientProcess.stderr?.on('data', (data) => {
      console.error(`[participant-client] ${data}`.trim())
    })

    clientProcess.on('exit', (code) => {
      console.log(`participant client exited with code ${code}`)
      clientProcess = null
    })
  },
})
