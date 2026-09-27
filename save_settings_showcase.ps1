$url = "file:///C:/Users/Usu%C3%A1rio/Desktop/RPG/render_settings_showcase.html"
$brainDir = Join-Path $env:USERPROFILE ".gemini\antigravity-ide\brain\0ac35696-a8f3-4878-99f1-5125c9c68395"
if (-not (Test-Path $brainDir)) { New-Item -ItemType Directory -Path $brainDir -Force | Out-Null }
$outPng = Join-Path $brainDir "settings_modal_showcase.png"
$tmpTxt = Join-Path $PSScriptRoot "temp_settings_dump.txt"

cmd.exe /c "`"C:\Program Files\Google\Chrome\Application\chrome.exe`" --headless --disable-gpu --allow-file-access-from-files --virtual-time-budget=4000 --dump-dom `"$url`" > `"$tmpTxt`""

if (Test-Path $tmpTxt) {
    $raw = Get-Content -Path $tmpTxt -Raw
    if ($raw -match 'id="base64"[^>]*>data:image/png;base64,([^<]+)</div>') {
        $bytes = [System.Convert]::FromBase64String($matches[1])
        [System.IO.File]::WriteAllBytes($outPng, $bytes)
        Write-Host "SUCCESS: Saved $($bytes.Length) bytes to $outPng"
    } else {
        Write-Host "No match for base64 in dump. Dump length: $($raw.Length)"
    }
} else {
    Write-Host "Temp dump not created"
}
