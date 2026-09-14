import { useState } from "react";
import { Link } from "react-router-dom";
import { Upload as UploadIcon, CheckCircle2, AlertCircle, Mic } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import ClayCover from "../components/ClayCover";
import { formatTime, readAudioDurationMs } from "../lib/audio";
import type { Mood } from "../types";
import ClaySpinner, { ButtonDots, ClayProgress, LoadingOverlay } from "../components/ClaySpinner";

const MOODS: Mood[] = ["Late night", "For you", "Warm-up", "Full send"];

export default function Upload() {
  const { user } = useAuth();
  const { publish } = useTracks();
  const { collections, addTrack } = useCollections();
  const mine = collections.filter((c) => c.ownerId === user?.id);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<Mood | "">("");
  const [albumId, setAlbumId] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [coverSeed] = useState(() => Math.floor(Math.random() * 10000));
  const [uploadPct, setUploadPct] = useState(0);
  const [readingFile, setReadingFile] = useState(false);

  async function onFile(next: File | null) {
    setFile(next);
    setDone(false);
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

  async function handleSubmit(e: React.FormEvent) {
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
        file.name
      );
      if (albumId) {
        try {
          await addTrack(albumId, track.id);
        } catch {}
      }
      setUploadPct(100);
      setDone(true);
      setFile(null);
      setTitle("");
      setNote("");
      setMood("");
      setAlbumId("");
      setDurationMs(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      clearInterval(interval);
      setBusy(false);
      setUploadPct(0);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center text-center gap-4">
        <div
          className="clay w-20 h-20 flex items-center justify-center"
          style={{ background: "var(--clay-mint)" }}
        >
          <CheckCircle2 size={36} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
          It is in the shared library
        </h1>
        <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
          Both of you can play it now.
        </p>
        <button
          onClick={() => setDone(false)}
          className="clay-btn min-h-12 px-8 py-3 text-sm font-bold text-white"
          style={{ background: "var(--clay-rose)" }}
        >
          Upload another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
        Upload a song
      </h1>
      <p className="text-sm mt-1 mb-6" style={{ color: "var(--soft-ink)" }}>
        Add a file from your phone. It shows up for both of you.
      </p>

      {user?.role === "singer" && (
        <Link
          to="/record"
          className="clay-sm mb-5 flex items-center gap-3 p-3"
          style={{ background: "white", color: "var(--ink)" }}
        >
          <Mic size={18} />
          <span className="text-sm font-bold">Or record live in Studio</span>
        </Link>
      )}

      <form onSubmit={handleSubmit} className="clay p-5 flex flex-col gap-4" style={{ background: "white" }}>
        <label className="clay-sm flex flex-col items-center justify-center gap-2 min-h-32 px-4 py-6 cursor-pointer text-center" style={{ background: "var(--cream)" }}>
          <UploadIcon size={28} style={{ color: "var(--clay-rose)" }} />
          <span className="text-sm font-bold">{file ? file.name : "Choose an audio file"}</span>
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
          <div className="flex items-center gap-3">
            <ClayCover title={title || "Song"} mood={mood} seed={coverSeed} size="md" />
            <p className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--soft-ink)" }}>
              {readingFile && <ClaySpinner size={16} />}
              {durationMs ? formatTime(durationMs) : readingFile ? "Reading length" : "Length unknown"}
            </p>
          </div>
        )}

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

        {mine.length > 0 && (
          <label className="text-xs font-bold" style={{ color: "var(--soft-ink)" }}>
            Add to an album or playlist
            <select
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="mt-1 w-full clay-sm px-4 py-3.5 text-base outline-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            >
              <option value="">None for now</option>
              {mine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kind === "album" ? "Album" : "Playlist"}: {c.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--record-red)" }}>
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
          style={{ background: file && title.trim() ? "var(--clay-rose)" : "var(--soft-ink)" }}
        >
          {busy ? <ButtonDots /> : "Publish to SpotiYen"}
        </button>
      </form>
      {busy && <LoadingOverlay message="Sending this song to SpotiYen" />}
    </div>
  );
}
