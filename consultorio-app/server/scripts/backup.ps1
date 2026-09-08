# Backup semanal de los datos del consultorio (Biomedical Center)
#
# Comprime la carpeta "data" (base de datos + fotos de pacientes) en un archivo .zip
# con la fecha en el nombre, y lo guarda en la carpeta de destino configurada abajo.
# Tambien borra automaticamente los backups mas viejos que $diasConservar dias,
# para que no se llene el disco con el tiempo.
#
# No hace falta ejecutar esto a mano: se corre solo, una vez por semana, si instalaste
# la tarea programada con "instalar-backup-automatico.bat" (ver README).

$origen = Join-Path $PSScriptRoot "..\data"

# --- IMPORTANTE ---
# Por defecto guarda el backup en la misma PC (carpeta "Backups" en Documentos), que ya es
# mejor que nada, pero NO protege si se rompe el disco de esa PC. Idealmente cambia esta
# ruta por una carpeta en OTRO disco, un pendrive que dejes siempre conectado, o una
# carpeta de red (por ejemplo "\\OTRA-PC\backups" o una carpeta sincronizada con OneDrive).
$destino = Join-Path $env:USERPROFILE "Documents\BackupsConsultorio"

$diasConservar = 90

if (-not (Test-Path $origen)) {
    Write-Error "No se encontro la carpeta de datos en $origen"
    exit 1
}

if (-not (Test-Path $destino)) {
    New-Item -ItemType Directory -Path $destino -Force | Out-Null
}

$fecha = Get-Date -Format "yyyy-MM-dd_HH-mm"
$archivoDestino = Join-Path $destino "consultorio-backup-$fecha.zip"

Compress-Archive -Path $origen -DestinationPath $archivoDestino -Force

Write-Output "Backup creado: $archivoDestino"

Get-ChildItem -Path $destino -Filter "consultorio-backup-*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$diasConservar) } |
    Remove-Item -Force
