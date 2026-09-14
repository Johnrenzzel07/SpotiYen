import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, ListMusic, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import CollectionCard from "../components/CollectionCard";
import type { CollectionKind } from "../types";
import { ButtonDots, CollectionSkeleton } from "../components/ClaySpinner";

export default function Collections() {
  const { user } = useAuth();
  const { ownerName } = useTracks();
  const { collections, loading, missingTables, create } = useCollections();
  const navigate = useNavigate();
  const [kind, setKind] = useState<CollectionKind>("album");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const mine = useMemo(
    () => collections.filter((c) => c.ownerId === user?.id),
    [collections, user]
  );
  const theirs = useMemo(
    () => collections.filter((c) => c.ownerId !== user?.id),
    [collections, user]
  );

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function onPhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await create(kind, title.trim(), undefined, photo);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setTitle("");
      setPhoto(null);
      setPhotoPreview("");
      navigate(`/collection/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <CollectionSkeleton />;
  }

  if (missingTables) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="clay p-5" style={{ background: "white" }}>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--ink)" }}>
            One more SQL step
          </h1>
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            Open Supabase SQL Editor, paste <strong>supabase/migrate-collections.sql</strong>, click Run, then refresh.
          </p>
        </div>
      </div>
    );
  }

  const otherName = theirs[0] ? ownerName(theirs[0].ownerId) : user?.role === "singer" ? "John" : "Yen";

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <ListMusic size={26} />
        Albums and playlists
      </h1>
      <p className="text-sm mt-1 mb-6" style={{ color: "var(--soft-ink)" }}>
        Yours and {otherName}&apos;s. Both of you can open everything.
      </p>

      <form
        onSubmit={handleCreate}
        className="clay p-4 mb-8 flex flex-col gap-3"
        style={{ background: "white" }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("album")}
            className="clay-btn min-h-11 px-4 text-xs font-bold"
            style={{
              background: kind === "album" ? "var(--clay-peach)" : "var(--cream)",
              color: "var(--ink)",
            }}
          >
            Album
          </button>
          <button
            type="button"
            onClick={() => setKind("playlist")}
            className="clay-btn min-h-11 px-4 text-xs font-bold"
            style={{
              background: kind === "playlist" ? "var(--clay-lilac)" : "var(--cream)",
              color: "var(--ink)",
            }}
          >
            Playlist
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-20 h-20 flex-shrink-0">
            <label
              className="w-20 h-20 clay-sm overflow-hidden cursor-pointer flex items-center justify-center"
              style={{ background: "var(--cream)" }}
              aria-label="Add cover photo"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={22} style={{ color: "var(--clay-rose)" }} />
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <button
                type="button"
                onClick={() => onPhoto(null)}
                className="absolute -top-1 -right-1 clay-btn w-7 h-7 flex items-center justify-center z-10"
                style={{ background: "white", color: "var(--ink)" }}
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "album" ? "Album name" : "Playlist name"}
              className="flex-1 clay-sm px-4 py-3 text-base outline-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            />
            <button
              type="submit"
              disabled={!title.trim() || busy}
              aria-busy={busy}
              className="clay-btn min-h-12 px-5 text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: "var(--clay-rose)" }}
            >
              {busy ? (
                <ButtonDots />
              ) : (
                <>
                  <Plus size={16} />
                  Create
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--soft-ink)" }}>
          {photo ? photo.name : "Optional: tap the square to add a cover photo"}
        </p>
      </form>
      {error && (
        <p className="text-xs font-semibold mb-4" style={{ color: "var(--record-red)" }}>
          {error}
        </p>
      )}

      <Section title="Your albums" items={mine.filter((c) => c.kind === "album")} empty="Make an album. They will see it too." />
      <Section title="Your playlists" items={mine.filter((c) => c.kind === "playlist")} empty="Make a playlist for the two of you." />
      <Section title={`${otherName}'s albums`} items={theirs.filter((c) => c.kind === "album")} empty={`${otherName} has no albums yet.`} />
      <Section title={`${otherName}'s playlists`} items={theirs.filter((c) => c.kind === "playlist")} empty={`${otherName} has no playlists yet.`} />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: import("../types").Collection[];
  empty: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-extrabold mb-3" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((c, i) => (
            <CollectionCard key={c.id} collection={c} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
