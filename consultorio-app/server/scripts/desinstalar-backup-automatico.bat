@echo off
REM Elimina la tarea programada de backup automatico (ver instalar-backup-automatico.bat).
schtasks /Delete /TN "BiomedicalCenter_BackupSemanal" /F
pause
