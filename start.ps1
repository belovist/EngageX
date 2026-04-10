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

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
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

function Get-SystemInfo {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/system/info" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return ($response.Content | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Ensure-LanFirewallAccess {
    $ruleName = "EngageX LAN Backend TCP 8000"
    try {
        $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        if ($existingRule) {
            return
        }
    } catch {}

    if (-not (Test-IsAdministrator)) {
        Write-Host "Windows Firewall was not updated automatically. Run PowerShell as Administrator once if participant laptops still cannot reach port 8000." -ForegroundColor Yellow
        return
    }

    try {
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -Action Allow `
            -Enabled True `
            -Profile Private `
            -Protocol TCP `
            -LocalPort 8000 | Out-Null
        Write-Host "Opened Windows Firewall for EngageX LAN access on port 8000." -ForegroundColor Green
    } catch {
        Write-Host ("Could not configure Windows Firewall automatically: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }
}

Write-Host "Starting EngageX Admin..." -ForegroundColor Cyan
Ensure-PythonEnv
Ensure-FrontendDeps
Ensure-LanFirewallAccess

if ($CleanPorts) {
    Stop-ProcessesOnPort -Ports @(3000, 8000)
}

$backend = Start-Process -PassThru -NoNewWindow -FilePath $PYTHON_BIN `
    -ArgumentList "-m uvicorn backend.server:app --host 0.0.0.0 --port 8000" `
    -WorkingDirectory $REPO_ROOT

if (-not (Wait-ForHttpOk -Url "http://127.0.0.1:8000/health" -TimeoutSeconds 30)) {
    throw "Backend did not become ready on port 8000."
}

$vite = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host 127.0.0.1 --port 3000 --strictPort" `
    -WorkingDirectory $FRONTEND_DIR

if (-not (Wait-ForHttpOk -Url "http://127.0.0.1:3000" -TimeoutSeconds 40)) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    throw "Frontend did not become ready on port 3000."
}

$electron = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" `
    -ArgumentList "/c npx electron ." `
    -WorkingDirectory $FRONTEND_DIR

$systemInfo = Get-SystemInfo
$serverIp = "127.0.0.1"
if ($systemInfo -and $systemInfo.server_ip) {
    $serverIp = $systemInfo.server_ip
}

Write-Host ""
Write-Host "EngageX Admin is running." -ForegroundColor Green
Write-Host ("Backend:   http://{0}:8000" -f $serverIp)
Write-Host "Frontend:  http://127.0.0.1:3000"
Write-Host "Dashboard: http://127.0.0.1:3000/host"
Write-Host ""
Write-Host "Close this window to stop the admin stack."

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backend.HasExited) { break }
        if ($vite.HasExited) { break }
        if ($electron.HasExited) { break }
    }
} finally {
    Stop-Process -Id $electron.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
}
