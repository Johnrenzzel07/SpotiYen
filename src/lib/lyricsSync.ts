import { supabase } from "./supabase";

export async function requestLyricTimes(params: {
  title: string;
  durationSec: number;
  lines: string[];
}): Promise<{ times: number[]; source: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in as admin first.");

  const res = await fetch("/api/lyrics-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    times?: unknown;
    source?: unknown;
  };

  if (!res.ok) {
    throw new Error(payload.error || "Could not auto-time those lyrics.");
  }
  if (!Array.isArray(payload.times) || payload.times.length === 0) {
    throw new Error("No published timestamps came back for that song.");
  }
  return {
    times: payload.times.map((n) => Number(n)),
    source: typeof payload.source === "string" ? payload.source : "web",
  };
}
