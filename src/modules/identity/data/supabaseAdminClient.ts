// SERVER-ONLY. Uses the service-role key, which bypasses RLS entirely.
// Only ever import this from a 'use server' file (Server Actions) or a
// server Route Handler — never from a 'use client' component.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
