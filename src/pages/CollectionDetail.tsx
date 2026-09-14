import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Play, Plus, Trash2, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import { usePlayer } from "../context/PlayerContext";
import ClayCover from "../components/ClayCover";
import TrackCard from "../components/TrackCard";
import { readAudioDurationMs } from "../lib/audio";
import { coverPublicUrl } from "../lib/db";
import ClaySpinner, {
  ButtonDots,
  CollectionSkeleton,
  LoadingOverlay,
} from "../components/ClaySpinner";

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tracks, ownerName, publish } = useTracks();
  const { collections, loading, addTrack, removeTrack, remove, setCover } = useCollections();
  const { play, setQueue } = usePlayer();
  const [picking, setPicking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
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
  const unused = tracks.filter((t) => !collection.trackIds.includes(t.id));

  function playAll() {
    if (members.length === 0) return;
    setQueue(members);
    play(members[0]);
  }

  async function handleCoverPhoto(file: File) {
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
    setDeleting(true);
    try {
      await remove(collection.id);
      navigate("/collections");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddExisting(trackId: string) {
    setError("");
    setAddingId(trackId);
    try {
      await addTrack(collection.id, trackId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add that song. Run supabase/migrate-collections.sql in SQL Editor."
      );
    } finally {
      setAddingId(null);
    }
  }

  async function handleUploadFromDrive(file: File) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const durationMs = await readAudioDurationMs(file);
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      const track = await publish(
        {
          title,
          note: "",
          mood: "",
          coverSeed: Math.floor(Math.random() * 10000),
          durationMs,
          singerId: user.id,
          likedByListener: false,
          source: "upload",
        },
        file,
        file.name
      );
      await addTrack(collection.id, track.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that file.");
    } finally {
      setBusy(false);
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
                <button
                  onClick={() => setPicking((v) => !v)}
                  className="clay-btn min-h-11 px-5 text-sm font-bold flex items-center gap-2"
                  style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
                >
                  <Plus size={16} />
                  Add songs
                </button>
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

      {picking && isOwner && (
        <div className="clay p-4 mb-6 flex flex-col gap-3" style={{ background: "white" }}>
          <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
            Add from your phone, computer, or Drive
          </p>
          <label
            className="clay-btn min-h-12 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "var(--clay-mint)", color: "var(--ink)" }}
            aria-busy={busy}
          >
            {busy ? <ButtonDots ink /> : <Upload size={16} />}
            {busy ? "Uploading" : "Choose file from Drive or device"}
            <input
              type="file"
              className="sr-only"
              disabled={busy}
              accept="audio/*,video/mp4,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleUploadFromDrive(file);
              }}
            />
          </label>
          <p className="text-xs" style={{ color: "var(--soft-ink)" }}>
            Or tap a song already in SpotiYen
          </p>
          {error && (
            <p className="text-xs font-semibold" style={{ color: "var(--record-red)" }}>
              {error}
            </p>
          )}
          {unused.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
              No other library songs yet. Use the button above to pick a file.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {unused.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void handleAddExisting(t.id)}
                  disabled={addingId === t.id}
                  aria-busy={addingId === t.id}
                  className="clay-sm text-left px-4 py-3 text-sm font-bold flex items-center justify-between gap-3"
                  style={{ background: "var(--cream)", color: "var(--ink)" }}
                >
                  <span className="min-w-0">
                    {t.title}
                    <span className="block text-xs font-semibold" style={{ color: "var(--soft-ink)" }}>
                      {ownerName(t.singerId)}
                    </span>
                  </span>
                  {addingId === t.id && <ClaySpinner size={20} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {members.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            Empty for now.{isOwner ? " Add songs above." : ""}
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
      {busy && <LoadingOverlay message="Adding this song to the mix" />}
    </div>
  );
}
