import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Captions,
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
import { applyLyricTimes, formatStamp, lyricsAreSynced, lyricsFromText } from "../lib/lyrics";
import { requestLyricTimes } from "../lib/lyricsSync";
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

  useEffect(() => {
    if (!track || loadedId === track.id) return;
    setLines(track.lyrics);
    setDraft(track.lyrics.map((line) => line.text).join("\n"));
    setLoadedId(track.id);
    setError("");
    setSaved(false);
    setTimedFrom("");
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
      isActive ? duration : 0,
      track.durationMs
    );
    if (durationSec < 20) {
      setError("Play the song once so we know its length, then tap Auto-time.");
      return;
    }
    setSyncing(true);
    setError("");
    setSaved(false);
    setTimedFrom("");
    try {
      const result = await requestLyricTimes({
        title: track.title,
        durationSec,
        lines: next.map((line) => line.text),
      });
      setLines(applyLyricTimes(next, result.times));
      setDraft(next.map((line) => line.text).join("\n"));
      setTimedFrom(result.source);
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

      <div className="clay p-4 mb-5" style={{ background: "white" }}>
        <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--soft-ink)" }}>
          Paste one lyric per line. Auto-time looks up a published karaoke/LRC timing sheet for this title and stamps those seconds onto your lines.
        </p>
      </div>

      <div className="clay p-4 mb-5 flex flex-wrap items-center gap-3" style={{ background: "white" }}>
        <button
          type="button"
          onClick={() => {
            if (isActive) togglePlay();
            else play(track, tracks);
          }}
          className="clay-btn w-12 h-12 flex items-center justify-center"
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
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold" style={{ color: "var(--ink)" }}>
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
          className="clay-btn px-4 py-3 text-sm font-extrabold"
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

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--soft-ink)" }}>
          Timing · {timedCount}/{lines.length} {synced ? "synced" : "not synced yet"}
        </p>
        <p className="text-[11px] font-semibold" style={{ color: "var(--soft-ink)" }}>
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
                className="flex items-center gap-2 px-3 py-2.5"
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
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "var(--cream)" }}
                  aria-label="Earlier"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(index, 0.2)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
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
          Timed from published karaoke times ({timedFrom}). Nudge anything that’s off, then save.
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
          className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center gap-2"
          style={{ background: "var(--clay-rose)", color: "white" }}
        >
          {busy ? <ButtonDots /> : <Save size={16} />}
          Save lyrics
        </button>
        <Link
          to={`/track/${track.id}`}
          className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center gap-2"
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
