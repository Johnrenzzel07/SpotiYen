import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ListMusic, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { useCollections } from "../context/CollectionContext";
import CollectionCard from "../components/CollectionCard";
import { CollectionSkeleton } from "../components/ClaySpinner";

export default function Collections() {
  const { user } = useAuth();
  const { ownerName } = useTracks();
  const { collections, loading, missingTables } = useCollections();

  const mine = useMemo(
    () => collections.filter((c) => c.ownerId === user?.id),
    [collections, user]
  );
  const theirs = useMemo(
    () => collections.filter((c) => c.ownerId !== user?.id),
    [collections, user]
  );

  if (loading) {
    return <CollectionSkeleton />;
  }

  if (missingTables) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="clay p-5" style={{ background: "white" }}>
          <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--ink)" }}>
            One more SQL step
          </h1>
          <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
            Open Supabase SQL Editor, paste <strong>supabase/migrate-collections.sql</strong>, click Run, then refresh.
          </p>
        </div>
      </div>
    );
  }

  const otherName = theirs[0] ? ownerName(theirs[0].ownerId) : user?.role === "singer" ? "John" : "Yen";

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <ListMusic size={26} />
            Albums and playlists
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--soft-ink)" }}>
            Yours and {otherName}&apos;s. Both of you can open everything.
          </p>
        </div>
        <Link
          to="/upload?tab=album"
          className="clay-btn min-h-11 px-4 text-sm font-bold flex items-center gap-2"
          style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
        >
          <Plus size={16} />
          New album or playlist
        </Link>
      </div>

      <Section title="Your albums" items={mine.filter((c) => c.kind === "album")} empty="Make an album on Upload. They will see it too." />
      <Section title="Your playlists" items={mine.filter((c) => c.kind === "playlist")} empty="Make a playlist on Upload for the two of you." />
      <Section title={`${otherName}'s albums`} items={theirs.filter((c) => c.kind === "album")} empty={`${otherName} has no albums yet.`} />
      <Section title={`${otherName}'s playlists`} items={theirs.filter((c) => c.kind === "playlist")} empty={`${otherName} has no playlists yet.`} />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: import("../types").Collection[];
  empty: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-extrabold mb-3" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--soft-ink)" }}>
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((c, i) => (
            <CollectionCard key={c.id} collection={c} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
