<#
  Removes everything install-sensing-server.ps1 added. Run it with:
    powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
  RuView Desktop itself is left installed.
#>
param([string]$InstallDir = "")
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
  if ($InstallDir) { $argList += " -InstallDir `"$InstallDir`"" }
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit
}
Get-Process -Name "ruview-laptop-node","wifi-densepose-sensing-server","sensing-server" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "RuView Laptop Node.lnk") -ErrorAction SilentlyContinue
$binDir = Join-Path $env:LOCALAPPDATA "RuView\bin"
Remove-Item $binDir -Recurse -Force -ErrorAction SilentlyContinue
$dirs = @($InstallDir, "$env:ProgramFiles\RuView Desktop", "$env:LOCALAPPDATA\RuView Desktop", "$env:LOCALAPPDATA\Programs\RuView Desktop") | Where-Object { $_ -and (Test-Path $_) }
foreach ($d in $dirs) {
  foreach ($f in "wifi-densepose-sensing-server.exe", "sensing-server.exe") {
    Remove-Item (Join-Path $d $f) -Force -ErrorAction SilentlyContinue
  }
  $ui = Join-Path $d "ui"
  if (Test-Path (Join-Path $ui ".ruview-fix")) { Remove-Item $ui -Recurse -Force -ErrorAction SilentlyContinue }
}
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath) {
  [Environment]::SetEnvironmentVariable("Path", (($userPath -split ';') | Where-Object { $_ -and $_ -ne $binDir }) -join ';', "User")
}
[Environment]::SetEnvironmentVariable("RUVIEW_UDP_BIND", $null, "User")
[Environment]::SetEnvironmentVariable("RUVIEW_UDP_ALLOW", $null, "User")
foreach ($port in 5005, 5006) { Remove-NetFirewallRule -DisplayName "RuView sensing UDP $port" -ErrorAction SilentlyContinue }
Remove-NetFirewallRule -DisplayName "RuView laptop node" -ErrorAction SilentlyContinue
Write-Host "RuView server, laptop node, dashboard, firewall rules and settings removed."
Write-Host "Server data is kept in $env:LOCALAPPDATA\RuView\data (delete it by hand if you want)."
Read-Host "Press Enter to close"
