@echo off
REM Proev appen UDEN en nemlig-konto. Starter to stub-servere der svarer efter
REM de dokumenterede skemaer, og koerer appen mod dem. Kraever Node.js.
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js mangler - demo-tilstanden bruger to smaa stub-servere.
  echo   Hent den paa https://nodejs.org, eller brug start.cmd med en rigtig
  echo   nemlig-konto i stedet.
  echo.
  exit /b 1
)

start "falsk nemlig" /min node tools\fake-nemlig\server.mjs 5300
start "falske opskrifter" /min node tools\fake-recipes\server.mjs 5400

timeout /t 2 /nobreak >nul

set "MADPLAN_DB_PATH=demo.db"
set "MADPLAN_USERS=Demo:demo@example.com:demo1234"
set "NEMLIG_USERNAME=demo@example.com"
set "NEMLIG_PASSWORD=demo"
set "Nemlig__BaseUrl=http://localhost:5300"
set "Nemlig__SearchGatewayUrl=http://localhost:5300/searchgateway/api"

echo.
echo   DEMO paa http://localhost:5265
echo   Log ind med  demo@example.com  /  demo1234
echo.
echo   Proev i denne raekkefoelge:
echo     1. Opskrifter -^> Importer. Indsaet disse links:
echo.
echo        http://localhost:5400/opskrifter/spaghetti-koedsovs
echo        http://localhost:5400/opskrifter/lasagne
echo        http://localhost:5400/opskrifter/frikadeller
echo        http://localhost:5400/opskrifter/kylling-i-fad
echo        http://localhost:5400/opskrifter/pasta-pesto
echo        http://localhost:5400/opskrifter/kylling-karry
echo        http://localhost:5400/opskrifter/fiskefrikadeller
echo        http://localhost:5400/opskrifter/linsegryde
echo.
echo     2. Tryk "Kobl alle" nederst paa samme side
echo     3. Budget -^> saet 400 kr. -^> Foreslaa menu
echo.
dotnet run --project src\Madplan.Web -c Release
