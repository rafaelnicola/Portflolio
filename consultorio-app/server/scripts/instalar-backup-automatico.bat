@echo off
setlocal
set SCRIPT_DIR=%~dp0

REM Crea una tarea programada de Windows que corre backup.ps1 todos los lunes a las 8:00.
REM Hay que ejecutar este archivo como Administrador (clic derecho -> Ejecutar como administrador).

schtasks /Create /TN "BiomedicalCenter_BackupSemanal" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT_DIR%backup.ps1\"" /SC WEEKLY /D MON /ST 08:00 /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Listo. El backup se va a hacer automaticamente todos los lunes a las 8:00,
    echo aunque nadie este usando la PC ^(mientras este prendida^).
    echo.
    echo Para probarlo ahora mismo sin esperar al domingo, ejecuta:
    echo   schtasks /Run /TN "BiomedicalCenter_BackupSemanal"
) else (
    echo.
    echo Hubo un error al crear la tarea programada.
    echo Asegurate de haber ejecutado este archivo como Administrador.
)

pause
