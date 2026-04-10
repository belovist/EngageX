const { contextBridge } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const https = require('https')
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

function requestJson(method, rawUrl, body = null, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let targetUrl

    try {
      targetUrl = new URL(rawUrl)
    } catch (error) {
      resolve({ ok: false, status: 0, error: error instanceof Error ? error.message : 'Invalid URL.' })
      return
    }

    const transport = targetUrl.protocol === 'https:' ? https : http
    const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8')
    const headers = {
      Accept: 'application/json',
    }

    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = String(payload.length)
    }

    const request = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method,
        headers,
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          responseBody += chunk
        })
        response.on('end', () => {
          let data = null
          if (responseBody) {
            try {
              data = JSON.parse(responseBody)
            } catch {
              data = null
            }
          }

          const status = Number(response.statusCode || 0)
          const ok = status >= 200 && status < 300
          const error =
            ok
              ? undefined
              : data?.detail || response.statusMessage || `Request failed with status ${status || '0'}.`

          resolve({ ok, status, data, error })
        })
      }
    )

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Request timed out.'))
    })

    request.on('error', (error) => {
      resolve({ ok: false, status: 0, error: error instanceof Error ? error.message : 'Request failed.' })
    })

    if (payload) {
      request.write(payload)
    }

    request.end()
  })
}

function buildServerUrl(serverUrl, relativePath) {
  const baseUrl = String(serverUrl || '').trim()
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL(relativePath, normalizedBase).toString()
}

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
  fetchSession: async (config = {}) => {
    const sessionId = String(config.sessionId || '').trim()
    const serverUrl = String(config.serverUrl || '').trim()
    const limitPerUser = Number.isFinite(Number(config.limitPerUser)) ? Number(config.limitPerUser) : 10

    if (!sessionId || !serverUrl) {
      return { ok: false, status: 0, error: 'sessionId and serverUrl are required.' }
    }

    const requestUrl = buildServerUrl(
      serverUrl,
      `api/sessions/${encodeURIComponent(sessionId)}?limit_per_user=${Math.max(1, Math.min(200, limitPerUser))}`
    )
    return requestJson('GET', requestUrl)
  },
  fetchHealth: async (config = {}) => {
    const serverUrl = String(config.serverUrl || '').trim()
    if (!serverUrl) {
      return { ok: false, status: 0, error: 'serverUrl is required.' }
    }

    return requestJson('GET', buildServerUrl(serverUrl, 'health'))
  },
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
