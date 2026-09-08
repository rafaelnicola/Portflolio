@echo off
REM Elimina la tarea programada de inicio automatico (ver instalar-inicio-automatico.bat).
schtasks /Delete /TN "BiomedicalCenter_ServidorInicio" /F
pause
