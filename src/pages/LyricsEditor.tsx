import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Captions,
  Clock,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { useTracks } from "../context/TrackContext";
import ClayCover from "../components/ClayCover";
import ClaySpinner, { ButtonDots, LibrarySkeleton } from "../components/ClaySpinner";
import { coverPublicUrl } from "../lib/db";
import { finiteDuration, formatTimeFromSec } from "../lib/audio";
import { applyLyricTimes, formatStamp, lyricsAreSynced, lyricsFromText, offsetLyricTimes } from "../lib/lyrics";
import { requestLyricTimes, type LyricTemplate } from "../lib/lyricsSync";
import type { LyricLine } from "../types";

export default function LyricsEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { tracks, loading, ownerName, saveLyrics } = useTracks();
  const {
    play,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    togglePlay,
    seek,
  } = usePlayer();

  const track = tracks.find((item) => item.id === id);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [timedFrom, setTimedFrom] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const [delayDraft, setDelayDraft] = useState("0");
  const [templates, setTemplates] = useState<LyricTemplate[]>([]);

  useEffect(() => {
    if (!track || loadedId === track.id) return;
    setLines(track.lyrics);
    setDraft(track.lyrics.map((line) => line.text).join("\n"));
    setLoadedId(track.id);
    setError("");
    setSaved(false);
    setTimedFrom("");
    setDelayDraft("0");
    setTemplates([]);
  }, [track, loadedId]);

  const timedCount = lines.filter((line) => line.t > 0).length;
  const nextStamp = lines.findIndex((line) => line.t <= 0);
  const isActive = currentTrack?.id === track?.id;
  const waiting = isActive && isBuffering;
  const safeDuration = finiteDuration(duration, track?.durationMs);
  const synced = lyricsAreSynced(lines);

  const preview = useMemo(
    () => lines.map((line) => line.text).join("\n"),
    [lines]
  );

  if (user && user.role !== "admin") {
    return <Navigate to={id ? `/track/${id}` : "/library"} replace />;
  }

  if (loading) return <LibrarySkeleton />;

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          Track not found
        </p>
        <Link
          to="/library"
          className="clay-btn mt-4 px-6 py-3 text-sm font-bold"
          style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
        >
          Back to Library
        </Link>
      </div>
    );
  }

  function applyText() {
    const next = lyricsFromText(draft);
    setLines((prev) =>
      next.map((line, index) => ({
        text: line.text,
        t: prev[index]?.t ?? 0,
      }))
    );
    setSaved(false);
  }

  function stamp(index: number) {
    if (!track) return;
    if (!isActive) {
      play(track, tracks);
      setError("Song started. Tap Stamp when this line is sung.");
      return;
    }
    const t = Math.max(0, Number(currentTime.toFixed(2)));
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, t } : line)));
    setError("");
    setSaved(false);
  }

  function stampNext() {
    if (nextStamp < 0) {
      setError("Every line already has a time. Tap a line to retune it.");
      return;
    }
    stamp(nextStamp);
  }

  function nudge(index: number, delta: number) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, t: Math.max(0, Number((line.t + delta).toFixed(2))) } : line
      )
    );
    setSaved(false);
  }

  function clearTimes() {
    setLines((prev) => prev.map((line) => ({ ...line, t: 0 })));
    setSaved(false);
  }

  const durationCap = finiteDuration(track.durationMs / 1000, (isActive ? duration : 0) * 1000);

  function parseDelay() {
    const value = Number(delayDraft);
    return Number.isFinite(value) ? value : 0;
  }

  function shiftAll(deltaSec: number) {
    if (!deltaSec) return;
    if (!lyricsAreSynced(lines)) {
      setError("Time the lyrics first, then add a delay.");
      return;
    }
    setLines((prev) => offsetLyricTimes(prev, deltaSec, durationCap || Number.POSITIVE_INFINITY));
    setError("");
    setSaved(false);
  }

  function applyDelay() {
    const delta = parseDelay();
    if (!delta) {
      setError("Enter a delay in seconds, like 8.5 or -1.2.");
      return;
    }
    shiftAll(delta);
  }

  function applyTemplate(template: LyricTemplate, baseLines?: LyricLine[]) {
    const next =
      baseLines ??
      lyricsFromText(draft).map((line, index) => ({
        text: line.text,
        t: lines[index]?.t ?? 0,
      }));
    const stamped = applyLyricTimes(next, template.times);
    const delay = parseDelay();
    setLines(
      delay ? offsetLyricTimes(stamped, delay, durationCap || Number.POSITIVE_INFINITY) : stamped
    );
    setDraft(next.map((line) => line.text).join("\n"));
    setTimedFrom(
      delay
        ? `${template.source}, then ${delay > 0 ? "+" : ""}${delay.toFixed(2)}s delay`
        : template.source
    );
    setError("");
    setSaved(false);
  }

  async function autoTime() {
    if (!track) return;
    const next = lyricsFromText(draft).map((line, index) => ({
      text: line.text,
      t: lines[index]?.t ?? 0,
    }));
    if (next.length < 2) {
      setError("Paste at least two lyric lines, then tap Auto-time.");
      return;
    }
    const durationSec = finiteDuration(
      track.durationMs / 1000,
      (isActive ? duration : 0) * 1000
    );
    if (durationSec < 20) {
      setError("Play the song once so we know its length, then tap Auto-time.");
      return;
    }
    setSyncing(true);
    setError("");
    setSaved(false);
    setTimedFrom("");
    setTemplates([]);
    try {
      const result = await requestLyricTimes({
        title: track.title,
        durationSec,
        lines: next.map((line) => line.text),
      });
      setTemplates(result.templates);
      if (result.templates.length === 1) {
        applyTemplate(result.templates[0], next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not auto-time those lyrics.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave() {
    if (!track) return;
    setBusy(true);
    setError("");
    try {
      const next = draft.trim() === preview ? lines : lyricsFromText(draft).map((line, index) => ({
        text: line.text,
        t: lines[index]?.t ?? 0,
      }));
      await saveLyrics(track.id, next);
      setLines(next);
      setDraft(next.map((line) => line.text).join("\n"));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lyrics.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 md:py-10">
      <Link
        to={`/track/${track.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 hover:underline"
        style={{ color: "var(--soft-ink)" }}
      >
        <ArrowLeft size={16} />
        {track.title}
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <ClayCover
          title={track.title}
          mood={track.mood}
          seed={track.coverSeed}
          size="md"
          imageUrl={coverPublicUrl(track.coverUrl)}
        />
        <div className="min-w-0">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--soft-ink)" }}
          >
            Karaoke lyrics
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
            {track.title}
          </h1>
          <p className="text-sm font-semibold" style={{ color: "var(--soft-ink)" }}>
            {ownerName(track.singerId)}
          </p>
        </div>
      </div>

      <div className="clay p-3 sm:p-4 mb-5 flex flex-wrap items-center gap-3" style={{ background: "white" }}>
        <button
          type="button"
          onClick={() => {
            if (isActive) togglePlay();
            else play(track, tracks);
          }}
          className="clay-btn w-12 h-12 flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--clay-rose)" }}
          aria-label={waiting ? "Loading" : isActive && isPlaying ? "Pause" : "Play"}
        >
          {waiting ? (
            <ClaySpinner size={18} tone="light" />
          ) : isActive && isPlaying ? (
            <Pause size={18} fill="white" className="text-white" />
          ) : (
            <Play size={18} fill="white" className="text-white ml-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1 basis-28">
          <p className="text-xs font-extrabold tabular-nums" style={{ color: "var(--ink)" }}>
            {isActive ? formatTimeFromSec(currentTime) : "0:00"}
            <span style={{ color: "var(--soft-ink)" }}>
              {" "}
              / {formatTimeFromSec(isActive ? safeDuration : track.durationMs / 1000)}
            </span>
          </p>
          <input
            type="range"
            min={0}
            max={isActive ? safeDuration || 0 : track.durationMs / 1000}
            step={0.1}
            value={isActive ? Math.min(currentTime, safeDuration || 0) : 0}
            onChange={(e) => {
              if (!isActive) play(track, tracks);
              seek(Number(e.target.value));
            }}
            className="w-full mt-1"
            style={{ accentColor: "var(--clay-rose)" }}
            aria-label="Seek"
          />
        </div>
        <button
          type="button"
          onClick={stampNext}
          className="clay-btn px-4 py-3 text-sm font-extrabold w-full sm:w-auto min-h-11"
          style={{ background: "var(--clay-mint)", color: "var(--ink)" }}
        >
          Stamp {nextStamp >= 0 ? `line ${nextStamp + 1}` : "done"}
        </button>
      </div>

      <label className="block text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color: "var(--soft-ink)" }}>
        Lyrics text
      </label>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        onBlur={applyText}
        rows={8}
        placeholder={"Verse one line\nNext line\n#INSTRUMENTAL\nChorus line"}
        className="clay w-full p-4 text-sm font-semibold leading-relaxed resize-y mb-3"
        style={{ background: "white", color: "var(--ink)", outline: "none" }}
      />
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => void autoTime()}
          disabled={syncing || busy}
          className="clay-btn px-4 py-2.5 text-sm font-extrabold inline-flex items-center gap-1.5"
          style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
        >
          {syncing ? <ButtonDots ink /> : <Sparkles size={16} />}
          Auto-time
        </button>
        <button
          type="button"
          onClick={applyText}
          className="clay-btn px-4 py-2.5 text-sm font-extrabold"
          style={{ background: "var(--clay-lilac)", color: "var(--ink)" }}
        >
          Use these lines
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft((prev) => `${prev.trim() ? `${prev.trim()}\n` : ""}#INSTRUMENTAL`);
          }}
          className="clay-btn px-4 py-2.5 text-sm font-extrabold"
          style={{ background: "white", color: "var(--ink)" }}
        >
          Add instrumental
        </button>
        <button
          type="button"
          onClick={clearTimes}
          className="clay-btn px-4 py-2.5 text-sm font-extrabold inline-flex items-center gap-1.5"
          style={{ background: "white", color: "var(--ink)" }}
        >
          <TimerReset size={16} />
          Clear times
        </button>
      </div>

      {templates.length > 0 && (
        <div className="clay p-3 sm:p-4 mb-6" style={{ background: "white" }}>
          <p className="text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: "var(--ink)" }}>
            Auto-time templates
          </p>
          <p className="text-sm font-semibold leading-snug mb-3" style={{ color: "var(--soft-ink)" }}>
            {templates.length === 1
              ? "Published karaoke times for this title."
              : "LRCLIB has more than one synced sheet. Pick the one that matches this upload."}
          </p>
          <div className="grid gap-2.5">
            {templates.map((template, index) => {
              const closest =
                templates.length > 1 &&
                durationCap > 0 &&
                Math.abs(template.durationSec - durationCap) ===
                  Math.min(...templates.map((item) => Math.abs((item.durationSec || 0) - durationCap)));
              return (
                <button
                  key={`${template.source}-${index}`}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="clay-btn w-full text-left px-3 py-3 sm:px-4 min-h-11"
                  style={{
                    background: closest ? "rgba(142,224,200,0.45)" : "var(--cream)",
                    color: "var(--ink)",
                  }}
                >
                  <span className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-70">
                          Template {index + 1}
                        </span>
                        {closest && (
                          <span
                            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.7)" }}
                          >
                            Closest length
                          </span>
                        )}
                      </span>
                      <span className="block text-sm font-extrabold leading-snug break-words [overflow-wrap:anywhere]">
                        {templateHeadline(template.label)}
                      </span>
                      <span className="block text-xs font-semibold mt-1" style={{ color: "var(--soft-ink)" }}>
                        {template.durationSec > 0 ? formatTimeFromSec(template.durationSec) : "Unknown length"}
                        {" · "}
                        {template.matched} timed lines
                      </span>
                    </span>
                    <span
                      className="text-xs font-extrabold w-full sm:w-auto text-center sm:text-right sm:flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-0"
                      style={{ borderColor: "rgba(58,47,69,0.08)" }}
                    >
                      Use this
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="clay p-3 sm:p-4 mb-6" style={{ background: "white" }}>
        <div className="flex items-start gap-2 mb-2">
          <Clock size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--ink)" }} />
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--ink)" }}>
              Sync delay
            </p>
            <p className="text-sm font-semibold leading-snug mt-1" style={{ color: "var(--soft-ink)" }}>
              YouTube videos often start later than Spotify. Positive delay waits (intro). Negative brings lyrics in sooner.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => shiftAll(-1)}
            className="clay-btn min-h-11 px-2 sm:px-3 py-2 text-sm font-extrabold"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
          >
            −1s
          </button>
          <button
            type="button"
            onClick={() => shiftAll(-0.5)}
            className="clay-btn min-h-11 px-2 sm:px-3 py-2 text-sm font-extrabold"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
          >
            −0.5s
          </button>
          <button
            type="button"
            onClick={() => shiftAll(0.5)}
            className="clay-btn min-h-11 px-2 sm:px-3 py-2 text-sm font-extrabold"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
          >
            +0.5s
          </button>
          <button
            type="button"
            onClick={() => shiftAll(1)}
            className="clay-btn min-h-11 px-2 sm:px-3 py-2 text-sm font-extrabold"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
          >
            +1s
          </button>
          <label className="col-span-2 inline-flex items-center gap-1.5 min-w-0 sm:w-auto">
            <span className="sr-only">Delay in seconds</span>
            <input
              type="number"
              step={0.1}
              inputMode="decimal"
              value={delayDraft}
              onChange={(e) => setDelayDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyDelay();
                }
              }}
              className="clay w-full sm:w-24 min-h-11 px-3 py-2 text-sm font-extrabold tabular-nums text-center"
              style={{ background: "var(--cream)", color: "var(--ink)", outline: "none" }}
              aria-label="Delay in seconds"
            />
            <span className="text-xs font-extrabold flex-shrink-0" style={{ color: "var(--soft-ink)" }}>
              sec
            </span>
          </label>
          <button
            type="button"
            onClick={applyDelay}
            className="clay-btn col-span-2 min-h-11 px-4 py-2 text-sm font-extrabold"
            style={{ background: "var(--clay-mint)", color: "var(--ink)" }}
          >
            Apply delay
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--soft-ink)" }}>
          Timing · {timedCount}/{lines.length} {synced ? "synced" : "not synced yet"}
        </p>
        <p className="hidden sm:block text-[11px] font-semibold" style={{ color: "var(--soft-ink)" }}>
          Press T to stamp the next line
        </p>
      </div>

      <div className="clay overflow-hidden mb-6" style={{ background: "white" }}>
        {lines.length === 0 ? (
          <p className="p-5 text-sm font-semibold" style={{ color: "var(--soft-ink)" }}>
            Paste lyrics above, then tap Use these lines.
          </p>
        ) : (
          lines.map((line, index) => {
            const current = nextStamp === index;
            return (
              <div
                key={`${index}-${line.text}`}
                className="flex items-center gap-2 px-3 py-2.5 min-h-12"
                style={{
                  background: current ? "rgba(142,224,200,0.35)" : index % 2 ? "rgba(244,239,230,0.5)" : "white",
                  borderBottom: "1px solid rgba(58,47,69,0.06)",
                }}
              >
                <span
                  className="w-7 text-[11px] font-extrabold tabular-nums"
                  style={{ color: "var(--soft-ink)" }}
                >
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => stamp(index)}
                  className="w-[4.5rem] text-left text-xs font-extrabold tabular-nums"
                  style={{ color: line.t > 0 ? "var(--ink)" : "var(--soft-ink)" }}
                >
                  {formatStamp(line.t)}
                </button>
                <p className="flex-1 min-w-0 text-sm font-bold truncate" style={{ color: "var(--ink)" }}>
                  {line.text}
                </p>
                <button
                  type="button"
                  onClick={() => nudge(index, -0.2)}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--cream)" }}
                  aria-label="Earlier"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(index, 0.2)}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--cream)" }}
                  aria-label="Later"
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--record-red)" }}>
          {error}
        </p>
      )}
      {timedFrom && (
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
          Timed from published karaoke times ({timedFrom}). Add a delay if this upload has a YouTube intro, then save.
        </p>
      )}
      {saved && (
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
          Lyrics saved. Open karaoke from the player to preview.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || syncing}
          className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12"
          style={{ background: "var(--clay-rose)", color: "white" }}
        >
          {busy ? <ButtonDots /> : <Save size={16} />}
          Save lyrics
        </button>
        <Link
          to={`/track/${track.id}`}
          className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12"
          style={{ background: "white", color: "var(--ink)" }}
        >
          <Captions size={16} />
          Done
        </Link>
      </div>
      <StampHotkey onStamp={stampNext} />
    </div>
  );
}

function templateHeadline(label: string) {
  const parts = label
    .split(" · ")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d+:\d{2}$/.test(part));
  const unique = [...new Set(parts)];
  return (
    unique.filter((part) => !unique.some((other) => other !== part && other.includes(part))).join(" · ") ||
    label
  );
}

function StampHotkey({ onStamp }: { onStamp: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "t" && e.key !== "T") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      e.preventDefault();
      onStamp();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStamp]);
  return null;
}
