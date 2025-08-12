import { type SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedClient } from '@/integrations/supabase/client';

let client: SupabaseClient<any, 'app'> | null = null;

export function getSupabase(): SupabaseClient<any, 'app'> | null {
  // Reuse the shared client and ensure single instance
  if (!client) {
    client = sharedClient as unknown as SupabaseClient<any, 'app'>;
  }
  return client;
}

export async function invokeFn<T = any>(name: string, body?: unknown): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}

