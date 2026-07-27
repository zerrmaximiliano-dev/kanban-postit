# Premium UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Verification note:** This project has no automated UI test suite. Every task's
> verification step is "check in the browser preview" (start the `kanban-postit-dev`
> preview, navigate to the relevant page, confirm visually + check console for errors)
> instead of a unit test — this matches how every prior session in this codebase has
> verified UI/CSS work. `npx tsc --noEmit` must pass with zero errors after every task.

**Goal:** Redesign the entire kanban-postit UI to the premium petrol/turquoise design
system approved in `docs/superpowers/specs/2026-07-27-premium-redesign-design.md`.

**Architecture:** Add design tokens as Tailwind v4 `@theme` CSS variables in
`app/globals.css` (no separate Tailwind config file exists — this project uses Tailwind
v4's CSS-first config, already the pattern for the existing `--font-*` variables). Build a
small shared component library under `src/modules/ui/` (Button, Input, Badge, Toast,
EmptyState). Then apply the new tokens/components screen by screen, verifying each in the
browser before moving on.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, React (no new
dependencies — no icon library is installed, so this plan uses small inline SVG icons
instead of pulling in `lucide-react`/`heroicons`).

---

## File Structure

New files:
- `src/modules/ui/Button.tsx` — shared button (primary/secondary/ghost/danger, loading state)
- `src/modules/ui/Input.tsx` — shared labeled text input with error state
- `src/modules/ui/Badge.tsx` — shared pill badge (neutral/accent/danger)
- `src/modules/ui/Toast.tsx` — toast primitive + `ToastProvider`/`useToast` hook
- `src/modules/ui/EmptyState.tsx` — icon + message + optional action
- `src/modules/ui/icons.tsx` — small inline SVG icon set used across the redesign

Modified files (one task each, in dependency order):
- `app/globals.css` — design tokens
- `src/modules/boards/domain/palette.ts` — `DEFAULT_BASE` update
- `app/layout.tsx` — wrap app in `ToastProvider`
- `src/modules/boards/ui/Sidebar.tsx`
- `src/modules/boards/ui/BoardHeader.tsx`
- `src/modules/boards/ui/BoardTabs.tsx`
- `src/modules/boards/ui/BoardView.tsx` (BoardColumn + note-list chrome)
- `src/modules/boards/ui/NoteCard.tsx`
- `src/modules/boards/ui/NoteEditor.tsx` (modal → drawer)
- `src/modules/boards/ui/MiniCalendarPanel.tsx`
- `src/modules/calendar/ui/CalendarView.tsx`
- `app/(auth)/login/page.tsx`
- `app/(app)/boards/page.tsx` (empty state)

---

### Task 1: Design tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the token block**

Open `app/globals.css`. It currently ends with:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), -apple-system, "Helvetica Neue", Arial, sans-serif;
  color-scheme: light;
}
```

Replace the whole file with:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #101828;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-note: var(--font-caveat);

  /* Neutral surface/text scale */
  --color-page: #fafbfc;
  --color-surface: #ffffff;
  --color-border: #e4e7ec;
  --color-border-strong: #d0d5dd;
  --color-ink: #101828;
  --color-ink-muted: #475467;
  --color-ink-faint: #98a2b3;

  /* Single accent (independent of per-board color) */
  --color-accent-100: #ccfbf1;
  --color-accent-500: #14b8a6;
  --color-accent-600: #0f9488;

  /* Feedback colors */
  --color-success: #12b76a;
  --color-success-bg: #ecfdf3;
  --color-danger: #f04438;
  --color-danger-bg: #fef3f2;
  --color-warning: #f79009;
  --color-warning-bg: #fffaeb;

  /* Radius */
  --radius-control: 10px;
  --radius-card: 16px;

  /* Shadows */
  --shadow-elevation-sm: 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-elevation-md: 0 4px 12px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04);

  /* Motion */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  background: var(--color-page);
  color: var(--color-ink);
  font-family: var(--font-inter), -apple-system, "Helvetica Neue", Arial, sans-serif;
  color-scheme: light;
}

@property --reveal {
  syntax: '<percentage>';
  initial-value: 0%;
  inherits: false;
}
```

This generates Tailwind utilities: `bg-page`, `bg-surface`, `border-border`,
`border-border-strong`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `bg-accent-100`,
`bg-accent-500` / `text-accent-500` / `border-accent-500`, `bg-accent-600`, `bg-success`,
`bg-success-bg`, `text-success`, `bg-danger`, `bg-danger-bg`, `text-danger`, `bg-warning`,
`bg-warning-bg`, `text-warning`, `rounded-control`, `rounded-card`,
`shadow-elevation-sm`, `shadow-elevation-md`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors — this is a CSS-only change, just confirming
nothing else broke). Start the preview (`kanban-postit-dev`), open any page, confirm the
page background is the new very-light `#fafbfc` instead of pure white and there are no
console errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add premium design system tokens (color, radius, shadow, motion)"
```

---

### Task 2: Update default board color to petrol blue

**Files:**
- Modify: `src/modules/boards/domain/palette.ts:12`

- [ ] **Step 1: Change `DEFAULT_BASE`**

Find:

```ts
const DEFAULT_BASE = '#5B6B8C';
```

Replace with:

```ts
const DEFAULT_BASE = '#1B4B5A';
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser, open a board that has never
had a custom color set — its header/sidebar should now render in a petrol-blue tone
instead of the old blue-gray.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/domain/palette.ts
git commit -m "Default board theme to petrol blue instead of blue-gray"
```

---

### Task 3: Shared icon set

**Files:**
- Create: `src/modules/ui/icons.tsx`

- [ ] **Step 1: Write the icon components**

```tsx
'use client';

type IconProps = { className?: string };

const base = 'h-4 w-4';

export function ChevronLeftIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronsLeftIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M11 15L6 10L11 5M16 15L11 10L16 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronsRightIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M9 15L14 10L9 5M4 15L9 10L4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6M6 6l.6 9.4a1 1 0 001 .9h4.8a1 1 0 001-.9L14 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoreIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="10" cy="15.5" r="1.4" />
    </svg>
  );
}

export function PlusIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PaletteIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 3a7 7 0 100 14c.83 0 1.4-.7 1.15-1.48-.13-.4-.4-.74-.4-1.17 0-.6.5-1.1 1.1-1.1h1.3a2.85 2.85 0 002.85-2.85A6.98 6.98 0 0010 3z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="7.2" cy="8.2" r="0.9" fill="currentColor" />
      <circle cx="10.4" cy="6.6" r="0.9" fill="currentColor" />
      <circle cx="13.2" cy="8.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function CalendarIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 8h13M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M17.5 10a7.5 7.5 0 00-7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 11.5l1.6-6.1A1.5 1.5 0 016.55 4.2h6.9a1.5 1.5 0 011.45 1.2l1.6 6.1M3.5 11.5v3a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-3M3.5 11.5H7l.7 1.5h4.6l.7-1.5h3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors — this file isn't imported yet, so this only
checks it compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ui/icons.tsx
git commit -m "Add shared inline icon set for the redesign"
```

---

### Task 4: Button primitive

**Files:**
- Create: `src/modules/ui/Button.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { SpinnerIcon } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-500 shadow-elevation-sm hover:shadow-elevation-md',
  secondary:
    'bg-surface text-ink border border-border hover:border-border-strong focus-visible:ring-accent-500',
  ghost: 'bg-transparent text-ink-muted hover:bg-black/5 hover:text-ink focus-visible:ring-accent-500',
  danger:
    'bg-transparent text-danger border border-danger/30 hover:bg-danger-bg focus-visible:ring-danger',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <SpinnerIcon className="h-4 w-4" />}
      {children}
    </button>
  );
});
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ui/Button.tsx
git commit -m "Add shared Button primitive with variants and loading state"
```

---

### Task 5: Input primitive

**Files:**
- Create: `src/modules/ui/Input.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-ink-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink placeholder-ink-faint transition-[border-color,box-shadow] duration-150 ease-standard focus:outline-none focus:ring-2 focus:ring-offset-0 ${
          error
            ? 'border-danger focus:ring-danger'
            : 'border-border focus:border-accent-500 focus:ring-accent-100'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ui/Input.tsx
git commit -m "Add shared Input primitive with label and error state"
```

---

### Task 6: Badge primitive

**Files:**
- Create: `src/modules/ui/Badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'accent' | 'danger';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-page text-ink-muted border border-border',
  accent: 'bg-accent-100 text-accent-600',
  danger: 'bg-danger-bg text-danger',
};

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ui/Badge.tsx
git commit -m "Add shared Badge primitive"
```

---

### Task 7: Toast primitive + provider

**Files:**
- Create: `src/modules/ui/Toast.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the toast provider**

```tsx
'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastVariant = 'success' | 'danger';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-72 rounded-card border px-4 py-3 text-sm shadow-elevation-md transition-all duration-200 ease-standard animate-[toast-in_200ms_ease-standard] ${
              toast.variant === 'success'
                ? 'border-success/20 bg-success-bg text-success'
                : 'border-danger/20 bg-danger-bg text-danger'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Register the `toast-in` keyframe**

Open `app/globals.css`. After the `@property --reveal { ... }` block added in Task 1, add:

```css
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Wrap the app in `ToastProvider`**

Open `app/layout.tsx`. Find:

```tsx
import { AppQueryProvider } from "@/src/lib/queryClient";
```

Add below it:

```tsx
import { ToastProvider } from "@/src/modules/ui/Toast";
```

Find:

```tsx
      <body className="min-h-full flex flex-col">
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
```

Replace with:

```tsx
      <body className="min-h-full flex flex-col">
        <AppQueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppQueryProvider>
      </body>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser, confirm the app still loads
with no console errors (the toast stack renders empty/invisible until `showToast` is
called — nothing to see yet, this just wires the plumbing).

- [ ] **Step 5: Commit**

```bash
git add src/modules/ui/Toast.tsx app/globals.css app/layout.tsx
git commit -m "Add Toast primitive and wire ToastProvider into the app root"
```

---

### Task 8: EmptyState primitive

**Files:**
- Create: `src/modules/ui/EmptyState.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-600">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/ui/EmptyState.tsx
git commit -m "Add shared EmptyState primitive"
```

---

### Task 9: Redesign Sidebar

**Files:**
- Modify: `src/modules/boards/ui/Sidebar.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useBoards, useCreateBoard, useDeleteBoard } from './useBoards';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';
import { useToast } from '@/src/modules/ui/Toast';
import { ChevronsLeftIcon, ChevronsRightIcon, TrashIcon } from '@/src/modules/ui/icons';
import type { Board } from '../domain/types';

export function Sidebar() {
  const { data: boards, isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();
  const pathname = usePathname();
  const router = useRouter();
  const { boardColor } = useBoardTheme();
  const { showToast } = useToast();
  const [newBoardName, setNewBoardName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    createBoard.mutate(name, {
      onSuccess: () => {
        setNewBoardName('');
        showToast('Tablero creado');
      },
      onError: () => showToast('No se pudo crear el tablero', 'danger'),
    });
  }

  function handleDelete(board: Board) {
    if (!window.confirm(`¿Eliminar el tablero "${board.name}" y todo su contenido? Esta acción no se puede deshacer.`)) {
      return;
    }
    deleteBoard.mutate(board.id, {
      onSuccess: () => {
        if (pathname?.startsWith(`/boards/${board.id}`)) {
          router.push('/boards');
        }
      },
    });
  }

  const background = boardColor ? getBoardPalette(boardColor).dark : '#1B4B5A';

  if (collapsed) {
    return (
      <aside
        className="flex h-screen w-12 shrink-0 flex-col items-center gap-3 py-4 text-white"
        style={{ background: `linear-gradient(180deg, ${background}, color-mix(in srgb, ${background} 80%, black))` }}
      >
        <div className="h-6 w-6 rounded-control bg-accent-500" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-control p-1.5 text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
          aria-label="Mostrar barra lateral"
        >
          <ChevronsRightIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col gap-4 p-4 text-white"
      style={{ background: `linear-gradient(180deg, ${background}, color-mix(in srgb, ${background} 80%, black))` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-control bg-accent-500" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/70">Tableros</h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-control p-1.5 text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
          aria-label="Ocultar barra lateral"
        >
          <ChevronsLeftIcon />
        </button>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <Input
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Nuevo tablero..."
          className="border-white/15 bg-white/10 text-white placeholder-white/50 focus:border-accent-500 focus:ring-accent-500/30"
        />
        <Button type="submit" loading={createBoard.isPending} disabled={createBoard.isPending}>
          {createBoard.isPending ? 'Creando...' : 'Crear tablero'}
        </Button>
      </form>

      {isLoading && <p className="px-1 text-sm text-white/70">Cargando...</p>}

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {boards?.map((board) => {
          const isActive = pathname?.startsWith(`/boards/${board.id}`);
          return (
            <div
              key={board.id}
              className={`group flex items-center rounded-control transition-colors duration-150 ease-standard ${
                isActive ? 'bg-white/15' : 'hover:bg-white/10'
              }`}
              style={isActive ? { boxShadow: 'inset 3px 0 0 0 var(--color-accent-500)' } : undefined}
            >
              <Link href={`/boards/${board.id}`} className="flex-1 truncate px-3 py-2 text-sm">
                {board.name}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(board)}
                className="hidden px-2 text-white/70 transition-colors duration-150 ease-standard hover:text-danger group-hover:block"
                aria-label={`Eliminar tablero ${board.name}`}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

Note: `color-mix()` is used for the gradient's darker stop — this is supported in all
evergreen browsers (Chrome 111+, Firefox 113+, Safari 16.2+) and needs no build config.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the sidebar shows a
petrol gradient, the accent-colored logo square, the "Crear tablero" button is now the
shared filled `Button`, creating a board shows a toast, the collapse/expand icons are now
chevrons (not `«`/`»`), and the active board row shows a left accent bar.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/Sidebar.tsx
git commit -m "Redesign Sidebar with premium tokens and shared primitives"
```

---

### Task 10: Redesign BoardHeader

**Files:**
- Modify: `src/modules/boards/ui/BoardHeader.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard, updateBoardColor } from '../application/boardService';
import { getBoardPalette, BOARD_COLOR_PRESETS } from '../domain/palette';
import { useBoardTheme } from './BoardThemeContext';
import { PaletteIcon } from '@/src/modules/ui/icons';

export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBoard(supabase, boardId).then((board) => {
      if (!cancelled) {
        setName(board.name);
        setDraft(board.name);
        setColor(board.color);
        setBoardColor(board.color);
      }
    });
    return () => {
      cancelled = true;
      setBoardColor(null);
    };
  }, [boardId]);

  function commitRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name ?? '');
      return;
    }
    setName(trimmed);
    renameBoard(supabase, boardId, trimmed).then(() => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    });
  }

  function handlePickColor(newColor: string) {
    setColor(newColor);
    setBoardColor(newColor);
    setPickerOpen(false);
    updateBoardColor(supabase, boardId, newColor);
  }

  if (name === null) return null;

  const palette = getBoardPalette(color);

  return (
    <div
      className="relative flex items-center gap-3 px-6 py-4"
      style={{ backgroundColor: palette.dark }}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="rounded-control border border-white/30 bg-white/10 px-2 py-1 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      ) : (
        <h1
          onClick={() => setEditing(true)}
          className="cursor-text text-2xl font-bold text-white"
          title="Click para renombrar el tablero"
        >
          {name}
        </h1>
      )}

      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-white/25 bg-white/10 text-white transition-colors duration-150 ease-standard hover:bg-white/20"
          aria-label="Cambiar color del tablero"
          title="Cambiar color del tablero"
        >
          <PaletteIcon />
        </button>
        {pickerOpen && (
          <div className="absolute right-0 top-11 z-10 w-64 rounded-card border border-border bg-surface p-3 shadow-elevation-md">
            <p className="mb-2 text-xs font-medium text-ink-muted">Color del tablero</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => handlePickColor(preset.color)}
                  style={{ backgroundColor: preset.color }}
                  className={`h-7 w-7 rounded-full transition-transform duration-150 ease-standard hover:scale-110 ${
                    color === preset.color ? 'ring-2 ring-accent-500 ring-offset-2' : 'ring-1 ring-black/10'
                  }`}
                  aria-label={`Color ${preset.name}`}
                  title={preset.name}
                />
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-ink-muted">
              Personalizado
              <input
                type="color"
                value={color ?? '#1B4B5A'}
                onChange={(e) => handlePickColor(e.target.value)}
                aria-label="Color personalizado del tablero"
                className="h-7 w-9 cursor-pointer rounded-control border border-border p-0"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the header title is
larger, the color trigger is now a palette icon button, and clicking it opens a card-style
popover (rounded, shadowed, labeled custom-color input) instead of the old bare row of
dots.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/BoardHeader.tsx
git commit -m "Redesign BoardHeader with icon button trigger and card-style color popover"
```

---

### Task 11: Redesign BoardTabs as a segmented control

**Files:**
- Modify: `src/modules/boards/ui/BoardTabs.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BoardTabs({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname?.endsWith('/calendar');

  return (
    <div className="flex gap-6 border-b border-border bg-surface px-6">
      <Link
        href={`/boards/${boardId}`}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          !isCalendar ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Board
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isCalendar ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Calendario
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the tabs are now an
underline style (turquoise underline on the active tab) on a white bar, replacing the old
"active tab gets a white background" look.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/BoardTabs.tsx
git commit -m "Redesign BoardTabs as an underline segmented control"
```

---

### Task 12: Redesign BoardColumn and note-list chrome

**Files:**
- Modify: `src/modules/boards/ui/BoardView.tsx`

- [ ] **Step 1: Update imports**

Find:

```tsx
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { BoardTabs } from './BoardTabs';
import { BoardHeader } from './BoardHeader';
import { MiniCalendarPanel } from './MiniCalendarPanel';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import type { Column, Note, ChecklistItem } from '../domain/types';
```

Replace with:

```tsx
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { BoardTabs } from './BoardTabs';
import { BoardHeader } from './BoardHeader';
import { MiniCalendarPanel } from './MiniCalendarPanel';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import { Badge } from '@/src/modules/ui/Badge';
import { MoreIcon, PlusIcon } from '@/src/modules/ui/icons';
import type { Column, Note, ChecklistItem } from '../domain/types';
```

- [ ] **Step 2: Redesign the `BoardColumn` header row and container**

Find the `BoardColumn` function's return statement (the outer `<div>` through the column
header `</div>`):

```tsx
  return (
    <div
      className="flex h-full w-64 shrink-0 flex-col rounded-lg bg-white p-3 shadow-sm"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between pb-1.5">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setName(column.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm font-bold text-gray-800"
          />
        ) : (
          <h3
            onClick={() => setEditing(true)}
            className="cursor-text text-sm font-bold uppercase tracking-wide text-gray-700"
            title="Click para renombrar"
          >
            {column.name}
          </h3>
        )}
        <button
          type="button"
          onClick={() => onDeleteColumn(column)}
          className="ml-2 text-gray-400 hover:text-red-600"
          aria-label={`Eliminar columna ${column.name}`}
        >
          🗑
        </button>
      </div>
```

Replace with:

```tsx
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="flex h-full w-72 shrink-0 flex-col rounded-card bg-surface p-4 shadow-elevation-sm transition-shadow duration-200 ease-standard"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div className="relative mb-3 flex shrink-0 items-center justify-between pb-1.5">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setName(column.name);
                setEditing(false);
              }
            }}
            className="w-full rounded-control border border-border px-2 py-1 text-sm font-bold text-ink"
          />
        ) : (
          <div className="flex items-center gap-2">
            <h3
              onClick={() => setEditing(true)}
              className="cursor-text text-xs font-bold uppercase tracking-wide text-ink-muted"
              title="Click para renombrar"
            >
              {column.name}
            </h3>
            <Badge>{notes.length}</Badge>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-control p-1 text-ink-faint transition-colors duration-150 ease-standard hover:bg-black/5 hover:text-ink"
          aria-label={`Opciones de la columna ${column.name}`}
        >
          <MoreIcon />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-10 w-40 rounded-control border border-border bg-surface py-1 shadow-elevation-md">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-page"
            >
              Renombrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDeleteColumn(column);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger-bg"
            >
              Eliminar columna
            </button>
          </div>
        )}
      </div>
```

- [ ] **Step 3: Redesign the note-list container and "+ Nueva nota" button**

Find:

```tsx
      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDroppableRef}
          className={`min-h-[3rem] flex-1 overflow-x-hidden overflow-y-auto rounded px-1 ${isOver ? 'bg-sky-50' : ''}`}
        >
          {notes.map((note) => (
            <SortableNote key={note.id} note={note} onOpen={onOpenNote} onDelete={onDeleteNote} />
          ))}
        </div>
      </SortableContext>

      <button
        onClick={() => onAddNote(column.id)}
        className="mt-1 w-full shrink-0 rounded py-1 text-left text-sm text-gray-400 hover:bg-gray-100"
      >
        + Nueva nota
      </button>
    </div>
  );
}
```

Replace with:

```tsx
      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDroppableRef}
          className={`min-h-[3rem] flex-1 overflow-x-hidden overflow-y-auto rounded-control px-1 transition-colors duration-150 ease-standard ${
            isOver ? 'bg-accent-100/40' : ''
          }`}
        >
          {notes.map((note) => (
            <SortableNote key={note.id} note={note} onOpen={onOpenNote} onDelete={onDeleteNote} />
          ))}
        </div>
      </SortableContext>

      <button
        onClick={() => onAddNote(column.id)}
        className="mt-1 flex w-full shrink-0 items-center gap-1.5 rounded-control py-1.5 text-left text-sm text-ink-faint transition-colors duration-150 ease-standard hover:bg-page hover:text-ink-muted"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Nueva nota
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (expected: no errors — `useState` is already imported at the top of
`BoardView.tsx` from React, confirm this by checking the existing `import { useEffect,
useState } from 'react';` line is still present). In the browser: confirm each column is a
white rounded-16px card with soft shadow, the header shows a note-count badge, the trash
emoji is replaced by a kebab-menu icon that opens a Rename/Eliminar menu, and "+ Nueva
nota" has a plus icon.

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/ui/BoardView.tsx
git commit -m "Redesign BoardColumn chrome: card styling, count badge, kebab menu"
```

---

### Task 13: Redesign NoteCard chrome (keep post-it identity)

**Files:**
- Modify: `src/modules/boards/ui/NoteCard.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import type { Note } from '../domain/types';
import { TrashIcon } from '@/src/modules/ui/icons';

const PRIORITY_LABEL: Record<Note['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const PRIORITY_DOT: Record<Note['priority'], string> = {
  low: 'bg-ink-faint',
  medium: 'bg-warning',
  high: 'bg-danger',
};

const TILT_ANGLES = [-3, -1.5, 0, 1.5, 3];

function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TILT_ANGLES[Math.abs(hash) % TILT_ANGLES.length];
}

export function NoteCard({
  note,
  onOpen,
  onDelete,
  deleteLabel = 'Eliminar nota',
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onDelete?: (note: Note) => void;
  deleteLabel?: string;
}) {
  const doneCount = note.checklist.filter((c) => c.done).length;
  const progress = note.checklist.length > 0 ? (doneCount / note.checklist.length) * 100 : 0;

  return (
    <div
      onDoubleClick={() => onOpen(note)}
      style={{ backgroundColor: note.color, transform: `rotate(${tiltFor(note.id)}deg)` }}
      className="group relative mb-3 cursor-pointer rounded-[2px] p-3 text-sm shadow-elevation-sm transition-[transform,box-shadow] duration-150 ease-standard hover:-translate-y-0.5 hover:shadow-elevation-md"
    >
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note);
          }}
          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/10 text-ink transition-colors duration-150 ease-standard hover:bg-black/20 group-hover:flex"
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}

      <p className="font-note pr-4 text-lg font-bold leading-tight text-gray-900">{note.title}</p>

      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[note.priority]}`} />
        <span>{PRIORITY_LABEL[note.priority]}</span>
      </div>

      {note.checklist.length > 0 && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-black/40 transition-[width] duration-200 ease-standard"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-700">
            {doneCount}/{note.checklist.length} tareas
          </p>
        </div>
      )}

      {note.startDate && (
        <p className="mt-1 text-xs text-gray-600">
          {note.startDate}
          {note.endDate && note.endDate !== note.startDate ? ` → ${note.endDate}` : ''}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm notes keep their
tilt/color/Caveat title, the delete "×" is now a proper trash icon button, priority shows a
small colored dot, and a note with checklist items shows a thin progress bar above the
"x/y tareas" text.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/NoteCard.tsx
git commit -m "Redesign NoteCard chrome: icon delete button, priority dot, checklist progress bar"
```

---

### Task 14: Convert NoteEditor from centered modal to a right-side drawer

**Files:**
- Modify: `src/modules/boards/ui/NoteEditor.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useState } from 'react';
import type { ChecklistItem, Note, Priority } from '../domain/types';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';
import { TrashIcon } from '@/src/modules/ui/icons';

const COLORS = ['#FDE8C8', '#FBD4D4', '#D6ECD2', '#CFE3F5', '#E6D9F2', '#FCF4CB'];

export function NoteEditor({
  note,
  onClose,
  onSave,
  onDelete,
  onAddChecklistItem,
  onToggleChecklistItem,
  onEditChecklistItemText,
  onDeleteChecklistItem,
}: {
  note: Note;
  onClose: () => void;
  onSave: (update: {
    title: string;
    description: string;
    color: string;
    priority: Priority;
    tags: string[];
    startDate: string | null;
    endDate: string | null;
  }) => void;
  onDelete?: () => void;
  onAddChecklistItem?: (text: string) => Promise<ChecklistItem>;
  onToggleChecklistItem?: (item: ChecklistItem, done: boolean) => void;
  onEditChecklistItemText?: (item: ChecklistItem, text: string) => void;
  onDeleteChecklistItem?: (item: ChecklistItem) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [color, setColor] = useState(note.color);
  const [priority, setPriority] = useState<Priority>(note.priority);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [startDate, setStartDate] = useState(note.startDate ?? '');
  const [endDate, setEndDate] = useState(note.endDate ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist);
  const [newItemText, setNewItemText] = useState('');

  function handleSave() {
    onSave({
      title: title.trim(),
      description,
      color,
      priority,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      startDate: startDate || null,
      endDate: endDate || null,
    });
    onClose();
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(`¿Eliminar la nota "${note.title}"? Esta acción no se puede deshacer.`)) return;
    onDelete();
    onClose();
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text || !onAddChecklistItem) return;
    setNewItemText('');
    const item = await onAddChecklistItem(text);
    setChecklist((prev) => [...prev, item]);
  }

  function handleToggleItem(item: ChecklistItem) {
    const done = !item.done;
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done } : i)));
    onToggleChecklistItem?.(item, done);
  }

  function handleEditItemText(item: ChecklistItem, text: string) {
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, text } : i)));
  }

  function commitItemText(item: ChecklistItem) {
    const current = checklist.find((i) => i.id === item.id);
    if (current) onEditChecklistItemText?.(item, current.text);
  }

  function handleDeleteItem(item: ChecklistItem) {
    setChecklist((prev) => prev.filter((i) => i.id !== item.id));
    onDeleteChecklistItem?.(item);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: `radial-gradient(ellipse at top right, ${color}33 0%, var(--color-surface) 55%)` }}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto p-6 shadow-elevation-md animate-[drawer-in_250ms_ease-standard]"
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} label="Título" placeholder="Título de la nota" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink transition-[border-color,box-shadow] duration-150 ease-standard focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            rows={3}
            placeholder="Descripción / observaciones"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Color</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                className={`h-7 w-7 rounded-full transition-transform duration-150 ease-standard hover:scale-110 ${
                  color === c ? 'ring-2 ring-accent-500 ring-offset-2' : 'ring-1 ring-black/10'
                }`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Color personalizado"
              className="h-7 w-9 cursor-pointer rounded-control border border-border p-0"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Prioridad</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          >
            <option value="low">Prioridad baja</option>
            <option value="medium">Prioridad media</option>
            <option value="high">Prioridad alta</option>
          </select>
        </div>

        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} label="Tags" placeholder="Separados por coma" />

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Fechas (para el calendario)</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
              aria-label="Fecha de inicio"
            />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
              aria-label="Fecha de fin"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Lista de tareas</p>
          <div className="space-y-1">
            {checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-control px-1 py-0.5 hover:bg-page">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleToggleItem(item)}
                  className="h-4 w-4 shrink-0 accent-accent-500"
                />
                <input
                  value={item.text}
                  onChange={(e) => handleEditItemText(item, e.target.value)}
                  onBlur={() => commitItemText(item)}
                  className={`w-full rounded-control border-none bg-transparent px-1 py-0.5 text-sm text-ink focus:bg-surface focus:ring-1 focus:ring-border-strong ${
                    item.done ? 'text-ink-faint line-through' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item)}
                  className="shrink-0 text-ink-faint opacity-0 transition-opacity duration-150 ease-standard hover:text-danger group-hover:opacity-100"
                  aria-label="Eliminar tarea"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddItem} className="mt-2 flex gap-2">
            <input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Agregar tarea"
              className="w-full rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              Agregar
            </Button>
          </form>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          {onDelete ? (
            <Button variant="danger" onClick={handleDelete}>
              <TrashIcon className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the `drawer-in` keyframe**

Open `app/globals.css`. After the `toast-in` keyframe added in Task 7, add:

```css
@keyframes drawer-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: open a note (double-click a
card) and confirm it now slides in as a right-side drawer over a blurred backdrop instead
of appearing as a centered modal, all fields use the shared `Input`, and the footer buttons
use the shared `Button` variants (danger/ghost/primary).

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/ui/NoteEditor.tsx app/globals.css
git commit -m "Convert NoteEditor from centered modal to a right-side drawer"
```

---

### Task 15: Redesign MiniCalendarPanel

**Files:**
- Modify: `src/modules/boards/ui/MiniCalendarPanel.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { getMonthRange, getMonthLeadingBlankDays } from '@/src/modules/calendar/domain/bucketing';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@/src/modules/ui/icons';
import type { Note } from '../domain/types';

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function DayDropCell({ date, count }: { date: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `calendar-day:${date}`, data: { type: 'calendar-day', date } });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-control border text-xs transition-[transform,border-color,background-color] duration-150 ease-standard ${
        isOver ? 'scale-110 border-accent-500 bg-accent-100/50' : 'border-border bg-surface'
      }`}
    >
      <span className="text-ink-muted">{date.slice(8, 10)}</span>
      {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />}
    </div>
  );
}

export function MiniCalendarPanel({ notes, accentColor }: { notes: Note[]; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());

  const range = getMonthRange(cursor.getFullYear(), cursor.getMonth());
  const leadingBlanks = getMonthLeadingBlankDays(cursor.getFullYear(), cursor.getMonth());

  const days: string[] = [];
  for (const d = new Date(range.start); d <= range.end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  function countForDay(date: string): number {
    return notes.filter((n) => n.startDate && n.startDate <= date && (n.endDate ?? n.startDate) >= date).length;
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 w-72 rounded-card bg-surface shadow-elevation-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-t-card px-3 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-standard"
        style={{ backgroundColor: accentColor }}
      >
        <CalendarIcon className="h-4 w-4" />
        <span className="flex-1 text-left">Abrí y arrastrá una nota aquí</span>
        <ChevronRightIcon className={`h-4 w-4 transition-transform duration-200 ease-standard ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:bg-page hover:text-ink"
              aria-label="Mes anterior"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <p className="text-xs font-semibold text-ink">
              {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:bg-page hover:text-ink"
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-[10px] font-bold uppercase text-ink-faint">
                {label}
              </p>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((date) => (
              <DayDropCell key={date} date={date} count={countForDay(date)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the panel is now a
floating card with a calendar icon in its header bar, day cells use the new hover/isOver
ring styling, and month nav uses chevron icons.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/MiniCalendarPanel.tsx
git commit -m "Redesign MiniCalendarPanel as a floating card with icon nav"
```

---

### Task 16: Redesign CalendarView

**Files:**
- Modify: `src/modules/calendar/ui/CalendarView.tsx`

- [ ] **Step 1: Update imports**

Find:

```tsx
import { NoteCard } from '@/src/modules/boards/ui/NoteCard';
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import { BoardHeader } from '@/src/modules/boards/ui/BoardHeader';
import { useBoardTheme } from '@/src/modules/boards/ui/BoardThemeContext';
import { getBoardPalette } from '@/src/modules/boards/domain/palette';
import type { ChecklistItem, Note } from '@/src/modules/boards/domain/types';
```

Replace with:

```tsx
import { NoteCard } from '@/src/modules/boards/ui/NoteCard';
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import { BoardHeader } from '@/src/modules/boards/ui/BoardHeader';
import { useBoardTheme } from '@/src/modules/boards/ui/BoardThemeContext';
import { getBoardPalette } from '@/src/modules/boards/domain/palette';
import { ChevronLeftIcon, ChevronRightIcon } from '@/src/modules/ui/icons';
import type { ChecklistItem, Note } from '@/src/modules/boards/domain/types';
```

- [ ] **Step 2: Redesign the Mes/Semana toggle and nav row**

Find:

```tsx
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('month')}
              className={`rounded px-3 py-1 text-sm ${mode === 'month' ? 'bg-black text-white' : 'bg-gray-200'}`}
            >
              Mes
            </button>
            <button
              onClick={() => setMode('week')}
              className={`rounded px-3 py-1 text-sm ${mode === 'week' ? 'bg-black text-white' : 'bg-gray-200'}`}
            >
              Semana
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPrevious}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
              aria-label="Anterior"
            >
              ‹
            </button>
            <p className="min-w-[9rem] text-center text-sm font-semibold text-gray-700">{rangeLabel}</p>
            <button
              type="button"
              onClick={goToNext}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
              aria-label="Siguiente"
            >
              ›
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 rounded px-2 py-1 text-xs text-gray-500 underline hover:text-gray-800"
            >
              Hoy
            </button>
          </div>
        </div>
```

Replace with:

```tsx
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
          <div className="flex gap-4 border-b border-border">
            <button
              onClick={() => setMode('month')}
              className={`border-b-2 py-2 text-sm font-medium transition-colors duration-150 ease-standard ${
                mode === 'month' ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setMode('week')}
              className={`border-b-2 py-2 text-sm font-medium transition-colors duration-150 ease-standard ${
                mode === 'week' ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Semana
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevious}
              className="rounded-control p-1.5 text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface hover:text-ink"
              aria-label="Anterior"
            >
              <ChevronLeftIcon />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-semibold text-ink">{rangeLabel}</p>
            <button
              type="button"
              onClick={goToNext}
              className="rounded-control p-1.5 text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface hover:text-ink"
              aria-label="Siguiente"
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-2 rounded-control px-2 py-1 text-xs font-medium text-accent-600 transition-colors duration-150 ease-standard hover:bg-accent-100"
            >
              Hoy
            </button>
          </div>
        </div>
```

- [ ] **Step 3: Redesign day cells and the "+N más" pill**

Find (inside the `DayCell` function):

```tsx
  return (
    <div ref={setNodeRef} className={`min-h-24 rounded p-1.5 shadow-sm ${isOver ? 'bg-sky-50' : 'bg-white'}`}>
      <p className="mb-1 text-xs text-gray-400">{bucket.date.slice(8, 10)}</p>
      {visibleNotes.map((note) => (
        <DraggableNote key={note.id} note={note} onOpen={onOpenNote} onUnschedule={onUnscheduleNote} />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded py-0.5 text-left text-[10px] font-medium text-gray-500 hover:bg-gray-100"
        >
          +{hiddenCount} más
        </button>
      )}
      {expanded && bucket.notes.length > MAX_VISIBLE_NOTES && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded py-0.5 text-left text-[10px] font-medium text-gray-500 hover:bg-gray-100"
        >
          Ver menos
        </button>
      )}
    </div>
  );
```

Replace with:

```tsx
  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 rounded-control p-2 shadow-elevation-sm transition-[box-shadow,background-color] duration-150 ease-standard hover:shadow-elevation-md ${
        isOver ? 'bg-accent-100/40' : 'bg-surface'
      }`}
    >
      <p className="mb-1 text-xs text-ink-faint">{bucket.date.slice(8, 10)}</p>
      {visibleNotes.map((note) => (
        <DraggableNote key={note.id} note={note} onOpen={onOpenNote} onUnschedule={onUnscheduleNote} />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-full bg-page px-2 py-0.5 text-left text-[10px] font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-accent-100 hover:text-accent-600"
        >
          +{hiddenCount} más
        </button>
      )}
      {expanded && bucket.notes.length > MAX_VISIBLE_NOTES && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded-full px-2 py-0.5 text-left text-[10px] font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-page"
        >
          Ver menos
        </button>
      )}
    </div>
  );
```

- [ ] **Step 4: Redesign the weekday header row**

Find:

```tsx
          <div className="mb-1 grid shrink-0 grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-xs font-bold uppercase text-gray-500">
                {label}
              </p>
            ))}
          </div>
```

Replace with:

```tsx
          <div className="mb-1 grid shrink-0 grid-cols-7 gap-2 border-b border-border pb-2">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-xs font-bold uppercase text-ink-faint">
                {label}
              </p>
            ))}
          </div>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the Mes/Semana
toggle now matches the BoardTabs underline style, day cells have soft shadows with hover
elevation, the "+N más" control is a pill, and the weekday row has a subtle bottom border.

- [ ] **Step 6: Commit**

```bash
git add src/modules/calendar/ui/CalendarView.tsx
git commit -m "Redesign CalendarView: segmented toggle, card day cells, pill overflow control"
```

---

### Task 17: Redesign Login/Signup page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';

export default function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === 'signUp') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setInfo('Cuenta creada. Revisá tu email para confirmar antes de iniciar sesión.');
        setLoading(false);
        return;
      }
      router.push('/boards');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/boards');
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.08), transparent 45%), radial-gradient(circle at 80% 0%, rgba(27,75,90,0.10), transparent 40%), radial-gradient(circle, #e4e7ec 1px, transparent 1px)',
        backgroundSize: 'auto, auto, 22px 22px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-96 space-y-4 rounded-card border border-border bg-surface p-8 shadow-elevation-md"
      >
        <div className="mb-2">
          <div className="mb-3 h-8 w-8 rounded-control bg-accent-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ink">
            {mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === 'signIn' ? 'Ingresá a tus tableros.' : 'Empezá a organizar tus proyectos.'}
          </p>
        </div>

        <Input
          type="email"
          label="Email"
          placeholder="vos@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          label="Contraseña"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="rounded-control border border-danger/20 bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-control border border-success/20 bg-success-bg px-3 py-2 text-sm text-success">
            {info}
          </div>
        )}

        <Button type="submit" loading={loading} disabled={loading} className="w-full">
          {mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
            setInfo(null);
          }}
          className="w-full text-center text-sm text-ink-muted transition-colors duration-150 ease-standard hover:text-accent-600"
        >
          {mode === 'signIn' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: confirm the login page shows
a soft radial-gradient + faint dot-pattern background (not flat gray), a card with shadow,
and the shared `Input`/`Button` primitives with a loading spinner on submit.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "Redesign login/signup page with premium background and shared primitives"
```

---

### Task 18: Empty state for the boards index page

**Files:**
- Modify: `app/(app)/boards/page.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import { EmptyState } from '@/src/modules/ui/EmptyState';
import { InboxIcon } from '@/src/modules/ui/icons';

export default function BoardsIndexPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-page p-8">
      <EmptyState
        icon={<InboxIcon className="h-6 w-6" />}
        title="Elegí un tablero"
        description="O creá uno nuevo desde la barra lateral para empezar a organizar tus notas."
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected: no errors). In the browser: navigate to `/boards` (no
board selected) and confirm it shows the new bordered empty-state card with an inbox icon
instead of the old plain centered text.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/boards/page.tsx"
git commit -m "Add EmptyState to the boards index page"
```

---

### Task 19: Final consistency pass and deploy

**Files:** none new — this is a review + deploy task.

- [ ] **Step 1: Consistency audit**

Walk through every screen touched in Tasks 9–18 in the browser (Sidebar collapsed/expanded,
Board with 0/1/many columns, a column with 0/1/many notes, NoteEditor open, MiniCalendarPanel
open/closed, Calendar month/week view, Login and Signup mode, boards index empty state) and
confirm:
- Spacing reads as 8px-grid throughout (no stray odd paddings left over from the old style)
- Every card/modal/popover uses `rounded-card`, every input/button/tile uses `rounded-control`
- Every shadow is `shadow-elevation-sm` or `shadow-elevation-md` — no leftover `shadow-sm`/`shadow-xl`/`shadow` Tailwind defaults
- Every hover/focus transition uses `duration-150`/`duration-200`/`duration-250` with
  `ease-standard` — no leftover unstyled instant state changes
- The accent color (`accent-500`/`accent-600`) is the only saturated color used for
  interactive affordances; board colors remain scoped to header/sidebar/column-accent only

Fix any inconsistency found directly in the relevant file from Tasks 9–18.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit any consistency fixes**

```bash
git add -A
git commit -m "Consistency pass: spacing, radius, shadow, and motion audit"
```

(Skip this commit if Step 1 found nothing to fix.)

- [ ] **Step 4: Push to deploy**

```bash
git push origin master
```

This triggers the existing Vercel git-connected auto-deploy. Poll `npx vercel ls kanban-postit --yes`
until the newest deployment shows `Ready`, then open `https://kanban-postit.vercel.app` and
spot-check the same screens as Step 1 in production.

---

## Self-Review

- **Spec coverage:** Tokens (Task 1), default board color (Task 2), all six shared
  primitives (Tasks 3–8), Sidebar/Header/Tabs (Tasks 9–11), Board columns/notes (Tasks
  12–13), NoteEditor drawer conversion (Task 14), MiniCalendarPanel/CalendarView (Tasks
  15–16), Login/Signup (Task 17), empty state (Task 18), and the states checklist +
  consistency audit (Task 19) are all covered. Non-goals from the spec (custom confirm
  dialog, dark mode, DnD logic changes) are intentionally not tasked.
- **Placeholder scan:** no TBD/TODO markers; every step has literal, complete code.
- **Type consistency:** `Board`, `Note`, `Column`, `ChecklistItem`, `Priority` types are
  unchanged from the existing domain types and used identically across tasks; the new
  shared primitives (`Button`, `Input`, `Badge`, `Toast`/`useToast`, `EmptyState`) are
  imported with the same names and prop shapes everywhere they're used (Sidebar, NoteEditor,
  Login all call `useToast()`/`<Button>`/`<Input>` consistently).
