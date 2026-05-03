$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://+:6060/')
$listener.Start()

Write-Host "Test Server Running on http://localhost:6060"
Write-Host "Press Ctrl+C to stop"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath
    if ($localPath -eq "/" -or $localPath -eq "") {
        $localPath = "/test.html"
    }

    $filePath = Join-Path "d:\Aplikasi Saya" $localPath.TrimStart("/")

    if (Test-Path $filePath -PathType Leaf) {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $response.ContentType = if ($filePath.EndsWith(".html")) { "text/html; charset=utf-8" }
                              elseif ($filePath.EndsWith(".css")) { "text/css" }
                              elseif ($filePath.EndsWith(".js")) { "application/javascript" }
                              else { "text/plain" }
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
    } else {
        $response.StatusCode = 404
        $buffer = [System.Text.Encoding]::UTF8.GetBytes("File not found")
    }

    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}

$listener.Stop()