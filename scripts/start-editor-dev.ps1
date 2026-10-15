$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

# Fail clearly instead of opening another repository or silently choosing 5174.
foreach ($port in @(5173, 4401)) {
  $probe = New-Object Net.Sockets.TcpClient
  try {
    $probe.Connect('127.0.0.1', $port)
    throw "Port $port is already occupied. Stop its development server before starting KFL from $projectRoot."
  } catch [Net.Sockets.SocketException] {
    # No listener: safe to start this project's service.
  } finally { $probe.Dispose() }
}

$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
# This existing guard verifies DATABASE_URL matches the marked local test DB.
& npm.cmd --workspace apps/api run test:browser:prepare
if ($LASTEXITCODE -ne 0) { throw 'Dedicated local database verification failed.' }

$env:PORT = '4401'
$env:WEB_ORIGIN = 'http://localhost:5173'
$apiProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('--import','tsx','apps/api/src/server.ts') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$projectRoot/.local/editor-api.log" -RedirectStandardError "$projectRoot/.local/editor-api-error.log"
try {
  $env:VITE_API_URL = 'http://127.0.0.1:4401/api'
  $webProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/vite/bin/vite.js','apps/web','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$projectRoot/.local/editor-web.log" -RedirectStandardError "$projectRoot/.local/editor-web-error.log"
  @{root=$projectRoot;apiPid=$apiProcess.Id;webPid=$webProcess.Id;url='http://localhost:5173/admin/athletes'} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath "$projectRoot/.local/editor-dev-processes.json"
  Write-Output "KFL frontend root: $projectRoot/apps/web"
  Write-Output 'Frontend: http://localhost:5173/admin/athletes | Local test API: 4401'
} catch {
  Stop-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
  throw
}
