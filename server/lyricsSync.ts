import { createClient } from "@supabase/supabase-js";
import { groqWebTimes, lookupPublishedTimes } from "./lrcLookup.ts";

type SyncInput = {
  title: string;
  durationSec: number;
  lines: string[];
};

function groqKey() {
  return (
    process.env.groq_api_key?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    process.env["groq-api-key"]?.trim() ||
    process.env.GROQ_KEY?.trim() ||
    ""
  );
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdmin(authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token) throw new Error("Sign in as admin first.");
  if (!url || !anon) throw new Error("Supabase is not configured on the server.");

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Sign in as admin first.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const metaRole = data.user.user_metadata?.role;
  const role =
    profile?.role ||
    (metaRole === "admin" || metaRole === "singer" || metaRole === "listener" ? metaRole : "");
  if (role !== "admin") {
    throw new Error("Only the admin account can auto-time lyrics.");
  }
}

export async function handleLyricsSync(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (request.method !== "POST") {
      return json(405, { error: "POST only" });
    }

    try {
      await requireAdmin(request.headers.get("authorization"));
    } catch (err) {
      return json(403, { error: err instanceof Error ? err.message : "Not allowed." });
    }

    let payload: SyncInput;
    try {
      payload = (await request.json()) as SyncInput;
    } catch {
      return json(400, { error: "Could not read that request." });
    }

    const title = String(payload.title || "Untitled").slice(0, 180);
    const durationSec = Number(payload.durationSec);
    const lines = Array.isArray(payload.lines)
      ? payload.lines.map((line) => String(line).trim()).filter(Boolean).slice(0, 200)
      : [];

    if (lines.length < 2) {
      return json(400, { error: "Paste at least two lyric lines first." });
    }
    if (!Number.isFinite(durationSec) || durationSec < 20) {
      return json(400, { error: "This song needs a duration before AI can time it." });
    }

    try {
      const published = await lookupPublishedTimes(title, durationSec, lines);
      if (published) {
        return json(200, {
          times: published.times,
          source: published.source,
          matched: published.matched,
        });
      }
    } catch {
      /* fall through to Groq web search */
    }

    if (groqKey()) {
      try {
        const web = await groqWebTimes(groqKey(), title, durationSec, lines);
        if (web) {
          return json(200, {
            times: web.times,
            source: web.source,
            matched: web.matched,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/api key|unauthorized|invalid.*key/i.test(message)) {
          return json(502, {
            error: "Groq rejected the API key. Check groq_api_key in .env.",
          });
        }
      }
    }

    return json(404, {
      error:
        "No published karaoke timestamps were found for that title. Check the song name (Artist - Title) or stamp the lines by hand.",
    });
  } catch (err) {
    return json(500, {
      error: err instanceof Error ? err.message : "Lyrics sync failed.",
    });
  }
}
