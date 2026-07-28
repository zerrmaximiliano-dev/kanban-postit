'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';
import { JanusLogoReveal } from '@/src/modules/ui/JanusLogoReveal';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/boards';

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
      router.push(next);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(next);
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
        className="relative w-[28rem] space-y-4 rounded-card border border-border bg-surface p-8 shadow-elevation-md"
      >
        <div className="mb-2 flex flex-col items-center text-center">
          <JanusLogoReveal iconSize={216} entranceSpeed={900} idleFloat={false} sheenEffect={false} />
          <h1 className="mt-3 text-2xl font-bold text-ink">
            {mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="mt-1 text-center text-sm text-ink-muted">
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
