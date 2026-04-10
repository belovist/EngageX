param(
    [switch]$InstallFrontendDeps,
    [switch]$CleanPorts
)

& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "start.ps1") `
    -InstallFrontendDeps:$InstallFrontendDeps `
    -CleanPorts:$CleanPorts
