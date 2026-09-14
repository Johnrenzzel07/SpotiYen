import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Collection, CollectionKind } from "../types";
import {
  getAllCollections,
  createCollection as dbCreate,
  addTrackToCollection,
  removeTrackFromCollection,
  deleteCollection as dbDelete,
  onCollectionChanged,
  uploadCollectionCover,
  setCollectionCoverUrl,
} from "../lib/db";
import { prepareCoverBlob } from "../lib/image";
import { useAuth } from "./AuthContext";

interface CollectionCtx {
  collections: Collection[];
  loading: boolean;
  missingTables: boolean;
  refresh: () => Promise<void>;
  create: (
    kind: CollectionKind,
    title: string,
    note?: string,
    coverFile?: File | null
  ) => Promise<Collection>;
  setCover: (id: string, file: File) => Promise<void>;
  addTrack: (collectionId: string, trackId: string) => Promise<void>;
  removeTrack: (collectionId: string, trackId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const CollectionContext = createContext<CollectionCtx | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTables, setMissingTables] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await getAllCollections();
      setCollections(all);
      setMissingTables(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/missing|schema cache|does not exist/i.test(msg)) {
        setMissingTables(true);
        setCollections([]);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCollections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const off = onCollectionChanged(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [user, refresh]);

  const create = useCallback(
    async (kind: CollectionKind, title: string, note?: string, coverFile?: File | null) => {
      if (!user) throw new Error("Sign in first.");
      const created = await dbCreate({
        ownerId: user.id,
        kind,
        title,
        note,
      });
      if (coverFile) {
        const blob = await prepareCoverBlob(coverFile);
        const path = await uploadCollectionCover(user.id, created.id, blob);
        await setCollectionCoverUrl(created.id, path);
        const withCover = { ...created, coverUrl: path };
        setCollections((prev) => [withCover, ...prev]);
        return withCover;
      }
      setCollections((prev) => [created, ...prev]);
      return created;
    },
    [user]
  );

  const setCover = useCallback(
    async (id: string, file: File) => {
      if (!user) throw new Error("Sign in first.");
      const blob = await prepareCoverBlob(file);
      const path = await uploadCollectionCover(user.id, id, blob);
      await setCollectionCoverUrl(id, path);
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, coverUrl: path } : c))
      );
    },
    [user]
  );

  const addTrack = useCallback(
    async (collectionId: string, trackId: string) => {
      const col = collections.find((c) => c.id === collectionId);
      await addTrackToCollection(collectionId, trackId, col?.trackIds.length ?? 0);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId && !c.trackIds.includes(trackId)
            ? { ...c, trackIds: [...c.trackIds, trackId] }
            : c
        )
      );
    },
    [collections]
  );

  const removeTrack = useCallback(async (collectionId: string, trackId: string) => {
    await removeTrackFromCollection(collectionId, trackId);
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, trackIds: c.trackIds.filter((id) => id !== trackId) }
          : c
      )
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    const coverUrl = collections.find((c) => c.id === id)?.coverUrl;
    await dbDelete(id, coverUrl);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, [collections]);

  return (
    <CollectionContext.Provider
      value={{
        collections,
        loading,
        missingTables,
        refresh,
        create,
        setCover,
        addTrack,
        removeTrack,
        remove,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollections() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollections must be inside CollectionProvider");
  return ctx;
}
