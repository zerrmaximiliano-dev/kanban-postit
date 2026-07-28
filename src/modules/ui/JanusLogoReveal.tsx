// src/modules/ui/JanusLogoReveal.tsx
'use client';

import { useEffect, useState } from 'react';

export function JanusLogoReveal({
  wordmark = 'JANUS',
  iconSize = 380,
  wordmarkSize,
  entranceSpeed = 900,
  idleFloat = true,
  sheenEffect = true,
}: {
  wordmark?: string;
  iconSize?: number;
  wordmarkSize?: number;
  entranceSpeed?: number;
  idleFloat?: boolean;
  sheenEffect?: boolean;
}) {
  const [iconIn, setIconIn] = useState(false);
  const [textIn, setTextIn] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIconIn(true), 120);
    const t2 = setTimeout(() => setTextIn(true), 120 + entranceSpeed * 0.55);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [entranceSpeed]);

  const letters = wordmark.split('');
  const wordmarkFontSize = wordmarkSize ?? (76 / 380) * iconSize;

  return (
    <div className="flex flex-col items-center" style={{ gap: iconSize * (36 / 380) }}>
      <div
        className="relative overflow-hidden rounded-[18px]"
        style={{ width: iconSize }}
      >
        <img
          src="/janus-icon.png"
          alt="Janus"
          className="block w-full"
          style={{
            opacity: iconIn ? 1 : 0,
            transform: iconIn ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(-10deg)',
            transformOrigin: 'center bottom',
            transition: 'opacity 1000ms cubic-bezier(0.16,1,0.3,1), transform 1200ms cubic-bezier(0.16,1,0.3,1)',
            animation: idleFloat ? 'janus-float 5s ease-in-out infinite 1.4s' : 'none',
          }}
        />
        {sheenEffect && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.85) 50%, transparent 60%)',
              mixBlendMode: 'screen',
              animation: 'janus-sheen 3.2s ease-in-out infinite 1.6s',
            }}
          />
        )}
      </div>
      <div className="flex" style={{ gap: '0.06em' }}>
        {letters.map((char, i) => (
          <span
            key={`${char}-${i}`}
            className="font-archivo inline-block font-extrabold"
            style={{
              fontSize: wordmarkFontSize,
              letterSpacing: '0.02em',
              color: 'oklch(0.28 0.06 265)',
              opacity: textIn ? 1 : 0,
              transform: textIn ? 'translateY(0)' : 'translateY(18px)',
              transition: `opacity 620ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}
