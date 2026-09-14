import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Music, Heart, Mic, Pause, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { usePlayer } from "../context/PlayerContext";
import { useCollections } from "../context/CollectionContext";
import TrackCard from "../components/TrackCard";
import ClayCover from "../components/ClayCover";
import CollectionCard from "../components/CollectionCard";
import ClaySpinner, { LibrarySkeleton } from "../components/ClaySpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Track } from "../types";

type Tab = "home" | "songs" | "liked" | "recent";

export default function Library() {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: Tab = (tab as Tab) || "home";
  const { user } = useAuth();
  const { tracks, loading } = useTracks();
  const { collections } = useCollections();
  const { setQueue, play } = usePlayer();

  const liked = useMemo(() => tracks.filter((t) => t.likedByListener), [tracks]);
  const recent = useMemo(
    () => [...tracks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10),
    [tracks]
  );

  function playAll(list: typeof tracks) {
    if (list.length === 0) return;
    setQueue(list);
    play(list[0]);
  }

  if (loading) {
    return <LibrarySkeleton />;
  }

  return (
    <div className="px-4 md:px-8 py-5 md:py-10 max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-8 animate-slide-up">
        <h1
          className="text-2xl md:text-3xl font-extrabold flex items-center gap-2 flex-wrap"
          style={{ color: "var(--ink)" }}
        >
          {user?.role === "listener" ? (
            <>
              For you, {user.name}
              <Heart
                size={26}
                fill="var(--clay-lilac)"
                style={{ color: "var(--clay-lilac)" }}
                aria-hidden
              />
            </>
          ) : user?.role === "admin" ? (
            <>
              Library admin
              <Shield size={26} aria-hidden />
            </>
          ) : (
            <>
              Hey {user?.name}
              <Mic size={26} aria-hidden />
            </>
          )}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--soft-ink)" }}>
          {user?.role === "admin"
            ? tracks.length === 0
              ? "The library is empty."
              : `${tracks.length} song${tracks.length > 1 ? "s" : ""}. You can delete any of them.`
            : tracks.length === 0
              ? user?.role === "listener"
                ? "Waiting for Yen's next take."
                : "The studio is quiet. Leave him a song."
              : `${tracks.length} song${tracks.length > 1 ? "s" : ""} in the library`}
        </p>
      </div>

      {/* Home view */}
      {activeTab === "home" && (
        <>
          {/* Recently added */}
          {recent.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-extrabold"
                  style={{ color: "var(--ink)" }}
                >
                  Recently Added
                </h2>
                <Link
                  to="/library/recent"
                  className="text-xs font-bold hover:underline"
                  style={{ color: "var(--clay-rose)" }}
                >
                  See all
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4">
                {recent.slice(0, 5).map((track, i) => (
                  <RecentCard key={track.id} track={track} index={i} />
                ))}
              </div>
            </section>
          )}

          {collections.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold" style={{ color: "var(--ink)" }}>
                  Albums and playlists
                </h2>
                <Link
                  to="/collections"
                  className="text-xs font-bold hover:underline"
                  style={{ color: "var(--clay-rose)" }}
                >
                  See all
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4">
                {collections.slice(0, 8).map((c, i) => (
                  <CollectionCard key={c.id} collection={c} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* All songs */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-extrabold"
                style={{ color: "var(--ink)" }}
              >
                All Songs
              </h2>
              {tracks.length > 0 && (
                <button
                  onClick={() => playAll(tracks)}
                  className="clay-btn min-h-11 px-4 py-2 text-xs font-bold text-white"
                  style={{ background: "var(--clay-rose)" }}
                >
                  Play All
                </button>
              )}
            </div>
            <TrackList tracks={tracks} />
          </section>
        </>
      )}

      {activeTab === "songs" && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-lg font-extrabold"
              style={{ color: "var(--ink)" }}
            >
              All Songs
            </h2>
            {tracks.length > 0 && (
              <button
                onClick={() => playAll(tracks)}
                className="clay-btn min-h-11 px-4 py-2 text-xs font-bold text-white"
                style={{ background: "var(--clay-rose)" }}
              >
                Play All
              </button>
            )}
          </div>
          <TrackList tracks={tracks} />
        </section>
      )}

      {activeTab === "liked" && (
        <section>
          <h2
            className="text-lg font-extrabold mb-4"
            style={{ color: "var(--ink)" }}
          >
            Liked Songs
          </h2>
          {liked.length === 0 ? (
            <EmptyState
              icon={<Heart size={32} style={{ color: "var(--clay-rose)" }} />}
              text="No liked songs yet. Tap the heart on any song!"
            />
          ) : (
            <TrackList tracks={liked} />
          )}
        </section>
      )}

      {activeTab === "recent" && (
        <section>
          <h2
            className="text-lg font-extrabold mb-4"
            style={{ color: "var(--ink)" }}
          >
            Recently Added
          </h2>
          <TrackList tracks={recent} />
        </section>
      )}
    </div>
  );
}

function TrackList({ tracks }: { tracks: import("../types").Track[] }) {
  const { user } = useAuth();
  const { deleteTrack } = useTracks();
  const { currentTrack, stop } = usePlayer();
  const [pending, setPending] = useState<Track | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";

  if (tracks.length === 0) {
    return (
      <EmptyState
        icon={<Music size={32} style={{ color: "var(--clay-lilac)" }} />}
        text="No songs here yet."
      />
    );
  }
  return (
    <>
      <div className="flex flex-col gap-3">
        {tracks.map((t, i) => (
          <TrackCard
            key={t.id}
            track={t}
            index={i}
            onDelete={isAdmin ? () => setPending(t) : undefined}
          />
        ))}
      </div>
      {pending && (
        <ConfirmDialog
          title={`Delete “${pending.title}”?`}
          message="This removes the song and its audio from SpotiYen. It cannot be undone."
          confirmLabel="Delete song"
          busy={busy}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              setError("");
              try {
                const id = pending.id;
                await deleteTrack(id);
                if (currentTrack?.id === id) stop();
                setPending(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not delete that song.");
              } finally {
                setBusy(false);
              }
            })();
          }}
          onCancel={() => {
            if (!busy) setPending(null);
          }}
        />
      )}
      {error && (
        <p className="text-xs font-semibold mt-3" style={{ color: "var(--record-red)" }}>
          {error}
        </p>
      )}
    </>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="clay w-20 h-20 flex items-center justify-center mb-4"
        style={{ background: "var(--cream)" }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--soft-ink)" }}>
        {text}
      </p>
    </div>
  );
}

function RecentCard({
  track,
  index,
}: {
  track: import("../types").Track;
  index: number;
}) {
  const { play: playTrack, currentTrack, isPlaying, isBuffering, togglePlay, setQueue } = usePlayer();
  const { tracks, ownerName } = useTracks();
  const isActive = currentTrack?.id === track.id;
  const waiting = isActive && isBuffering;

  function handleClick() {
    if (isActive) {
      togglePlay();
    } else {
      setQueue(tracks);
      playTrack(track);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="clay-sm flex flex-col items-center gap-2 p-3 min-w-[132px] snap-start animate-pop-in text-center group"
      style={{
        background: isActive ? "var(--clay-peach)" : "white",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div className="relative">
        <ClayCover
          title={track.title}
          mood={track.mood}
          seed={track.coverSeed}
          size="lg"
          className="!w-20 !h-20 !rounded-xl"
        />
        {waiting && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/25">
            <ClaySpinner size={22} tone="light" />
          </div>
        )}
        {isActive && isPlaying && !waiting && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/15">
            <Pause size={16} fill="white" className="text-white" />
          </div>
        )}
      </div>
      <p
        className="text-xs font-bold truncate w-full"
        style={{ color: "var(--ink)" }}
      >
        {track.title}
      </p>
      <p className="text-[10px]" style={{ color: "var(--soft-ink)" }}>
        {ownerName(track.singerId)}
      </p>
    </button>
  );
}
