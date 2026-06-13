# DESIGN_NOTES — Contrato del design system "Hive" (renovacion-ui)

Este documento es el **contrato** entre el agente de fundación y los 10 agentes
de página. Todo lo descrito aquí YA existe en `src/app/globals.css` y en los
componentes compartidos. Léelo entero antes de tocar una página.

Lenguaje: "AI Desktop Native" — dark-first, grises cálidos, un solo acento
ámbar, profundidad por escalera de luminosidad + hairlines (NO drop-shadows en
superficies base), movimiento corto y físico.

---

## 1. Tokens (nombres exactos)

Definidos en `:root` y expuestos como utilidades Tailwind vía `@theme inline`.
Usa las clases Tailwind; usa `var(--token)` solo en CSS/inline-styles.

### Superficies (escalera de luminosidad, gris cálido)

| Clase | Token | Uso |
|---|---|---|
| `bg-background` | `--background` | canvas de la app |
| `bg-surface-1` | `--surface-1` | cards, paneles, sidebar |
| `bg-surface-2` | `--surface-2` | hover, elementos elevados, keycaps |
| `bg-surface-3` | `--surface-3` | activo, popovers |
| `bg-popover` | `--popover` | menús/popovers |

### Texto (3 niveles — nunca blanco puro, nunca grises crudos)

| Clase | Token | Uso |
|---|---|---|
| `text-foreground` | `--foreground` | primario |
| `text-muted-foreground` | `--muted-foreground` | secundario |
| `text-faint` | `--faint` | terciario, placeholders, metadata |

### Bordes (hairline, siempre alfa)

| Clase | Token |
|---|---|
| `border-border` | `--border` (blanco 8%) — **default global**, basta `border` |
| `border-border-strong` | `--border-strong` (blanco 14%) |
| `border-input` / `--input` | inputs (blanco 10%) |

### Acento (ámbar Hive) y semánticos

| Clase | Token | Notas |
|---|---|---|
| `bg-primary` / `text-primary` | `--primary` | `oklch(0.78 0.14 78)` |
| `bg-primary-hover` | `--primary-hover` | hover de CTAs |
| `bg-primary-soft` | `--primary-soft` | fondos al 14% |
| `text-primary-foreground` | `--primary-foreground` | texto OSCURO sobre ámbar |
| `success` / `success-soft` | verde | estados ok / done |
| `destructive` / `destructive-soft` | rojo | errores, acciones peligrosas |
| `warning` / `warning-soft` | amarillo | tool-use, nudges |
| `info` / `info-soft` | cian | needs-input, reminders |

Patrón badge/estado: fondo `*-soft` + texto del color vivo (ver `StatusBadge`).

### Radios (clases `rounded-*` ya remapeadas)

`rounded-xs` 4px (keycaps, badges) · `rounded-sm` 6px (items sidebar, skeleton)
· `rounded-md` 8px (botones, inputs) · `rounded-lg` 12px (cards, paneles)
· `rounded-xl` 16px (dialogs, palette) · `rounded-2xl` 20px (burbujas chat).
**Prohibidas las esquinas cuadradas** salvo decisión explícita.

### Sombras

| Clase | Uso |
|---|---|
| `shadow-bevel` | bisel interior 1px en cards (única "sombra" de superficies base) |
| `shadow-overlay` | SOLO overlays flotantes (dialog, palette, dropdown, toast) |
| `shadow-glow` | glow ámbar en hover de CTA primario |
| `shadow-glow-lg` | atmósfera hero |

**Regla: NADA de `shadow-md/lg/xl` ni drop-shadows en superficies base.**

### Terminal (solo `EmbeddedTerminal`)

`bg-terminal-bg` (fondo del PTY, coincide con el theme de xterm.js) y
`bg-terminal-dot-close/minimize/zoom` (traffic lights decorativos). xterm y
recharts necesitan colores concretos, así que sus literales espejan estos
tokens (comentado en el código).

### Glass y movimiento

- `.glass` → `--glass-bg` + `backdrop-filter: blur(20px) saturate(1.4)` +
  hairline + bevel. SOLO capas flotantes; nunca en cards base.
- Duraciones: `--duration-micro` 120ms (hover) · `--duration-base` 180ms
  (fades/slides) · `--duration-overlay` 280ms.
- Easings (también clases Tailwind): `ease-out` (default, easeOutQuart),
  `ease-spring` (overshoot para overlays), `ease-in-out`.

---

## 2. Clases utilitarias disponibles (globals.css)

| Clase | Qué hace |
|---|---|
| `.animate-enter` | entrada estándar: fade + translateY(8px), 180ms |
| `.animate-overlay` | entrada de overlay: fade + scale 0.97 + spring |
| `.stagger-children` | escalona los hijos directos +30ms cada uno (cap 210ms) |
| `.skeleton` | shimmer de carga (úsalo vía `<Skeleton />`) |
| `.ai-pulse` | pulso "IA pensando" (ring que respira) |
| `.streaming-caret` | caret ámbar parpadeante al final del texto en streaming |
| `.glass` | superficie de vidrio para overlays |
| `.hive-card` | receta card: surface-1 + hairline + radius-lg + bevel |
| `.hive-overline` | overline mono 11px ámbar — patrón "[ LABEL ]" |
| `.hive-h1` | H1 de página 28px/600/-0.025em |
| `.keycap` | tecla de atajo: mono 11px, surface-2, radius-xs |
| `.noise` | grano SVG al 4% (en `::after`; el padre necesita `position`) |
| `.shell-aurora` | aurora ámbar difusa (ya montada por el Shell) |
| `.ai-border` | borde gradiente "AI" para el input de prompt del Assistant |
| `.dot-grid` | patrón de puntos desvanecido para secciones técnicas |
| `.hive-modal-overlay` / `.hive-modal-panel` | legacy: fade del backdrop + spring del panel (los modales existentes ya las usan; siguen siendo válidas) |

Keyframes disponibles: `enter-up`, `overlay-in`, `overlay-fade`, `shimmer`,
`ai-pulse`, `blink`, `drift`.

`prefers-reduced-motion: reduce` desactiva TODO globalmente — no añadas
animaciones en `<style>` inline que lo ignoren.

---

## 3. Tipografía y jerarquía

- **Inter** (`font-sans`) para UI; **JetBrains Mono** (`font-mono`) es la firma
  para datos, ids, timestamps, código y keycaps.
- `tabular-nums` está activo globalmente (body).
- Escala: 11px metadata mono · 12px caption · 13px chrome (sidebar, botones,
  body de paneles) · 14px body · 15–16px contenido/chat · 18px h3 · 22px h2 ·
  **28px h1** (`.hive-h1`).
- El patrón de marca `[ LABEL ]` mono uppercase **solo** se usa como overline
  de 11px encima del H1 de página (lo hace `PageHeader`). No lo uses en títulos
  de cards/paneles: ahí usa 12px `font-medium text-muted-foreground`.
- **Prohibido `uppercase` en botones.** Botones: 13px `font-medium`.

### Recetas de botón

- Primario: `h-9 rounded-md bg-primary px-4 text-[13px] font-medium
  text-primary-foreground hover:bg-primary-hover hover:shadow-glow`
- Secundario: `h-8/9 rounded-md border border-border bg-surface-2 px-3
  text-[13px] font-medium text-muted-foreground hover:bg-surface-3
  hover:text-foreground`
- Peligro: `border border-destructive/40 bg-destructive-soft text-destructive
  hover:bg-destructive/25`
- Ghost: `hover:bg-surface-2`

---

## 4. API de componentes compartidos

### `PageHeader` — `@/components/ui/PageHeader` (server-safe)

```tsx
<PageHeader
  overline="Dashboard"            // sin corchetes; el componente los pone
  title="Mission Control"
  description="Everything your agents are doing, in one place."
  actions={<NewProjectButton />}  // opcional, alineado a la derecha
/>
```

**Todas las páginas DEBEN abrir con `PageHeader`.** Ya trae `.animate-enter` y
el margen inferior (`mb-6`).

### `EmptyState` — `@/components/EmptyState` (client)

```tsx
<EmptyState
  illustration="board"   // "hex" | "folder" | "chat" | "spark" | "board" | "clock"
  title="Your board is empty"
  description="Tasks let you queue work for an agent."
  cta={{ label: "New task", modal: "newTask" }}   // ← CTA REAL
  secondary={{ label: "Learn more", href: "/docs" }}
/>
```

CTA admite **una** de tres formas: `href` (Link), `onClick` (solo desde client
components) o `modal` (nombre de `ModalName` del modalBus — **serializable,
úsalo desde server pages**: `"newProject" | "newTask" | "newProfile" |
"newReminder" | "newAutomation"`). Esto arregla los CTAs muertos con `href="#"`:
migra a `modal:`.

### `StatusBadge` — `@/components/StatusBadge`

`<StatusBadge status={state.status} />` con `ProjectStatus`
(`idle | running | needs-input | blocked | done`). Pill `*-soft` + punto.
Para otros dominios (tasks, runs) replica el patrón: `rounded-full bg-*-soft
text-* font-mono text-[11px] + dot`.

### `Skeleton` — `@/components/ui/Skeleton`

`<Skeleton className="h-4 w-32" />` — dale tamaño/radio con utilidades.
Cada ruta principal ya tiene su `loading.tsx`; si creas rutas nuevas, añade el
tuyo reutilizando este componente.

### `ConfirmDialog` — `confirm()` / `useConfirm()` de `@/components/ui/ConfirmDialog`

Igual que antes (`confirm({ title, message, danger, confirmLabel })`).
Nota: con `danger: true`, Enter ya NO confirma (solo click / foco explícito).

### Toasts — `notify` de `@/lib/ui/notify` (sin cambios de API).

---

## 5. Lo que el Shell YA hace (no lo dupliques en páginas)

- **Aurora + noise**: capa fija detrás de todo (`Shell.tsx`). No añadas otra
  aurora de página completa; para un hero puntual puedes usar un glow local
  (`shadow-glow-lg` o radial-gradient con `--primary-soft`).
- **Sidebar** (240px fija): navegación con estado ACTIVO por ruta
  (`usePathname`), secciones Workspace/Automation/System, **Board ya está en el
  nav**, logo `public/hive-logo.svg`, widget de runs activos, footer.
- **TopBar** (48px): titlebar integrada con pills de scheduler/anthropic. Las
  páginas NO ponen breadcrumbs ni título aquí: usa `PageHeader` en el cuerpo.
- **StatusBar** (28px): versión, último tick, reloj.
- **CommandPalette** (⌘K): navegación (incluye "Go to Board"), creación
  (modalBus), proyectos, perfiles, stop-all. Si tu página añade comandos,
  repórtalo — no montes otra palette.
- **Cheatsheet** (`?`), **GlobalModalsHost** (modales de newProject/newTask/
  newAutomation + redirects de newProfile/newReminder), **Toaster**,
  **ConfirmHost**: todos montados desde `layout.tsx`. No los re-montes.
- `main` tiene `p-6` y NO fija max-width: **cada página define su contenedor**.
  Estándar: `mx-auto max-w-7xl` para vistas densas, `max-w-3xl` para
  lectura/formularios, `max-w-5xl` para chat. Evita inventar otros anchos.

---

## 6. Patrones obligatorios

1. **Entrada escalonada**: lista/grid que aparece al cargar → contenedor
   `stagger-children`, o `.animate-enter` con
   `style={{ animationDelay: \`${i * 30}ms\` }}` (máx 8). Animar SOLO
   opacity/transform.
2. **Filas de lista**: 44px (`min-h-11`), `hover:bg-surface-2`,
   `divide-y divide-border`, contenedor `rounded-lg border bg-surface-1`.
3. **Cards**: `.hive-card` (o sus clases equivalentes) + hover opcional
   `hover:-translate-y-0.5 hover:border-border-strong` (transform/opacity only).
4. **Overlays**: `.glass` + `rounded-xl` + `shadow-overlay` +
   `.animate-overlay`; backdrop `bg-black/60 backdrop-blur-[2px]` con
   `.hive-modal-overlay`.
5. **Foco**: NO quites el outline; hay `:focus-visible` global ámbar. Todo lo
   clickable debe ser `<button>`/`<a>` reales (no divs con onClick).
6. **Hovers**: transición global de 120ms ya aplicada a `a/button`; no añadas
   `transition-all`.

## 7. Reglas duras (revisión = rechazo)

- ❌ Colores crudos de Tailwind (`emerald-400`, `red-500`, `yellow-300`,
  `slate-*`, hex sueltos). ✅ Solo tokens de la §1.
- ❌ `uppercase` en botones. ❌ drop-shadows en superficies base.
- ❌ Animar width/height/top/left. ✅ Solo opacity/transform.
- ❌ Keyframes inline en `<style>` sin pasar por globals (rompen
  reduced-motion).
- ❌ H1 mono de 10px. ✅ `PageHeader`.
- Los aliases `hive-bg/panel/border/text/muted/amber/green/red/cyan/yellow`
  siguen funcionando (mapean a los tokens nuevos) pero están **DEPRECATED**:
  todo código que toques debe migrar a los tokens nuevos.

## 8. Dependencias añadidas

- `react-markdown` + `remark-gfm`: para el chat del Assistant (renderizar
  markdown del asistente). No se añadió `motion`: los springs se logran con
  `--ease-spring` en CSS (decisión de fundación; si una página necesita springs
  de layout reales, que lo reporte).

## 9. Marca

- Logo: `public/hive-logo.svg` (hexágono ámbar con glow) — usado en Sidebar.
- Icono inline: `HexIcon` (`@/components/icons/HexIcon`), hereda currentColor.
- Acento único ámbar; el resto del UI casi monocromo. Semánticos solo en
  estados.

## 10. Cómo se verifica

Comandos que deben pasar (exit 0) antes de mergear cualquier cambio de UI:

```bash
# 1. Tipos
node_modules/.bin/tsc --noEmit

# 2. Lint (incluye reglas del React Compiler: purity, set-state-in-effect…)
npm run lint

# 3. Build de producción
npm run build

# 4. Smoke test con la build real (puerto libre, p. ej. 3210)
PORT=3210 npm run start &
for r in / /assistant /board /automations /profiles /reminders /settings /welcome; do
  curl -sL -o /dev/null -w "$r -> %{http_code}\n" "http://localhost:3210$r"
done   # todas deben dar 200 (welcome redirige a / si el onboarding terminó)
kill %1
```

Nota: `next start` avisa que con `output: "standalone"` se recomienda
`node .next/standalone/server.js`; para el smoke test local `next start`
sirve igual (el standalone existe para el empaquetado desktop/Tauri).

Barrido de consistencia (deben devolver 0 resultados en UI):

```bash
# Colores crudos de Tailwind y hex inline fuera de globals.css
grep -rnE 'emerald-|red-4|red-5|yellow-3|green-4|blue-4|bg-\[#|text-\[#' src/
```

Excepciones documentadas con hex literal: `global-error.tsx` (autónomo, sin
globals.css), theme de xterm en `EmbeddedTerminal.tsx` y fallbacks de
`useChartTokens.ts` (espejan tokens), y las paletas de color de
perfiles/automatizaciones (son DATOS de usuario, no estilos).
