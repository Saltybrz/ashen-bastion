$raw = Get-Content -Path "test_settings_out.txt" -Raw
if ($raw -match 'id="base64"[^>]*>data:image/png;base64,([^<]+)</div>') {
    $bytes = [System.Convert]::FromBase64String($matches[1])
    $brainDir = Join-Path $env:USERPROFILE ".gemini\antigravity-ide\brain\0ac35696-a8f3-4878-99f1-5125c9c68395"
    if (-not (Test-Path $brainDir)) { New-Item -ItemType Directory -Path $brainDir -Force | Out-Null }
    $outPath = Join-Path $brainDir "settings_audit_report.png"
    [System.IO.File]::WriteAllBytes($outPath, $bytes)
    Write-Host "SUCCESS: Saved $($bytes.Length) bytes to $outPath"
} else {
    Write-Host "No base64 match found"
}
