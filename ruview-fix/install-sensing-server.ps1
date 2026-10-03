<#
  Makes RuView Desktop v0.4.x work on Windows, with or without ESP32 boards.

  1. Installs the sensing server that RuView Desktop's "Start Server" button
     launches (wifi-densepose-sensing-server.exe). The desktop installer does
     not ship it. It goes into the RuView Desktop folder (found automatically)
     and into %LOCALAPPDATA%\RuView\bin, which is added to your user PATH.
  2. Installs the live web dashboard next to the server
     (http://localhost:8080/ui/index.html while the server runs).
  3. Installs ruview-laptop-node.exe, which turns this laptop's WiFi adapter
     into a RuView sensing node, and starts it now and at every logon.
  4. Lets ESP32 boards on your home network reach the server (UDP 5005/5006).
  5. Self-tests the server and the laptop WiFi stream.

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

$uiSrc = Join-Path $here "ui"
foreach ($t in $targets) {
  # v0.4.x looks for wifi-densepose-sensing-server.exe; newer builds look for sensing-server.exe.
  Copy-Item $src (Join-Path $t "wifi-densepose-sensing-server.exe") -Force
  Copy-Item $src (Join-Path $t "sensing-server.exe") -Force
  # Live web dashboard served by the server at http://localhost:8080/ui/index.html
  # A marker file tells this script (and uninstall.ps1) the folder is ours;
  # a pre-existing ui folder without it is left untouched.
  $uiDst = Join-Path $t "ui"
  if ((Test-Path $uiSrc) -and (-not (Test-Path $uiDst) -or (Test-Path (Join-Path $uiDst ".ruview-fix")))) {
    if (Test-Path $uiDst) { Remove-Item $uiDst -Recurse -Force }
    Copy-Item $uiSrc $uiDst -Recurse -Force
    Set-Content (Join-Path $uiDst ".ruview-fix") "installed by install-sensing-server.ps1"
  }
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

# Laptop WiFi node: turns this PC's WiFi adapter into a RuView sensing node,
# so RuView works without ESP32 hardware. Starts now and at every logon.
$nodeSrc = Join-Path $here "ruview-laptop-node.exe"
$nodeExe = Join-Path $binDir "ruview-laptop-node.exe"
if (Test-Path $nodeSrc) {
  Get-Process -Name "ruview-laptop-node" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  Copy-Item $nodeSrc $nodeExe -Force
  $startup = [Environment]::GetFolderPath("Startup")
  $lnk = Join-Path $startup "RuView Laptop Node.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $nodeExe
  $sc.WorkingDirectory = $binDir
  $sc.Description = "Streams this laptop's WiFi signal to the RuView sensing server"
  $sc.Save()
  Write-Host "  laptop WiFi node installed -> $nodeExe (starts at logon)"
  # Let RuView Desktop's discovery broadcast (UDP 5006) and mDNS reach the node.
  $fw = "RuView laptop node"
  Remove-NetFirewallRule -DisplayName $fw -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $fw -Direction Inbound -Program $nodeExe -Protocol UDP -Action Allow -Profile Private,Domain | Out-Null

  # Windows 11 24H2+ only shows WiFi details to desktop apps when location
  # access is allowed. Without it the node falls back to RSSI-only mode.
  $loc = "Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location"
  $sys  = (Get-ItemProperty "HKLM:\$loc" -Name Value -ErrorAction SilentlyContinue).Value
  $user = (Get-ItemProperty "HKCU:\$loc" -Name Value -ErrorAction SilentlyContinue).Value
  $desk = (Get-ItemProperty "HKCU:\$loc\NonPackaged" -Name Value -ErrorAction SilentlyContinue).Value
  if ($sys -eq "Deny" -or $user -eq "Deny" -or $desk -eq "Deny") {
    Write-Warning "Location access is off. Windows hides WiFi scan details from desktop apps without it."
    Write-Warning "Turn on 'Location services' and 'Let desktop apps access your location' in the window that opens."
    Start-Process "ms-settings:privacy-location"
  }
}

# Self-test 1: the server must start and answer on HTTP.
Write-Host "`nSelf-test..."
$exe = Join-Path $targets[0] "wifi-densepose-sensing-server.exe"
$proc = Start-Process $exe -ArgumentList "--http-port","18080","--ws-port","18765","--udp-port","15005","--log-level","info" -PassThru -WindowStyle Hidden
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
  Start-Sleep -Milliseconds 500
  try { Invoke-WebRequest "http://127.0.0.1:18080/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok = $true } catch {}
}
if ($ok) { Write-Host "  [OK] the sensing server runs on this PC." -ForegroundColor Green }
else     { Write-Warning "The server did not answer. Run '$exe' in a terminal to see the error." }

# Self-test 2: this laptop's WiFi must stream live into the server.
if ($ok -and (Test-Path $nodeExe)) {
  $testLog = Join-Path $env:TEMP "ruview-node-selftest.log"
  Remove-Item $testLog -ErrorAction SilentlyContinue
  $node = Start-Process $nodeExe -ArgumentList "--server","127.0.0.1:15005","--no-discovery","--log","`"$testLog`"" -PassThru
  $src = ""
  for ($i = 0; $i -lt 20 -and $src -ne "esp32"; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $j = Invoke-RestMethod "http://127.0.0.1:18080/api/v1/sensing/latest" -TimeoutSec 2
      $src = $j.source
      $rssi = $j.features.mean_rssi
    } catch {}
  }
  if (-not $node.HasExited) { Stop-Process -Id $node.Id -Force }
  if ($src -eq "esp32") {
    Write-Host "  [OK] your laptop WiFi is streaming live into RuView (RSSI $rssi dBm)." -ForegroundColor Green
  } else {
    Write-Warning "The laptop WiFi node did not stream. Its log says:"
    if (Test-Path $testLog) { Get-Content $testLog | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" } }
    Write-Warning "Make sure WiFi is on and connected to a network, then run the installer again."
  }
}
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }

# Start the real node now (the Startup shortcut handles future logons).
if (Test-Path $nodeExe) {
  Get-Process -Name "ruview-laptop-node" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Process $nodeExe -WorkingDirectory $binDir
}

Write-Host "`nDone. Close RuView Desktop completely (also from the system tray) and open it again."
Write-Host "  1. Sensing -> Start Server"
Write-Host "  2. Dashboard -> Scan Network   (your laptop appears as an online node)"
Write-Host "  3. Live view: http://localhost:8080/ui/index.html"
Read-Host "Press Enter to close"
