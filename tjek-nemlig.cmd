@echo off
REM Koerer nemlig-diagnosen. Kør den foer hver planlaegningsuge - og foerste
REM gang du proever appen, for at se om nemligs API ser ud som forventet.
setlocal

cd /d "%~dp0"

if not exist ".env" (
  echo   Ingen .env. Koer start.cmd foerst.
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0.env") do (
  echo %%a| findstr /b /c:"#" >nul || if not "%%~b"=="" set "%%a=%%~b"
)

dotnet run --project src\Madplan.Web -c Release -- smoke
echo.
pause
