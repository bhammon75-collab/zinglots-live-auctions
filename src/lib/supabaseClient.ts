import { createClient } from '@supabase/supabase-js';

// Frontend Supabase client (requires Lovable Supabase integration to inject runtime URL/key)
const url = (window as any).__SUPABASE_URL__ || '';
const anon = (window as any).__SUPABASE_ANON_KEY__ || '';
if (!url || !anon) {
  console.warn('Supabase client not configured: missing __SUPABASE_URL__/__SUPABASE_ANON_KEY__');
}

export const supabase = createClient(url, anon);

export async function invokeFn<T = any>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}
