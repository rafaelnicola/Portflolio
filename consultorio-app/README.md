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

- **Recepción**: gestiona pacientes, agenda turnos y puede imprimir el tratamiento (fórmula médica) que
  cargó el doctor/a, sin ver el resto de la historia clínica.
- **Doctor/a**: además de lo anterior, puede crear pacientes, agendar/cancelar turnos, y cargar/editar la
  historia clínica completa (presión arterial, peso, diagnóstico, tratamiento). Cada valoración se puede
  editar hasta **48 horas** después de creada; pasado ese plazo queda bloqueada y hay que cargar una nueva.
- **Admin**: todo lo anterior, y además crea usuarios y les asigna o cambia el rol (Usuarios → seleccionar
  rol en la lista desplegable), y configura el envío de emails (Configuración).

Al agendar un turno, el campo "Paciente" es un buscador (escribí nombre, apellido o DNI) en vez de una
lista desplegable — pensado para consultorios con muchos pacientes registrados.

## Roles y permisos

| Acción                                    | Recepción | Doctor/a | Admin |
|--------------------------------------------|:---------:|:--------:|:-----:|
| Ver / crear / editar pacientes              | ✅        | ✅       | ✅    |
| Ver historia clínica completa               | ✅        | ✅       | ✅    |
| Exportar / enviar por email la historia      | ✅        | ✅       | ✅    |
| Agendar / modificar turnos                   | ✅        | ✅       | ✅    |
| Crear y editar valoraciones (historia clínica)| ❌ (*)   | ✅       | ✅    |
| Eliminar pacientes                            | ❌ (*)   | ❌ (*)   | ✅    |
| Eliminar turnos                               | ✅        | ✅       | ✅    |
| Cambiar el rol de otros usuarios              | ❌        | ❌       | ✅    |
| Configurar email / datos del consultorio      | ❌        | ❌       | ✅    |

(*) Estos permisos los puede activar o desactivar el admin **individualmente por usuario**, sin tocar
código: Usuarios → botón **Permisos** en la fila de cada usuario. Por ejemplo, se le puede dar a una
recepcionista puntual el permiso de cargar historia clínica sin cambiarle el rol. Los permisos que ya vienen
incluidos por el rol (marcados arriba con ✅ liso) aparecen tildados y bloqueados en esa pantalla — para
sacarlos hay que cambiar el rol del usuario, no se puede hacer ahí.

## Exportar e imprimir documentos

Desde la ficha del paciente (pestaña "Historia clínica") y desde la Agenda, hay botones para generar
documentos **Word (.docx)**, editables e imprimibles. Al exportar, la app **guarda el archivo donde indiques
y lo abre automáticamente** (con Word, o el programa que tengas asociado a `.docx`).

- **Exportar a Word**: la historia clínica completa de una consulta, con el logo del consultorio arriba.
- **Exportar tratamiento (media carta)**: solo el tratamiento, en una página de tamaño media carta
  horizontal (8.5" x 5.5"), con el logo arriba y la dirección/teléfono del consultorio abajo — lista para
  imprimir como fórmula médica.
- **Enviar por email**: envía la historia clínica completa como PDF adjunto al email que indiques (requiere
  configurar el correo primero, ver más abajo).
- **Descargar lista (Word)**, en la Agenda: exporta la lista de turnos del día seleccionado, con nombre y
  teléfono de cada paciente, en formato tabla — pensada para imprimir y usar al llamar a los pacientes.

## Datos del consultorio (dirección y teléfono)

Como admin, en **Configuración** → "Datos del consultorio" podés cambiar la dirección y el teléfono que
aparecen en el pie de página de la fórmula médica, sin tocar código.

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

Toda la base de datos vive en un solo archivo: `server/data/consultorio.db` (en la PC servidor). Para hacer
una copia de seguridad, basta con copiar esa carpeta `data/` a un pendrive o a la nube de tanto en tanto.

## Estructura del proyecto

```
consultorio-app/
  server/   -> Backend (Node.js + Express + SQLite). Corre en la PC servidor.
  client/   -> App de escritorio (Electron). Se instala en cada PC.
```
