# Kanban Post-it

Gestión de proyectos con tableros Kanban estilo post-it y vista de Calendario (Mes/Semana).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres + Auth), Zod, TanStack Query, dnd-kit.

## Desarrollo local

1. `npm install`
2. Copiar `.env.local.example` a `.env.local` y completar con las credenciales de tu proyecto Supabase
3. Aplicar `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase
4. Crear un usuario en Supabase Auth (Authentication → Users → Add user, con "Auto Confirm User")
5. `npm run dev`

## Tests

- `npm run test` — unit tests (Vitest)
- `npx playwright test` — e2e (requiere `E2E_EMAIL` / `E2E_PASSWORD` de un usuario real en Supabase Auth)

## Deploy

Desplegar en Vercel (mismo flujo que KairOS): conectar el repo, configurar
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variables de entorno de producción.

## Roadmap (fuera de v1)

- Vista Gantt
- Sincronización con Google Calendar
- Multi-usuario (invitaciones, roles) y multi-tenant (organizaciones)
- Navegación mes/semana anterior-siguiente en el Calendario
- UI para renombrar/borrar columnas
