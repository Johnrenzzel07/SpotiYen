import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Captions,
  ChevronDown,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { useTracks } from "../context/TrackContext";
import { coverPublicUrl } from "../lib/db";
import {
  activeLyricIndex,
  isInstrumental,
  lyricsAreSynced,
} from "../lib/lyrics";
import { finiteDuration, formatTimeFromSec } from "../lib/audio";
import ClayCover from "./ClayCover";
import ClaySpinner from "./ClaySpinner";

function karaokeTheme(mood: string) {
  switch (mood) {
    case "Late night":
      return { bg: "#231B30", active: "#F4EEFF", dim: "rgba(244,238,255,0.34)", accent: "#C5B4F0" };
    case "For you":
      return { bg: "#4A2A36", active: "#FFF3F6", dim: "rgba(255,243,246,0.36)", accent: "#F2A6B8" };
    case "Warm-up":
      return { bg: "#38291F", active: "#FFE9D4", dim: "rgba(255,233,212,0.38)", accent: "#FFC89A" };
    case "Full send":
      return { bg: "#3A1C26", active: "#FFD9E0", dim: "rgba(255,217,224,0.38)", accent: "#E85D75" };
    default:
      return { bg: "#2C2438", active: "#F4EFE6", dim: "rgba(244,239,230,0.36)", accent: "#C5B4F0" };
  }
}

export default function LyricsKaraoke() {
  const { user } = useAuth();
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    isBuffering,
    lyricsOpen,
    closeLyrics,
    togglePlay,
    seek,
    next,
    prev,
  } = usePlayer();
  const { tracks, ownerName } = useTracks();
  const listRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const track = currentTrack
    ? tracks.find((item) => item.id === currentTrack.id) ?? currentTrack
    : null;
  const lines = track?.lyrics ?? [];
  const synced = lyricsAreSynced(lines);
  const active = synced ? activeLyricIndex(lines, currentTime) : -1;
  const theme = karaokeTheme(track?.mood || "");
  const isAdmin = user?.role === "admin";
  const safeDuration = finiteDuration(duration, track?.durationMs);
  const progress = safeDuration > 0 ? Math.min(1, currentTime / safeDuration) : 0;

  useEffect(() => {
    if (!currentTrack && lyricsOpen) closeLyrics();
  }, [currentTrack, lyricsOpen, closeLyrics]);

  useEffect(() => {
    if (!lyricsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLyrics();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lyricsOpen, closeLyrics]);

  useEffect(() => {
    if (!lyricsOpen || active < 0) return;
    lineRefs.current[active]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [active, lyricsOpen]);

  if (!lyricsOpen || !track) return null;

  function onLineClick(index: number) {
    if (!synced) return;
    const time = lines[index]?.t ?? 0;
    if (time > 0) seek(time);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: theme.bg, color: theme.active }}
      role="dialog"
      aria-label="Lyrics"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: track.coverUrl
            ? `linear-gradient(${theme.bg}cc, ${theme.bg}), url(${coverPublicUrl(track.coverUrl)})`
            : `radial-gradient(circle at 20% 0%, ${theme.accent}55, transparent 55%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(18px)",
        }}
        aria-hidden
      />

      <header className="relative z-10 flex items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={closeLyrics}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.12)" }}
          aria-label="Close lyrics"
        >
          <ChevronDown size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-70">
            Karaoke
          </p>
          <p className="text-sm font-extrabold truncate">{track.title}</p>
          <p className="text-xs font-semibold truncate opacity-70">
            {ownerName(track.singerId)}
          </p>
        </div>
        {isAdmin && (
          <Link
            to={`/track/${track.id}/lyrics`}
            onClick={closeLyrics}
            className="text-xs font-extrabold px-3 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            Edit
          </Link>
        )}
      </header>

      <div
        ref={listRef}
        className="karaoke-scroll relative z-10 flex-1 overflow-y-auto px-6 md:px-10 py-8"
      >
        <div className="max-w-2xl mx-auto min-h-full flex flex-col justify-center">
          {lines.length === 0 ? (
            <div className="text-center py-16">
              <Captions size={42} className="mx-auto mb-4 opacity-70" />
              <p className="text-2xl font-extrabold">No lyrics yet</p>
              <p className="text-sm font-semibold mt-2 opacity-70">
                {isAdmin
                  ? "Add the words, then tap along with the song to time each line."
                  : "Admin can add karaoke lyrics for this song."}
              </p>
              {isAdmin && (
                <Link
                  to={`/track/${track.id}/lyrics`}
                  onClick={closeLyrics}
                  className="inline-flex mt-6 px-5 py-3 rounded-full text-sm font-extrabold"
                  style={{ background: theme.accent, color: "#3A2F45" }}
                >
                  Add lyrics
                </Link>
              )}
            </div>
          ) : (
            <>
              {!synced && (
                <p
                  className="text-center text-sm font-bold mb-10 opacity-70"
                  style={{ color: theme.dim }}
                >
                  These lyrics aren’t time-synced, yet
                </p>
              )}
              {synced && active < 0 && (
                <p
                  className="text-center font-extrabold mb-8 opacity-40"
                  style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)" }}
                >
                  ♪
                </p>
              )}
              {lines.map((line, index) => {
                const instrumental = isInstrumental(line.text);
                const isActive = index === active;
                const passed = synced && active >= 0 && index < active;
                return (
                  <button
                    key={`${index}-${line.text}`}
                    type="button"
                    ref={(el) => {
                      lineRefs.current[index] = el;
                    }}
                    onClick={() => onLineClick(index)}
                    className={`karaoke-line block w-full text-left py-2.5 md:py-3 ${
                      isActive ? "karaoke-line-active" : ""
                    }`}
                    style={{
                      color: isActive ? theme.active : theme.dim,
                      opacity: passed ? 0.45 : 1,
                      fontStyle: instrumental ? "italic" : "normal",
                      fontSize: synced
                        ? isActive
                          ? "clamp(1.7rem, 4.6vw, 3.1rem)"
                          : "clamp(1.2rem, 3.2vw, 2.15rem)"
                        : "clamp(1.15rem, 2.8vw, 1.85rem)",
                      fontWeight: isActive || !synced ? 800 : 700,
                      lineHeight: 1.25,
                      cursor: synced && line.t > 0 ? "pointer" : "default",
                    }}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {instrumental ? "♪ Instrumental" : line.text}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div
        className="relative z-10 px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]"
        style={{ background: `linear-gradient(transparent, ${theme.bg})` }}
      >
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <ClayCover
              title={track.title}
              mood={track.mood}
              seed={track.coverSeed}
              size="sm"
              imageUrl={coverPublicUrl(track.coverUrl)}
              className="!w-12 !h-12 !rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold truncate">{track.title}</p>
              <p className="text-[11px] font-semibold truncate opacity-70">
                {ownerName(track.singerId)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold w-8 text-right tabular-nums opacity-70">
              {formatTimeFromSec(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration || 0}
              step={0.1}
              value={Math.min(currentTime, safeDuration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              className="karaoke-seek flex-1"
              style={{ accentColor: theme.accent }}
              aria-label="Seek"
            />
            <span className="text-[10px] font-bold w-8 tabular-nums opacity-70">
              {safeDuration > 0 ? `-${formatTimeFromSec(safeDuration - currentTime)}` : "0:00"}
            </span>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button type="button" onClick={prev} aria-label="Previous" className="p-2">
              <SkipBack size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: theme.accent, color: "#3A2F45" }}
              aria-label={isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <ClaySpinner size={20} tone="light" />
              ) : isPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button type="button" onClick={next} aria-label="Next" className="p-2">
              <SkipForward size={22} fill="currentColor" />
            </button>
          </div>
          <p className="sr-only">{Math.round(progress * 100)} percent</p>
        </div>
      </div>
    </div>
  );
}
