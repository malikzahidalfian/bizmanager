@echo off
title Ricko's App Launcher
echo ========================================
echo    Ricko's App - Starting...
echo ========================================
echo.

:: Check for admin (needed for network binding)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Membutuhkan akses Administrator untuk bisa diakses dari HP.
    echo [!] Memulai ulang sebagai Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Add firewall rule (if not exists)
netsh advfirewall firewall show rule name="RickosApp" >nul 2>&1
if %errorlevel% neq 0 (
    echo [+] Menambahkan rule Firewall untuk akses dari HP...
    netsh advfirewall firewall add rule name="RickosApp" dir=in action=allow protocol=tcp localport=6060
)

:: Start server in background
start /min powershell -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0server.ps1"

:: Wait for server to start
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:6060

echo.
echo Ricko's App sudah berjalan!
echo.
echo   PC      : http://localhost:6060
echo   HP      : Lihat alamat IP di window PowerShell
echo.
echo Pastikan HP dan PC terhubung ke WiFi yang sama!
echo.
echo Jangan tutup window ini selama menggunakan Ricko's App.
echo Tekan Ctrl+C atau tutup window ini untuk stop server.
echo.
pause
