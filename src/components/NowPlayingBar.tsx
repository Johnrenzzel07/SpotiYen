import {
  Captions,
  Heart,
  MoreVertical,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import ClayCover from "./ClayCover";
import ClaySpinner from "./ClaySpinner";
import { formatTimeFromSec, finiteDuration } from "../lib/audio";
import { coverPublicUrl } from "../lib/db";
import { usePlayer, type RepeatMode } from "../context/PlayerContext";
import { useTracks } from "../context/TrackContext";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function NowPlayingBar() {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlay,
    seek,
    setVolume,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    openLyrics,
    closeLyrics,
    lyricsOpen,
  } = usePlayer();
  const { toggleLike, tracks, ownerName } = useTracks();
  const [lastVolume, setLastVolume] = useState(0.8);

  if (!currentTrack) return null;

  const safeDuration = finiteDuration(duration, currentTrack.durationMs);
  const progress = safeDuration > 0 ? Math.min(1, currentTime / safeDuration) : 0;
  const liked =
    tracks.find((t) => t.id === currentTrack.id)?.likedByListener ?? false;

  function toggleMute() {
    if (volume > 0) {
      setLastVolume(volume);
      setVolume(0);
    } else {
      setVolume(lastVolume || 0.8);
    }
  }

  const cover = (
    <ClayCover
      title={currentTrack.title}
      mood={currentTrack.mood}
      seed={currentTrack.coverSeed}
      size="sm"
      imageUrl={coverPublicUrl(currentTrack.coverUrl)}
      className="!rounded-xl"
    />
  );

  const meta = (
    <div className="min-w-0">
      <p className="text-sm font-extrabold truncate leading-tight" style={{ color: "var(--ink)" }}>
        {currentTrack.title}
      </p>
      <p className="text-[11px] font-semibold truncate mt-0.5" style={{ color: "var(--soft-ink)" }}>
        {ownerName(currentTrack.singerId)}
      </p>
    </div>
  );

  const playBtn = (
    <button
      onClick={togglePlay}
      aria-busy={isBuffering}
      className="clay-btn w-12 h-12 flex items-center justify-center flex-shrink-0"
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
  );

  return (
    <>
      <div
        data-player-bar
        className="hidden md:grid fixed bottom-4 left-4 right-4 z-40 clay-float px-5 py-3.5 gap-x-6 gap-y-0 items-center overflow-visible"
        style={{
          background: "white",
          gridTemplateColumns: "1fr auto 1fr",
        }}
      >
        <div className="flex items-center gap-3 min-w-0 justify-start">
          {cover}
          {meta}
        </div>

        <div className="flex flex-col items-center gap-1.5 w-[min(42vw,28rem)] min-w-[280px]">
          <div className="flex items-center gap-1">
            <ShuffleButton on={shuffle} onClick={toggleShuffle} />
            <IconButton label="Previous" onClick={prev}>
              <SkipBack size={18} fill="var(--ink)" style={{ color: "var(--ink)" }} />
            </IconButton>
            {playBtn}
            <IconButton label="Next" onClick={next}>
              <SkipForward size={18} fill="var(--ink)" style={{ color: "var(--ink)" }} />
            </IconButton>
            <RepeatButton mode={repeat} onClick={cycleRepeat} />
          </div>
          <SeekBar
            currentTime={currentTime}
            duration={safeDuration}
            progress={progress}
            onSeek={seek}
          />
        </div>

        <div className="flex items-center justify-end gap-1 min-w-0">
          <IconButton
            label={liked ? "Unlike" : "Like"}
            onClick={() => toggleLike(currentTrack.id)}
          >
            <Heart
              size={16}
              fill={liked ? "var(--clay-rose)" : "none"}
              style={{ color: liked ? "var(--clay-rose)" : "var(--soft-ink)" }}
            />
          </IconButton>
          <IconButton
            label="Lyrics"
            onClick={lyricsOpen ? closeLyrics : openLyrics}
            pressed={lyricsOpen}
          >
            <Captions size={16} style={{ color: "var(--ink)" }} />
          </IconButton>
          <IconButton label={volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute}>
            {volume === 0 ? (
              <VolumeX size={16} style={{ color: "var(--soft-ink)" }} />
            ) : (
              <Volume2 size={16} style={{ color: "var(--soft-ink)" }} />
            )}
          </IconButton>
          <div className="w-28">
            <VolumeBar value={volume} onChange={setVolume} />
          </div>
        </div>
      </div>
    </>
  );
}

export function MobileNowPlaying() {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlay,
    seek,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    openLyrics,
    closeLyrics,
    lyricsOpen,
  } = usePlayer();
  const { toggleLike, tracks, ownerName } = useTracks();

  if (!currentTrack) return null;

  const safeDuration = finiteDuration(duration, currentTrack.durationMs);
  const progress = safeDuration > 0 ? Math.min(1, currentTime / safeDuration) : 0;
  const liked =
    tracks.find((t) => t.id === currentTrack.id)?.likedByListener ?? false;

  return (
    <div>
      <div className="px-4 pt-3">
        <SeekBar
          currentTime={currentTime}
          duration={safeDuration}
          progress={progress}
          onSeek={seek}
          compact
        />
      </div>

      <div className="flex items-center gap-3 px-4 pt-1">
        <div className="relative flex-shrink-0">
          <ClayCover
            title={currentTrack.title}
            mood={currentTrack.mood}
            seed={currentTrack.coverSeed}
            size="sm"
            imageUrl={coverPublicUrl(currentTrack.coverUrl)}
            className="!w-11 !h-11 !rounded-xl"
          />
          {isPlaying && !isBuffering && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--clay-mint)", boxShadow: "0 0 0 2px white" }}
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold truncate leading-tight" style={{ color: "var(--ink)" }}>
            {currentTrack.title}
          </p>
          <p className="text-[11px] font-semibold truncate" style={{ color: "var(--soft-ink)" }}>
            {ownerName(currentTrack.singerId)}
          </p>
        </div>
        <PlayerMoreMenu
          liked={liked}
          lyricsOpen={lyricsOpen}
          onFavorite={() => toggleLike(currentTrack.id)}
          onLyrics={() => (lyricsOpen ? closeLyrics() : openLyrics())}
        />
      </div>

      <div className="flex items-center px-2 pb-2 pt-0.5">
        <ShuffleButton on={shuffle} onClick={toggleShuffle} />
        <div className="flex-1 flex items-center justify-center">
          <IconButton label="Previous" onClick={prev}>
            <SkipBack size={18} fill="var(--ink)" style={{ color: "var(--ink)" }} />
          </IconButton>
          <button
            onClick={togglePlay}
            aria-busy={isBuffering}
            className="clay-btn w-11 h-11 flex items-center justify-center flex-shrink-0 mx-1"
            style={{ background: "var(--clay-rose)" }}
            aria-label={isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"}
          >
            {isBuffering ? (
              <ClaySpinner size={16} tone="light" />
            ) : isPlaying ? (
              <Pause size={16} fill="white" className="text-white" />
            ) : (
              <Play size={16} fill="white" className="text-white ml-0.5" />
            )}
          </button>
          <IconButton label="Next" onClick={next}>
            <SkipForward size={18} fill="var(--ink)" style={{ color: "var(--ink)" }} />
          </IconButton>
        </div>
        <RepeatButton mode={repeat} onClick={cycleRepeat} />
      </div>
    </div>
  );
}

function ShuffleButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <IconButton
      label={on ? "Shuffle on" : "Shuffle off"}
      onClick={onClick}
      pressed={on}
      tone="lilac"
    >
      <Shuffle size={16} style={{ color: on ? "var(--ink)" : "var(--soft-ink)" }} />
    </IconButton>
  );
}

function RepeatButton({ mode, onClick }: { mode: RepeatMode; onClick: () => void }) {
  const on = mode !== "off";
  const label =
    mode === "one" ? "Repeat this song" : mode === "all" ? "Repeat all" : "Repeat off";
  return (
    <IconButton label={label} onClick={onClick} pressed={on} tone="peach">
      {mode === "one" ? (
        <Repeat1 size={16} style={{ color: "var(--ink)" }} />
      ) : (
        <Repeat size={16} style={{ color: on ? "var(--ink)" : "var(--soft-ink)" }} />
      )}
    </IconButton>
  );
}

function PlayerMoreMenu({
  liked,
  lyricsOpen,
  onFavorite,
  onLyrics,
}: {
  liked: boolean;
  lyricsOpen: boolean;
  onFavorite: () => void;
  onLyrics: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, right: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function placeMenu() {
    const el = rootRef.current;
    const btn = el?.getBoundingClientRect();
    if (!btn) return;
    const bar = el?.closest("[data-player-bar]")?.getBoundingClientRect();
    const top = bar?.top ?? btn.top;
    setPos({
      bottom: Math.max(12, window.innerHeight - top + 10),
      right: Math.max(12, window.innerWidth - btn.right),
    });
  }

  function toggle() {
    placeMenu();
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", placeMenu);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placeMenu);
    };
  }, [open]);

  useEffect(() => {
    if (lyricsOpen) setOpen(false);
  }, [lyricsOpen]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="player-more-menu fixed z-[80] py-1.5 min-w-[12rem]"
          style={{
            bottom: pos.bottom,
            right: pos.right,
            background: "white",
            borderRadius: 20,
            boxShadow:
              "8px 12px 28px rgba(58,47,69,0.18), inset -2px -2px 6px rgba(58,47,69,0.05), inset 3px 3px 6px rgba(255,255,255,0.85)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={onFavorite}
            className="player-more-item w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: liked ? "var(--clay-rose)" : "var(--cream)" }}
            >
              <Heart
                size={15}
                fill={liked ? "white" : "none"}
                style={{ color: liked ? "white" : "var(--ink)" }}
              />
            </span>
            <span className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>
              {liked ? "Favorited" : "Favorite"}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLyrics();
            }}
            className="player-more-item w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: lyricsOpen ? "var(--clay-lilac)" : "var(--cream)" }}
            >
              <Captions size={15} style={{ color: "var(--ink)" }} />
            </span>
            <span className="text-sm font-extrabold" style={{ color: "var(--ink)" }}>
              Lyrics
            </span>
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative flex-shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close menu" : "More"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: open ? "var(--clay-lilac)" : "var(--cream)",
          boxShadow: open
            ? "inset 3px 3px 8px rgba(58,47,69,0.12), inset -2px -2px 4px rgba(255,255,255,0.5)"
            : "4px 4px 10px rgba(58,47,69,0.08), inset -1px -1px 3px rgba(58,47,69,0.04), inset 2px 2px 4px rgba(255,255,255,0.7)",
        }}
      >
        <MoreVertical size={18} style={{ color: "var(--ink)" }} />
      </button>
      {menu}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  pressed = false,
  tone = "cream",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  tone?: "cream" | "lilac" | "peach";
}) {
  const fill =
    !pressed
      ? "transparent"
      : tone === "lilac"
        ? "var(--clay-lilac)"
        : tone === "peach"
          ? "var(--clay-peach)"
          : "var(--cream)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background: fill,
        boxShadow: pressed
          ? "inset 3px 3px 8px rgba(58,47,69,0.12), inset -2px -2px 4px rgba(255,255,255,0.5)"
          : "none",
      }}
    >
      {children}
    </button>
  );
}

function VolumeBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function setFromX(clientX: number) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(pct);
  }

  return (
    <div
      ref={ref}
      className="h-5 flex items-center cursor-pointer touch-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      role="slider"
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
    >
      <div className="relative w-full h-1.5 rounded-full" style={{ background: "rgba(197,180,240,0.4)" }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${value * 100}%`, background: "var(--clay-lilac)" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full"
          style={{
            left: `calc(${value * 100}% - 7px)`,
            background: "white",
            boxShadow: "3px 3px 8px rgba(58,47,69,0.16)",
          }}
        />
      </div>
    </div>
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
    <div className={`flex items-center gap-2 ${compact ? "w-full" : "w-full"}`}>
      <span
        className="text-[10px] font-bold w-8 text-right tabular-nums"
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
          className="relative w-full rounded-full"
          style={{ height: compact ? 5 : 6, background: "rgba(197,180,240,0.4)" }}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: "var(--clay-rose)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: compact ? 12 : 14,
              height: compact ? 12 : 14,
              left: `calc(${progress * 100}% - ${compact ? 6 : 7}px)`,
              background: "white",
              boxShadow: "3px 3px 8px rgba(58,47,69,0.16)",
            }}
          />
        </div>
      </div>
      <span
        className="text-[10px] font-bold w-8 tabular-nums"
        style={{ color: "var(--soft-ink)" }}
      >
        {duration > 0 ? `-${formatTimeFromSec(duration - currentTime)}` : "0:00"}
      </span>
    </div>
  );
}
