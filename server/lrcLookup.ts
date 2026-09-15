type LrcLine = { t: number; text: string };

type LrcRecord = {
  trackName?: string;
  artistName?: string;
  duration?: number;
  syncedLyrics?: string | null;
};

export type LookupHit = {
  times: number[];
  source: string;
  matched: number;
};

const UA = "SpotiYen/1.0 (private karaoke timing)";

function parseTitle(title: string) {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), track: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", track: title.trim() };
}

function norm(value: string) {
  return value
    .toLowerCase()
    .replace(/^#?instrumental$/i, "")
    .replace(/♪/g, "")
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a: string, b: string) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const wa = new Set(left.split(" ").filter(Boolean));
  const wb = new Set(right.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const word of wa) if (wb.has(word)) inter += 1;
  return (2 * inter) / (wa.size + wb.size);
}

function parseLrc(synced: string): LrcLine[] {
  const rows: LrcLine[] = [];
  for (const raw of synced.split(/\r?\n/)) {
    const match = raw.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
    if (!match) continue;
    const text = match[4].trim();
    if (!text) continue;
    const fraction = match[3] ? Number(match[3].padEnd(3, "0").slice(0, 3)) / 1000 : 0;
    const t = Number(match[1]) * 60 + Number(match[2]) + fraction;
    if (!Number.isFinite(t)) continue;
    rows.push({ t, text });
  }
  return rows;
}

function isGap(text: string) {
  return /^#?instrumental$/i.test(text.trim()) || text.trim() === "♪";
}

function alignTimes(userLines: string[], lrc: LrcLine[]) {
  const times: Array<number | null> = userLines.map(() => null);
  let cursor = 0;
  for (let i = 0; i < userLines.length; i++) {
    if (isGap(userLines[i])) {
      times[i] = lrc[cursor]?.t ?? (i > 0 ? (times[i - 1] ?? 0) + 4 : 8);
      continue;
    }
    let best = 0.48;
    let bestAt = -1;
    const limit = Math.min(lrc.length, cursor + 10);
    for (let k = cursor; k < limit; k++) {
      const score = similar(userLines[i], lrc[k].text);
      if (score > best) {
        best = score;
        bestAt = k;
      }
    }
    if (bestAt >= 0) {
      times[i] = lrc[bestAt].t;
      cursor = bestAt + 1;
    }
  }
  return times;
}

function fillHoles(raw: Array<number | null>, durationSec: number) {
  const cap = Math.max(1, durationSec - 0.25);
  const times = raw.map((t) => (t != null && Number.isFinite(t) ? t : NaN));
  let lastKnown = -1;
  for (let i = 0; i < times.length; i++) {
    if (!Number.isFinite(times[i])) continue;
    if (lastKnown >= 0) {
      const gap = i - lastKnown;
      const start = times[lastKnown];
      const end = times[i];
      for (let k = 1; k < gap; k++) {
        times[lastKnown + k] = start + ((end - start) * k) / gap;
      }
    } else {
      for (let k = 0; k < i; k++) {
        times[k] = Math.max(0.4, times[i] - (i - k) * 3.2);
      }
    }
    lastKnown = i;
  }
  if (lastKnown >= 0) {
    for (let i = lastKnown + 1; i < times.length; i++) {
      times[i] = times[i - 1] + 3.4;
    }
  }
  let prev = 0;
  return times.map((t, i) => {
    let next = Number.isFinite(t) ? t : prev + 3;
    next = Math.min(cap, Math.max(i === 0 ? 0.2 : prev + 0.12, next));
    prev = next;
    return Number(next.toFixed(2));
  });
}

function recordScore(row: LrcRecord, artist: string, track: string, durationSec: number) {
  if (!row.syncedLyrics) return -1;
  const durationScore =
    typeof row.duration === "number"
      ? Math.max(0, 1 - Math.abs(row.duration - durationSec) / 18)
      : 0.2;
  return (
    similar(row.trackName || "", track) * 4 +
    similar(row.artistName || "", artist) * 2 +
    durationScore * 3
  );
}

async function lrclibGet(params: Record<string, string>) {
  const url = new URL("https://lrclib.net/api/search");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as LrcRecord[]) : [];
}

export async function lookupPublishedTimes(
  title: string,
  durationSec: number,
  userLines: string[]
): Promise<LookupHit | null> {
  const { artist, track } = parseTitle(title);
  const queries: Record<string, string>[] = [];
  if (artist) queries.push({ track_name: track, artist_name: artist });
  queries.push({ q: title });
  if (track !== title) queries.push({ q: track });

  let best: LrcRecord | null = null;
  let bestScore = 1.8;
  for (const query of queries) {
    try {
      const rows = await lrclibGet(query);
      for (const row of rows) {
        const score = recordScore(row, artist, track, durationSec);
        if (score > bestScore) {
          best = row;
          bestScore = score;
        }
      }
      if (best?.syncedLyrics) break;
    } catch {
      /* try the next query */
    }
  }

  if (!best?.syncedLyrics) return null;
  const lrc = parseLrc(best.syncedLyrics);
  if (lrc.length < 4) return null;
  const aligned = alignTimes(userLines, lrc);
  const matched = aligned.filter((t) => t != null).length;
  if (matched < Math.max(3, Math.floor(userLines.length * 0.35))) return null;
  return {
    times: fillHoles(aligned, durationSec),
    source: `lrclib:${best.artistName || "unknown"} – ${best.trackName || track}`,
    matched,
  };
}

export async function groqWebTimes(
  groqKey: string,
  title: string,
  durationSec: number,
  userLines: string[]
): Promise<LookupHit | null> {
  const numbered = userLines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "groq/compound",
      temperature: 0.05,
      compound_custom: {
        tools: { enabled_tools: ["web_search", "visit_website"] },
      },
      search_settings: {
        include_domains: ["lrclib.net", "lyricsify.com", "megalobiz.com"],
      },
      messages: [
        {
          role: "system",
          content:
            "You look up published karaoke/LRC timestamps on the web. You never invent times. You never replace the user's lyric text. Reply with JSON only.",
        },
        {
          role: "user",
          content: `Find a published LRC or synced-lyrics timing sheet for this recording:
Title: ${title}
Duration: ${durationSec.toFixed(1)} seconds

Search/visit pages that contain [mm:ss.xx] karaoke timestamps. Map those start times onto these exact lines (same order, same words). If a line has no match, omit a guess — use null.

Lines:
${numbered}

Return JSON:
{"found":true,"source":"https://...","times":[12.04,15.2,null,...]}
times MUST have length ${userLines.length}.
If no published timing sheet exists, return {"found":false,"times":[]}`,
        },
      ],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) throw new Error(data.error?.message || `Groq search returned ${res.status}`);

  const content = data.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: { found?: unknown; source?: unknown; times?: unknown };
  try {
    parsed = JSON.parse(match[0]) as {
      found?: unknown;
      source?: unknown;
      times?: unknown;
    };
  } catch {
    return null;
  }
  if (parsed.found === false || !Array.isArray(parsed.times)) return null;
  const aligned = parsed.times.map((value) => {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  });
  const matched = aligned.filter((t) => t != null).length;
  if (matched < Math.max(3, Math.floor(userLines.length * 0.35))) return null;
  return {
    times: fillHoles(aligned, durationSec),
    source: typeof parsed.source === "string" ? parsed.source : "web",
    matched,
  };
}
