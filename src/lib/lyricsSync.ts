import { supabase } from "./supabase";

export type LyricTemplate = {
  times: number[];
  source: string;
  matched: number;
  label: string;
  durationSec: number;
};

function asTemplate(row: unknown): LyricTemplate | null {
  if (!row || typeof row !== "object") return null;
  const item = row as {
    times?: unknown;
    source?: unknown;
    matched?: unknown;
    label?: unknown;
    durationSec?: unknown;
  };
  if (!Array.isArray(item.times) || item.times.length === 0) return null;
  const times = item.times.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (times.length === 0) return null;
  return {
    times,
    source: typeof item.source === "string" ? item.source : "lrclib",
    matched: Number(item.matched) || times.length,
    label: typeof item.label === "string" && item.label.trim() ? item.label : "Published karaoke times",
    durationSec: Number(item.durationSec) || 0,
  };
}

export async function requestLyricTimes(params: {
  title: string;
  durationSec: number;
  lines: string[];
}): Promise<{ templates: LyricTemplate[] }> {
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
    templates?: unknown;
  };

  if (!res.ok) {
    throw new Error(payload.error || "Could not auto-time those lyrics.");
  }

  const templates = Array.isArray(payload.templates)
    ? payload.templates.map(asTemplate).filter((item): item is LyricTemplate => Boolean(item))
    : [];

  if (templates.length === 0) {
    const legacy = asTemplate({
      times: payload.times,
      source: payload.source,
      matched: Array.isArray(payload.times) ? payload.times.length : 0,
      label: typeof payload.source === "string" ? payload.source : "Published karaoke times",
    });
    if (legacy) templates.push(legacy);
  }

  if (templates.length === 0) {
    throw new Error("No published timestamps came back for that song.");
  }
  return { templates: templates.slice(0, 3) };
}
