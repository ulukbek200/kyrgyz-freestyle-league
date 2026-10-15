param(
  [ValidateSet('init','start','stop','status')][string]$Action = 'status',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $projectRoot '.local'
$dataDir = Join-Path $localDir 'postgres-data'
$metadataPath = Join-Path $localDir 'postgres.json'
$envPath = Join-Path $projectRoot '.env'
$port = 55432
function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Local PostgreSQL command failed: $(Split-Path -Leaf $File)" }
}
function New-LocalSecret {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
if ($Action -ne 'init') {
  if (!(Test-Path -LiteralPath $metadataPath)) { throw 'No project-owned cluster metadata. Run init first.' }
  $meta = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
  if ($meta.dataDir -ne $dataDir -or $meta.port -ne $port -or $meta.purpose -ne 'KFL_LOCAL_TEST_ONLY') { throw 'Cluster identity mismatch' }
  $PgBin = $meta.bin
  if ($Action -eq 'start') {
    Invoke-Checked (Join-Path $PgBin 'pg_ctl.exe') @('-D',$dataDir,'-l',(Join-Path $localDir 'postgres.log'),'-w','start')
  } elseif ($Action -eq 'stop') {
    Invoke-Checked (Join-Path $PgBin 'pg_ctl.exe') @('-D',$dataDir,'-m','fast','-w','stop')
  } else {
    Invoke-Checked (Join-Path $PgBin 'pg_ctl.exe') @('-D',$dataDir,'status')
  }
  exit
}
if (Test-Path -LiteralPath $envPath) { throw 'Existing .env will not be overwritten.' }
if (Test-Path -LiteralPath $dataDir) { throw 'Existing data directory will not be initialized or reset.' }
if (!(Test-Path -LiteralPath (Join-Path $PgBin 'initdb.exe'))) { throw 'Install PostgreSQL or pass the installed bin directory with -PgBin.' }
$probe = New-Object System.Net.Sockets.TcpClient
try {
  $probe.Connect('127.0.0.1',$port)
  throw "Port $port is already occupied; refusing to use an unknown server."
} catch [System.Net.Sockets.SocketException] {
  # Connection refused: expected for a new isolated cluster.
} finally { $probe.Dispose() }
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$adminPassword = New-LocalSecret
$appPassword = New-LocalSecret
$jwtSecret = New-LocalSecret
$passwordFile = Join-Path $localDir 'postgres-admin-password'
[IO.File]::WriteAllText($passwordFile,$adminPassword,$utf8)
Invoke-Checked (Join-Path $PgBin 'initdb.exe') @('-D',$dataDir,'-U','kfl_local_owner','--encoding=UTF8','--locale=C','--auth=scram-sha-256',"--pwfile=$passwordFile")
[IO.File]::AppendAllText((Join-Path $dataDir 'postgresql.conf'),"`nlisten_addresses = '127.0.0.1'`nport = $port`n",$utf8)
$meta = @{purpose='KFL_LOCAL_TEST_ONLY';bin=$PgBin;dataDir=$dataDir;port=$port;database='kfl_stage2_test'}
[IO.File]::WriteAllText($metadataPath,($meta | ConvertTo-Json),$utf8)
Invoke-Checked (Join-Path $PgBin 'pg_ctl.exe') @('-D',$dataDir,'-l',(Join-Path $localDir 'postgres.log'),'-w','start')
$oldPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $adminPassword
  # This connection is to the new cluster just initialized above, never a pre-existing service.
  $sql = "CREATE ROLE kfl_test_user LOGIN PASSWORD '$appPassword';`nCREATE DATABASE kfl_stage2_test OWNER kfl_test_user;`nCOMMENT ON DATABASE kfl_stage2_test IS 'KFL_LOCAL_TEST_ONLY';"
  $sql | & (Join-Path $PgBin 'psql.exe') -X -q -w -h 127.0.0.1 -p $port -U kfl_local_owner -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Could not create dedicated test database' }
} finally { $env:PGPASSWORD = $oldPassword }
$databaseUrl = "postgresql://kfl_test_user:${appPassword}@127.0.0.1:${port}/kfl_stage2_test?schema=public"
$content = "# Dedicated project-owned local TEST database. Never production.`nDATABASE_URL=`"$databaseUrl`"`nTEST_DATABASE_URL=`"$databaseUrl`"`nJWT_SECRET=`"$jwtSecret`"`nPORT=4000`nWEB_ORIGIN=`"http://localhost:5173,http://127.0.0.1:5173`"`n"
[IO.File]::WriteAllText($envPath,$content,$utf8)
Write-Output "Created project-owned PostgreSQL on 127.0.0.1:$port; database kfl_stage2_test. Secrets saved locally, not printed."
