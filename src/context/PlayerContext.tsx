import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Track } from "../types";
import { getPlayableUrl } from "../lib/db";
import { finiteDuration } from "../lib/audio";

interface PlayerCtx {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  play: (track: Track) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  queue: Track[];
  setQueue: (tracks: Track[]) => void;
}

const PlayerContext = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<Track[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const trackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const playTrackRef = useRef<(track: Track) => Promise<void>>(async () => {});

  queueRef.current = queue;

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.8;
    }
    const audio = audioRef.current;

    const applyDuration = () => {
      const fallback = trackRef.current?.durationMs ?? 0;
      setDuration(finiteDuration(audio.duration, fallback));
    };

    const onTime = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      applyDuration();
    };
    const onDur = () => applyDuration();
    const onEnd = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      const q = queueRef.current;
      const idx = q.findIndex((t) => t.id === trackRef.current?.id);
      if (idx >= 0 && idx < q.length - 1) {
        void playTrackRef.current(q[idx + 1]);
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      const audio = audioRef.current!;
      trackRef.current = track;
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(finiteDuration(0, track.durationMs));
      setIsBuffering(true);
      setIsPlaying(false);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      try {
        const src = await getPlayableUrl(track);
        if (trackRef.current?.id !== track.id) return;
        if (!src) {
          setIsBuffering(false);
          setIsPlaying(false);
          return;
        }
        audio.src = src;
        audio.volume = volume;
        await audio.play();
      } catch {
        if (trackRef.current?.id === track.id) {
          setIsBuffering(false);
          setIsPlaying(false);
        }
      }
    },
    [volume]
  );

  playTrackRef.current = playTrack;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      setIsBuffering(true);
      audio.play().catch(() => setIsBuffering(false));
    } else {
      audio.pause();
    }
  }, [currentTrack]);

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(() => {
    setIsBuffering(true);
    audioRef.current?.play().catch(() => setIsBuffering(false));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const next = useCallback(() => {
    if (!currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx >= 0 && idx < queue.length - 1) {
      void playTrack(queue[idx + 1]);
    }
  }, [currentTrack, queue, playTrack]);

  const prev = useCallback(() => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      void playTrack(queue[idx - 1]);
    }
  }, [currentTrack, queue, playTrack]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    trackRef.current = null;
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        play: playTrack,
        togglePlay,
        pause,
        resume,
        seek,
        setVolume,
        next,
        prev,
        stop,
        queue,
        setQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
}
