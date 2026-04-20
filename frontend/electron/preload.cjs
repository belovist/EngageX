const { contextBridge } = require('electron')
const { spawn, spawnSync } = require('child_process')
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

function checkPythonModule(pythonExe, moduleName) {
  const check = spawnSync(
    pythonExe,
    ['-c', `import ${moduleName}`],
    {
      cwd: repoRoot,
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
    }
  )

  if (check.status === 0) {
    return { ok: true }
  }

  const details = [check.stderr, check.stdout]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

  return {
    ok: false,
    error: details || `Required Python module '${moduleName}' is not installed.`,
  }
}

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

function summarizeProcessOutput(stderrLines, stdoutLines) {
  return [...stderrLines.slice(-6), ...stdoutLines.slice(-4)]
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join(' | ')
}

function attachLineLogger(stream, onLine) {
  if (!stream) {
    return () => {}
  }

  stream.setEncoding('utf8')
  let buffer = ''

  stream.on('data', (chunk) => {
    buffer += String(chunk)
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (line) {
        onLine(line)
      }
    }
  })

  return () => {
    const finalLine = buffer.trim()
    if (finalLine) {
      onLine(finalLine)
    }
  }
}

function startPythonModule(moduleName, moduleArgs, logPrefix, options = {}) {
  stopClientProcess()

  const pythonExe = resolvePythonExecutable()
  const readyPrefix = typeof options.readyPrefix === 'string' ? options.readyPrefix : ''
  const startupDelayMs = Number.isFinite(Number(options.startupDelayMs)) ? Number(options.startupDelayMs) : 1000
  const readyTimeoutMs = Number.isFinite(Number(options.readyTimeoutMs)) ? Number(options.readyTimeoutMs) : 15000

  return new Promise((resolve) => {
    const stdoutLines = []
    const stderrLines = []
    let settled = false
    let timer = null

    const child = spawn(
      pythonExe,
      ['-u', '-m', moduleName, ...moduleArgs],
      {
        cwd: repoRoot,
        shell: false,
        windowsHide: false,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      }
    )

    clientProcess = child

    const rememberLine = (bucket, line) => {
      bucket.push(line)
      if (bucket.length > 40) {
        bucket.shift()
      }
    }

    const finish = (result) => {
      if (settled) {
        return
      }

      settled = true
      if (timer) {
        clearTimeout(timer)
      }
      resolve(result)
    }

    const maybeResolveReadyLine = (line) => {
      if (!readyPrefix || !line.startsWith(readyPrefix)) {
        return
      }

      const payloadText = line.slice(readyPrefix.length).trim()
      if (!payloadText) {
        finish({ ok: true })
        return
      }

      try {
        finish({ ok: true, ...JSON.parse(payloadText) })
      } catch {
        finish({ ok: true, raw: payloadText })
      }
    }

    const flushStdout = attachLineLogger(child.stdout, (line) => {
      rememberLine(stdoutLines, line)
      console.log(`[${logPrefix}] ${line}`)
      maybeResolveReadyLine(line)
    })

    const flushStderr = attachLineLogger(child.stderr, (line) => {
      rememberLine(stderrLines, line)
      console.error(`[${logPrefix}] ${line}`)
    })

    child.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[${logPrefix}] failed to start: ${message}`)
      if (clientProcess === child) {
        clientProcess = null
      }
      finish({ ok: false, error: message })
    })

    child.on('exit', (code, signal) => {
      flushStdout()
      flushStderr()
      console.log(`${logPrefix} exited with code ${code}${signal ? ` signal ${signal}` : ''}`)
      if (clientProcess === child) {
        clientProcess = null
      }

      if (!settled) {
        const details = summarizeProcessOutput(stderrLines, stdoutLines)
        finish({
          ok: false,
          error: details || `${logPrefix} exited with code ${code ?? 'unknown'}.`,
        })
      }
    })

    timer = setTimeout(() => {
      const isRunning = child.exitCode == null && !child.killed
      if (!isRunning) {
        const details = summarizeProcessOutput(stderrLines, stdoutLines)
        finish({
          ok: false,
          error: details || `${logPrefix} exited before it finished starting.`,
        })
        return
      }

      if (!readyPrefix) {
        finish({ ok: true })
        return
      }

      const details = summarizeProcessOutput(stderrLines, stdoutLines)
      finish({
        ok: false,
        error: details || `Timed out waiting for ${logPrefix} to start.`,
      })
    }, readyPrefix ? readyTimeoutMs : startupDelayMs)
  })
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

    return startPythonModule(
      'clients.distributed_client',
      [
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
        ...(preview ? ['--display'] : []),
      ],
      'participant-client',
      {
        startupDelayMs: 1200,
      }
    )
  },
  startVirtualCamera: (config = {}) => {
    const sessionId = String(config.sessionId || '').trim()
    const userId = String(config.userId || '').trim()
    const serverUrl = String(config.serverUrl || '').trim()
    const cameraId = Number.isFinite(Number(config.cameraId)) ? String(Number(config.cameraId)) : '0'
    const interval = Number.isFinite(Number(config.intervalSec)) ? String(Number(config.intervalSec)) : '3'
    const preview = Boolean(config.preview)

    if (!sessionId || !userId || !serverUrl) {
      return { ok: false, error: 'sessionId, userId, and serverUrl are required.' }
    }

    const pythonExe = resolvePythonExecutable()
    const moduleCheck = checkPythonModule(pythonExe, 'pyvirtualcam')
    if (!moduleCheck.ok) {
      return {
        ok: false,
        error: 'Virtual camera support is not installed in this Python environment. Install pyvirtualcam, then try again.',
      }
    }

    return startPythonModule(
      'clients.desktop.run_virtual_cam',
      [
        '--session-id',
        sessionId,
        '--user-id',
        userId,
        '--backend-url',
        serverUrl,
        '--camera-id',
        cameraId,
        '--send-interval',
        interval,
        ...(preview ? ['--show-preview'] : []),
      ],
      'participant-virtual-camera',
      {
        readyPrefix: 'ENGAGEX_READY ',
        readyTimeoutMs: 20000,
      }
    )
  },
  stopClient: () => ({ ok: stopClientProcess() }),
})
