# BRANDING — cómo re-brandear esta app

> **"Hive", el logo hexagonal y el color ámbar son PLACEHOLDERS.**
> Esta guía lista TODO lo que hay que tocar para poner tu marca real.
> Tiempo estimado: 20–30 minutos + regenerar iconos.

## 1. Nombre y textos (1 archivo)

Edita **`src/lib/brand.ts`** — única fuente de verdad dentro de la web app:

```ts
export const BRAND = {
  name: "TuMarca",          // prosa: título del tab, status bar
  wordmark: "TUMARCA",      // texto junto al logo en el sidebar
  tagline: "Tu descripción corta.",
  version: "0.1.0",
  logoSrc: "/tu-logo.svg",  // archivo dentro de /public
};
```

Con eso cambian: título del navegador, sidebar, status bar y metadata.

## 2. Logo de la web app

1. Pon tu logo (SVG recomendado, cuadrado, funciona sobre claro y oscuro)
   en **`public/`** (ej. `public/tu-logo.svg`).
2. Apunta `logoSrc` en `src/lib/brand.ts` a ese archivo.
3. Favicon: reemplaza **`src/app/favicon.ico`** (usa https://realfavicongenerator.net
   con un PNG 512×512 de tu logo).

## 3. Colores (opcional)

Todo el color vive en **`src/app/globals.css`**:

- Tema oscuro: bloque `:root` (busca `--primary` — hoy es el ámbar).
- Tema claro: bloque `:root[data-theme="light"]`.

Cambia `--primary`, `--primary-hover`, `--primary-soft`, `--ring` en ambos
bloques y toda la UI (botones, links, focus, aurora) sigue tu acento.
Los valores están en `oklch()` — usa https://oklch.com para convertir tu hex.

## 4. App de escritorio (Tauri)

En **`desktop/src-tauri/tauri.conf.json`**:

- `productName`: `"Hive"` → tu nombre (es el nombre del .app y del menú).
- `identifier`: `"com.hive.desktop"` → `"com.tumarca.desktop"`.
  ⚠️ Cambiar el identifier cambia la carpeta de datos
  (`~/Library/Application Support/<identifier>`), así que muévela si ya
  tenías datos.
- `app.windows[0].title`: título de la ventana.

**Iconos del .app** (hoy son un placeholder): con un PNG 1024×1024 de tu logo:

```bash
cd desktop
./node_modules/.bin/tauri icon ruta/a/tu-logo-1024.png
# Regenera desktop/src-tauri/icons/* (icns, ico, png)
```

Luego reconstruye la app (`HANDOFF-DESKTOP.md` tiene los comandos exactos).

**Splash de arranque**: `desktop/frontend/index.html` — cambia el texto/color
del splash que se ve mientras arranca el servidor interno.

## 5. Documentación

- `README.md`: título, badges y screenshots (`docs/screenshot-*.png`).
- `package.json`: campo `name` (hoy `hive`).

## 6. Checklist final

- [ ] `src/lib/brand.ts` con nombre/wordmark/tagline/logo nuevos
- [ ] `public/<tu-logo>.svg` + `src/app/favicon.ico`
- [ ] (opcional) `--primary` en ambos temas de `globals.css`
- [ ] `desktop/src-tauri/tauri.conf.json` (productName, identifier, title)
- [ ] `tauri icon` con tu PNG 1024 y rebuild del .app
- [ ] README y screenshots
