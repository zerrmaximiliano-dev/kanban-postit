# Rebrand a "Janus" — Diseño

## Objetivo

Renombrar la app "kanban-postit" a "Janus" en toda la superficie visible (título del navegador, metadata, sidebar, login), usando el logo provisto (un cubo isométrico estilo Escher con laberintos, más el wordmark "JANUS").

## Alcance de esta v1

Incluye:
- Recorte del isotipo (solo el cubo, sin el wordmark) como asset cuadrado con fondo blanco, en `public/janus-icon-512.png`.
- Favicon (`app/favicon.ico`) generado a partir de ese mismo recorte.
- `<title>`/metadata del navegador → "Janus" (`app/layout.tsx`).
- `package.json` `name` → `"janus"`.
- Isotipo del cubo reemplazando el cuadradito de color actual en:
  - `Sidebar.tsx` (arriba de "TABLEROS"), junto al texto "Janus".
  - `login/page.tsx` (arriba del formulario), junto al texto "Janus".

No incluye (fuera de alcance):
- Cambios a la paleta de colores (petrol/turquesa se mantiene sin tocar).
- Cambios al nombre del repositorio de GitHub ni al proyecto de Vercel/Supabase.
- Loop de flotado/brillo (`idleFloat`/`sheenEffect`) en el uso dentro del login — solo la animación de entrada. El componente los soporta (por si se reusa en un splash a pantalla completa más adelante), pero el call site de login los pasa en `false`.

## Addendum (2026-07-28): asset final + animación de entrada

El usuario compartió un handoff de diseño (`design_handoff_janus_logo/`) con el ícono final ya recortado con fondo transparente (mejor que el recorte hecho a mano en la v1 de este spec) y una especificación de animación de entrada de alta fidelidad. Esto reemplaza/extiende lo de arriba:

### Asset actualizado

- `public/janus-icon.png`: ícono final del handoff (684×379, RGBA transparente) — reemplaza `public/janus-icon-512.png`, que se elimina.
- `app/favicon.ico`: regenerado desde ese mismo asset (padding ~10%, fondo blanco, cuadrado, 512×512 antes de convertir a `.ico` multi-resolución).

### Nuevo componente: `JanusLogoReveal`

Recreación fiel (no una librería de animación nueva — CSS transitions + `useState`/`useEffect`, igual que el resto del proyecto) del HTML de referencia:

- **Entrada**: ícono arranca en `opacity:0, scale(0.7) rotate(-10deg)`; a los 120ms pasa a `opacity:1, scale(1) rotate(0)` (`transition: opacity 1000ms, transform 1200ms`, easing `cubic-bezier(0.16,1,0.3,1)`). El wordmark "JANUS" arranca en `opacity:0, translateY(18px)` por letra; a los `120 + entranceSpeed*0.55`ms (con `entranceSpeed` default 900ms) cada letra pasa a `opacity:1, translateY(0)` con `transition: 620ms/700ms` mismo easing, **stagger de 60ms por letra** (izquierda a derecha).
- **Loop idle** (float vertical + sheen diagonal): implementado vía `@keyframes` en `globals.css`, activado solo si `idleFloat`/`sheenEffect` son `true` (default `true` en el componente, para poder reusarlo en un futuro splash a pantalla completa) — el login los pasa en `false` para no competir con el formulario.
- **Props**: `wordmark` (default `"JANUS"`), `iconSize` (px, default 380), `entranceSpeed` (ms, default 900), `idleFloat` (bool, default true), `sheenEffect` (bool, default true).
- **Tipografía del wordmark**: Archivo (Google Font, peso 800), `76px` a tamaño default, escalando proporcionalmente si `iconSize` es menor (el login la usa a una fracción del tamaño del hero, ver Cambios de código). Color `oklch(0.28 0.06 265)` (navy oscuro). Fondo del propio componente: transparente (hereda el fondo de donde se monte), no fuerza el `oklch(0.995 0.002 250)` del mockup aislado ya que en el login va sobre `bg-surface` existente.

### Cambios de código (reemplaza la sección homónima de arriba)

- `app/layout.tsx`: `metadata.title` → `"Janus"`, `description` → `"Janus — tableros Kanban y calendario colaborativo"`. Se agrega la fuente `Archivo` (Google Font, `next/font/google`, weight 800) como variable CSS, igual patrón que `Inter`/`Caveat` ya existentes.
- `package.json`: campo `name` → `"janus"`.
- `src/modules/ui/JanusLogoReveal.tsx` (nuevo): el componente descrito arriba.
- `src/modules/boards/ui/Sidebar.tsx`: el cuadradito de color (aparece dos veces) se reemplaza por `<img src="/janus-icon.png" alt="Janus" className="h-6 w-6 object-contain" />` (estático, sin animación — la animación de entrada es solo para el login, per decisión del usuario). En la versión expandida se agrega el wordmark "Janus" en Inter (no Archivo, para no mezclar dos fuentes de marca en un lugar tan chico) junto al ícono, arriba del label "Tableros".
- `app/(auth)/login/page.tsx`: el cuadradito de color se reemplaza por `<JanusLogoReveal iconSize={72} entranceSpeed={900} idleFloat={false} sheenEffect={false} />`.

## Testing

Sin lógica de negocio nueva que testear con Vitest — es un cambio puramente visual/de metadata más un componente de animación autocontenido sin estado de aplicación. Verificación: `npx tsc --noEmit` limpio, revisión visual manual de sidebar/login/favicon en el navegador de preview (confirmar que la animación de entrada se ve fluida y que no queda flotando/brillando en el login).
