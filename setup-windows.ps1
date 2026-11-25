# Run from PowerShell: powershell.exe -ExecutionPolicy Bypass -File .\setup-windows.ps1
# Never commit backend/.env or backend/data/. This script does not print passwords/seeds.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is required. Install Node.js and reopen VS Code.' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd is unavailable. Reinstall Node.js.' }
    $nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }

    $envPath = Join-Path $PSScriptRoot 'backend\.env'
    if (-not (Test-Path $envPath)) {
        Write-Host 'Creating private backend/.env; do not share this file.' -ForegroundColor Cyan
        $email = Read-Host 'Organizer email (press Enter for organizer@example.test)'
        if ([string]::IsNullOrWhiteSpace($email)) { $email = 'organizer@example.test' }
        if ($email.Contains("`n") -or $email.Contains("`r") -or $email.Contains(' ')) { throw 'Invalid email format.' }

        $secure = Read-Host 'Organizer password (14+ characters)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        if ($pw.Length -lt 14 -or $pw.Contains("`r") -or $pw.Contains("`n")) { throw 'Password must be at least 14 characters and one line.' }
        $safePw = $pw.Replace('\','\\').Replace('"','\"')
        $rand = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($rand) } finally { $rng.Dispose() }
        $seed = -join ($rand | ForEach-Object { $_.ToString('x2') })
        $lines = @(
            'DATA_FILE=./data/veridraw.json',
            "VRF_PRIVATE_KEY_HEX=$seed",
            "ADMIN_EMAIL=$email",
            "ADMIN_PASSWORD=`"$safePw`"",
            'FRONTEND_ORIGIN=http://127.0.0.1:5173',
            'PORT=5000',
            'HOST=127.0.0.1',
            'NODE_ENV=development',
            'ENABLE_DEMO=true'
        )
        [IO.File]::WriteAllText($envPath,($lines -join "`n")+"`n",(New-Object System.Text.UTF8Encoding($false)))
        $pw = $null
        $seed = $null
    } else {
        Write-Host 'Existing backend/.env detected and preserved.' -ForegroundColor Yellow
    }

    Write-Host 'Installing Node.js project packages...' -ForegroundColor Cyan
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed. Check internet connection and npm registry access.' }
    & npm.cmd run db:init
    if ($LASTEXITCODE -ne 0) { throw 'JSON initialization failed.' }
    & npm.cmd run db:admin
    if ($LASTEXITCODE -ne 0) { throw 'Organizer setup failed. Check backend/.env.' }
    & npm.cmd run test:protocol
    if ($LASTEXITCODE -ne 0) { throw 'Protocol tests failed.' }
    & npm.cmd run test:storage
    if ($LASTEXITCODE -ne 0) { throw 'JSON storage tests failed.' }
    Write-Host 'Setup finished. Run these in two VS Code terminals:' -ForegroundColor Green
    Write-Host '  npm.cmd run dev:backend'
    Write-Host '  npm.cmd run dev:frontend'
    Write-Host 'Then open: http://127.0.0.1:5173'
    Write-Host 'Before real draws also run: npm.cmd run test:crypto; npm.cmd run typecheck; npm.cmd run build'
} finally {
    Pop-Location
}
