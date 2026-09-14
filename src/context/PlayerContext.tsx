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

export type RepeatMode = "off" | "all" | "one";

function shuffleIds(ids: string[], currentId?: string) {
  const rest = ids.filter((id) => id !== currentId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return currentId && ids.includes(currentId) ? [currentId, ...rest] : rest;
}

function playOrder(tracks: Track[], currentId: string | undefined, shuffled: boolean) {
  const ids = tracks.map((t) => t.id);
  return shuffled ? shuffleIds(ids, currentId) : ids;
}

interface PlayerCtx {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  play: (track: Track) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
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
  const [queue, setQueueState] = useState<Track[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const objectUrlRef = useRef<string | null>(null);
  const trackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const orderRef = useRef<string[]>([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const playTrackRef = useRef<(track: Track) => Promise<void>>(async () => {});
  const goNextRef = useRef<() => void>(() => {});

  queueRef.current = queue;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;

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
      setIsBuffering(false);
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      goNextRef.current();
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
        if (!orderRef.current.includes(track.id)) {
          orderRef.current = playOrder(
            queueRef.current.some((t) => t.id === track.id)
              ? queueRef.current
              : [...queueRef.current, track],
            track.id,
            shuffleRef.current
          );
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

  const setQueue = useCallback((tracks: Track[]) => {
    setQueueState(tracks);
    queueRef.current = tracks;
    orderRef.current = playOrder(tracks, trackRef.current?.id, shuffleRef.current);
  }, []);

  const findInQueue = (id: string | undefined) =>
    queueRef.current.find((t) => t.id === id);

  const goNext = useCallback(() => {
    const q = queueRef.current;
    let order = orderRef.current;
    const currentId = trackRef.current?.id;
    if (!currentId || q.length === 0) return;
    if (!order.includes(currentId)) {
      order = playOrder(q, currentId, shuffleRef.current);
      orderRef.current = order;
    }
    const idx = order.indexOf(currentId);
    let nextId: string | undefined;
    if (idx >= 0 && idx < order.length - 1) {
      nextId = order[idx + 1];
    } else if (repeatRef.current === "all" && order.length > 0) {
      if (shuffleRef.current) {
        order = shuffleIds(
          q.map((t) => t.id),
          currentId
        );
        orderRef.current = order;
        nextId = order.find((id) => id !== currentId) ?? order[0];
      } else {
        nextId = order[0];
      }
    }
    const nextTrack = findInQueue(nextId);
    if (nextTrack) void playTrackRef.current(nextTrack);
    else setIsPlaying(false);
  }, []);

  goNextRef.current = goNext;

  const next = goNext;

  const prev = useCallback(() => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const order = orderRef.current;
    const idx = order.indexOf(currentTrack.id);
    if (idx > 0) {
      const prevTrack = findInQueue(order[idx - 1]);
      if (prevTrack) void playTrack(prevTrack);
    }
  }, [currentTrack, playTrack]);

  const toggleShuffle = useCallback(() => {
    const nextOn = !shuffleRef.current;
    shuffleRef.current = nextOn;
    setShuffle(nextOn);
    orderRef.current = playOrder(queueRef.current, trackRef.current?.id, nextOn);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => {
      const nextMode: RepeatMode = mode === "off" ? "all" : mode === "all" ? "one" : "off";
      repeatRef.current = nextMode;
      return nextMode;
    });
  }, []);

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
        shuffle,
        repeat,
        play: playTrack,
        togglePlay,
        pause,
        resume,
        seek,
        setVolume,
        next,
        prev,
        stop,
        toggleShuffle,
        cycleRepeat,
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
