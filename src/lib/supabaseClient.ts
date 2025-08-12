import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<any, "app"> | null = null;

function resolveKeys() {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const anon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  return { url, anon } as { url?: string; anon?: string };
}

export function getSupabase(): SupabaseClient<any, "app"> | null {
  if (client) return client;
  const { url, anon } = resolveKeys();
  if (!url || !anon) {
    console.warn('Supabase not configured. Set project Supabase integration to enable backend features.');
    return null;
  }
  client = createClient(url, anon, {
    auth: { persistSession: true },
    db: { schema: 'app' },
    global: { headers: { 'Accept-Profile': 'app' } },
  });
  return client;
}

export async function invokeFn<T = any>(name: string, body?: unknown): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

