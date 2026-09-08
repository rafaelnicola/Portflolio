@echo off
setlocal
set SCRIPT_DIR=%~dp0
set SERVIDOR_BAT=%SCRIPT_DIR%..\iniciar-servidor.bat

REM Crea una tarea programada de Windows que inicia el servidor automaticamente, minimizado,
REM cada vez que se inicia sesion en esta PC. Hay que ejecutar este archivo como Administrador
REM (clic derecho -> Ejecutar como administrador).

schtasks /Create /TN "BiomedicalCenter_ServidorInicio" /TR "cmd /c start /min \"\" \"%SERVIDOR_BAT%\"" /SC ONLOGON /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Listo. El servidor se va a iniciar solo, minimizado, cada vez que se inicie sesion en
    echo Windows en esta PC.
    echo.
    echo Si esta PC no la usa nadie para otra cosa, se recomienda ademas activar el inicio de
    echo sesion automatico de Windows para el usuario que uses aca ^(Panel de control -^> Cuentas
    echo de usuario, o buscar "netplwiz"^), asi el servidor arranca solo despues de un corte de
    echo luz o un reinicio, sin que nadie tenga que escribir la contraseña.
    echo.
    echo IMPORTANTE: como el servidor arranca en segundo plano, Windows no va a mostrar el cartel
    echo para permitirlo en el Firewall. Ejecuta tambien "permitir-firewall.bat" ^(como
    echo Administrador^) para que las demas PCs puedan conectarse.
    echo.
    echo Para probarlo ahora mismo sin reiniciar, ejecuta:
    echo   schtasks /Run /TN "BiomedicalCenter_ServidorInicio"
) else (
    echo.
    echo Hubo un error al crear la tarea programada.
    echo Asegurate de haber ejecutado este archivo como Administrador.
)

pause
