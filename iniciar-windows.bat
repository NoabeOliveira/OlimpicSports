@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js nao encontrado. Instale Node.js 22.5 ou superior.
 pause
 exit /b 1
)
if not exist ".env" (
 copy ".env.example" ".env" >nul
 echo Arquivo .env criado. Abra-o e preencha ADMIN_EMAIL e ADMIN_PASSWORD.
 notepad ".env"
 echo Depois de salvar o arquivo, execute novamente este iniciar-windows.bat.
 pause
 exit /b 0
)
echo Iniciando OlimpicSports em http://localhost:3000
node --env-file=.env server.js
pause
