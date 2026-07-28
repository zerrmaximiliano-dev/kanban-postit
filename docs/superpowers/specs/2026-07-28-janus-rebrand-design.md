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
- Un rediseño del wordmark tipográfico del logo original — el texto "Janus" en la UI usa la tipografía Inter ya establecida en el sistema de diseño, no la fuente del logo, para mantener consistencia visual con el resto de la app.

## Assets

- `public/janus-icon-512.png`: recorte cuadrado del cubo (512×512, fondo blanco, ~8% de padding), generado con Pillow a partir del JPEG original del usuario.
- `app/favicon.ico`: generado desde el mismo recorte (multi-resolución: 16/24/32px).

## Cambios de código

- `app/layout.tsx`: `metadata.title` pasa de lo que sea que tenga hoy a `"Janus"` (y `description` si menciona "kanban-postit" explícitamente, se ajusta a texto genérico sobre Janus).
- `package.json`: campo `name` → `"janus"`.
- `src/modules/boards/ui/Sidebar.tsx`: el `<div className="h-6 w-6 rounded-control bg-accent-500" />` (el cuadradito de color, aparece dos veces — colapsado y expandido) se reemplaza por `<img src="/janus-icon-512.png" alt="Janus" className="h-6 w-6 rounded-control object-cover" />`; en la versión expandida, el texto "Tableros" (uppercase, label de sección) se mantiene tal cual — es un label de sección, no el nombre de la app — y se agrega el wordmark "Janus" en `font-semibold text-white` junto al isotipo, arriba de ese label, para que el nombre de marca sea visible.
- `app/(auth)/login/page.tsx`: el `<div className="mb-3 h-8 w-8 rounded-control bg-accent-500" />` se reemplaza por `<img src="/janus-icon-512.png" alt="Janus" className="mb-3 h-8 w-8 rounded-control object-cover" />`.

## Testing

Sin lógica nueva que testear con Vitest — es un cambio puramente visual/de metadata. Verificación: `npx tsc --noEmit` limpio, revisión visual manual de sidebar/login/favicon en el navegador de preview.
