import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import ClayCover from "./ClayCover";
import { useTracks } from "../context/TrackContext";
import { coverPublicUrl } from "../lib/db";
import type { Track } from "../types";

interface Props {
  track: Track;
  onPlay: () => void;
  onDismiss: () => void;
}

export default function Toast({ track, onPlay, onDismiss }: Props) {
  const [exiting, setExiting] = useState(false);
  const { ownerName } = useTracks();

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed z-50 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-auto ${
        exiting ? "toast-exit" : "toast-enter"
      }`}
      style={{ top: "max(12px, env(safe-area-inset-top))" }}
    >
      <div
        className="clay flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 max-w-lg mx-auto"
        style={{ background: "white" }}
      >
        <ClayCover
          title={track.title}
          mood={track.mood}
          seed={track.coverSeed}
          size="sm"
          imageUrl={coverPublicUrl(track.coverUrl)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: "var(--soft-ink)" }}>
            {ownerName(track.singerId)} just dropped a song
          </p>
          <p
            className="text-sm font-bold truncate"
            style={{ color: "var(--ink)" }}
          >
            {track.title}
          </p>
        </div>
        <button
          onClick={onPlay}
          className="clay-btn flex items-center justify-center gap-1.5 min-h-11 px-3 text-xs font-bold text-white flex-shrink-0"
          style={{ background: "var(--clay-rose)" }}
          aria-label="Play now"
        >
          <Play size={14} fill="white" />
          <span className="hidden sm:inline">Play</span>
        </button>
        <button
          onClick={() => {
            setExiting(true);
            setTimeout(onDismiss, 300);
          }}
          className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full"
          aria-label="Dismiss"
        >
          <X size={16} style={{ color: "var(--soft-ink)" }} />
        </button>
      </div>
    </div>
  );
}
