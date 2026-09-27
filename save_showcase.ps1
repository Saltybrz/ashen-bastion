$url = "file:///C:/Users/Usuário/Desktop/RPG/visual_test.html"
$outPng = "C:\Users\Usuário\.gemini\antigravity-ide\brain\b72a139a-56c6-4c2f-b3aa-217edf735559\sprites_showcase.png"
$tmpTxt = "C:\Users\Usuário\Desktop\RPG\temp_dump.txt"

cmd.exe /c "`"C:\Program Files\Google\Chrome\Application\chrome.exe`" --headless --disable-gpu --allow-file-access-from-files --virtual-time-budget=4000 --dump-dom `"$url`" > `"$tmpTxt`""

if (Test-Path $tmpTxt) {
    $raw = Get-Content -Path $tmpTxt -Raw
    Write-Host "Raw length: $($raw.Length)"
    if ($raw -match 'id="base64">data:image/png;base64,([^<]+)</div>') {
        $bytes = [System.Convert]::FromBase64String($matches[1])
        [System.IO.File]::WriteAllBytes($outPng, $bytes)
        Write-Host "SUCCESS: Saved $($bytes.Length) bytes to $outPng"
    } else {
        Write-Host "No match for base64 in file"
    }
    Remove-Item -Path $tmpTxt -ErrorAction SilentlyContinue
}
