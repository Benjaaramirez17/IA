# Generador Asegurado SHOPPERS — Google Apps Script

Versión de la herramienta `asegurado/index.html` desplegada como **Web App
standalone** de Google Apps Script. El procesamiento del Excel sigue
ocurriendo 100% en el navegador (ExcelJS): este proyecto solo la aloja con
una URL propia de Google (`.../exec`). No lee ni escribe ninguna Hoja de
cálculo ni archivo de Drive.

## Archivos

- `Code.gs` — sirve la página (`doGet`) y un helper `include()` para armar
  el HTML a partir de partials.
- `Index.html` — la interfaz (subir archivo, procesar, previsualizar,
  descargar). Es una plantilla que incluye `ExcelJS.html`.
- `ExcelJS.html` — la librería [ExcelJS](https://github.com/exceljs/exceljs)
  (v4.4.0) vendorizada dentro de un `<script>`, para que la app no dependa
  de ningún CDN externo en tiempo de ejecución.
- `appsscript.json` — manifiesto del proyecto. Ya viene configurado como
  Web App de acceso **solo para vos** (`"access": "MYSELF"`).

## Cómo desplegarlo

### Opción A — copiar y pegar (más simple, sin instalar nada)

1. Andá a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Renombrá el proyecto (ej. "Generador Asegurado SHOPPERS").
3. Borrá el contenido del archivo `Code.gs` que viene por defecto y pegá el
   de este repo.
4. Con el ícono **+** junto a "Archivos", agregá dos **archivos HTML**
   llamados exactamente `Index` y `ExcelJS`, y pegá el contenido de
   `Index.html` y `ExcelJS.html` respectivamente (Apps Script no usa la
   extensión `.html` en el nombre del archivo, solo el tipo).
5. Abrí el ícono de engranaje (⚙️ Configuración del proyecto) →
   activá **"Mostrar archivo de manifiesto 'appsscript.json' en el editor"**.
   Reemplazá el contenido de `appsscript.json` por el de este repo.
6. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo (tu cuenta)**.
   - Quién puede acceder: **Solo yo** (podés cambiarlo después a "Cualquier
     usuario de [tu organización]" si querés compartirlo con el equipo).
7. Autorizá los permisos cuando te lo pida (el script no necesita acceso a
   Drive/Sheets, solo a mostrar una página).
8. Copiá la **URL de la aplicación web** (`.../exec`) — esa es la
   herramienta lista para usar, guardala como marcador.

### Opción B — con `clasp` (si preferís línea de comandos)

```bash
npm install -g @google/clasp
clasp login
cd asegurado-appscript
clasp create --type webapp --title "Generador Asegurado SHOPPERS"
clasp push
clasp deploy
```

`clasp create` genera su propio `.clasp.json` y puede pedirte confirmar el
`appsscript.json` existente; usá el de esta carpeta.

## Actualizar la herramienta más adelante

Si cambia la lógica en `asegurado/index.html` (el repo principal), copiá el
bloque `<style>`/`<script>` actualizado a `Index.html` acá (el único cambio
estructural entre ambos es que acá el `<script src="exceljs.min.js">` se
reemplaza por `<?!= include('ExcelJS'); ?>`), y volvé a `clasp push` /
pegar+guardar en el editor, o simplemente creá una nueva implementación
desde **Implementar → Gestionar implementaciones**.

## Notas

- Acceso configurado como **"Solo yo"**: solo tu cuenta de Google puede
  abrir la URL. Si más adelante querés compartirla con compañeros de tu
  organización, cambiá "Quién puede acceder" en la implementación (no hace
  falta tocar el código).
- Como todo el procesamiento pasa en el navegador, cada persona que use la
  URL necesita que su navegador pueda ejecutar JavaScript normalmente; no
  hay backend que procese datos ni los almacene en ningún lado.
