export type UserRole = "singer" | "listener" | "admin";

export type Mood = "Late night" | "For you" | "Warm-up" | "Full send";

export type TrackSource = "recording" | "upload";

export type CollectionKind = "album" | "playlist";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Track {
  id: string;
  title: string;
  note: string;
  mood: Mood | "";
  coverSeed: number;
  audioUrl: string;
  audioBlobKey?: string;
  durationMs: number;
  createdAt: number;
  singerId: string;
  likedByListener: boolean;
  isSample?: boolean;
  source?: TrackSource;
}

export interface Collection {
  id: string;
  ownerId: string;
  kind: CollectionKind;
  title: string;
  note: string;
  coverSeed: number;
  createdAt: number;
  trackIds: string[];
  coverUrl: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}
