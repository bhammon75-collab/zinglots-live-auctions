import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function resolveKeys() {
  const w = window as any;
  const url = w.__SUPABASE_URL__ || w.SUPABASE_URL || w.__env?.SUPABASE_URL;
  const anon = w.__SUPABASE_ANON_KEY__ || w.SUPABASE_ANON_KEY || w.__env?.SUPABASE_ANON_KEY;
  return { url, anon } as { url?: string; anon?: string };
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const { url, anon } = resolveKeys();
  if (!url || !anon) {
    console.warn('Supabase not configured. Set project Supabase integration to enable backend features.');
    return null;
  }
  client = createClient(url, anon);
  return client;
}

export async function invokeFn<T = any>(name: string, body?: unknown): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

