import { handleLyricsSync } from "../server/lyricsSync";

export default async function handler(req: {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}, res: {
  status: (code: number) => { json: (body: unknown) => void; end: () => void };
}) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }

  const request = new Request("https://spotiyen.local/api/lyrics-sync", {
    method: req.method || "POST",
    headers,
    body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
  });

  const response = await handleLyricsSync(request);
  const payload = await response.json();
  res.status(response.status).json(payload);
}
