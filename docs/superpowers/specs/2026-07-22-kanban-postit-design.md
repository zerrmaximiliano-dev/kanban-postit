# Kanban Post-it — Diseño (v1)

> **Estado:** Aprobado por el usuario (2026-07-22)
> **Nombre de trabajo del proyecto:** `kanban-postit` (nombre definitivo a decidir más adelante)

## 1. Concepto y alcance

Web app de gestión de proyectos con tableros Kanban estilo notas post-it, diseñada
para crecer en tres etapas:

1. **Uso personal** (v1, este documento)
2. **Equipo** — compañeros de trabajo con acceso al mismo espacio
3. **Producto multi-cliente** — cada organización/cliente con su propio espacio aislado,
   siguiendo el mismo camino que tomó KairOS (`business-os`)

El modelo de datos y la arquitectura se diseñan desde el inicio para soportar esta
evolución (multi-tenant-ready), aunque la v1 se construye y se usa como mono-usuario.

### Alcance v1 (este proyecto)

- Tableros múltiples
- Columnas configurables por tablero (crear, renombrar, reordenar, borrar)
- Notas post-it con: título, descripción, color, prioridad, tags, checklist, fecha de vencimiento
- Vista Calendario (Mes / Semana con switch) derivada de la fecha de las notas
- Navegación: sidebar lateral con la lista de tableros
- Dentro de cada tablero: pestañas **Board** y **Calendario**

### Explícitamente fuera de alcance de v1 (fases futuras)

- Vista Gantt
- Sincronización con Google Calendar
- Multi-usuario real (invitaciones, roles, permisos)
- Multi-tenant (organizaciones/clientes aislados)

Estas features están consideradas en el modelo de datos (ver §2) para no requerir
migraciones destructivas cuando se implementen.

## 2. Stack técnico y arquitectura

Mismo stack que KairOS (`business-os`), por consistencia entre proyectos del usuario
y porque resuelve directamente el camino a multi-usuario/multi-tenant sin reescribir
la base.

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Estilos | Tailwind CSS + clases custom para el look post-it (rotación, sombra) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth (login desde v1, aunque mono-usuario) |
| Validación | Zod |
| Estado servidor (front) | TanStack Query (cache, optimistic updates) |
| Drag & drop | dnd-kit |
| Tests | Vitest (unit) + Playwright (e2e) |
| Hosting | Vercel |

**Por qué login desde v1 aunque sea un solo usuario:** agregar Supabase Auth ahora es
trivial y evita una migración de datos y de rutas cuando se sume el segundo usuario
(equipo) o el primer cliente (multi-tenant). Los datos ya nacen asociados a un
`owner_id`.

### Arquitectura por capas, modular (igual que KairOS)

```
src/modules/
  boards/       → tableros, columnas
  notes/        → notas post-it (título, color, tags, checklist, fecha)
  calendar/     → vista mes/semana derivada de notes.dueDate
  identity/     → usuarios (preparado para org/equipo a futuro)
```

Cada módulo tiene:
- `domain/` — tipos y reglas de negocio puras (sin I/O), testeadas con Vitest
- `application/` — services que orquestan casos de uso
- `data/` — repositorios que encapsulan el acceso a Supabase
- `ui/` — componentes y hooks propios del módulo

Regla de dependencia: `ui → application → domain`; `data` implementa interfaces
que `domain`/`application` definen. La UI nunca llama a Supabase directo.

### Modelo de datos (simplificado)

```
boards            (id, nombre, owner_id, org_id nullable, created_at)
columns           (id, board_id, nombre, orden)
notes             (id, column_id, titulo, descripcion, color, prioridad,
                    tags: text[], fecha_vencimiento, orden, created_at)
checklist_items   (id, note_id, texto, hecho, orden)
```

`org_id` nullable en `boards` desde el día 1 es la decisión clave que evita una
migración dolorosa al pasar de uso personal a equipo/multi-tenant: cuando exista
una organización, se completa esa columna; hasta entonces queda en null y el
tablero pertenece directamente a `owner_id`.

## 3. UI y experiencia

### Tablero (Board)

- Columnas configurables: crear, renombrar, reordenar, borrar
- Notas post-it clásicas: papel amarillo por defecto, color editable por nota,
  ligera rotación aleatoria y sombra (estética de post-it real)
- Cada nota muestra: título, chips de tags, indicador de prioridad, progreso de
  checklist (ej. "2/5"), fecha si tiene
- Drag & drop entre columnas y para reordenar dentro de una columna (dnd-kit)
- Click en una nota abre el editor (modal o panel lateral)

### Navegación

- Sidebar lateral fijo con la lista de tableros del usuario + botón "nuevo tablero"
- Tablero activo resaltado en el sidebar
- Dentro de un tablero: pestañas **Board** / **Calendario** arriba del contenido

### Calendario

- Switch **Mes / Semana** arriba de la vista
- Vista Mes: notas como miniaturas post-it dentro de cada casillero de día
- Vista Semana: notas más grandes y legibles, mismo estilo visual que en el tablero
- Click en una nota en el Calendario abre el mismo editor que en el Board
  (edición consistente entre vistas — una sola fuente de verdad por nota)

### Editor de nota

Modal o panel lateral con: título, descripción (texto largo), color, prioridad
(baja/media/alta), tags (libres), checklist (subtareas con checkbox), fecha de
vencimiento (la fecha es lo que hace que la nota aparezca en el Calendario).

### Responsive

- Prioridad desktop/tablet (uso de gestión de proyectos)
- En mobile: sidebar colapsa a menú hamburguesa; navegación del tablero por
  columna (swipe horizontal) en vez de las columnas en fila

## 4. Testing y manejo de errores

- **Vitest** sobre `domain/`: reglas de reordenamiento de columnas/notas, cálculo
  de qué notas caen en la semana/mes visible del Calendario — sin tocar Supabase
- **Playwright** sobre 2-3 flujos críticos e2e: crear tablero → crear nota →
  arrastrarla de columna → ponerle fecha → verla en el Calendario
- **Validación:** Zod en Server Actions/API routes (título obligatorio, fechas
  válidas, prioridad dentro del enum, etc.)
- **Errores de red/Supabase:** toast no bloqueante; si fue un drag & drop que
  falló al guardar, se revierte visualmente (rollback) y se avisa al usuario
- **Optimistic updates** vía TanStack Query para que drag & drop y edición se
  sientan instantáneos, con rollback automático si el guardado en el server falla

## Decisiones registradas durante el brainstorming

- Estilo de nota: **A — post-it clásico** (papel amarillo, rotación, sombra), no
  tarjeta plana moderna ni doodle hand-drawn
- Navegación entre tableros: **sidebar lateral**, no pestañas ni dropdown
- Convivencia Kanban/Calendario/Gantt: **pestañas de vista** dentro del proyecto
- Calendario: **switch Mes/Semana** (se descartó la vista Agenda-lista)
- Alcance v1: **Kanban + Calendario interno**; Gantt y Google Calendar quedan
  para fases futuras
- Campos de nota en v1: descripción, prioridad, tags y checklist — los cuatro,
  no un subconjunto
- Stack: mismo que KairOS (Next.js + Supabase + Tailwind + Vercel), por
  consistencia y porque destraba el camino a multi-usuario/multi-tenant
