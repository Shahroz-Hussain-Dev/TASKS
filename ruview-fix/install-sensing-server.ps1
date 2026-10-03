<#
  Installs the missing RuView sensing server next to RuView Desktop v0.4.x.

  RuView Desktop's "Start Server" button launches a separate program,
  wifi-densepose-sensing-server.exe, which the desktop installer does not ship.
  This script copies a prebuilt Windows build of that server:
    1. into the RuView Desktop install folder (found automatically), and
    2. into %LOCALAPPDATA%\RuView\bin, which is added to your user PATH,
  and opens the firewall for UDP 5005 so ESP32 nodes can stream CSI later.

  Usage (from this folder, in PowerShell):
    powershell -ExecutionPolicy Bypass -File .\install-sensing-server.ps1
  Optional: -InstallDir "D:\Apps\RuView Desktop"   (if auto-detect fails)
#>
param([string]$InstallDir = "")

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $here "sensing-server.exe"
if (-not (Test-Path $src)) { throw "sensing-server.exe not found next to this script ($here)." }

# Re-launch elevated (needed to write into Program Files and add a firewall rule).
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Requesting administrator rights..."
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
  if ($InstallDir) { $argList += " -InstallDir `"$InstallDir`"" }
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit
}

function Find-RuViewDir {
  # 1. Uninstall registry entries written by the MSI / NSIS installers
  $keys = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*")
  foreach ($k in $keys) {
    foreach ($e in (Get-ItemProperty $k -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*RuView*" })) {
      if ($e.InstallLocation -and (Test-Path $e.InstallLocation)) { return $e.InstallLocation.TrimEnd('\') }
      if ($e.DisplayIcon) {
        $icon = ($e.DisplayIcon -split ',')[0].Trim('"')
        if (Test-Path $icon) { return (Split-Path -Parent $icon) }
      }
    }
  }
  # 2. Common install locations
  $candidates = @(
    "$env:ProgramFiles\RuView Desktop",
    "${env:ProgramFiles(x86)}\RuView Desktop",
    "$env:LOCALAPPDATA\RuView Desktop",
    "$env:LOCALAPPDATA\Programs\RuView Desktop")
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  # 3. A running RuView Desktop window
  $p = Get-Process | Where-Object { $_.ProcessName -like "*RuView*" -or $_.ProcessName -like "*wifi-densepose-desktop*" } |
       Select-Object -First 1
  if ($p -and $p.Path) { return (Split-Path -Parent $p.Path) }
  return $null
}

if (-not $InstallDir) { $InstallDir = Find-RuViewDir }

$targets = @()
if ($InstallDir) {
  Write-Host "RuView Desktop found in: $InstallDir"
  $targets += $InstallDir
} else {
  Write-Warning "Could not find the RuView Desktop folder. Installing to the PATH location only."
  Write-Warning "If Start Server still fails, re-run with -InstallDir `"<folder containing RuView Desktop.exe>`"."
}

$binDir = Join-Path $env:LOCALAPPDATA "RuView\bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$targets += $binDir

# Stop any old copy that is still running so the files can be replaced.
Get-Process -Name "wifi-densepose-sensing-server","sensing-server" -ErrorAction SilentlyContinue | Stop-Process -Force

foreach ($t in $targets) {
  # v0.4.x looks for wifi-densepose-sensing-server.exe; newer builds look for sensing-server.exe.
  Copy-Item $src (Join-Path $t "wifi-densepose-sensing-server.exe") -Force
  Copy-Item $src (Join-Path $t "sensing-server.exe") -Force
  Write-Host "  installed -> $t"
}

# Add %LOCALAPPDATA%\RuView\bin to the user PATH (fallback lookup).
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
if (($userPath -split ';') -notcontains $binDir) {
  [Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(';') + ";" + $binDir).TrimStart(';'), "User")
  Write-Host "  added $binDir to your user PATH"
}

# Let ESP32 nodes on your home network reach the server. By default the server
# only accepts CSI over UDP from this PC (127.0.0.1); RuView Desktop v0.4.x has
# no setting for this, so it is configured through environment variables that
# the app passes on to the server. Only the local subnet is allowed.
$net = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
       Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1
if ($net) {
  $ip = $net.IPv4Address | Select-Object -First 1
  $prefix = [int]$ip.PrefixLength
  $bytes = ([Net.IPAddress]$ip.IPAddress).GetAddressBytes()
  [Array]::Reverse($bytes)
  $addr = [BitConverter]::ToUInt32($bytes, 0)
  $mask = [uint32]([math]::Pow(2, 32) - [math]::Pow(2, 32 - $prefix))
  $nb = [BitConverter]::GetBytes([uint32]([uint64]$addr -band [uint64]$mask))
  [Array]::Reverse($nb)
  $cidr = "$(([Net.IPAddress]$nb).ToString())/$prefix"
  [Environment]::SetEnvironmentVariable("RUVIEW_UDP_BIND", "0.0.0.0", "User")
  [Environment]::SetEnvironmentVariable("RUVIEW_UDP_ALLOW", $cidr, "User")
  Write-Host "  ESP32 CSI accepted from your network: $cidr (this PC is $($ip.IPAddress))"
} else {
  Write-Warning "No active network with a gateway found; ESP32 CSI will only be accepted from this PC."
}

# Firewall: allow ESP32 nodes to stream CSI to UDP 5005, and discovery replies on 5006.
foreach ($port in 5005, 5006) {
  $name = "RuView sensing UDP $port"
  if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol UDP -LocalPort $port -Action Allow -Profile Private,Domain | Out-Null
    Write-Host "  firewall rule added: $name"
  }
}

# Quick self-test: the server must start and answer on http://127.0.0.1:8080.
Write-Host "`nSelf-test..."
$exe = Join-Path $targets[0] "wifi-densepose-sensing-server.exe"
$proc = Start-Process $exe -ArgumentList "--http-port","18080","--ws-port","18765","--udp-port","15005","--log-level","info","--source","simulated" -PassThru -WindowStyle Hidden
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
  Start-Sleep -Milliseconds 500
  try { Invoke-WebRequest "http://127.0.0.1:18080/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok = $true } catch {}
}
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
if ($ok) { Write-Host "Self-test passed: the sensing server runs on this PC." -ForegroundColor Green }
else     { Write-Warning "Self-test did not get a response. Run '$exe --source simulated' in a terminal to see the error." }

Write-Host "`nDone. Close RuView Desktop completely (also from the system tray) and open it again,"
Write-Host "then go to Sensing -> Start Server."
Read-Host "Press Enter to close"
