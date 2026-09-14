import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, RotateCcw, Send, CheckCircle2, AlertCircle, Heart, Music } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import ClayCover from "../components/ClayCover";
import ClaySpinner, { ClayProgress } from "../components/ClaySpinner";
import Waveform from "../components/Waveform";
import { formatTimeFromSec, getWaveformData } from "../lib/audio";
import type { Mood } from "../types";

const MOODS: Mood[] = ["Late night", "For you", "Warm-up", "Full send"];

type RecordState = "idle" | "requesting" | "recording" | "preview" | "publishing" | "done" | "error";

export default function Studio() {
  const { user } = useAuth();

  /* If listener visits, show locked state */
  if (user?.role !== "singer") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div
          className="clay w-24 h-24 flex items-center justify-center mb-6"
          style={{ background: "var(--clay-lilac)" }}
        >
          <Mic size={40} style={{ color: "var(--soft-ink)" }} />
        </div>
        <h2
          className="text-xl font-extrabold mb-2"
          style={{ color: "var(--ink)" }}
        >
          This studio belongs to Yen
        </h2>
        <p className="text-sm flex items-center justify-center gap-1.5" style={{ color: "var(--soft-ink)" }}>
          Only she can record songs for you here.
          <Mic size={14} aria-hidden />
        </p>
      </div>
    );
  }

  return <StudioRecorder />;
}

function StudioRecorder() {
  const { user } = useAuth();
  const { publish } = useTracks();

  const [state, setState] = useState<RecordState>("idle");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<Mood | "">("");
  const [elapsed, setElapsed] = useState(0);
  const [waveData, setWaveData] = useState<number[]>(Array(40).fill(0.1));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [micError, setMicError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);
  const coverSeed = useRef(Math.floor(Math.random() * 10000));

  const cleanupRecording = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [cleanupRecording, previewUrl]);

  async function startRecording() {
    setState("requesting");
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = buf;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("preview");
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);

      startTimeRef.current = Date.now();
      setState("recording");

      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 200);

      function drawWave() {
        if (analyserRef.current && dataArrayRef.current) {
          const data = getWaveformData(analyserRef.current, dataArrayRef.current);
          setWaveData(data);
        }
        animRef.current = requestAnimationFrame(drawWave);
      }
      drawWave();
    } catch (err: any) {
      setState("error");
      setMicError(
        err?.name === "NotAllowedError"
          ? "Microphone access denied. Please allow mic access in your browser settings."
          : "Could not access microphone. Please check your device."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(animRef.current);
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setWaveData(Array(40).fill(0.1));
    setState("idle");
  }

  async function handlePublish() {
    if (!title.trim() || !blobRef.current) return;
    setState("publishing");

    let pct = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 20, 90);
      setUploadPct(pct);
    }, 200);

    try {
      if (!user) throw new Error("You need to be signed in.");
      await publish(
        {
          title: title.trim(),
          note: note.trim(),
          mood,
          coverSeed: coverSeed.current,
          durationMs: elapsed * 1000,
          singerId: user.id,
          likedByListener: false,
        },
        blobRef.current
      );
      clearInterval(interval);
      setUploadPct(100);
      setState("done");
    } catch (err) {
      clearInterval(interval);
      setState("error");
      setMicError(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again."
      );
    }
  }

  function resetAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setWaveData(Array(40).fill(0.1));
    setTitle("");
    setNote("");
    setMood("");
    setUploadPct(0);
    coverSeed.current = Math.floor(Math.random() * 10000);
    setState("idle");
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-12">
      {/* Header */}
      <div className="text-center mb-8 animate-slide-up">
        <h1
          className="text-2xl md:text-3xl font-extrabold"
          style={{ color: "var(--ink)" }}
        >
          Your Studio
        </h1>
        <p
          className="text-sm mt-1 flex items-center justify-center gap-1.5"
          style={{ color: "var(--soft-ink)" }}
        >
          {state === "idle" && (
            <>
              Ready when you are, Yen
              <Mic size={14} aria-hidden />
            </>
          )}
          {state === "recording" && "Singing..."}
          {state === "preview" && "Listen back before sharing"}
          {state === "publishing" && "Sending to John's SpotiYen..."}
          {state === "done" && (
            <>
              It's on his SpotiYen now
              <Heart size={14} fill="var(--clay-rose)" style={{ color: "var(--clay-rose)" }} aria-hidden />
            </>
          )}
          {state === "error" && "Something went wrong"}
          {state === "requesting" && "Requesting mic access..."}
        </p>
      </div>

      {/* Record button (idle / recording) */}
      {(state === "idle" || state === "recording" || state === "requesting") && (
        <div className="flex flex-col items-center gap-6 animate-pop-in">
          <button
            onClick={state === "recording" ? stopRecording : startRecording}
            disabled={state === "requesting"}
            className={`relative w-40 h-40 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center clay-btn ${
              state === "recording" ? "recording-pulse" : ""
            }`}
            style={{
              background:
                state === "recording"
                  ? "var(--record-red)"
                  : "var(--clay-rose)",
            }}
            aria-label={state === "recording" ? "Stop recording" : "Start recording"}
          >
            {state === "recording" ? (
              <>
                <Square size={32} fill="white" className="text-white" />
                <span className="text-[10px] font-bold text-white mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  REC
                </span>
              </>
            ) : state === "requesting" ? (
              <>
                <ClaySpinner size={36} tone="light" />
                <span className="text-[10px] font-bold text-white mt-1">WAIT</span>
              </>
            ) : (
              <>
                <Mic size={36} className="text-white" />
                <span className="text-[10px] font-bold text-white mt-1">
                  RECORD
                </span>
              </>
            )}
          </button>

          {state === "recording" && (
            <>
              <span
                className="text-2xl font-extrabold tabular-nums"
                style={{ color: "var(--record-red)" }}
              >
                {formatTimeFromSec(elapsed)}
              </span>
              <div className="w-full max-w-xs">
                <Waveform
                  data={waveData}
                  color="var(--clay-rose)"
                  activeColor="var(--record-red)"
                  progress={1}
                  height={56}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className="flex flex-col items-center gap-4 animate-pop-in">
          <div
            className="clay w-20 h-20 flex items-center justify-center"
            style={{ background: "rgba(232,93,117,0.12)" }}
          >
            <AlertCircle size={32} style={{ color: "var(--record-red)" }} />
          </div>
          <p
            className="text-sm text-center font-semibold"
            style={{ color: "var(--record-red)" }}
          >
            {micError}
          </p>
          <button
            onClick={resetAll}
            className="clay-btn px-6 py-3 text-sm font-bold"
            style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Preview */}
      {state === "preview" && (
        <div className="flex flex-col gap-5 animate-pop-in">
          {/* Audio preview */}
          <div className="clay p-4 flex flex-col gap-3" style={{ background: "white" }}>
            <div className="flex items-center gap-3">
              <ClayCover
                title={title || "Untitled"}
                mood={mood}
                seed={coverSeed.current}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-lg font-extrabold"
                  style={{ color: "var(--ink)" }}
                >
                  {title || "Untitled"}
                </p>
                <p className="text-xs" style={{ color: "var(--soft-ink)" }}>
                  {formatTimeFromSec(elapsed)} · Yen
                </p>
              </div>
            </div>
            {previewUrl && (
              <audio controls src={previewUrl} className="w-full max-w-full mt-2" style={{ borderRadius: 16 }} />
            )}
          </div>

          {/* Metadata */}
          <div className="clay p-5 flex flex-col gap-4" style={{ background: "white" }}>
            <div>
              <label
                htmlFor="title"
                className="text-xs font-bold mb-1 block"
                style={{ color: "var(--soft-ink)" }}
              >
                Song Title *
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name this take..."
                className="w-full clay-sm px-4 py-3.5 text-base outline-none"
                style={{ background: "var(--cream)", color: "var(--ink)" }}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold mb-2 block" style={{ color: "var(--soft-ink)" }}>
                Mood
              </label>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(mood === m ? "" : m)}
                    className={`clay-btn min-h-11 px-4 py-2 text-xs font-semibold transition-all ${
                      mood === m ? "scale-95" : ""
                    }`}
                    style={{
                      background:
                        mood === m
                          ? m === "Late night"
                            ? "var(--clay-lilac)"
                            : m === "For you"
                              ? "var(--clay-rose)"
                              : m === "Warm-up"
                                ? "var(--clay-mint)"
                                : "var(--record-red)"
                          : "var(--cream)",
                      color:
                        mood === m && m === "Full send"
                          ? "white"
                          : "var(--ink)",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="note"
                className="text-xs font-bold mb-1 block"
                style={{ color: "var(--soft-ink)" }}
              >
                Note for John
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Leave him a message..."
                rows={2}
                className="w-full clay-sm px-4 py-3.5 text-base outline-none resize-none"
                style={{ background: "var(--cream)", color: "var(--ink)" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reRecord}
              className="clay-btn flex items-center justify-center gap-2 flex-1 min-h-12 py-3 text-sm font-bold"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            >
              <RotateCcw size={16} />
              Re-record
            </button>
            <button
              onClick={handlePublish}
              disabled={!title.trim()}
              className="clay-btn flex items-center justify-center gap-2 flex-1 min-h-12 py-3 text-sm font-bold text-white"
              style={{
                background: title.trim()
                  ? "var(--clay-rose)"
                  : "var(--soft-ink)",
              }}
            >
              <Send size={16} />
              Publish
            </button>
          </div>
        </div>
      )}

      {/* Publishing */}
      {state === "publishing" && (
        <div className="flex flex-col items-center gap-5 animate-pop-in">
          <ClaySpinner size={48} label="Sending to John's SpotiYen" />
          <ClayCover
            title={title}
            mood={mood}
            seed={coverSeed.current}
            size="xl"
          />
          <ClayProgress value={uploadPct} label={`Uploading… ${Math.round(uploadPct)}%`} />
        </div>
      )}

      {/* Done */}
      {state === "done" && (
        <div className="flex flex-col items-center gap-5 animate-pop-in text-center">
          <div
            className="clay w-20 h-20 flex items-center justify-center"
            style={{ background: "var(--clay-mint)" }}
          >
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2
            className="text-xl font-extrabold flex items-center justify-center gap-2"
            style={{ color: "var(--ink)" }}
          >
            It's on his SpotiYen now
            <Heart size={22} fill="var(--clay-rose)" style={{ color: "var(--clay-rose)" }} aria-hidden />
          </h2>
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            "{title}" is ready for John to listen to.
          </p>
          <button
            onClick={resetAll}
            className="clay-btn px-8 py-3 text-sm font-bold text-white"
            style={{ background: "var(--clay-rose)" }}
          >
            Record Another
          </button>
        </div>
      )}

      {/* Empty state hint */}
      {state === "idle" && (
        <p
          className="text-center text-xs mt-10 flex items-center justify-center gap-1.5"
          style={{ color: "var(--soft-ink)" }}
        >
          The studio is quiet. Leave him a song.
          <Music size={12} aria-hidden />
        </p>
      )}
    </div>
  );
}
