# Sistema de gestión para el consultorio

App de escritorio para consultorios médicos: pacientes, agenda de turnos e historia clínica (con el
tratamiento/fórmula médica como parte de la misma consulta, sin duplicarlo en un modulo aparte).
Pensada para instalarse en varias PCs (recepción, consultorio del doctor/a) que comparten los datos a través de la red local.

## Cómo funciona

- **Servidor**: se instala y se deja corriendo en UNA sola PC (por ejemplo, la de recepción). Guarda toda la
  información en una base de datos local (SQLite). No necesita internet.
- **Cliente**: es la app de escritorio que se instala en cada PC que va a usar el sistema (recepción, consultorio,
  etc.). Se conecta al servidor a través de la red local (Wi-Fi o cable).

```
[PC Recepción: Servidor + Cliente] <--- red local --->  [PC Doctor/a: Cliente]
```

## 1. Preparar el servidor (una sola vez, en una PC)

Requiere tener [Node.js](https://nodejs.org/) instalado (versión 22.5 o superior; usa el motor de SQLite
incluido en Node, así que no hace falta instalar compiladores ni herramientas de C++ en ninguna PC).

Al arrancar vas a ver un aviso que dice `ExperimentalWarning: SQLite is an experimental feature...` — es
normal, no es un error, el servidor funciona igual.

```bash
cd server
npm install
npm start
```

Al iniciar por primera vez se crea un usuario administrador por defecto:

- **Usuario:** `admin`
- **Contraseña:** `admin123`

⚠️ Cambiala apenas entres a la app (o creá tu propio usuario admin y desactivá este).

La consola va a mostrar algo como:

```
Direcciones IP de esta PC en la red local (usalas en los clientes):
  http://192.168.1.10:4000
```

Anotá esa dirección IP: es la que vas a usar para configurar cada cliente. El servidor tiene que quedar
encendido mientras el consultorio esté usando el sistema (podés dejar esa PC prendida y minimizada, o
configurarlo como servicio de Windows más adelante).

> Sugerencia: asigná una **IP fija** a la PC del servidor en el router, así la dirección no cambia con el tiempo.

### Permitir el acceso desde otras PCs (Firewall de Windows)

La primera vez que el servidor arranca, Windows suele preguntar "¿Permitir acceso a esta app en redes
privadas?" — hay que aceptarlo. Pero si el servidor se inicia en segundo plano (por ejemplo con la tarea de
inicio automático, ver más abajo), ese cartel nunca aparece y el Firewall bloquea las conexiones entrantes:
el sistema funciona en esa misma PC pero las demás PCs no logran conectarse. Para evitarlo, ejecutá una vez
como Administrador `server/scripts/permitir-firewall.bat`, que abre el puerto 4000 de forma permanente.

## 2. Instalar el cliente en cada PC

### Para desarrollo / probar rápido

```bash
cd client
npm install
npm start
```

### Para generar el instalador (.exe para Windows, .dmg para Mac, .AppImage para Linux)

```bash
cd client
npm install
npm run dist
```

Los instaladores quedan en `client/dist/`. Copiá ese instalador y ejecutalo en cada PC del consultorio.

La primera vez que se abre la app en cada PC, pide la **dirección del servidor** (la IP que anotaste en el
paso 1, por ejemplo `http://192.168.1.10:4000`). Después de configurarla una vez, la app la recuerda.

### PCs con Windows 7 / 8 / 8.1

El cliente normal (`client/`) usa una versión de Electron que solo corre en Windows 10/11. Para PCs viejas
con Windows 7, 8 u 8.1, usar en su lugar `client-legacy/`, que es el mismo cliente pero fijado a Electron
22.3.27 (la última versión con soporte para esos sistemas). Ver `client-legacy/README-LEGACY.md` para más
detalles y la advertencia de seguridad correspondiente.

### Problemas comunes al instalar el cliente (Windows)

Si la PC tiene un antivirus corporativo o restricciones de IT, `npm install` puede fallar al instalar
Electron. Los síntomas y soluciones, en orden:

**1. `npm warn install-scripts ... electron@x.x.x (postinstall: node install.js)` y después
`Error: Electron failed to install correctly`**

npm bloqueó por seguridad el script que descarga el programa de Electron. Aprobalo y reinstalá:
```cmd
npm install-scripts approve electron
npm install
```

**2. Sigue el mismo error después de aprobar el script**

El script se aprobó pero no se volvió a ejecutar. Forzalo:
```cmd
npm rebuild electron
```
Si `node_modules\electron\dist` sigue vacío o solo tiene una carpeta `locales` (podés revisarlo con
`dir node_modules\electron\dist`), el problema es que algo bloquea la descarga real del instalador de
Electron (antivirus, proxy corporativo, etc.), no solo el permiso de npm.

**3. La descarga del instalador de Electron está bloqueada (dist vacío o solo con `locales`)**

- Agregá una exclusión de antivirus para la carpeta del proyecto completo (en Windows: Seguridad de
  Windows → Protección contra virus y amenazas → Administrar configuración → Exclusiones).
- Borrá la caché de Electron por si quedó una descarga corrupta, y reintentá:
  ```cmd
  rmdir /s /q "%LOCALAPPDATA%\electron\Cache"
  rmdir /s /q node_modules\electron
  npm install
  dir node_modules\electron\dist
  ```
- Si con eso sigue sin funcionar (típico en PCs de trabajo con software de seguridad adicional que Windows
  Defender no controla), instalá el archivo a mano:
  1. Fijate qué versión de Electron figura en `client/package.json` (por ejemplo `31.7.7`) y descargá desde
     el navegador (no por cmd):
     `https://github.com/electron/electron/releases/download/vX.X.X/electron-vX.X.X-win32-x64.zip`
     (reemplazando `X.X.X` por la versión correspondiente).
  2. Descomprimilo directo dentro de la carpeta que quedó vacía y creá el archivo `path.txt` sin salto de
     línea al final (usar `echo` lo rompe, por eso se usa PowerShell):
     ```cmd
     cd client
     tar -xf "%USERPROFILE%\Downloads\electron-vX.X.X-win32-x64.zip" -C node_modules\electron\dist
     powershell -Command "[IO.File]::WriteAllText('node_modules\electron\path.txt','electron.exe')"
     npm start
     ```

## 3. Uso diario

- **Recepción / Enfermero/a**: gestionan pacientes, agendan turnos, y ven la historia clínica completa de
  cada paciente (con el botón "Ver" de cada valoración), pero no pueden crear ni editar valoraciones.
- **Doctor/a**: además de lo anterior, carga/edita la historia clínica completa (motivo, antecedentes,
  signos vitales, diagnóstico, tratamiento, etc.) y puede eliminar valoraciones. Cada valoración se puede
  editar hasta **48 horas** después de creada; pasado ese plazo queda bloqueada y hay que cargar una nueva.
- **Admin**: todo lo anterior, y además crea usuarios y les asigna o cambia el rol (Usuarios → seleccionar
  rol en la lista desplegable), y configura el envío de emails (Configuración).

En la lista de historias clínicas de cada paciente solo se ven de entrada los datos más importantes (motivo,
presión arterial, peso, diagnóstico, tratamiento) — el botón **Ver** (disponible para todos los usuarios)
abre el detalle completo con todo lo que cargó el doctor/a (antecedentes, signos vitales completos,
exploración física, exámenes de laboratorio, observaciones, etc.).

El campo **IMC** de los signos vitales se calcula solo, a partir del peso y la talla (estatura) cargados —
no se escribe a mano.

El campo **Diagnóstico** tiene arriba un buscador de códigos **CIE-10** (por código, ej. "J45", o por texto,
ej. "asma") con la tabla oficial de referencia del Ministerio de Salud / SISPRO. Al elegir un resultado se
autocompleta el campo con "código - nombre", pero se puede seguir editando libremente después (agregar
observaciones, corregir, etc.) — no queda bloqueado ni ligado al código elegido.

Dentro del detalle de cada valoración ("Ver") hay una sección de **anotaciones de enfermería**, para
registrar seguimientos posteriores a la consulta (por ejemplo, cuando el paciente asiste a una terapia unos
días después). Solo quien tenga el permiso correspondiente (enfermero/a o admin por defecto) puede
cargarlas o editarlas — el resto de los usuarios las puede ver, pero no modificar. A diferencia de la
valoración en sí, estas anotaciones **no se bloquean a las 48hs**, se pueden editar en cualquier momento.

Al agendar un turno, el campo "Paciente" es un buscador (escribí nombre, apellido o DNI) en vez de una
lista desplegable — pensado para consultorios con muchos pacientes registrados. La Agenda muestra además
quién agendó cada turno y cuándo — ese dato no se puede modificar (ni siquiera el admin) y no aparece en la
lista descargada en Word, solo en la pantalla.

Al crear un turno nuevo, el panel **no se cierra** después de guardar — queda abierto con los mismos datos
(paciente, doctor/a, motivo) para poder agendar varias sesiones del mismo paciente en distintas fechas sin
volver a llenar el formulario cada vez: solo hay que cambiar la fecha (y la hora si corresponde) y volver a
darle "Crear turno". El panel se cierra únicamente con el botón "Cerrar". Al editar un turno existente, el
panel sí se cierra al guardar, como antes.

## Roles y permisos

| Acción                                    | Recepción | Enfermero/a | Doctor/a | Admin |
|--------------------------------------------|:---------:|:-----------:|:--------:|:-----:|
| Ver / crear / editar pacientes              | ✅        | ✅          | ✅       | ✅    |
| Subir / tomar foto del paciente             | ✅        | ✅          | ✅       | ✅    |
| Ver historia clínica completa               | ✅        | ✅          | ✅       | ✅    |
| Exportar / enviar por email la historia      | ✅        | ✅          | ✅       | ✅    |
| Agendar / modificar turnos                   | ✅        | ✅          | ✅       | ✅    |
| Crear y editar valoraciones (historia clínica)| ❌ (*)   | ❌ (*)      | ✅       | ✅    |
| Eliminar valoraciones (historia clínica)      | ❌ (*)   | ❌ (*)      | ✅       | ✅    |
| Cargar / editar anotaciones de enfermería     | ❌ (*)   | ✅          | ❌ (*)   | ✅    |
| Eliminar pacientes                            | ❌ (*)   | ❌ (*)      | ❌ (*)   | ✅    |
| Eliminar turnos                               | ✅        | ✅          | ✅       | ✅    |
| Cambiar el rol de otros usuarios              | ❌        | ❌          | ❌       | ✅    |
| Configurar email / datos del consultorio      | ❌        | ❌          | ❌       | ✅    |

(*) Estos permisos los puede activar o desactivar el admin **individualmente por usuario**, sin tocar
código: Usuarios → botón **Permisos** en la fila de cada usuario. Por ejemplo, se le puede dar a una
recepcionista puntual el permiso de cargar historia clínica sin cambiarle el rol. Los permisos que ya vienen
incluidos por el rol (marcados arriba con ✅ liso) aparecen tildados y bloqueados en esa pantalla — para
sacarlos hay que cambiar el rol del usuario, no se puede hacer ahí.

## Foto del paciente

Al crear o editar un paciente (cualquier usuario puede hacerlo), hay dos formas de agregarle una foto:

- **Subir desde el PC**: abre el explorador de archivos para elegir una imagen ya guardada.
- **Tomar foto**: usa la cámara conectada a la PC (webcam) para sacarla en el momento.

La imagen se ajusta automáticamente de tamaño antes de guardarse, así que no importa si la foto original es
muy pesada. Se puede reemplazar o quitar en cualquier momento desde "Editar datos".

> Si "Tomar foto" no encuentra la cámara, revisá en Windows: Configuración → Privacidad y seguridad →
> Cámara, que el acceso a la cámara esté permitido para las apps de escritorio.

## Exportar e imprimir documentos

Desde la ficha del paciente (pestaña "Historia clínica") y desde la Agenda, hay botones para generar
documentos **Word (.docx)**, editables e imprimibles. Al exportar, la app **guarda el archivo donde indiques
y lo abre automáticamente** (con Word, o el programa que tengas asociado a `.docx`).

- **Exportar a Word**: la historia clínica completa de una consulta, con el logo del consultorio arriba.
- **Exportar tratamiento**: solo el tratamiento, en hoja carta vertical, en formato Courier New 9.5 — con el
  logo del consultorio como membrete arriba, y la dirección/teléfonos del consultorio en un pie de página
  ubicado a 15cm del borde inferior (pensado para imprimir en una hoja media carta). Lista para imprimir
  como fórmula médica.
- **Exportar exámenes**: igual al botón anterior, pero con el contenido del campo "Exámenes de laboratorio"
  en vez del tratamiento — para poder entregar por separado la fórmula del tratamiento y la orden de
  exámenes.
- **Enviar por email**: envía la historia clínica completa como PDF adjunto al email que indiques (requiere
  configurar el correo primero, ver más abajo).
- **Descargar lista (Word)**, en la Agenda: exporta la lista de turnos del día seleccionado, con nombre y
  teléfono de cada paciente, en formato tabla — pensada para imprimir y usar al llamar a los pacientes.

## Datos del consultorio

Como admin, en **Configuración** → "Datos del consultorio" podés cambiar, sin tocar código, la dirección y
los teléfonos que aparecen en el pie de página de la fórmula. El logo que aparece como membrete arriba es
siempre el mismo (`server/src/assets/logo.png`, `logo-mark.png`) — para cambiarlo hay que reemplazar esos
archivos.

## Configurar el envío de email

Como admin, andá a **Configuración** y cargá los datos de tu servidor de correo:

- **Gmail**: servidor `smtp.gmail.com`, puerto `587`, sin SSL. En "Contraseña" hay que usar una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords) de Google, no la contraseña normal
  de la cuenta (Gmail no permite el acceso directo con la contraseña habitual).
- **Outlook/Hotmail**: servidor `smtp.office365.com`, puerto `587`, sin SSL.
- Para otros proveedores, pedile los datos SMTP a quien administre ese correo.

Una vez configurado, el botón "Enviar por email" en la historia clínica de cada paciente queda habilitado.

## Seguridad

- Las contraseñas se guardan encriptadas (nunca en texto plano).
- Cada sesión expira a las 12 horas.
- Después de 5 intentos fallidos de inicio de sesión con el mismo usuario, ese usuario queda bloqueado 15
  minutos.
- La información clínica (diagnóstico, tratamiento, signos vitales) solo es visible para doctor/a y admin.
- El servidor solo debe usarse dentro de la red local del consultorio — no lo expongas a internet ni abras
  su puerto (4000) en el router.
- Hacé copias de seguridad periódicas de la carpeta `server/data/` (ver más abajo).

## Respaldo de la información

Toda la base de datos vive en un solo archivo: `server/data/consultorio.db` (en la PC servidor), junto con
la carpeta `server/data/fotos/`. Para hacer una copia de seguridad, basta con copiar esa carpeta `data/` a
un pendrive o a la nube de tanto en tanto.

### Backup automático semanal

En `server/scripts/` hay un backup automático listo para usar, para no depender de acordarse de hacerlo a
mano:

1. En la PC servidor, clic derecho sobre `server/scripts/instalar-backup-automatico.bat` → **Ejecutar como
   administrador**.
2. Eso deja programada una tarea de Windows que corre todos los lunes a las 8:00: comprime la carpeta
   `data/` en un `.zip` con la fecha, y borra automáticamente los backups de más de 90 días.
3. Por defecto el `.zip` se guarda en `Documentos\BackupsConsultorio` de esa misma PC. Se recomienda editar
   `server/scripts/backup.ps1` con el Bloc de notas y cambiar esa ruta (variable `$destino`) por un pendrive
   que quede siempre conectado, un disco externo o una carpeta de red — así el backup no se pierde si falla
   el disco de la PC servidor.

Para probarlo sin esperar al lunes: `schtasks /Run /TN "BiomedicalCenter_BackupSemanal"`. Para desinstalarlo:
ejecutar `server/scripts/desinstalar-backup-automatico.bat`.

### Backup manual (Configuración → Seguridad, solo admin)

Además del backup automático, cualquier admin puede generar una copia de seguridad al instante desde la
app: Configuración → "Seguridad" → **Hacer copia de seguridad ahora**. Descarga un `.zip` con la base de
datos y las fotos, que se puede guardar donde se quiera (un pendrive, un disco externo, etc.) sin esperar al
backup automático — útil antes de un mantenimiento o para sacar una copia extra puntual.

### Mensajes de ayuda (Ayuda, todos los usuarios)

Cualquier usuario puede escribir un mensaje al administrador desde la sección "Ayuda" (por ejemplo, para
reportar un problema o hacer una consulta). El admin ve los mensajes recibidos ahí mismo, con un aviso en el
menú lateral cuando hay mensajes sin leer.

### Chat interno (Chat, todos los usuarios)

Mensajería privada entre usuarios del sistema: se elige un usuario de la lista y se chatea 1 a 1 con esa
persona (cada conversación es privada, solo la ven los dos usuarios involucrados). Se actualiza solo cada 5
segundos mientras la pantalla de Chat está abierta, y avisa con un número en el menú lateral — y al lado de
cada contacto — cuando hay mensajes nuevos sin leer.

Además, aunque no se esté en la pantalla de Chat (o la app esté minimizada / detrás de otra ventana), llega
una **notificación de escritorio de Windows** apenas entra un mensaje nuevo — la app revisa mensajes nuevos
cada 15 segundos en segundo plano mientras hay una sesión iniciada. Al hacer clic en la notificación, la app
se enfoca y abre directo en la pantalla de Chat. La primera vez que un usuario inicia sesión, Windows puede
pedir permiso para mostrar notificaciones de la app — hay que aceptarlo para que funcione.

### Inicio automático del servidor con Windows

Para que el servidor arranque solo (por ejemplo después de un corte de luz o un reinicio), sin que nadie
tenga que ir a hacer doble clic en `iniciar-servidor.bat`:

1. En la PC servidor, clic derecho sobre `server/scripts/instalar-inicio-automatico.bat` → **Ejecutar como
   administrador**.
2. Eso deja programado que el servidor arranque minimizado cada vez que se inicia sesión en esa PC.
3. Si esa PC no la usa nadie para otra cosa, conviene además activar el **inicio de sesión automático** de
   Windows para el usuario que se use ahí (buscar "netplwiz" en el menú de inicio), así el servidor termina
   arrancando solo, sin que nadie tenga que escribir ninguna contraseña.

Para desinstalarlo: ejecutar `server/scripts/desinstalar-inicio-automatico.bat`.

## Estructura del proyecto

```
consultorio-app/
  server/   -> Backend (Node.js + Express + SQLite). Corre en la PC servidor.
  client/   -> App de escritorio (Electron). Se instala en cada PC.
```
