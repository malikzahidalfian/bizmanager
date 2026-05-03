$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://+:6060/')
$listener.Start()

# Get local IP using simple ipconfig method
$localIP = (ipconfig | Select-String 'IPv4' | Select-Object -First 1).ToString().Split(':')[-1].Trim()
if (-not $localIP) { $localIP = "IP_TIDAK_DITEMUKAN" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ricko's App - Server Running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PC      : http://localhost:6060" -ForegroundColor White
Write-Host "  HP/Mobile: http://${localIP}:6060" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Pastikan HP & PC terhubung ke WiFi yang sama!" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# Global cookie jar — shared across requests to maintain session
$global:cookieJar = [System.Net.CookieContainer]::new()
$global:sessionReady = $false

function Get-ShopeeSession {
    if ($global:sessionReady) { return }
    Write-Host "PROXY: Getting Shopee session cookies..."
    try {
        $httpReq = [System.Net.HttpWebRequest]::Create('https://shopee.co.id/')
        $httpReq.Method = 'GET'
        $httpReq.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        $httpReq.Accept = 'text/html,application/xhtml+xml'
        $httpReq.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
        $httpReq.CookieContainer = $global:cookieJar
        $httpReq.Timeout = 15000
        $httpReq.AllowAutoRedirect = $true

        $httpResp = $httpReq.GetResponse()
        $httpResp.Close()

        $cookieCount = $global:cookieJar.Count
        Write-Host "PROXY: Got $cookieCount cookies from Shopee"
        $global:sessionReady = $true
    } catch {
        Write-Host "PROXY: Session error: $($_.Exception.Message)"
    }
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $resp = $ctx.Response
    $localPath = $req.Url.LocalPath

    # ===== SHOPEE SEARCH API PROXY =====
    if ($localPath -eq '/api/shopee-search') {
        try {
            # Ensure we have session cookies
            Get-ShopeeSession

            $keyword = $req.QueryString['keyword']
            $page = $req.QueryString['page']
            if (-not $page) { $page = '0' }

            $newest = [int]$page * 60
            $shopeeUrl = "https://shopee.co.id/api/v4/search/search_items?by=relevancy&keyword=$([System.Uri]::EscapeDataString($keyword))&limit=60&newest=$newest&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"

            $httpReq = [System.Net.HttpWebRequest]::Create($shopeeUrl)
            $httpReq.Method = 'GET'
            $httpReq.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            $httpReq.Referer = "https://shopee.co.id/search?keyword=$([System.Uri]::EscapeDataString($keyword))"
            $httpReq.Accept = 'application/json'
            $httpReq.Headers.Add('X-Shopee-Language', 'id')
            $httpReq.Headers.Add('X-Requested-With', 'XMLHttpRequest')
            $httpReq.Headers.Add('af-ac-enc-dat', 'null')
            $httpReq.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
            $httpReq.CookieContainer = $global:cookieJar
            $httpReq.Timeout = 20000

            $httpResp = $httpReq.GetResponse()
            $reader = [System.IO.StreamReader]::new($httpResp.GetResponseStream(), [System.Text.Encoding]::UTF8)
            $result = $reader.ReadToEnd()
            $reader.Close()
            $httpResp.Close()

            $resp.ContentType = 'application/json; charset=utf-8'
            $resp.Headers.Add('Access-Control-Allow-Origin', '*')
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($result)
            $resp.ContentLength64 = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "PROXY OK: keyword=$keyword page=$page ($($bytes.Length) bytes)"
        } catch {
            # If 403, reset session and retry once
            if ($_.Exception.Message -match '403') {
                Write-Host "PROXY: Got 403, resetting session..."
                $global:sessionReady = $false
                $global:cookieJar = [System.Net.CookieContainer]::new()
            }

            $errMsg = '{"error":"' + $_.Exception.Message.Replace('"', '\"').Replace("`n", " ").Replace("`r", " ") + '"}'
            $resp.StatusCode = 502
            $resp.ContentType = 'application/json; charset=utf-8'
            $resp.Headers.Add('Access-Control-Allow-Origin', '*')
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errMsg)
            $resp.ContentLength64 = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "PROXY ERROR: $($_.Exception.Message)"
        }
        $resp.Close()
        continue
    }

    # ===== STATIC FILES =====
    if ($localPath -eq '/') { $localPath = '/index.html' }

    $filePath = Join-Path 'd:\Aplikasi Saya' ($localPath.TrimStart('/'))

    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

        $mime = 'application/octet-stream'
        if ($ext -eq '.html') { $mime = 'text/html; charset=utf-8' }
        elseif ($ext -eq '.css') { $mime = 'text/css; charset=utf-8' }
        elseif ($ext -eq '.js') { $mime = 'application/javascript; charset=utf-8' }

        $resp.ContentType = $mime
        $resp.ContentLength64 = $content.Length
        $resp.OutputStream.Write($content, 0, $content.Length)
    } else {
        $resp.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    }

    $resp.Close()
    Write-Host "$($req.HttpMethod) $localPath"
}
