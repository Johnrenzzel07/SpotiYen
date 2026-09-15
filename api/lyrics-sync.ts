import { handleLyricsSync } from "../server/lyricsSync";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

type NodeReq = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type NodeRes = {
  status: (code: number) => { json: (body: unknown) => void; end: () => void };
};

function isWebRequest(value: unknown): value is Request {
  return typeof Request !== "undefined" && value instanceof Request;
}

function headerMap(headers: NodeReq["headers"]) {
  const mapped = new Headers();
  for (const [key, value] of Object.entries(headers || {})) {
    if (typeof value === "string") mapped.set(key, value);
    else if (Array.isArray(value)) mapped.set(key, value.join(", "));
  }
  if (!mapped.has("content-type")) mapped.set("content-type", "application/json");
  return mapped;
}

function toWebRequest(req: NodeReq) {
  const method = (req.method || "POST").toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body ?? {});
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: headerMap(req.headers),
  };
  if (body !== undefined) {
    init.body = body;
    init.duplex = "half";
  }
  return new Request("https://spotiyen.local/api/lyrics-sync", init);
}

async function run(request: Request) {
  return handleLyricsSync(request);
}

export async function POST(request: Request) {
  try {
    return await run(request);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lyrics sync failed.";
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export default async function handler(req: Request | NodeReq, res?: NodeRes) {
  try {
    if (!isWebRequest(req) && req.method === "OPTIONS") {
      res?.status(204).end();
      return;
    }

    const request = isWebRequest(req) ? req : toWebRequest(req);
    const response = await run(request);

    if (res && typeof res.status === "function") {
      const payload = await response.json().catch(() => ({}));
      res.status(response.status).json(payload);
      return;
    }

    return response;
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lyrics sync failed.";
    if (res && typeof res.status === "function") {
      res.status(500).json({ error });
      return;
    }
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
