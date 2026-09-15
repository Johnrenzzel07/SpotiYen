import { handleLyricsSync } from "../server/lyricsSync.ts";

export const maxDuration = 60;

export function GET() {
  return Response.json({
    ok: true,
    supabase: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    groq: Boolean(
      process.env.groq_api_key ||
        process.env.GROQ_API_KEY ||
        process.env["groq-api-key"]
    ),
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  try {
    return await handleLyricsSync(request);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lyrics sync failed.";
    return Response.json({ error }, { status: 500 });
  }
}
