$REPO_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$USER_ID = "student-1"
$CAMERA_ID = "0"
$FACE_LANDMARKER_TASK = "$REPO_ROOT\models\face_landmarker.task"

Write-Host "Starting EngageX..." -ForegroundColor Cyan

# Find or create venv
if (Test-Path "$REPO_ROOT\.venv\Scripts\python.exe") {
    $PYTHON_BIN = "$REPO_ROOT\.venv\Scripts\python.exe"
    Write-Host "Found venv" -ForegroundColor Green
} else {
    Write-Host "Creating venv..." -ForegroundColor Yellow
    python -m venv "$REPO_ROOT\.venv"
    if (-Not (Test-Path "$REPO_ROOT\.venv\Scripts\python.exe")) {
        Write-Host "ERROR: Could not create venv. Make sure Python is installed." -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & "$REPO_ROOT\.venv\Scripts\pip.exe" install --upgrade pip -q
    & "$REPO_ROOT\.venv\Scripts\pip.exe" install -r "$REPO_ROOT\requirements.txt"
    Write-Host "Dependencies installed" -ForegroundColor Green
}

$PYTHON_BIN = "$REPO_ROOT\.venv\Scripts\python.exe"

# Check and install frontend deps
if (-Not (Test-Path "$REPO_ROOT\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$REPO_ROOT\frontend"
    npm install
    Set-Location $REPO_ROOT
    Write-Host "Frontend dependencies installed" -ForegroundColor Green
}

# Download and convert model if missing
if ((-Not (Test-Path "$REPO_ROOT\models\l2cs_net.onnx")) -or (-Not (Test-Path $FACE_LANDMARKER_TASK))) {
    Write-Host "Model not found, running setup..." -ForegroundColor Yellow
    & $PYTHON_BIN "$REPO_ROOT\setup_models.py"
    if ((-Not (Test-Path "$REPO_ROOT\models\l2cs_net.onnx")) -or (-Not (Test-Path $FACE_LANDMARKER_TASK))) {
        Write-Host "ERROR: Model setup failed. Please run 'python setup_models.py' manually." -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host "Models ready" -ForegroundColor Green

# Kill anything on ports 3000 and 8000
Write-Host "Clearing ports..." -ForegroundColor Yellow
$connections = netstat -ano | Select-String -Pattern ":(3000|8000)\s.*LISTENING"
foreach ($conn in $connections) {
    $parts = $conn -split '\s+'
    $procId = $parts[-1]
    if ($procId -match '^\d+$') {
        taskkill /PID $procId /F 2>$null | Out-Null
    }
}

# Start backend
Write-Host "Starting backend..." -ForegroundColor Green
$BACKEND = Start-Process -PassThru -NoNewWindow -FilePath $PYTHON_BIN `
    -ArgumentList "-m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload" `
    -WorkingDirectory $REPO_ROOT

Start-Sleep -Seconds 3

# Start Vite
Write-Host "Starting Vite..." -ForegroundColor Green
$VITE = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host 127.0.0.1 --port 3000 --strictPort" `
    -WorkingDirectory "$REPO_ROOT\frontend"

# Wait for Vite to be ready
Write-Host "Waiting for Vite..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "Vite is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $waited++
}

# Start Electron
Write-Host "Starting Electron..." -ForegroundColor Green
$ELECTRON = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx electron ." `
    -WorkingDirectory "$REPO_ROOT\frontend"

# Wait then start client
Start-Sleep -Seconds 3
Write-Host "Starting attention client..." -ForegroundColor Green
$CLIENT = Start-Process -PassThru -NoNewWindow -FilePath $PYTHON_BIN `
    -ArgumentList "-m clients.distributed_client --user-id $USER_ID --server-url http://127.0.0.1:8000 --camera-id $CAMERA_ID --interval 1.5" `
    -WorkingDirectory $REPO_ROOT

Write-Host "Validating live stack..." -ForegroundColor Yellow
$stackReady = $false
$maxWait = 40
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Select-Object -ExpandProperty Content | ConvertFrom-Json
        $scores = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/scores" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Select-Object -ExpandProperty Content | ConvertFrom-Json

        if ($health.status -eq "ok" -and $health.video_feed_live -and $scores.participants.Count -gt 0) {
            $stackReady = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $waited++
}

if (-Not $stackReady) {
    Write-Host "ERROR: Backend, frontend, and live model feed did not all become ready." -ForegroundColor Red
    Write-Host "Make sure the camera is free and the participant client can stream frames." -ForegroundColor Red
    Stop-Process -Id $BACKEND.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $VITE.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $ELECTRON.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $CLIENT.Id -Force -ErrorAction SilentlyContinue
    pause
    exit 1
}

Write-Host ""
Write-Host "EngageX is running!" -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close this window to stop everything." -ForegroundColor Yellow
Write-Host ""

# Keep running and cleanup on exit
try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($BACKEND.HasExited) {
            Write-Host "Backend stopped unexpectedly!" -ForegroundColor Red
            break
        }
    }
} finally {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Stop-Process -Id $BACKEND.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $VITE.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $ELECTRON.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $CLIENT.Id -Force -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
