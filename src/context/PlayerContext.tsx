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
  if (currentId && ids.includes(currentId)) return [currentId, ...rest];
  return rest;
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
  play: (track: Track, queue?: Track[]) => void;
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
  lyricsOpen: boolean;
  openLyrics: () => void;
  closeLyrics: () => void;
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
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const objectUrlRef = useRef<string | null>(null);
  const trackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const orderRef = useRef<string[]>([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const volumeRef = useRef(0.8);
  const playGenRef = useRef(0);
  const playTrackRef = useRef<(track: Track) => Promise<void>>(async () => {});
  const goNextRef = useRef<(forceWrap?: boolean) => void>(() => {});

  queueRef.current = queue;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;
  volumeRef.current = volume;

  function applyQueue(tracks: Track[]) {
    queueRef.current = tracks;
    setQueueState(tracks);
  }

  function rebuildOrder(currentId?: string) {
    const ids = queueRef.current.map((t) => t.id);
    const anchor = currentId ?? trackRef.current?.id;
    orderRef.current = shuffleRef.current ? shuffleIds(ids, anchor) : ids;
  }

  function trackById(id: string | undefined) {
    if (!id) return undefined;
    return queueRef.current.find((t) => t.id === id);
  }

  function shouldWrap() {
    return shuffleRef.current || repeatRef.current === "all";
  }

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volumeRef.current;
      audioRef.current.preload = "auto";
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
        const current = trackRef.current;
        if (current) {
          void playTrackRef.current(current);
          return;
        }
      }
      goNextRef.current(true);
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const playTrack = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    const gen = ++playGenRef.current;
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
      if (playGenRef.current !== gen || trackRef.current?.id !== track.id) return;
      if (!src) {
        setIsBuffering(false);
        setIsPlaying(false);
        return;
      }

      audio.pause();
      audio.src = src;
      audio.volume = volumeRef.current;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      if (playGenRef.current === gen && trackRef.current?.id === track.id) {
        setIsBuffering(false);
        setIsPlaying(false);
      }
    }
  }, []);

  playTrackRef.current = playTrack;

  const play = useCallback(
    (track: Track, nextQueue?: Track[]) => {
      const incoming = nextQueue && nextQueue.length > 0 ? nextQueue : queueRef.current;
      const withTrack = incoming.some((t) => t.id === track.id) ? incoming : [...incoming, track];
      applyQueue(withTrack);
      rebuildOrder(track.id);
      void playTrack(track);
    },
    [playTrack]
  );

  const setQueue = useCallback((tracks: Track[]) => {
    applyQueue(tracks);
    rebuildOrder(trackRef.current?.id);
  }, []);

  const goNext = useCallback(
    (fromEnded = false) => {
      const q = queueRef.current;
      const currentId = trackRef.current?.id;
      if (!currentId || q.length === 0) {
        if (fromEnded) setIsPlaying(false);
        return;
      }

      const ids = q.map((t) => t.id);
      const orderValid =
        orderRef.current.length === ids.length &&
        orderRef.current.includes(currentId) &&
        orderRef.current.every((id) => ids.includes(id));
      if (!orderValid) rebuildOrder(currentId);

      let order = orderRef.current;
      const idx = order.indexOf(currentId);
      const wrap = shouldWrap();

      if (idx >= 0 && idx < order.length - 1) {
        const nextTrack = trackById(order[idx + 1]);
        if (nextTrack) {
          void playTrackRef.current(nextTrack);
          return;
        }
      }

      if (!wrap) {
        if (fromEnded) setIsPlaying(false);
        return;
      }

      if (shuffleRef.current && q.length > 1) {
        rebuildOrder(currentId);
        order = orderRef.current;
        const nextTrack = trackById(order[1] ?? order[0]);
        if (nextTrack) void playTrackRef.current(nextTrack);
        return;
      }

      const nextTrack = trackById(order[0] ?? currentId);
      if (nextTrack) void playTrackRef.current(nextTrack);
    },
    []
  );

  goNextRef.current = goNext;

  const next = useCallback(() => goNext(false), [goNext]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const currentId = trackRef.current?.id;
    const q = queueRef.current;
    if (!currentId || q.length === 0) return;

    const ids = q.map((t) => t.id);
    if (!orderRef.current.includes(currentId) || orderRef.current.length !== ids.length) {
      rebuildOrder(currentId);
    }

    const order = orderRef.current;
    const idx = order.indexOf(currentId);
    if (idx > 0) {
      const prevTrack = trackById(order[idx - 1]);
      if (prevTrack) void playTrack(prevTrack);
      return;
    }

    if (shouldWrap()) {
      const prevTrack = trackById(order[order.length - 1]);
      if (prevTrack) void playTrack(prevTrack);
    }
  }, [playTrack]);

  const toggleShuffle = useCallback(() => {
    const nextOn = !shuffleRef.current;
    shuffleRef.current = nextOn;
    setShuffle(nextOn);
    rebuildOrder(trackRef.current?.id);
  }, []);

  const cycleRepeat = useCallback(() => {
    const nextMode: RepeatMode =
      repeatRef.current === "off" ? "all" : repeatRef.current === "all" ? "one" : "off";
    repeatRef.current = nextMode;
    setRepeat(nextMode);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track) return;

    if (audio.ended || (!audio.src && track)) {
      void playTrack(track);
      return;
    }

    if (audio.paused) {
      setIsBuffering(true);
      audio.play().catch(() => {
        void playTrack(track);
      });
    } else {
      audio.pause();
    }
  }, [playTrack]);

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(() => {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track) return;
    setIsBuffering(true);
    audio.play().catch(() => {
      void playTrack(track);
    });
  }, [playTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const openLyrics = useCallback(() => setLyricsOpen(true), []);
  const closeLyrics = useCallback(() => setLyricsOpen(false), []);

  const stop = useCallback(() => {
    playGenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    trackRef.current = null;
    orderRef.current = [];
    applyQueue([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
    setLyricsOpen(false);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLButtonElement)
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
        play,
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
        lyricsOpen,
        openLyrics,
        closeLyrics,
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
