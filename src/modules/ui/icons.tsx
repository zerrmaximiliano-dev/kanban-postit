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

export function CloseIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

export function UsersIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="7" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12.5 12.2c1.9.3 3 1.5 3 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function LogOutIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M8 4H5.5a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 005.5 16H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 13.5L16.5 10 13 6.5M16.5 10H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
