import type {
  Collection,
  CollectionKind,
  Mood,
  Track,
  TrackSource,
  User,
  UserRole,
} from "../types";
import { COVERS_BUCKET, RECORDINGS_BUCKET, supabase } from "./supabase";

type ProfileRow = {
  id: string;
  name: string;
  role: UserRole;
  email: string;
};

type TrackRow = {
  id: string;
  title: string;
  note: string;
  mood: string;
  cover_seed: number;
  audio_url: string;
  duration_ms: number;
  created_at: string;
  singer_id: string;
  liked_by_listener: boolean;
  is_sample: boolean;
  source?: TrackSource;
};

type CollectionRow = {
  id: string;
  owner_id: string;
  kind: CollectionKind;
  title: string;
  note: string;
  cover_seed: number;
  created_at: string;
  cover_url?: string | null;
};

function throwIfError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const missingTable =
    error.code === "PGRST205" ||
    /schema cache|does not exist|could not find the table/i.test(error.message);
  if (missingTable) {
    throw new Error(
      "Database tables are missing. In Supabase open SQL Editor, paste supabase/schema.sql, click Run, then sign in again."
    );
  }
  throw new Error(error.message);
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
  };
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? "",
    mood: (row.mood as Mood) || "",
    coverSeed: row.cover_seed,
    audioUrl: row.audio_url,
    durationMs: row.duration_ms,
    createdAt: new Date(row.created_at).getTime(),
    singerId: row.singer_id,
    likedByListener: row.liked_by_listener,
    isSample: row.is_sample,
    source: row.source === "upload" ? "upload" : "recording",
  };
}

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function ensureProfile(params: {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
}): Promise<User> {
  const existing = await fetchProfile(params.id);
  if (existing) return existing;

  const profile: ProfileRow = {
    id: params.id,
    email: params.email,
    name: params.name || params.email.split("@")[0] || "Friend",
    role:
      params.role === "singer" || params.role === "listener" || params.role === "admin"
        ? params.role
        : params.email.toLowerCase().startsWith("yen@")
          ? "singer"
          : params.email.toLowerCase().startsWith("admin@")
            ? "admin"
            : "listener",
  };

  const { error } = await supabase.from("profiles").insert(profile);
  if (error && error.code !== "23505") throwIfError(error);

  const created = await fetchProfile(params.id);
  if (!created) throw new Error("Could not create your SpotiYen profile.");
  return created;
}

export async function getAllProfiles(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  throwIfError(error);
  return (data as ProfileRow[] | null)?.map(mapProfile) ?? [];
}

export async function updateProfile(
  id: string,
  data: Partial<Pick<User, "name" | "role">>
): Promise<void> {
  const patch: Partial<ProfileRow> = {};
  if (data.name !== undefined) patch.name = data.name.trim() || "Friend";
  if (data.role !== undefined) patch.role = data.role;

  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (
    error &&
    (/policy|permission|row-level|42501/i.test(error.message) ||
      error.message.toLowerCase().includes("violates"))
  ) {
    throw new Error(
      "User management needs one SQL step. In Supabase open SQL Editor, paste supabase/migrate-users.sql, click Run, then try again."
    );
  }
  throwIfError(error);
}

export async function adminSetPassword(
  userId: string,
  password: string,
  isSelf: boolean
): Promise<void> {
  const next = password.trim();
  if (next.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (isSelf) {
    const { error } = await supabase.auth.updateUser({ password: next });
    throwIfError(error);
    return;
  }

  const { error } = await supabase.rpc("admin_set_password", {
    target_id: userId,
    new_password: next,
  });

  if (error) {
    if (
      error.code === "PGRST202" ||
      /schema cache|could not find the function|does not exist/i.test(error.message)
    ) {
      throw new Error(
        "Password changes need one SQL step. In Supabase open SQL Editor, paste supabase/migrate-users.sql, click Run, then try again."
      );
    }
    throw new Error(error.message);
  }
}

export async function getAllTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data as TrackRow[] | null)?.map(mapTrack) ?? [];
}

export async function updateTrack(
  id: string,
  data: Partial<Pick<Track, "likedByListener">>
): Promise<void> {
  const patch: Partial<TrackRow> = {};
  if (data.likedByListener !== undefined) {
    patch.liked_by_listener = data.likedByListener;
  }

  const { error } = await supabase.from("tracks").update(patch).eq("id", id);
  throwIfError(error);
}

function adminBlocked(error: { message: string } | null) {
  if (!error) return;
  if (/policy|permission|row-level|42501/i.test(error.message)) {
    throw new Error(
      "Admin delete is blocked. In Supabase open SQL Editor, paste supabase/migrate-admin.sql, click Run, then try again."
    );
  }
}

export async function deleteTrack(id: string, audioUrl?: string): Promise<void> {
  if (audioUrl && !audioUrl.startsWith("http")) {
    await supabase.storage.from(RECORDINGS_BUCKET).remove([audioUrl]);
  }
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  adminBlocked(error);
  throwIfError(error);
}

export async function uploadRecording(
  ownerId: string,
  trackId: string,
  blob: Blob,
  filename?: string
): Promise<string> {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  const allowed = ["mp3", "wav", "m4a", "aac", "ogg", "webm", "opus", "flac", "mp4"];
  let ext = fromName && allowed.includes(fromName) ? fromName : "";
  if (!ext) {
    if (blob.type.includes("mpeg") || blob.type.includes("mp3")) ext = "mp3";
    else if (blob.type.includes("wav")) ext = "wav";
    else if (blob.type.includes("mp4") || blob.type.includes("m4a") || blob.type.includes("aac"))
      ext = "m4a";
    else if (blob.type.includes("ogg")) ext = "ogg";
    else ext = "mp3";
  }
  const mime =
    blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : ext === "mp3"
        ? "audio/mpeg"
        : ext === "wav"
          ? "audio/wav"
          : ext === "m4a" || ext === "mp4"
            ? "audio/mp4"
            : "audio/mpeg";
  const path = `${ownerId}/${trackId}.${ext}`;

  const { error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .upload(path, blob, {
      contentType: mime,
      upsert: false,
    });

  if (error) {
    throw new Error(
      error.message.includes("Bucket")
        ? "Storage is blocked. Run supabase/migrate-collections.sql in the SQL Editor."
        : error.message.includes("size") || error.message.includes("maximum")
          ? "That file is too large (max about 50 MB). Pick a smaller audio file."
          : error.message
    );
  }
  return path;
}

export async function insertTrack(track: {
  id: string;
  title: string;
  note: string;
  mood: Mood | "";
  coverSeed: number;
  audioUrl: string;
  durationMs: number;
  singerId: string;
  source?: TrackSource;
}): Promise<Track> {
  const row = {
    id: track.id,
    title: track.title,
    note: track.note,
    mood: track.mood,
    cover_seed: track.coverSeed,
    audio_url: track.audioUrl,
    duration_ms: Math.round(track.durationMs),
    singer_id: track.singerId,
    liked_by_listener: false,
    is_sample: false,
    source: track.source || "recording",
  };

  let { data, error } = await supabase.from("tracks").insert(row).select().single();
  if (error && /source/i.test(error.message)) {
    const { source: _source, ...withoutSource } = row;
    void _source;
    ({ data, error } = await supabase.from("tracks").insert(withoutSource).select().single());
  }
  throwIfError(error);
  return mapTrack(data as TrackRow);
}

export async function getPlayableUrl(track: Track): Promise<string> {
  if (!track.audioUrl) return "";
  if (track.audioUrl.startsWith("http")) return track.audioUrl;

  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(track.audioUrl, 60 * 60);

  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}

export async function seedSampleTracks(): Promise<void> {
  /* Real recordings live in Supabase. No local sample seed. */
}

type TrackListener = (track: Track) => void;

export function onTrackPublished(fn: TrackListener) {
  const channel = supabase
    .channel("spotiyen-tracks")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tracks" },
      (payload) => fn(mapTrack(payload.new as TrackRow))
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function onTrackUpdated(fn: TrackListener) {
  const channel = supabase
    .channel("spotiyen-tracks-update")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tracks" },
      (payload) => fn(mapTrack(payload.new as TrackRow))
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function onTrackDeleted(fn: (id: string) => void) {
  const channel = supabase
    .channel("spotiyen-tracks-delete")
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "tracks" },
      (payload) => {
        const id = (payload.old as { id?: string } | null)?.id;
        if (id) fn(id);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function mapCollection(row: CollectionRow, trackIds: string[] = []): Collection {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    title: row.title,
    note: row.note ?? "",
    coverSeed: row.cover_seed,
    createdAt: new Date(row.created_at).getTime(),
    trackIds,
    coverUrl: row.cover_url ?? "",
  };
}

export function coverPublicUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from(COVERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function coverSqlHint(error: { message: string } | null) {
  if (!error) return;
  if (/cover_url|schema cache|could not find the.*column/i.test(error.message)) {
    throw new Error(
      "Cover photos need one SQL step. In Supabase open SQL Editor, paste supabase/migrate-covers.sql, click Run, then try again."
    );
  }
  if (/bucket|covers/i.test(error.message) && /not found|exist/i.test(error.message)) {
    throw new Error(
      "Cover storage is missing. Run supabase/migrate-covers.sql in the SQL Editor, then try again."
    );
  }
}

export async function getAllCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error);

  const collections = (data as CollectionRow[] | null) ?? [];
  if (collections.length === 0) return [];

  const { data: members, error: memberError } = await supabase
    .from("collection_tracks")
    .select("collection_id, track_id, position");
  throwIfError(memberError);

  const byCollection = new Map<string, { track_id: string; position: number }[]>();
  for (const row of members ?? []) {
    const list = byCollection.get(row.collection_id) ?? [];
    list.push({ track_id: row.track_id, position: row.position });
    byCollection.set(row.collection_id, list);
  }

  return collections.map((row) => {
    const ids = (byCollection.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((m) => m.track_id);
    return mapCollection(row, ids);
  });
}

export async function createCollection(params: {
  ownerId: string;
  kind: CollectionKind;
  title: string;
  note?: string;
}): Promise<Collection> {
  const { data, error } = await supabase
    .from("collections")
    .insert({
      owner_id: params.ownerId,
      kind: params.kind,
      title: params.title.trim(),
      note: params.note?.trim() || "",
      cover_seed: Math.floor(Math.random() * 10000),
    })
    .select()
    .single();
  throwIfError(error);
  return mapCollection(data as CollectionRow, []);
}

export async function uploadCollectionCover(
  ownerId: string,
  collectionId: string,
  blob: Blob
): Promise<string> {
  const path = `${ownerId}/${collectionId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(COVERS_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  coverSqlHint(error);
  if (error) {
    throw new Error(
      error.message.includes("size") || error.message.includes("maximum")
        ? "That photo is too large (max about 5 MB after shrinking)."
        : error.message
    );
  }
  return path;
}

export async function setCollectionCoverUrl(
  collectionId: string,
  coverUrl: string
): Promise<void> {
  const { error } = await supabase
    .from("collections")
    .update({ cover_url: coverUrl })
    .eq("id", collectionId);
  coverSqlHint(error);
  throwIfError(error);
}

export async function addTrackToCollection(
  collectionId: string,
  trackId: string,
  position: number
): Promise<void> {
  const { error } = await supabase.from("collection_tracks").insert({
    collection_id: collectionId,
    track_id: trackId,
    position,
  });
  if (error && error.code !== "23505") throwIfError(error);
}

export async function removeTrackFromCollection(
  collectionId: string,
  trackId: string
): Promise<void> {
  const { error } = await supabase
    .from("collection_tracks")
    .delete()
    .eq("collection_id", collectionId)
    .eq("track_id", trackId);
  throwIfError(error);
}

export async function deleteCollection(id: string, coverUrl?: string): Promise<void> {
  if (coverUrl && !coverUrl.startsWith("http")) {
    await supabase.storage.from(COVERS_BUCKET).remove([coverUrl]);
  }
  const { error } = await supabase.from("collections").delete().eq("id", id);
  throwIfError(error);
}

export function onCollectionChanged(fn: () => void) {
  const channel = supabase
    .channel("spotiyen-collections")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "collections" },
      () => fn()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "collection_tracks" },
      () => fn()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
