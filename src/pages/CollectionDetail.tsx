import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Play, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import { usePlayer } from "../context/PlayerContext";
import ClayCover from "../components/ClayCover";
import TrackCard from "../components/TrackCard";
import { coverPublicUrl } from "../lib/db";
import ClaySpinner, { CollectionSkeleton } from "../components/ClaySpinner";

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tracks, ownerName } = useTracks();
  const { collections, loading, removeTrack, remove, setCover } = useCollections();
  const { play, setQueue } = usePlayer();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const collection = collections.find((c) => c.id === id);

  const members = useMemo(() => {
    if (!collection) return [];
    return collection.trackIds
      .map((tid) => tracks.find((t) => t.id === tid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [collection, tracks]);

  if (loading) {
    return <CollectionSkeleton />;
  }

  if (!collection) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-bold" style={{ color: "var(--ink)" }}>
          Album not found
        </p>
        <Link to="/collections" className="text-sm font-bold" style={{ color: "var(--clay-rose)" }}>
          Back
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === collection.ownerId;
  const isAlbum = collection.kind === "album";

  function playAll() {
    if (members.length === 0) return;
    setQueue(members);
    play(members[0]);
  }

  async function handleCoverPhoto(file: File) {
    if (!collection) return;
    setCoverBusy(true);
    setError("");
    try {
      await setCover(collection.id, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleDelete() {
    if (!collection) return;
    setDeleting(true);
    try {
      await remove(collection.id);
      navigate("/collections");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <Link
        to="/collections"
        className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6"
        style={{ color: "var(--soft-ink)" }}
      >
        <ArrowLeft size={16} />
        Albums and playlists
      </Link>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
        <div className="relative">
          <ClayCover
            title={collection.title}
            mood={isAlbum ? "For you" : "Late night"}
            seed={collection.coverSeed}
            size="xl"
            imageUrl={coverPublicUrl(collection.coverUrl)}
          />
          {isOwner && (
            <label
              className={`absolute inset-0 rounded-2xl flex flex-col items-center cursor-pointer ${
                coverBusy ? "justify-center" : "justify-end pb-3"
              }`}
              style={{ background: coverBusy ? "rgba(58,47,69,0.35)" : "transparent" }}
              aria-label={collection.coverUrl ? "Change cover photo" : "Add cover photo"}
            >
              {coverBusy ? (
                <ClaySpinner size={28} tone="light" />
              ) : (
                <span className="clay-sm px-3 py-1.5 text-[11px] font-bold flex items-center gap-1" style={{ background: "white", color: "var(--ink)" }}>
                  <ImagePlus size={12} />
                  {collection.coverUrl ? "Change photo" : "Add photo"}
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={coverBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleCoverPhoto(file);
                }}
              />
            </label>
          )}
        </div>
        <div className="text-center sm:text-left min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--soft-ink)" }}>
            {isAlbum ? "Album" : "Playlist"}
          </p>
          <h1 className="text-2xl font-extrabold mt-1" style={{ color: "var(--ink)" }}>
            {collection.title}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--soft-ink)" }}>
            {ownerName(collection.ownerId)} · {members.length} song{members.length === 1 ? "" : "s"}
          </p>
          {collection.note && (
            <p className="text-sm mt-3" style={{ color: "var(--ink)" }}>
              {collection.note}
            </p>
          )}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
            <button
              onClick={playAll}
              disabled={members.length === 0}
              className="clay-btn min-h-11 px-5 text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "var(--clay-rose)" }}
            >
              <Play size={16} fill="white" />
              Play
            </button>
            {isOwner && (
              <>
                <Link
                  to={`/upload?to=${collection.id}`}
                  className="clay-btn min-h-11 px-5 text-sm font-bold flex items-center gap-2"
                  style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
                >
                  <Plus size={16} />
                  Add songs
                </Link>
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  aria-busy={deleting}
                  className="clay-btn min-h-11 w-11 flex items-center justify-center"
                  style={{ background: "white", color: "var(--record-red)" }}
                  aria-label="Delete"
                >
                  {deleting ? <ClaySpinner size={16} /> : <Trash2 size={16} />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold mb-4" style={{ color: "var(--record-red)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {members.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            Empty for now.
            {isOwner ? (
              <>
                {" "}
                <Link to={`/upload?to=${collection.id}`} className="font-bold" style={{ color: "var(--clay-rose)" }}>
                  Upload a song
                </Link>{" "}
                to add it here.
              </>
            ) : null}
          </p>
        ) : (
          members.map((t, i) => (
            <TrackCard
              key={t.id}
              track={t}
              index={i}
              queue={members}
              onRemove={
                isOwner
                  ? () => void removeTrack(collection.id, t.id)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
