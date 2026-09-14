import { Link } from "react-router-dom";
import ClayCover from "./ClayCover";
import type { Collection } from "../types";
import { useTracks } from "../context/TrackContext";
import { coverPublicUrl } from "../lib/db";

export default function CollectionCard({
  collection,
  index = 0,
}: {
  collection: Collection;
  index?: number;
}) {
  const { ownerName } = useTracks();
  const isAlbum = collection.kind === "album";

  return (
    <Link
      to={`/collection/${collection.id}`}
      className="clay-sm flex flex-col gap-2 p-3 min-w-[148px] snap-start animate-pop-in text-left"
      style={{
        background: "white",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <ClayCover
        title={collection.title}
        mood={isAlbum ? "For you" : "Late night"}
        seed={collection.coverSeed}
        size="lg"
        className="!w-full !h-28 !rounded-xl"
        imageUrl={coverPublicUrl(collection.coverUrl)}
      />
      <p
        className="text-sm font-bold truncate"
        style={{ color: "var(--ink)" }}
      >
        {collection.title}
      </p>
      <p className="text-[11px]" style={{ color: "var(--soft-ink)" }}>
        {ownerName(collection.ownerId)} · {isAlbum ? "Album" : "Playlist"} ·{" "}
        {collection.trackIds.length} song{collection.trackIds.length === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
