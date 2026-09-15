type LrcLine = { t: number; text: string };

type LrcRecord = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string | null;
};

export type LookupHit = {
  times: number[];
  source: string;
  matched: number;
  label: string;
  durationSec: number;
};

const UA = "SpotiYen/1.0 (private karaoke timing)";
const MIN_MATCH = 0.48;

function parseTitle(title: string) {
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), track: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "", track: title.trim() };
}

function artistParts(artist: string) {
  return artist
    .split(/[&,/]|feat\.?|ft\.?/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
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

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = Array(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

function artistSimilar(published: string, wanted: string) {
  const score = similar(published, wanted);
  if (score >= 0.62) return score;
  const left = norm(published);
  const right = norm(wanted);
  if (!left || !right) return score;
  if (left.length >= 8 && right.length >= 8 && editDistance(left, right) <= 2) return 0.9;
  const stop = new Set(["the", "a", "an", "and", "of", "feat", "ft"]);
  const wa = [...new Set(left.split(" ").filter((word) => word && !stop.has(word) && word.length > 2))];
  const wb = [...new Set(right.split(" ").filter((word) => word && !stop.has(word) && word.length > 2))];
  if (wa.length === 0 || wb.length === 0) return score;
  let inter = 0;
  for (const word of wa) {
    if (
      wb.some(
        (other) =>
          word === other ||
          (Math.min(word.length, other.length) >= 5 && editDistance(word, other) <= 1)
      )
    ) {
      inter += 1;
    }
  }
  return Math.max(score, (2 * inter) / (wa.length + wb.length));
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function similar(a: string, b: string) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 10 && longer.includes(shorter)) return 0.93;
  const wa = new Set(left.split(" ").filter(Boolean));
  const wb = new Set(right.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const word of wa) if (wb.has(word)) inter += 1;
  return (2 * inter) / (wa.size + wb.size);
}

function phraseContained(a: string, b: string) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 10 && longer.includes(shorter);
}

function matchScore(user: string, published: string) {
  if (phraseContained(user, published)) return Math.max(similar(user, published), 0.94);
  return similar(user, published);
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

function usableLrc(lrc: LrcLine[]) {
  return lrc.filter((line) => line.text && !isGap(line.text));
}

function strongClause(part: string) {
  const words = wordCount(part);
  return words >= 4 || (words >= 3 && part.length >= 20);
}

function splitLyricClause(text: string): string[] {
  if (text.length < 28) return [text];
  const comma = text.split(/,\s+/).map((part) => part.trim()).filter(Boolean);
  if (comma.length >= 2 && comma.every(strongClause)) return comma;
  const andSplit = text.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  if (andSplit.length === 2 && andSplit.every(strongClause)) {
    return [andSplit[0], /^and\b/i.test(andSplit[1]) ? andSplit[1] : `And ${andSplit[1]}`];
  }
  return [text];
}

function explodeLrc(lrc: LrcLine[]): LrcLine[] {
  const out: LrcLine[] = [];
  for (let i = 0; i < lrc.length; i++) {
    const parts = splitLyricClause(lrc[i].text);
    if (parts.length < 2) {
      out.push(lrc[i]);
      continue;
    }
    const nextT = lrc[i + 1]?.t ?? lrc[i].t + 8;
    const span = Math.max(0.6, (nextT - lrc[i].t) * 0.82);
    const total = parts.reduce((sum, part) => sum + part.length, 0) || 1;
    let acc = 0;
    for (const part of parts) {
      out.push({ t: Number((lrc[i].t + span * (acc / total)).toFixed(3)), text: part });
      acc += part.length;
    }
  }
  return out;
}

function alignInOrder(userLines: string[], lrc: LrcLine[]) {
  if (lrc.length === 0) return userLines.map(() => null);
  if (userLines.length === 1) return [lrc[0].t];
  return userLines.map((text, i) => {
    if (isGap(text) && i > 0) return null;
    const idx = (i / (userLines.length - 1)) * (lrc.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lrc.length - 1, lo + 1);
    const frac = idx - lo;
    return lrc[lo].t + (lrc[hi].t - lrc[lo].t) * frac;
  });
}

function alignDp(userLines: string[], lrc: LrcLine[]) {
  const n = userLines.length;
  const m = lrc.length;
  if (n === 0 || m === 0) return userLines.map(() => null);

  const NEG = -1e6;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(NEG));
  const prev: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  dp[0][0] = 0;
  for (let j = 1; j <= m; j++) {
    dp[0][j] = 0;
    prev[0][j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] - (isGap(userLines[i - 1]) ? 0 : 0.14);
    prev[i][0] = 3;
  }

  for (let i = 1; i <= n; i++) {
    const user = userLines[i - 1];
    for (let j = 1; j <= m; j++) {
      if (isGap(user)) {
        dp[i][j] = dp[i - 1][j];
        prev[i][j] = 3;
        continue;
      }
      const score = matchScore(user, lrc[j - 1].text);
      const diag = dp[i - 1][j - 1] + (score >= MIN_MATCH ? score : score - 0.85);
      const skipLrc = dp[i][j - 1] - 0.06;
      const skipUser = dp[i - 1][j] - 0.12;
      if (diag >= skipLrc && diag >= skipUser) {
        dp[i][j] = diag;
        prev[i][j] = 1;
      } else if (skipLrc >= skipUser) {
        dp[i][j] = skipLrc;
        prev[i][j] = 2;
      } else {
        dp[i][j] = skipUser;
        prev[i][j] = 3;
      }
    }
  }

  const times: Array<number | null> = userLines.map(() => null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const move = i === 0 ? 2 : j === 0 ? 3 : prev[i][j];
    if (move === 1) {
      const score = matchScore(userLines[i - 1], lrc[j - 1].text);
      if (score >= MIN_MATCH || phraseContained(userLines[i - 1], lrc[j - 1].text)) {
        times[i - 1] = lrc[j - 1].t;
      }
      i -= 1;
      j -= 1;
    } else if (move === 2) {
      j -= 1;
    } else {
      i -= 1;
    }
  }
  return times;
}

function fillHoles(raw: Array<number | null>, durationSec: number, lastPublished?: number) {
  const cap = Math.max(1, durationSec - 0.4);
  const finish = Math.min(cap, lastPublished && lastPublished > 1 ? lastPublished : cap);
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
        times[k] = Math.max(0.3, times[i] * ((k + 1) / (i + 1)));
      }
    }
    lastKnown = i;
  }
  if (lastKnown >= 0 && lastKnown < times.length - 1) {
    const start = times[lastKnown];
    const rest = times.length - 1 - lastKnown;
    const room = Math.max(0, finish - start);
    const end = room >= rest * 1.4 ? finish : Math.min(cap, start + rest * 2.2);
    for (let k = 1; k <= rest; k++) {
      times[lastKnown + k] = start + ((end - start) * k) / rest;
    }
  }
  let prev = 0;
  return times.map((t, i) => {
    let next = Number.isFinite(t) ? t : prev + 2;
    next = Math.min(cap, Math.max(i === 0 ? 0.2 : prev + 0.25, next));
    prev = next;
    return Number(next.toFixed(2));
  });
}

function durationClose(rowDuration: number | undefined, durationSec: number) {
  if (typeof rowDuration !== "number") return true;
  if (durationSec <= 30) return true;
  const abs = Math.abs(rowDuration - durationSec);
  return abs <= Math.max(8, durationSec * 0.06);
}

function recordScore(
  row: LrcRecord,
  artist: string,
  track: string,
  durationSec: number,
  strictDuration: boolean,
  loose = false
) {
  if (!row.syncedLyrics) return -1;
  if (strictDuration && !durationClose(row.duration, durationSec)) return -1;
  const durationScore =
    typeof row.duration === "number"
      ? Math.max(0, 1 - Math.abs(row.duration - durationSec) / Math.max(durationSec, 1))
      : 0.2;
  const names = [artist, ...artistParts(artist)].filter(Boolean);
  const artistScore = names.length
    ? Math.max(0, ...names.map((name) => artistSimilar(row.artistName || "", name)))
    : 0;
  const trackScore = Math.max(similar(row.trackName || "", track), similar(row.trackName || "", `${artist} ${track}`));
  if (!loose && artist && artistScore < 0.55) return -1;
  if (trackScore < 0.28 && artistScore < 0.4) {
    if (!loose) return -1;
    const haystack = `${row.trackName || ""} ${row.artistName || ""} ${row.albumName || ""}`;
    if (similar(haystack, `${artist} ${track}`.trim() || track) < 0.2) return -1;
  }
  return trackScore * 4 + artistScore * 2 + durationScore * 3;
}

async function lrclibSearch(params: Record<string, string>) {
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

async function lrclibExact(artist: string, track: string, durationSec: number) {
  const url = new URL("https://lrclib.net/api/get");
  url.searchParams.set("track_name", track);
  if (artist) url.searchParams.set("artist_name", artist);
  if (durationSec > 20) url.searchParams.set("duration", String(Math.round(durationSec)));
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as LrcRecord;
  return data?.syncedLyrics ? data : null;
}

function stampFromRecord(best: LrcRecord, userLines: string[], durationSec: number, track: string): LookupHit | null {
  const exploded = explodeLrc(usableLrc(parseLrc(best.syncedLyrics || "")));
  if (exploded.length < 2) return null;

  const aligned = alignDp(userLines, exploded);
  const hits = aligned.filter((t) => t != null).length;
  const used = hits >= Math.max(3, Math.floor(userLines.length * 0.35)) ? aligned : alignInOrder(userLines, exploded);
  const lastPublished = exploded[exploded.length - 1]?.t ?? durationSec;
  const duration = typeof best.duration === "number" && best.duration > 20 ? best.duration : durationSec;
  const album = (best.albumName || "").trim();
  const albumLabel = /[\p{L}]{3,}/u.test(album) ? album : "";
  const artist = best.artistName || "unknown";
  const name = best.trackName || track;
  const clock = formatClock(duration);

  return {
    times: fillHoles(used, durationSec, lastPublished),
    source: `lrclib:${artist} – ${name}`,
    matched: used.filter((t) => t != null).length,
    label: albumLabel
      ? `${name} · ${artist} · ${clock} · ${albumLabel}`
      : `${name} · ${artist} · ${clock}`,
    durationSec: duration,
  };
}

function lrcFingerprint(row: LrcRecord) {
  const lines = usableLrc(parseLrc(row.syncedLyrics || ""));
  if (lines.length < 2) return "";
  const start = Math.round(lines[0].t);
  const mid = Math.round(lines[Math.floor(lines.length / 2)].t);
  const end = Math.round(lines[lines.length - 1].t);
  return `${lines.length}|${start}|${mid}|${end}`;
}

function durationBucket(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 20) return -1;
  return Math.round(seconds / 10);
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

async function collectRecords(title: string, durationSec: number) {
  const { artist, track } = parseTitle(title);
  const artists = [artist, ...artistParts(artist)].filter(Boolean);
  const found = new Map<string, LrcRecord>();

  for (const name of artists) {
    try {
      const exact = await lrclibExact(name, track, durationSec);
      if (exact?.syncedLyrics) found.set(lrcFingerprint(exact) || `exact-${name}`, exact);
    } catch {
      /* try search */
    }
  }

  const queries: Record<string, string>[] = [];
  if (track && artists[0]) queries.push({ track_name: track, artist_name: artists[0] });
  if (track) queries.push({ track_name: track });
  queries.push({ q: title });
  if (track !== title) queries.push({ q: track });

  for (const query of queries) {
    try {
      const rows = await lrclibSearch(query);
      for (const row of rows) {
        if (!row.syncedLyrics) continue;
        const key = lrcFingerprint(row);
        if (!key || found.has(key)) continue;
        found.set(key, row);
      }
    } catch {
      /* try the next query */
    }
  }

  return { artist, track, records: [...found.values()] };
}

export async function lookupPublishedTemplates(
  title: string,
  durationSec: number,
  userLines: string[],
  loose = false
): Promise<LookupHit[]> {
  const { artist, track, records } = await collectRecords(title, durationSec);
  let ranked = records
    .map((row) => ({ row, score: recordScore(row, artist, track, durationSec, false, loose) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (loose && ranked.length === 0) {
    ranked = records
      .filter((row) => Boolean(row.syncedLyrics))
      .map((row) => ({
        row,
        score: recordScore(row, artist, track, durationSec, false, true) + 0.01,
      }))
      .sort((a, b) => b.score - a.score);
  }

  const unique: LookupHit[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const fingerprint = lrcFingerprint(item.row);
    if (!fingerprint || seen.has(fingerprint)) continue;
    const hit = stampFromRecord(item.row, userLines, durationSec, track);
    if (!hit) continue;
    seen.add(fingerprint);
    unique.push(hit);
  }

  const templates: LookupHit[] = [];
  const usedBuckets = new Set<number>();
  for (const hit of unique) {
    const bucket = durationBucket(hit.durationSec);
    if (bucket >= 0 && usedBuckets.has(bucket)) continue;
    if (bucket >= 0) usedBuckets.add(bucket);
    templates.push(hit);
    if (templates.length >= 3) return templates;
  }
  for (const hit of unique) {
    if (templates.includes(hit)) continue;
    templates.push(hit);
    if (templates.length >= 3) break;
  }
  return templates;
}

export async function lookupPublishedTimes(
  title: string,
  durationSec: number,
  userLines: string[]
): Promise<LookupHit | null> {
  const templates = await lookupPublishedTemplates(title, durationSec, userLines);
  return templates[0] ?? null;
}

export async function groqWebTimes(
  groqKey: string,
  title: string,
  durationSec: number,
  userLines: string[]
): Promise<LookupHit | null> {
  const numbered = userLines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const bodies = [
    {
      model: "groq/compound",
      temperature: 0.05,
      compound_custom: {
        tools: { enabled_tools: ["web_search", "visit_website"] },
      },
      search_settings: {
        include_domains: ["lrclib.net", "lyricsify.com", "megalobiz.com"],
      },
      messages: groqMessages(title, durationSec, numbered, userLines.length),
    },
    {
      model: "groq/compound",
      temperature: 0.05,
      compound_custom: {
        tools: { enabled_tools: ["web_search", "visit_website"] },
      },
      messages: groqMessages(title, durationSec, numbered, userLines.length),
    },
  ];

  for (const body of bodies) {
    const hit = await groqWebOnce(groqKey, body, durationSec, userLines.length);
    if (hit) return hit;
  }
  return null;
}

function groqMessages(title: string, durationSec: number, numbered: string, count: number) {
  return [
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
times MUST have length ${count}.
If no published timing sheet exists, return {"found":false,"times":[]}`,
    },
  ];
}

async function groqWebOnce(
  groqKey: string,
  body: Record<string, unknown>,
  durationSec: number,
  lineCount: number
): Promise<LookupHit | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
  if (matched < Math.max(2, Math.floor(lineCount * 0.2))) return null;
  return {
    times: fillHoles(aligned, durationSec),
    source: typeof parsed.source === "string" ? parsed.source : "web",
    matched,
    label: "Web karaoke times",
    durationSec,
  };
}
