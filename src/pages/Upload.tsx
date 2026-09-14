import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Upload as UploadIcon,
  CheckCircle2,
  AlertCircle,
  Mic,
  ImagePlus,
  X,
  Disc,
  ListMusic,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import { formatTime, readAudioDurationMs } from "../lib/audio";
import type { CollectionKind, Mood } from "../types";
import ClaySpinner, { ButtonDots, ClayProgress, LoadingOverlay } from "../components/ClaySpinner";

const MOODS: Mood[] = ["Late night", "For you", "Warm-up", "Full send"];

type UploadTab = "song" | "album" | "playlist";

function parseTab(value: string | null): UploadTab {
  if (value === "album" || value === "playlist") return value;
  return "song";
}

export default function Upload() {
  const { user } = useAuth();
  const { publish, tracks, ownerName } = useTracks();
  const { collections, addTrack, create, missingTables } = useCollections();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const presetTo = searchParams.get("to") || "";

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<Mood | "">("");
  const [albumId, setAlbumId] = useState(presetTo);
  const [durationMs, setDurationMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"song" | CollectionKind | null>(null);
  const [doneAlbumId, setDoneAlbumId] = useState("");
  const [error, setError] = useState("");
  const [coverSeed] = useState(() => Math.floor(Math.random() * 10000));
  const [uploadPct, setUploadPct] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [mixTitle, setMixTitle] = useState("");
  const [mixNote, setMixNote] = useState("");

  const selectedAlbum = collections.find((c) => c.id === albumId);
  const albumOptions = useMemo(() => {
    const mine = collections.filter((c) => c.ownerId === user?.id);
    if (selectedAlbum && !mine.some((c) => c.id === selectedAlbum.id)) {
      return [selectedAlbum, ...mine];
    }
    return mine;
  }, [collections, user, selectedAlbum]);
  const unused = selectedAlbum
    ? tracks.filter((t) => !selectedAlbum.trackIds.includes(t.id))
    : [];

  useEffect(() => {
    if (presetTo) setAlbumId(presetTo);
  }, [presetTo]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function setTab(next: UploadTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "song") params.delete("tab");
    else params.set("tab", next);
    if (next !== "song") params.delete("to");
    setSearchParams(params, { replace: true });
    setError("");
    setDone(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
  }

  function onPhoto(next: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(next);
    setPhotoPreview(next ? URL.createObjectURL(next) : "");
  }

  function resetSongFields() {
    setFile(null);
    setTitle("");
    setNote("");
    setMood("");
    setDurationMs(0);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
  }

  function resetMixFields() {
    setMixTitle("");
    setMixNote("");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
  }

  async function onFile(next: File | null) {
    setFile(next);
    setDone(null);
    setError("");
    if (!next) {
      setDurationMs(0);
      setReadingFile(false);
      return;
    }
    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    }
    setReadingFile(true);
    setDurationMs(await readAudioDurationMs(next));
    setReadingFile(false);
  }

  async function handleSubmitSong(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user || !title.trim()) return;
    setBusy(true);
    setError("");
    setUploadPct(8);
    const interval = window.setInterval(() => {
      setUploadPct((pct) => Math.min(pct + Math.random() * 18, 90));
    }, 220);
    try {
      const track = await publish(
        {
          title: title.trim(),
          note: note.trim(),
          mood,
          coverSeed,
          durationMs,
          singerId: user.id,
          likedByListener: false,
          source: "upload",
        },
        file,
        file.name,
        photo
      );
      if (albumId) {
        try {
          await addTrack(albumId, track.id);
        } catch {}
      }
      setUploadPct(100);
      setDoneAlbumId(albumId);
      setDone("song");
      resetSongFields();
      setAlbumId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      clearInterval(interval);
      setBusy(false);
      setUploadPct(0);
    }
  }

  async function handleCreateMix(e: React.FormEvent) {
    e.preventDefault();
    if (!mixTitle.trim() || (tab !== "album" && tab !== "playlist")) return;
    setBusy(true);
    setError("");
    try {
      const created = await create(tab, mixTitle.trim(), mixNote.trim(), photo);
      resetMixFields();
      setDoneAlbumId(created.id);
      setDone(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddExisting(trackId: string) {
    if (!albumId) return;
    setAddingId(trackId);
    setError("");
    try {
      await addTrack(albumId, trackId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that song.");
    } finally {
      setAddingId(null);
    }
  }

  const doneAlbum = collections.find((c) => c.id === doneAlbumId);

  if (done) {
    const mixDone = done === "album" || done === "playlist";
    return (
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center text-center gap-4">
        <div
          className="clay w-20 h-20 flex items-center justify-center"
          style={{ background: "var(--clay-mint)" }}
        >
          <CheckCircle2 size={36} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
          {done === "song"
            ? "It is in the shared library"
            : done === "album"
              ? "Album is ready"
              : "Playlist is ready"}
        </h1>
        <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
          {done === "song"
            ? "Both of you can play it now."
            : "Both of you can open it. Add songs whenever you want."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {mixDone && doneAlbum && (
            <button
              onClick={() => {
                setDone(null);
                const params = new URLSearchParams();
                params.set("to", doneAlbum.id);
                setSearchParams(params, { replace: true });
                setAlbumId(doneAlbum.id);
              }}
              className="clay-btn min-h-12 px-8 py-3 text-sm font-bold"
              style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
            >
              Add songs
            </button>
          )}
          {doneAlbum && (
            <Link
              to={`/collection/${doneAlbum.id}`}
              className="clay-btn min-h-12 px-8 py-3 text-sm font-bold"
              style={{
                background: mixDone ? "white" : "var(--clay-peach)",
                color: "var(--ink)",
              }}
            >
              Open {doneAlbum.title}
            </Link>
          )}
          <button
            onClick={() => {
              setDone(null);
              if (presetTo) setAlbumId(presetTo);
            }}
            className="clay-btn min-h-12 px-8 py-3 text-sm font-bold text-white"
            style={{ background: "var(--clay-rose)" }}
          >
            {done === "song" ? "Upload another" : "Create another"}
          </button>
        </div>
      </div>
    );
  }

  const mixKind: CollectionKind = tab === "playlist" ? "playlist" : "album";

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
        Upload
      </h1>
      <p className="text-sm mt-1 mb-5" style={{ color: "var(--soft-ink)" }}>
        Song, album, or playlist. It shows up for both of you.
      </p>

      <div className="flex gap-2 mb-5" role="tablist" aria-label="What to upload">
        <TabButton active={tab === "song"} onClick={() => setTab("song")} label="Song" />
        <TabButton
          active={tab === "album"}
          onClick={() => setTab("album")}
          label="Album"
          tone="peach"
        />
        <TabButton
          active={tab === "playlist"}
          onClick={() => setTab("playlist")}
          label="Playlist"
          tone="lilac"
        />
      </div>

      {tab === "song" && user?.role === "singer" && (
        <Link
          to="/record"
          className="clay-sm mb-5 flex items-center gap-3 p-3"
          style={{ background: "white", color: "var(--ink)" }}
        >
          <Mic size={18} />
          <span className="text-sm font-bold">Or record live in Studio</span>
        </Link>
      )}

      {tab === "song" ? (
        <>
          <form
            onSubmit={handleSubmitSong}
            className="clay p-5 flex flex-col gap-4"
            style={{ background: "white" }}
          >
            <label
              className="clay-sm flex flex-col items-center justify-center gap-2 min-h-32 px-4 py-6 cursor-pointer text-center"
              style={{ background: "var(--cream)" }}
            >
              <UploadIcon size={28} style={{ color: "var(--clay-rose)" }} />
              <span className="text-sm font-bold">
                {file ? file.name : "Choose from Drive or device"}
              </span>
              <span className="text-xs" style={{ color: "var(--soft-ink)" }}>
                MP3, WAV, M4A, or WebM
              </span>
              <input
                type="file"
                accept="audio/*,video/mp4,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {file && (
              <p
                className="text-xs font-semibold flex items-center gap-2"
                style={{ color: "var(--soft-ink)" }}
              >
                {readingFile && <ClaySpinner size={16} />}
                {durationMs
                  ? formatTime(durationMs)
                  : readingFile
                    ? "Reading length"
                    : "Length unknown"}
              </p>
            )}

            <CoverPicker
              photo={photo}
              photoPreview={photoPreview}
              onPhoto={onPhoto}
              hint="Add a picture for this song. If you skip it, SpotiYen makes one."
            />

            <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none"
                style={{ background: "var(--cream)", color: "var(--ink)" }}
              />
            </label>

            <div>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--soft-ink)" }}>
                Mood
              </p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMood(mood === m ? "" : m)}
                    className="clay-btn min-h-11 px-4 py-2 text-xs font-semibold"
                    style={{
                      background: mood === m ? "var(--clay-rose)" : "var(--cream)",
                      color: "var(--ink)",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none resize-none"
                style={{ background: "var(--cream)", color: "var(--ink)" }}
              />
            </label>

            {albumOptions.length > 0 && (
              <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
                Add to an album or playlist
                <select
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none"
                  style={{ background: "var(--cream)", color: "var(--ink)" }}
                >
                  <option value="">None for now</option>
                  {albumOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kind === "album" ? "Album" : "Playlist"}: {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && (
              <p
                className="text-xs font-semibold flex items-center gap-2"
                style={{ color: "var(--record-red)" }}
              >
                <AlertCircle size={14} />
                {error}
              </p>
            )}

            {busy && (
              <ClayProgress value={uploadPct} label={`Uploading… ${Math.round(uploadPct)}%`} />
            )}

            <button
              type="submit"
              disabled={!file || !title.trim() || busy}
              aria-busy={busy}
              className="clay-btn min-h-12 py-3 text-sm font-bold text-white"
              style={{
                background: file && title.trim() ? "var(--clay-rose)" : "var(--soft-ink)",
              }}
            >
              {busy ? <ButtonDots /> : "Publish song"}
            </button>
          </form>

          {selectedAlbum && (
            <div className="clay p-5 mt-4 flex flex-col gap-3" style={{ background: "white" }}>
              <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                Or add a song already in SpotiYen
              </p>
              <p className="text-xs" style={{ color: "var(--soft-ink)" }}>
                Tap to put it in {selectedAlbum.title}.
              </p>
              {tracks.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
                  No library songs yet. Choose a file above.
                </p>
              ) : unused.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
                  Every library song is already in this mix.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {unused.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void handleAddExisting(t.id)}
                      disabled={addingId === t.id}
                      aria-busy={addingId === t.id}
                      className="clay-sm text-left px-4 py-3 text-sm font-bold flex items-center justify-between gap-3"
                      style={{ background: "var(--cream)", color: "var(--ink)" }}
                    >
                      <span className="min-w-0">
                        {t.title}
                        <span
                          className="block text-xs font-semibold"
                          style={{ color: "var(--soft-ink)" }}
                        >
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
        </>
      ) : missingTables ? (
        <div className="clay p-5" style={{ background: "white" }}>
          <h2 className="text-lg font-extrabold mb-2" style={{ color: "var(--ink)" }}>
            One more SQL step
          </h2>
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            Open Supabase SQL Editor, paste <strong>supabase/migrate-collections.sql</strong>, click
            Run, then refresh.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleCreateMix}
          className="clay p-5 flex flex-col gap-4"
          style={{ background: "white" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 clay-sm flex items-center justify-center flex-shrink-0"
              style={{
                background: mixKind === "album" ? "var(--clay-peach)" : "var(--clay-lilac)",
              }}
            >
              {mixKind === "album" ? <Disc size={20} /> : <ListMusic size={20} />}
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              {mixKind === "album" ? "New album" : "New playlist"}
            </p>
          </div>

          <CoverPicker
            photo={photo}
            photoPreview={photoPreview}
            onPhoto={onPhoto}
            hint={
              mixKind === "album"
                ? "Optional cover. Then add songs from the Song tab."
                : "Optional cover. Then add songs from the Song tab."
            }
          />

          <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
            {mixKind === "album" ? "Album name" : "Playlist name"}
            <input
              value={mixTitle}
              onChange={(e) => setMixTitle(e.target.value)}
              required
              placeholder={mixKind === "album" ? "e.g. Late nights" : "e.g. For the car"}
              className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            />
          </label>

          <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
            Note <span className="font-semibold">Optional</span>
            <textarea
              value={mixNote}
              onChange={(e) => setMixNote(e.target.value)}
              rows={2}
              className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none resize-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            />
          </label>

          {error && (
            <p
              className="text-xs font-semibold flex items-center gap-2"
              style={{ color: "var(--record-red)" }}
            >
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!mixTitle.trim() || busy}
            aria-busy={busy}
            className="clay-btn min-h-12 py-3 text-sm font-bold text-white"
            style={{
              background: mixTitle.trim() ? "var(--clay-rose)" : "var(--soft-ink)",
            }}
          >
            {busy ? <ButtonDots /> : mixKind === "album" ? "Create album" : "Create playlist"}
          </button>
        </form>
      )}

      {busy && tab === "song" && <LoadingOverlay message="Sending this song to SpotiYen" />}
      {busy && tab !== "song" && (
        <LoadingOverlay
          message={tab === "album" ? "Making this album" : "Making this playlist"}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  tone = "rose",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "rose" | "peach" | "lilac";
}) {
  const fill =
    tone === "peach" ? "var(--clay-peach)" : tone === "lilac" ? "var(--clay-lilac)" : "var(--clay-rose)";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="clay-btn flex-1 min-h-11 px-3 text-sm font-bold"
      style={{
        background: active ? fill : "white",
        color: "var(--ink)",
      }}
    >
      {label}
    </button>
  );
}

function CoverPicker({
  photo,
  photoPreview,
  onPhoto,
  hint,
}: {
  photo: File | null;
  photoPreview: string;
  onPhoto: (file: File | null) => void;
  hint: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold mb-2" style={{ color: "var(--soft-ink)" }}>
        Cover photo <span className="font-semibold">Optional</span>
      </p>
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 flex-shrink-0">
          <label
            className="w-20 h-20 clay-sm overflow-hidden cursor-pointer flex items-center justify-center"
            style={{ background: "var(--cream)" }}
            aria-label="Add a cover photo"
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
        <p className="text-xs leading-relaxed" style={{ color: "var(--soft-ink)" }}>
          {hint}
        </p>
      </div>
    </div>
  );
}
