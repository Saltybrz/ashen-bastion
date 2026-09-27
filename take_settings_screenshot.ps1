$brainDir = Join-Path $env:USERPROFILE ".gemini\antigravity-ide\brain\0ac35696-a8f3-4878-99f1-5125c9c68395"
$outPng = Join-Path $brainDir "settings_modal_showcase.png"
$htmlUrl = "file:///C:/Users/Usuário/Desktop/RPG/capture_settings_view.html"

Remove-Item -Path "test_snap.png" -ErrorAction SilentlyContinue

& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=2000 --window-size=1376,768 --screenshot="test_snap.png" "$htmlUrl"

if (Test-Path "test_snap.png") {
    Move-Item -Path "test_snap.png" -Destination $outPng -Force
    $item = Get-Item $outPng
    Write-Host "SUCCESS: Captured screenshot of size $($item.Length) bytes at $outPng"
} else {
    Write-Host "Screenshot failed"
}
