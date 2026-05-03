try {
    $r = Invoke-WebRequest -Uri 'http://localhost:7575/api/shopee-search?keyword=mp3+player&page=0' -UseBasicParsing -TimeoutSec 30
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length)"
    $len = [Math]::Min(2000, $r.Content.Length)
    if ($len -gt 0) {
        Write-Host $r.Content.Substring(0, $len)
    } else {
        Write-Host "Empty response"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
