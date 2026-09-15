import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Captions, Heart, PenLine, Play, Pause, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { usePlayer } from "../context/PlayerContext";
import ClayCover from "../components/ClayCover";
import ClaySpinner, { LibrarySkeleton } from "../components/ClaySpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatTime, timeAgo } from "../lib/audio";
import { coverPublicUrl } from "../lib/db";

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tracks, loading, toggleLike, ownerName, deleteTrack } = useTracks();
  const { play, currentTrack, isPlaying, isBuffering, togglePlay, stop, openLyrics } = usePlayer();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const track = tracks.find((t) => t.id === id);

  if (loading) {
    return <LibrarySkeleton />;
  }

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

  const isActive = currentTrack?.id === track.id;
  const waiting = isActive && isBuffering;

  function handlePlay() {
    if (!track) return;
    if (isActive) {
      togglePlay();
    } else {
      play(track, tracks);
    }
  }

  function handleLyrics() {
    if (!track) return;
    if (!isActive) play(track, tracks);
    openLyrics();
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-5 md:py-10">
      {/* Back */}
      <Link
        to="/library"
        className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 hover:underline"
        style={{ color: "var(--soft-ink)" }}
      >
        <ArrowLeft size={16} />
        Library
      </Link>

      {/* Cover */}
      <div className="flex flex-col items-center gap-5 animate-slide-up">
        <ClayCover
          title={track.title}
          mood={track.mood}
          seed={track.coverSeed}
          size="xl"
          imageUrl={coverPublicUrl(track.coverUrl)}
        />

        <div className="text-center">
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {track.title}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--soft-ink)" }}>
            {ownerName(track.singerId)} · {formatTime(track.durationMs)} · {timeAgo(track.createdAt)}
          </p>
          {track.isSample && (
            <span
              className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "var(--clay-lilac)",
                color: "var(--soft-ink)",
              }}
            >
              Sample track — replace with a real recording
            </span>
          )}
        </div>

        {/* Mood tag */}
        {track.mood && (
          <span
            className="clay-sm px-5 py-2 text-sm font-bold"
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

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={handlePlay}
            aria-busy={waiting}
            className="clay-btn w-14 h-14 flex items-center justify-center"
            style={{ background: "var(--clay-rose)" }}
            aria-label={waiting ? "Loading" : isActive && isPlaying ? "Pause" : "Play"}
          >
            {waiting ? (
              <ClaySpinner size={22} tone="light" />
            ) : isActive && isPlaying ? (
              <Pause size={24} fill="white" className="text-white" />
            ) : (
              <Play size={24} fill="white" className="text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={() => toggleLike(track.id)}
            className="clay-btn w-14 h-14 flex items-center justify-center"
            style={{
              background: track.likedByListener
                ? "var(--clay-rose)"
                : "white",
            }}
            aria-label={track.likedByListener ? "Unlike" : "Like"}
          >
            <Heart
              size={24}
              fill={track.likedByListener ? "white" : "none"}
              className={
                track.likedByListener
                  ? "text-white"
                  : "text-[var(--soft-ink)]"
              }
            />
          </button>
          {user?.role === "admin" && (
            <button
              onClick={() => setConfirm(true)}
              className="clay-btn w-14 h-14 flex items-center justify-center"
              style={{ background: "white", color: "var(--record-red)" }}
              aria-label="Delete song"
            >
              <Trash2 size={22} />
            </button>
          )}
        </div>
        {(track.lyrics.length > 0 || user?.role === "admin") && (
          <div className="flex items-center gap-3">
            {track.lyrics.length > 0 && (
              <button
                type="button"
                onClick={handleLyrics}
                className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center gap-2"
                style={{ background: "var(--clay-lilac)", color: "var(--ink)" }}
              >
                <Captions size={16} />
                Karaoke
              </button>
            )}
            {user?.role === "admin" && (
              <Link
                to={`/track/${track.id}/lyrics`}
                className="clay-btn px-5 py-3 text-sm font-extrabold inline-flex items-center gap-2"
                style={{ background: "white", color: "var(--ink)" }}
              >
                <PenLine size={16} />
                {track.lyrics.length > 0 ? "Edit lyrics" : "Add lyrics"}
              </Link>
            )}
          </div>
        )}
        {error && (
          <p className="text-xs font-semibold" style={{ color: "var(--record-red)" }}>
            {error}
          </p>
        )}

        {/* Note */}
        {track.note && (
          <div
            className="clay w-full p-5 mt-4"
            style={{ background: "white" }}
          >
            <p
              className="text-xs font-bold mb-2 uppercase tracking-wider"
              style={{ color: "var(--soft-ink)" }}
            >
              Note from {ownerName(track.singerId)}
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink)" }}
            >
              {track.note}
            </p>
          </div>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${track.title}”?`}
          message="This removes the song and its audio from SpotiYen. It cannot be undone."
          confirmLabel="Delete song"
          busy={busy}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              setError("");
              try {
                await deleteTrack(track.id);
                if (currentTrack?.id === track.id) stop();
                navigate("/library");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not delete that song.");
                setConfirm(false);
              } finally {
                setBusy(false);
              }
            })();
          }}
          onCancel={() => {
            if (!busy) setConfirm(false);
          }}
        />
      )}
    </div>
  );
}
