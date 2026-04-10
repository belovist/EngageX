param(
    [switch]$InstallFrontendDeps,
    [switch]$CleanPorts
)

$ErrorActionPreference = "Stop"

$REPO_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$PYTHON_BIN = Join-Path $REPO_ROOT ".venv\Scripts\python.exe"
$PIP_BIN = Join-Path $REPO_ROOT ".venv\Scripts\pip.exe"
$FRONTEND_DIR = Join-Path $REPO_ROOT "frontend"

function Get-HostPython {
    if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
    if (Get-Command python3 -ErrorAction SilentlyContinue) { return "python3" }
    throw "Python is not installed."
}

function Ensure-PythonEnv {
    if (-not (Test-Path $PYTHON_BIN)) {
        & (Get-HostPython) -m venv (Join-Path $REPO_ROOT ".venv")
    }

    & $PIP_BIN install --upgrade pip -q
    & $PIP_BIN install -r (Join-Path $REPO_ROOT "requirements.txt") -q
}

function Ensure-FrontendDeps {
    if ($InstallFrontendDeps -or -not (Test-Path (Join-Path $FRONTEND_DIR "node_modules"))) {
        Push-Location $FRONTEND_DIR
        try {
            npm install
        } finally {
            Pop-Location
        }
    }
}

function Ensure-Models {
    $onnxPath = Join-Path $REPO_ROOT "models\l2cs_net.onnx"
    $taskPath = Join-Path $REPO_ROOT "models\face_landmarker.task"
    if (-not (Test-Path $onnxPath) -or -not (Test-Path $taskPath)) {
        & $PYTHON_BIN (Join-Path $REPO_ROOT "setup_models.py")
    }
}

function Stop-ProcessesOnPort {
    param([int[]]$Ports)

    foreach ($Port in $Ports) {
        $connections = netstat -ano | Select-String -Pattern "[:.]$Port\s+.*LISTENING"
        foreach ($conn in $connections) {
            $parts = ($conn -split '\s+') | Where-Object { $_ }
            $pid = $parts[-1]
            if ($pid -match '^\d+$') {
                taskkill /PID $pid /F 2>$null | Out-Null
            }
        }
    }
}

function Wait-ForHttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 1
    }

    return $false
}

Write-Host "Starting EngageX Participant..." -ForegroundColor Cyan
Ensure-PythonEnv
Ensure-FrontendDeps
Ensure-Models

if ($CleanPorts) {
    Stop-ProcessesOnPort -Ports @(3000)
}

$vite = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host 127.0.0.1 --port 3000 --strictPort" `
    -WorkingDirectory $FRONTEND_DIR

if (-not (Wait-ForHttpOk -Url "http://127.0.0.1:3000" -TimeoutSeconds 40)) {
    Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
    throw "Frontend did not become ready on port 3000."
}

$electron = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx electron ." `
    -WorkingDirectory $FRONTEND_DIR

Write-Host ""
Write-Host "EngageX Participant is running." -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Join UI:  http://127.0.0.1:3000/participant"
Write-Host ""
Write-Host "Use the admin laptop's server IP and session ID in the participant UI."

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($vite.HasExited) { break }
        if ($electron.HasExited) { break }
    }
} finally {
    Stop-Process -Id $electron.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
}
