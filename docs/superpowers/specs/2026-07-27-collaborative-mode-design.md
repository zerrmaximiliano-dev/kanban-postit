# Modo colaborativo — Diseño

## Objetivo

Permitir que varios usuarios compartan un tablero y lo editen a la vez: ver los cambios de los demás en vivo, saber quién está mirando, evitar pisarse al editar la misma nota, y poder asignarse notas entre sí.

## Alcance de esta v1

Incluye:
- Compartir un tablero con otras personas (invitación por email o link).
- Roles: Owner / Editor / Viewer.
- Sincronización en vivo de columnas, notas y checklist entre todos los que tienen el tablero abierto.
- Presencia (avatares de quién está viendo el tablero ahora).
- Cursores en vivo (posición del mouse de cada persona, tipo Figma).
- Bloqueo suave al editar una nota (aviso + modo solo-lectura para los demás mientras alguien la tiene abierta).
- Asignación de notas a uno o varios miembros del tablero, con avatares en la tarjeta.
- Filtro "solo mis notas".
- Notificaciones in-app (campanita) cuando te asignan una nota.

No incluye (fuera de alcance, se puede evaluar después):
- Edición carácter-por-carácter tipo Google Docs (CRDT). Se resolvió con bloqueo suave.
- Roles más finos que Owner/Editor/Viewer.
- Notificaciones por email (requeriría sumar un proveedor de email externo, ej. Resend, que hoy el proyecto no tiene).
- Límite de miembros por tablero.
- Historial de versiones / auditoría de cambios.

## Arquitectura

100% Supabase, sin servicios de terceros nuevos:

1. **Postgres Changes** (Supabase Realtime): cada cliente suscribe un canal `board:<board_id>` que escucha INSERT/UPDATE/DELETE en `columns`, `notes`, `checklist_items` y `note_assignees` filtrados por `board_id`. Los eventos parchean el estado local del tablero.
2. **Presence** (Supabase Realtime): cada cliente conectado anuncia su presencia (user_id, nombre, color) en el mismo canal del tablero → alimenta los avatares de "quién está viendo esto ahora".
3. **Broadcast** (Supabase Realtime, efímero, no persiste en la base): posición de cursor de cada usuario (~10/s) y eventos `editing:<note_id>` para el bloqueo suave.

Alternativas consideradas y descartadas:
- **Polling** (refetch cada N segundos): no da cursores en vivo ni indicador de "editando", no cumple el nivel de colaboración pedido.
- **Liveblocks / Yjs**: servicios/librerías de colaboración de terceros con soporte para CRDT y presencia lista para usar. Se descartan porque agregarían una cuenta/infra externa y el proyecto no necesita edición carácter-por-carácter (se eligió bloqueo suave).

## Modelo de datos

### `board_members` (nueva)

| columna | tipo | notas |
|---|---|---|
| `board_id` | uuid → `boards.id` | |
| `user_id` | uuid → `auth.users.id`, nullable | null mientras la invitación está pendiente |
| `invited_email` | text, nullable | para invitar a alguien sin cuenta todavía |
| `role` | enum `owner` \| `editor` \| `viewer` | |
| `status` | enum `pending` \| `accepted` | |

Al crear un tablero se crea automáticamente su fila `board_members` con `role = owner`, `status = accepted`.

### `boards` (modificada)

- Nueva columna `share_token` (uuid random, generado al crear el tablero) para el link compartible (`/join/<share_token>`).

### `note_assignees` (nueva)

| columna | tipo |
|---|---|
| `note_id` | uuid → `notes.id` |
| `user_id` | uuid → `auth.users.id` |

Relación muchos-a-muchos: una nota puede tener varios asignados.

### `notifications` (nueva)

| columna | tipo |
|---|---|
| `user_id` | uuid → `auth.users.id` (destinatario) |
| `board_id` | uuid → `boards.id` |
| `note_id` | uuid → `notes.id`, nullable |
| `type` | text (ej. `note_assigned`) |
| `read` | boolean, default false |
| `created_at` | timestamptz, default now() |

### RLS

Las políticas de `boards`, `columns`, `notes`, `checklist_items`, `note_assignees` pasan de "solo el owner" a "el owner o cualquier `board_members` con `status = accepted` para ese `board_id`". Los `viewer` pueden hacer `select` pero las políticas de `insert`/`update`/`delete` exigen `role in ('owner', 'editor')` — el chequeo vive en la política SQL, no solo en el frontend, para que no se pueda saltear.

`notifications` usa RLS simple: cada usuario solo puede leer/marcar como leídas las suyas (`user_id = auth.uid()`).

## Invitar y unirse

- **Por email**: el owner escribe un email desde el tablero → una server action (usa la service-role key, nunca expuesta al cliente) llama `supabase.auth.admin.inviteUserByEmail` (mail nativo de Supabase Auth, sin proveedor externo) y crea la fila `board_members` (`status = pending`, `invited_email`). Cuando esa persona confirma el mail y su cuenta queda creada, al loguearse se busca una fila `board_members` pendiente que coincida con su email, se le asigna el `user_id` y pasa a `accepted`.
- **Por link**: botón "Copiar link para compartir" arma `/join/<share_token>`. Cualquiera logueado que abra ese link se agrega automáticamente a `board_members` con `role = viewer`, `status = accepted`. El owner puede subirle el rol después.
- **Gestión de miembros**: popover nuevo en `BoardHeader.tsx` que lista los miembros actuales, su rol, y permite al owner cambiar rol o quitar acceso (elimina la fila `board_members`, lo que corta el acceso vía RLS al instante).

## Presencia, cursores y bloqueo suave

- **Avatares de presencia**: fila de círculos con iniciales en `BoardHeader`, uno por cada persona con el tablero abierto en este momento.
- **Cursores en vivo**: mientras el mouse se mueve sobre `BoardView`, la posición relativa al contenedor se transmite por Broadcast; los demás ven un cursor de color con el nombre de esa persona flotando sobre el tablero.
- **Bloqueo suave**: al abrir el `NoteEditor` (drawer) de una nota se emite `editing:<note_id>` por Broadcast. Si otra persona intenta abrir la misma nota mientras tanto, ve un aviso ("María está editando esta nota") y el drawer se abre en modo solo-lectura hasta que María lo cierre o pase un timeout de inactividad (por si se cuelga o cierra la pestaña sin avisar).

## Asignación de notas

- `NoteCard.tsx` gana una fila de avatares superpuestos (iniciales sobre círculo de color) en la esquina de la tarjeta.
- El `NoteEditor` gana un selector multi-choice "Asignar a", con la lista de `board_members` del tablero.
- Filtro **"Solo mis notas"**: toggle en el header de `BoardView` y `CalendarView` que oculta todo lo que no te tenga asignado (comparando contra `note_assignees`).
- Al asignar una nota se crea una fila en `notifications` (`type = note_assigned`) para cada nuevo asignado. Campanita en el header con contador de no leídas (alimentada por Realtime igual que el resto); al hacer clic en una notificación navega directo a la nota.

## Migración del estado local a sincronizado

Hoy `BoardView.tsx` carga notas/columnas una vez con `useEffect` y parchea el estado a mano en cada mutación local (sin React Query, sin realtime). Para integrar la sincronización sin arriesgar el drag & drop:

- Se extrae un hook `useBoardRealtime(boardId)` que hace la carga inicial y después aplica los eventos de Postgres Changes al mismo `useState` — así el cambio propio y el ajeno entran por el mismo camino, sin lógica duplicada de parcheo manual.
- Las operaciones de reorder (`computeReorderWithinColumn`, `computeMoveToColumn` en `noteService.ts`) siguen actualizando el estado local al instante para que el drag se sienta ágil; el evento realtime que rebota de la propia escritura se ignora comparando contra la última escritura propia conocida, para no pisar la animación en curso.
- `CalendarView.tsx` se conecta al mismo hook (comparte el mismo canal `board:<id>` que `BoardView`).

## Testing

- **RLS**: verificación manual (dos cuentas reales) de que un `viewer` no puede escribir vía API directa y que alguien sin fila en `board_members` no puede ni leer el tablero. Se documentan los casos probados en el plan de implementación.
- **Realtime**: no es testeable con Vitest en un solo proceso; se verifica manualmente con dos pestañas/dos cuentas en paralelo antes de cerrar cada tarea relevante del plan de implementación.
- **Unitarios**: la lógica pura que no depende de dos clientes (cálculo de reorder, resolución de roles, filtro "solo mis notas") sí se cubre con Vitest como el resto del proyecto.

## Riesgo principal

`BoardView.tsx` es el archivo más grande y crítico del proyecto (columnas, notas, drag & drop, animación de agendado). Aislar la sincronización en `useBoardRealtime` en vez de mezclarla inline es la forma de acotar ese riesgo — el plan de implementación debe tratar esa extracción como su propia tarea, verificada a fondo antes de construir presencia/cursores/bloqueo encima.
