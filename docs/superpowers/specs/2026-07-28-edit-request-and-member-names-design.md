# Solicitar edición + nombres de miembros — Diseño

## Objetivo

Dos mejoras sobre el modo colaborativo ya en producción:
1. La lista de miembros hoy muestra el `user_id` (un UUID) cuando no fue invitado por email (p. ej. alguien que entró por link). Debe mostrar siempre un email o nombre real, nunca un código.
2. Un viewer (solo lectura) puede pedirle al dueño que lo pase a editor, sin que el dueño tenga que adivinar quién lo necesita.

## Alcance de esta v1

Incluye:
- Backfill + captura del email real del miembro en todos los caminos de alta (invitación por email, join por link, dueño original).
- Campo de "nombre para mostrar" que el propio miembro puede definir, habilitado recién cuando su rol pasa a `editor` u `owner` (no mientras es `viewer`).
- Botón "Solicitar edición" para un viewer, visible en el popover de Miembros.
- Vista del dueño: la persona que pidió editar aparece con **Aprobar** / **Rechazar** en vez del selector de rol normal.
- Un indicador (punto) en el botón de Miembros del header, visible solo para el dueño, cuando hay al menos un pedido pendiente. Sin sistema de notificaciones nuevo — se calcula de los miembros ya cargados, el dueño se entera la próxima vez que mira el tablero (no hay push).

No incluye (fuera de alcance):
- Notificaciones push/email cuando alguien pide editar o es aprobado.
- Pedir otros roles además de "editor" (no se puede pedir "dueño").
- Deshacer un pedido ya enviado (el viewer no puede "cancelar" el pedido una vez hecho; el dueño simplemente lo aprueba o rechaza).

## Modelo de datos

Se reutiliza y extiende `board_members` (no se crean tablas nuevas):

- `invited_email` (ya existe): se sigue llamando así por compatibilidad, pero pasa a significar "email real de este miembro", no solo "email con el que fue invitado". Se completa en los tres caminos de alta:
  - Invitación por email: ya lo hace (`inviteMemberByEmail` ya guarda el email escrito por el dueño).
  - Join por link (`join_board_via_token`): hoy no lo guarda — se corrige para tomarlo de `auth.users.email` en el momento del join.
  - Fila del dueño (trigger `create_owner_membership`, y el backfill que ya corrimos para tableros viejos): hoy no lo guarda — se corrige para tomarlo de `auth.users.email`.
  - Una migración de backfill completa `invited_email` para las filas existentes que lo tengan `null`, leyendo `auth.users.email`.
- `display_name text null` (nueva columna): nombre elegido por el propio miembro. `null` hasta que lo define.
- `edit_requested boolean not null default false` (nueva columna): `true` mientras el viewer tiene un pedido de edición pendiente sin resolver.

## Permisos (RLS)

Hoy solo el dueño puede hacer `update` sobre `board_members` (política `"Owners can change member roles"`). Se agrega una segunda política que permite que **cualquier miembro actualice su propia fila** (`user_id = auth.uid()`), pensada para que puedan tocar `edit_requested` y `display_name` sin pasar por el dueño.

Como Postgres RLS no puede restringir a nivel de columna, esa política de "actualizar mi propia fila" técnicamente permitiría a un viewer hacer un PATCH crudo cambiando su propio `role` a `editor` sin pasar por el dueño. Se cierra ese hueco con un trigger `before update` (mismo patrón que el que ya protege `boards.owner_id`/`share_token`): si quien llama no es el dueño del tablero, cualquier cambio a `role`, `invited_email` o `status` en esa fila se rechaza — solo `edit_requested` y `display_name` quedan libres para que el propio miembro los edite.

## Flujo

**Pedir edición (viewer):**
- En el popover de Miembros, si mi propio rol es `viewer` y no pedí edición todavía, veo un botón "Solicitar edición".
- Al tocarlo, se marca `edit_requested = true` en mi fila. El botón cambia a un texto informativo ("Pedido enviado, esperando aprobación") — no hay forma de deshacerlo desde acá en esta v1.

**Revisar pedidos (dueño):**
- El botón de Miembros en el header muestra un punto de aviso si hay algún miembro con `edit_requested = true`.
- Dentro del popover, esa persona aparece con "Pidió editar" + botones **Aprobar** (pone `role = editor`, `edit_requested = false`) / **Rechazar** (solo pone `edit_requested = false`, se queda en `viewer`).

**Nombre para mostrar:**
- La lista de miembros muestra `display_name` si existe; si no, el email; nunca el UUID crudo.
- Si mi propio rol ya es `editor` u `owner` y todavía no definí `display_name`, veo un campo simple dentro del popover ("¿Cómo querés que te vean?") para guardarlo. No se ofrece mientras soy `viewer`.

## Testing

Sin cambios a lógica cubierta por Vitest (todo es RLS + Server Actions + UI). Verificación: `npx tsc --noEmit` limpio, y verificación manual con dos cuentas (una due-a, una invitada) repitiendo el flujo completo: pedir edición → ver el punto de aviso → aprobar → confirmar que el select de rol vuelve a la normalidad → poner nombre para mostrar → confirmar que se ve en vez del email.
