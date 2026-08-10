# Sistema de gestión para el consultorio

App de escritorio para consultorios médicos: pacientes, agenda de turnos, historia clínica y recetas.
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

## 3. Uso diario

- **Recepción**: gestiona pacientes y la agenda de turnos.
- **Doctor/a**: además de lo anterior, puede cargar historia clínica y recetas de cada paciente.
- **Admin**: puede crear usuarios nuevos (Usuarios → Nuevo usuario) y les asigna el rol correspondiente
  (`recepcion`, `doctor` o `admin`).

## Roles y permisos

| Acción                          | Recepción | Doctor/a | Admin |
|----------------------------------|:---------:|:--------:|:-----:|
| Ver/crear/editar pacientes       | ✅        | ✅ (ver) | ✅    |
| Agendar / modificar turnos       | ✅        | ✅ (ver) | ✅    |
| Ver / cargar historia clínica    | ❌        | ✅       | ✅    |
| Ver / emitir recetas             | ❌        | ✅       | ✅    |
| Crear y administrar usuarios     | ❌        | ❌       | ✅    |

## Respaldo de la información

Toda la base de datos vive en un solo archivo: `server/data/consultorio.db` (en la PC servidor). Para hacer
una copia de seguridad, basta con copiar esa carpeta `data/` a un pendrive o a la nube de tanto en tanto.

## Estructura del proyecto

```
consultorio-app/
  server/   -> Backend (Node.js + Express + SQLite). Corre en la PC servidor.
  client/   -> App de escritorio (Electron). Se instala en cada PC.
```
