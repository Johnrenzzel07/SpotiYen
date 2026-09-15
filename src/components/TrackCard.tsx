import { Heart, Play, Pause, Trash2 } from "lucide-react";
import ClayCover from "./ClayCover";
import ClaySpinner from "./ClaySpinner";
import { timeAgo, formatTime } from "../lib/audio";
import { coverPublicUrl } from "../lib/db";
import type { Track } from "../types";
import { usePlayer } from "../context/PlayerContext";
import { useTracks } from "../context/TrackContext";

interface Props {
  track: Track;
  index?: number;
  queue?: Track[];
  onRemove?: () => void;
  onDelete?: () => void;
}

export default function TrackCard({ track, index = 0, queue, onRemove, onDelete }: Props) {
  const { play, currentTrack, isPlaying, isBuffering, togglePlay } = usePlayer();
  const { tracks, toggleLike, ownerName } = useTracks();
  const isActive = currentTrack?.id === track.id;
  const waiting = isActive && isBuffering;
  const isSample = track.isSample;

  function handlePlay() {
    if (isActive) {
      togglePlay();
    } else {
      play(track, queue ?? tracks);
    }
  }

  return (
    <div
      className="clay-sm animate-pop-in group flex items-center gap-3 p-3 active:scale-[0.99] md:hover:scale-[1.01] transition-transform cursor-pointer"
      style={{
        background: isActive ? "var(--clay-peach)" : "white",
        animationDelay: `${index * 60}ms`,
      }}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.title}`}
      onKeyDown={(e) => e.key === "Enter" && handlePlay()}
    >
      <div className="relative">
        <ClayCover
          title={track.title}
          mood={track.mood}
          seed={track.coverSeed}
          size="sm"
          imageUrl={coverPublicUrl(track.coverUrl)}
        />
        {waiting ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/25">
            <ClaySpinner size={20} tone="light" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 max-md:opacity-0 max-md:group-active:opacity-100 transition-opacity">
            {isActive && isPlaying ? (
              <Pause size={18} fill="white" className="text-white" />
            ) : (
              <Play size={18} fill="white" className="text-white" />
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-bold truncate"
          style={{ color: "var(--ink)" }}
        >
          {track.title}
          {isSample && (
            <span
              className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--clay-lilac)",
                color: "var(--soft-ink)",
              }}
            >
              Sample
            </span>
          )}
        </p>
        <p
          className="text-xs truncate"
          style={{ color: "var(--soft-ink)" }}
        >
          {ownerName(track.singerId)} · {formatTime(track.durationMs)} · {timeAgo(track.createdAt)}
        </p>
      </div>

      {track.mood && (
        <span
          className="hidden sm:block text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
          style={{
            background:
              track.mood === "Late night"
                ? "var(--clay-lilac)"
                : track.mood === "For you"
                  ? "var(--clay-rose)"
                  : track.mood === "Warm-up"
                    ? "var(--clay-mint)"
                    : "var(--record-red)",
            color: track.mood === "Full send" ? "white" : "var(--ink)",
          }}
        >
          {track.mood}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(track.id);
        }}
        className="p-2 rounded-full min-w-11 min-h-11 flex items-center justify-center flex-shrink-0"
        aria-label={track.likedByListener ? "Unlike" : "Like"}
      >
        <Heart
          size={18}
          fill={track.likedByListener ? "var(--clay-rose)" : "none"}
          className={
            track.likedByListener
              ? "text-[var(--clay-rose)]"
              : "text-[var(--soft-ink)]"
          }
        />
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="clay-btn w-11 h-11 flex items-center justify-center flex-shrink-0"
          style={{ background: "white", color: "var(--record-red)" }}
          aria-label="Delete song"
        >
          <Trash2 size={16} />
        </button>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="clay-btn w-11 h-11 flex items-center justify-center flex-shrink-0"
          style={{ background: "white", color: "var(--record-red)" }}
          aria-label="Remove from this album"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
