import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
} from "lucide-react";
import ClayCover from "./ClayCover";
import ClaySpinner from "./ClaySpinner";
import { formatTimeFromSec, finiteDuration } from "../lib/audio";
import { usePlayer } from "../context/PlayerContext";
import { useTracks } from "../context/TrackContext";
import { useRef } from "react";

export default function NowPlayingBar() {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    togglePlay,
    seek,
    setVolume,
    next,
    prev,
  } = usePlayer();
  const { toggleLike, tracks, ownerName } = useTracks();

  if (!currentTrack) return null;

  const safeDuration = finiteDuration(duration, currentTrack.durationMs);
  const progress = safeDuration > 0 ? Math.min(1, currentTime / safeDuration) : 0;
  const liked =
    tracks.find((t) => t.id === currentTrack.id)?.likedByListener ?? false;

  return (
    <>
      {/* Desktop bar */}
      <div
        className="hidden md:flex fixed bottom-4 left-4 right-4 z-40 clay-float items-center gap-4 px-5 py-3"
        style={{ background: "white" }}
      >
        <div className="flex items-center gap-3 min-w-0 w-64">
          <ClayCover
            title={currentTrack.title}
            mood={currentTrack.mood}
            seed={currentTrack.coverSeed}
            size="sm"
          />
          <div className="min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--ink)" }}
            >
              {currentTrack.title}
            </p>
            <p className="text-xs" style={{ color: "var(--soft-ink)" }}>
              {ownerName(currentTrack.singerId)}
            </p>
          </div>
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="p-2 rounded-full min-w-11 min-h-11 flex items-center justify-center"
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              size={16}
              fill={liked ? "var(--clay-rose)" : "none"}
              className={
                liked ? "text-[var(--clay-rose)]" : "text-[var(--soft-ink)]"
              }
            />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="p-2 rounded-full min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Previous"
            >
              <SkipBack size={18} style={{ color: "var(--ink)" }} />
            </button>
            <button
              onClick={togglePlay}
              aria-busy={isBuffering}
              className="clay-btn w-11 h-11 flex items-center justify-center"
              style={{ background: "var(--clay-rose)" }}
              aria-label={isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <ClaySpinner size={18} tone="light" />
              ) : isPlaying ? (
                <Pause size={18} fill="white" className="text-white" />
              ) : (
                <Play size={18} fill="white" className="text-white ml-0.5" />
              )}
            </button>
            <button
              onClick={next}
              className="p-2 rounded-full min-w-11 min-h-11 flex items-center justify-center"
              aria-label="Next"
            >
              <SkipForward size={18} style={{ color: "var(--ink)" }} />
            </button>
          </div>
          <SeekBar
            currentTime={currentTime}
            duration={safeDuration}
            progress={progress}
            onSeek={seek}
          />
        </div>

        <div className="flex items-center gap-2 w-36">
          <Volume2 size={16} style={{ color: "var(--soft-ink)" }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--clay-rose)]"
            aria-label="Volume"
          />
        </div>
      </div>

      {/* Mobile player */}
      <div
        className="md:hidden fixed left-3 right-3 z-40 clay-sm px-3 pt-2.5 pb-2"
        style={{
          background: "white",
          bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center gap-2">
          <ClayCover
            title={currentTrack.title}
            mood={currentTrack.mood}
            seed={currentTrack.coverSeed}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--ink)" }}
            >
              {currentTrack.title}
            </p>
            <p className="text-[11px]" style={{ color: "var(--soft-ink)" }}>
              {ownerName(currentTrack.singerId)}
            </p>
          </div>
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
            aria-label={liked ? "Unlike" : "Like"}
          >
            <Heart
              size={18}
              fill={liked ? "var(--clay-rose)" : "none"}
              className={
                liked ? "text-[var(--clay-rose)]" : "text-[var(--soft-ink)]"
              }
            />
          </button>
          <button
            onClick={prev}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
            aria-label="Previous"
          >
            <SkipBack size={18} style={{ color: "var(--ink)" }} />
          </button>
          <button
            onClick={togglePlay}
            aria-busy={isBuffering}
            className="clay-btn w-11 h-11 flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--clay-rose)" }}
            aria-label={isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"}
          >
            {isBuffering ? (
              <ClaySpinner size={18} tone="light" />
            ) : isPlaying ? (
              <Pause size={18} fill="white" className="text-white" />
            ) : (
              <Play size={18} fill="white" className="text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={next}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0"
            aria-label="Next"
          >
            <SkipForward size={18} style={{ color: "var(--ink)" }} />
          </button>
        </div>
        <div className="mt-1.5 px-0.5">
          <SeekBar
            currentTime={currentTime}
            duration={safeDuration}
            progress={progress}
            onSeek={seek}
            compact
          />
        </div>
      </div>
    </>
  );
}

function SeekBar({
  currentTime,
  duration,
  progress,
  onSeek,
  compact = false,
}: {
  currentTime: number;
  duration: number;
  progress: number;
  onSeek: (time: number) => void;
  compact?: boolean;
}) {
  const seekRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function posToTime(clientX: number) {
    if (!seekRef.current || !duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? "w-full" : "w-full max-w-lg"}`}>
      <span
        className="text-[10px] font-semibold w-8 text-right tabular-nums"
        style={{ color: "var(--soft-ink)" }}
      >
        {formatTimeFromSec(currentTime)}
      </span>
      <div
        ref={seekRef}
        className="flex-1 h-5 flex items-center cursor-pointer touch-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          posToTime(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) posToTime(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime}
      >
        <div
          className="relative w-full h-2 rounded-full"
          style={{ background: "rgba(197,180,240,0.45)" }}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: "var(--clay-rose)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full clay-sm"
            style={{
              left: `calc(${progress * 100}% - 8px)`,
              background: "white",
            }}
          />
        </div>
      </div>
      <span
        className="text-[10px] font-semibold w-8 tabular-nums"
        style={{ color: "var(--soft-ink)" }}
      >
        {duration > 0 ? `-${formatTimeFromSec(duration - currentTime)}` : "0:00"}
      </span>
    </div>
  );
}
