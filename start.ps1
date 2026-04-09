$ErrorActionPreference = "Stop"

$REPO_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

$USER_ID = "student-1"
$CAMERA_ID = "0"

$PYTHON_BIN = ""
$BACKEND = $null
$VITE = $null
$ELECTRON = $null
$CLIENT = $null

Write-Host "🚀 Starting EngageX..." -ForegroundColor Cyan

# ---------- PYTHON SETUP ----------

function Find-Python {
    if (Test-Path "$REPO_ROOT\.venv\Scripts\python.exe") {
        return "$REPO_ROOT\.venv\Scripts\python.exe"
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }
    if (Get-Command python3 -ErrorAction SilentlyContinue) {
        return "python3"
    }
    Write-Host "❌ Python not found" -ForegroundColor Red
    exit 1
}

$PYTHON_BIN = Find-Python

# Create venv if needed
if (-Not (Test-Path "$REPO_ROOT\.venv")) {
    Write-Host "📦 Creating virtual environment..." -ForegroundColor Yellow
    & $PYTHON_BIN -m venv "$REPO_ROOT\.venv"
}

$PYTHON_BIN = "$REPO_ROOT\.venv\Scripts\python.exe"

# Install Python dependencies
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
& $PYTHON_BIN -m pip install --upgrade pip -q
& $PYTHON_BIN -m pip install -r "$REPO_ROOT\requirements.txt" -q

# ---------- FRONTEND ----------

if (-Not (Test-Path "$REPO_ROOT\frontend\node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$REPO_ROOT\frontend"
    npm install
    Set-Location $REPO_ROOT
}

# ---------- MODELS ----------

if (-Not (Test-Path "$REPO_ROOT\models\l2cs_net.onnx")) {
    Write-Host "📥 Downloading models..." -ForegroundColor Yellow
    & $PYTHON_BIN "$REPO_ROOT\setup_models.py"
}

# ---------- CLEAN PORTS ----------

Write-Host "🧹 Clearing ports..." -ForegroundColor Yellow

$ports = @(3000, 8000)
foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port"
    foreach ($conn in $connections) {
        $parts = $conn -split '\s+'
        $pid = $parts[-1]
        if ($pid -match '^\d+$') {
            taskkill /PID $pid /F 2>$null | Out-Null
        }
    }
}

Start-Sleep -Seconds 1

# ---------- CLEANUP ----------

function Cleanup {
    Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow

    if ($CLIENT) { Stop-Process -Id $CLIENT.Id -Force -ErrorAction SilentlyContinue }
    if ($ELECTRON) { Stop-Process -Id $ELECTRON.Id -Force -ErrorAction SilentlyContinue }
    if ($VITE) { Stop-Process -Id $VITE.Id -Force -ErrorAction SilentlyContinue }
    if ($BACKEND) { Stop-Process -Id $BACKEND.Id -Force -ErrorAction SilentlyContinue }
}

# Handle Ctrl+C
Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# ---------- START BACKEND ----------

Write-Host "🧠 Starting backend..." -ForegroundColor Green

$BACKEND = Start-Process -PassThru -NoNewWindow -FilePath $PYTHON_BIN `
    -ArgumentList "-m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload" `
    -WorkingDirectory $REPO_ROOT

Start-Sleep -Seconds 3

# ---------- START FRONTEND ----------

Write-Host "🌐 Starting Vite..." -ForegroundColor Green

$VITE = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host 127.0.0.1 --port 3000 --strictPort" `
    -WorkingDirectory "$REPO_ROOT\frontend"

# Wait for Vite
Write-Host "⏳ Waiting for Vite..." -ForegroundColor Yellow

for ($i = 0; $i -lt 20; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2
        Write-Host "✅ Vite ready!" -ForegroundColor Green
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

# ---------- START ELECTRON ----------

Write-Host "🖥️ Starting Electron..." -ForegroundColor Green

$ELECTRON = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx electron ." `
    -WorkingDirectory "$REPO_ROOT\frontend"

Start-Sleep -Seconds 3

# ---------- START CLIENT ----------

Write-Host "🎥 Starting AI client..." -ForegroundColor Green

$CLIENT = Start-Process -PassThru -NoNewWindow -FilePath $PYTHON_BIN `
    -ArgumentList "-m clients.distributed_client --user-id $USER_ID --server-url http://127.0.0.1:8000 --camera-id $CAMERA_ID --interval 1.5" `
    -WorkingDirectory $REPO_ROOT

Write-Host ""
Write-Host "✅ EngageX is running!" -ForegroundColor Cyan
Write-Host "Backend  → http://127.0.0.1:8000"
Write-Host "Frontend → http://127.0.0.1:3000"
Write-Host ""
Write-Host "Press Ctrl+C to stop everything."
Write-Host ""

# ---------- WAIT LOOP ----------

try {
    while ($true) {
        Start-Sleep -Seconds 2
    }
}
finally {
    Cleanup
}