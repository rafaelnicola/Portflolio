# Cliente para Windows 7 / 8 / 8.1

Esta carpeta es una copia del cliente normal (`../client`), pero fijada a **Electron 22.3.27**, la última
versión de Electron que todavía corre en Windows 7 SP1, 8 y 8.1 (a partir de Electron 23 se requiere
Windows 10 o superior). Sirve solo para instalar en PCs viejas que no se puedan actualizar a Windows 10/11.

El código de la app (`src/`, `main.js`, `preload.js`) es el mismo que en `../client` — si se corrige un bug o
se agrega una funcionalidad ahí, hay que copiar los mismos cambios acá para mantenerlos sincronizados (o
generar este instalador de nuevo a partir de `../client` cambiando solo la versión de Electron y el
`appId`/`productName` en `package.json`).

**Importante**: Electron 22 dejó de recibir actualizaciones de seguridad en 2023. Como el sistema corre
solo en la red local del consultorio, sin exponerse a internet, este riesgo es acotado — pero de todos
modos es preferible actualizar esa PC a Windows 10/11 cuando sea posible, en vez de depender de esta
versión a largo plazo.

## Generar el instalador

```bash
npm install
npm run dist
```

El instalador queda en `dist/`.
