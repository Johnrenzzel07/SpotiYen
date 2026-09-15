import type { LyricLine } from "../types";

export function parseLyrics(raw: unknown): LyricLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: LyricLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const record = row as { t?: unknown; text?: unknown; line?: unknown };
    const text = String(record.text ?? record.line ?? "").trim();
    if (!text) continue;
    const t = Number(record.t);
    lines.push({ t: Number.isFinite(t) && t > 0 ? t : 0, text });
  }
  return lines;
}

export function lyricsFromText(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ t: 0, text: line }));
}

export function applyLyricTimes(lines: LyricLine[], times: number[]): LyricLine[] {
  return lines.map((line, index) => {
    const t = Number(times[index]);
    return {
      text: line.text,
      t: Number.isFinite(t) && t > 0 ? Number(t.toFixed(2)) : line.t,
    };
  });
}

export function lyricsAreSynced(lines: LyricLine[]) {
  return lines.some((line) => line.t > 0);
}

export function activeLyricIndex(lines: LyricLine[], timeSec: number) {
  if (!lyricsAreSynced(lines) || lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= 0) continue;
    if (lines[i].t <= timeSec + 0.08) idx = i;
    else break;
  }
  return idx;
}

export function formatStamp(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const tenth = Math.floor((s - whole) * 10);
  return `${m}:${whole.toString().padStart(2, "0")}.${tenth}`;
}

export function isInstrumental(text: string) {
  return /^#?instrumental$/i.test(text.trim()) || text.trim() === "♪";
}
