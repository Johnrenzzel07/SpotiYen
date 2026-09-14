import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Track, User } from "../types";
import {
  getAllTracks,
  getAllProfiles,
  updateTrack as dbUpdate,
  onTrackPublished,
  onTrackUpdated,
  onTrackDeleted,
  uploadRecording,
  insertTrack,
  deleteTrack as dbDeleteTrack,
  updateProfile as dbUpdateProfile,
} from "../lib/db";
import { useAuth } from "./AuthContext";

interface TrackCtx {
  tracks: Track[];
  profiles: User[];
  loading: boolean;
  refresh: () => Promise<void>;
  ownerName: (userId: string) => string;
  publish: (
    track: Omit<Track, "id" | "createdAt" | "audioUrl">,
    audioBlob: Blob,
    filename?: string
  ) => Promise<Track>;
  toggleLike: (id: string) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  updateProfile: (id: string, data: Partial<Pick<User, "name" | "role">>) => Promise<void>;
  newTrackToast: Track | null;
  dismissToast: () => void;
}

const TrackContext = createContext<TrackCtx | null>(null);

export function TrackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTrackToast, setNewTrackToast] = useState<Track | null>(null);

  const refresh = useCallback(async () => {
    const [all, people] = await Promise.all([getAllTracks(), getAllProfiles()]);
    setTracks(all);
    setProfiles(people);
  }, []);

  const ownerName = useCallback(
    (userId: string) => profiles.find((p) => p.id === userId)?.name || "Unknown",
    [profiles]
  );

  useEffect(() => {
    if (!user) {
      setTracks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [all, people] = await Promise.all([getAllTracks(), getAllProfiles()]);
        if (!cancelled) {
          setTracks(all);
          setProfiles(people);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const offInsert = onTrackPublished((track) => {
      setTracks((prev) => [track, ...prev.filter((t) => t.id !== track.id)]);
      if (user.role === "listener" || track.singerId !== user.id) {
        setNewTrackToast(track);
      }
    });
    const offUpdate = onTrackUpdated((track) => {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? track : t)));
    });
    const offDelete = onTrackDeleted((id) => {
      setTracks((prev) => prev.filter((t) => t.id !== id));
    });

    return () => {
      cancelled = true;
      offInsert();
      offUpdate();
      offDelete();
    };
  }, [user]);

  const publish = useCallback(
    async (
      data: Omit<Track, "id" | "createdAt" | "audioUrl">,
      audioBlob: Blob,
      filename?: string
    ): Promise<Track> => {
      const id = crypto.randomUUID();
      const audioUrl = await uploadRecording(data.singerId, id, audioBlob, filename);
      const created = await insertTrack({
        id,
        title: data.title,
        note: data.note,
        mood: data.mood,
        coverSeed: data.coverSeed,
        audioUrl,
        durationMs: data.durationMs,
        singerId: data.singerId,
        source: data.source || "recording",
      });
      setTracks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      return created;
    },
    []
  );

  const toggleLike = useCallback(
    async (id: string) => {
      const t = tracks.find((tr) => tr.id === id);
      if (!t) return;
      const liked = !t.likedByListener;
      setTracks((prev) =>
        prev.map((tr) => (tr.id === id ? { ...tr, likedByListener: liked } : tr))
      );
      try {
        await dbUpdate(id, { likedByListener: liked });
      } catch {
        setTracks((prev) =>
          prev.map((tr) =>
            tr.id === id ? { ...tr, likedByListener: t.likedByListener } : tr
          )
        );
      }
    },
    [tracks]
  );

  const deleteTrack = useCallback(async (id: string) => {
    if (user?.role !== "admin") {
      throw new Error("Only the admin account can delete songs.");
    }
    const track = tracks.find((t) => t.id === id);
    await dbDeleteTrack(id, track?.audioUrl);
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, [tracks, user]);

  const updateProfile = useCallback(
    async (id: string, data: Partial<Pick<User, "name" | "role">>) => {
      if (user?.role !== "admin") {
        throw new Error("Only the admin account can manage users.");
      }
      if (data.role && data.role !== "admin") {
        const admins = profiles.filter((p) => p.role === "admin");
        const target = profiles.find((p) => p.id === id);
        if (target?.role === "admin" && admins.length <= 1) {
          throw new Error("Keep at least one admin account.");
        }
      }
      await dbUpdateProfile(id, data);
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data, name: data.name?.trim() || p.name } : p))
      );
    },
    [user, profiles]
  );

  const dismissToast = useCallback(() => setNewTrackToast(null), []);

  return (
    <TrackContext.Provider
      value={{
        tracks,
        profiles,
        loading,
        refresh,
        ownerName,
        publish,
        toggleLike,
        deleteTrack,
        updateProfile,
        newTrackToast,
        dismissToast,
      }}
    >
      {children}
    </TrackContext.Provider>
  );
}

export function useTracks() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTracks must be inside TrackProvider");
  return ctx;
}
