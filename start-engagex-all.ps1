param(
    [string]$UserId = "student-1",
    [int]$CameraId = 0,
    [switch]$UseVirtualCam,
    [switch]$InstallFrontendDeps,
    [switch]$CleanPorts
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$frontendDir = Join-Path $repoRoot "frontend"
$virtualCamScript = Join-Path $repoRoot "clients\desktop\run_virtual_cam.py"
$distributedClientScript = Join-Path $repoRoot "clients\distributed_client.py"

if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found at $pythonExe. Ensure the project venv exists."
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found at $frontendDir"
}

function Stop-ProcessOnPort {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($null -eq $listeners) {
        return
    }

    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "Stopped process $pid on port $Port"
        } catch {
            Write-Warning "Could not stop PID $pid on port ${Port}: $($_.Exception.Message)"
        }
    }
}

function Start-InNewTerminal {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $escapedWd = $WorkingDirectory.Replace("'", "''")
    $fullCommand = "Set-Location '$escapedWd'; `$Host.UI.RawUI.WindowTitle = '$Title'; $Command"

    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $fullCommand
    ) | Out-Null

    Write-Host "Started: $Title"
}

if ($CleanPorts) {
    Stop-ProcessOnPort -Port 3000
    Stop-ProcessOnPort -Port 8000
}

if ($InstallFrontendDeps) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontendDir
    try {
        npm install
    } finally {
        Pop-Location
    }
}

$backendCmd = "& '$pythonExe' -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload"
Start-InNewTerminal -Title "EngageX Backend :8000" -WorkingDirectory $repoRoot -Command $backendCmd

$frontendCmd = "npm run dev"
Start-InNewTerminal -Title "EngageX Frontend :3000" -WorkingDirectory $frontendDir -Command $frontendCmd

if ($UseVirtualCam) {
    if (-not (Test-Path $virtualCamScript)) {
        throw "Virtual camera script not found at $virtualCamScript"
    }

    $participantCmd = "& '$pythonExe' '$virtualCamScript' --camera-id $CameraId --backend-url http://127.0.0.1:8000 --user-id $UserId --show-preview"
    Start-InNewTerminal -Title "EngageX Participant VirtualCam" -WorkingDirectory $repoRoot -Command $participantCmd
} else {
    if (-not (Test-Path $distributedClientScript)) {
        throw "Participant script not found at $distributedClientScript"
    }

    $participantCmd = "& '$pythonExe' '$distributedClientScript' --user-id $UserId --server-url http://127.0.0.1:8000 --camera-id $CameraId --interval 1.5"
    Start-InNewTerminal -Title "EngageX Participant Client" -WorkingDirectory $repoRoot -Command $participantCmd
}

Write-Host ""
Write-Host "Launched all services with corrected ports:"
Write-Host "- Backend:   http://127.0.0.1:8000"
Write-Host "- Frontend:  http://127.0.0.1:3000"
Write-Host ""
Write-Host "Pages:"
Write-Host "- Host view:        http://127.0.0.1:3000/host"
Write-Host "- Participant view: http://127.0.0.1:3000/participant"
Write-Host ""
Write-Host "Health check: http://127.0.0.1:8000/health"
