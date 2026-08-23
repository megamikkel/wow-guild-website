@echo off
REM Starter madplan. Dobbeltklik, eller kør fra en terminal.
setlocal

cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo   Der er ingen .env endnu. Opretter en fra .env.example.
  echo.
  copy /y ".env.example" ".env" >nul
  echo   Aabn .env og udfyld mindst MADPLAN_USERS, og gem.
  echo   Kør derefter start.cmd igen.
  echo.
  notepad ".env"
  exit /b 1
)

where dotnet >nul 2>&1
if errorlevel 1 (
  echo.
  echo   .NET 8 SDK mangler. Hent den her:
  echo   https://dotnet.microsoft.com/download/dotnet/8.0
  echo.
  exit /b 1
)

REM Laes .env ind som miljoevariabler for denne session.
for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0.env") do (
  echo %%a| findstr /b /c:"#" >nul || if not "%%~b"=="" set "%%a=%%~b"
)

echo.
echo   Starter madplan paa http://localhost:5265
echo   Stop med Ctrl+C.
echo.
dotnet run --project src\Madplan.Web -c Release
