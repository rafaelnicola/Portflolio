@echo off
REM Abre el puerto 4000 en el Firewall de Windows para que las demas PCs de la red
REM puedan conectarse al servidor. Ejecutar como Administrador.

netsh advfirewall firewall add rule name="Biomedical Center Servidor" dir=in action=allow protocol=TCP localport=4000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Listo. El puerto 4000 ya esta permitido en el Firewall de Windows.
) else (
    echo.
    echo Hubo un error al crear la regla del Firewall.
    echo Asegurate de haber ejecutado este archivo como Administrador.
)

pause
