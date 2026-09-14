import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);

export const RECORDINGS_BUCKET = "recordings";
export const COVERS_BUCKET = "covers";
