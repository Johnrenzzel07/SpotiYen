import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Headphones, Mic, Shield, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTracks } from "../context/TrackContext";
import { adminSetPassword } from "../lib/db";
import { ButtonDots, LibrarySkeleton } from "../components/ClaySpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import type { User, UserRole } from "../types";

const ROLES: { id: UserRole; label: string; hint: string; color: string }[] = [
  { id: "singer", label: "Singer", hint: "Can record", color: "var(--clay-peach)" },
  { id: "listener", label: "Listener", hint: "Can play", color: "var(--clay-mint)" },
  { id: "admin", label: "Admin", hint: "Can manage", color: "var(--clay-lilac)" },
];

export default function ManageUsers() {
  const { user, refreshProfile } = useAuth();
  const { profiles, tracks, loading, updateProfile } = useTracks();
  const [names, setNames] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{ person: User; role: UserRole } | null>(null);
  const [passwords, setPasswords] = useState<Record<string, { next: string; confirm: string }>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const people = useMemo(
    () => [...profiles].sort((a, b) => a.name.localeCompare(b.name)),
    [profiles]
  );

  if (user && user.role !== "admin") {
    return <Navigate to="/library" replace />;
  }

  if (loading) {
    return <LibrarySkeleton />;
  }

  function displayName(person: User) {
    return names[person.id] ?? person.name;
  }

  async function saveName(person: User) {
    const next = displayName(person).trim();
    if (!next || next === person.name) return;
    setSavingId(person.id);
    setError("");
    try {
      await updateProfile(person.id, { name: next });
      if (person.id === user?.id) await refreshProfile();
      setNames((prev) => {
        const copy = { ...prev };
        delete copy[person.id];
        return copy;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that name.");
    } finally {
      setSavingId(null);
    }
  }

  async function savePassword(person: User) {
    const pair = passwords[person.id] ?? { next: "", confirm: "" };
    if (pair.next.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (pair.next !== pair.confirm) {
      setError("Those two passwords do not match.");
      return;
    }
    setSavingId(person.id);
    setError("");
    setNotice("");
    try {
      await adminSetPassword(person.id, pair.next, person.id === user?.id);
      setPasswords((prev) => ({ ...prev, [person.id]: { next: "", confirm: "" } }));
      setNotice(`Password updated for ${person.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that password.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveRole() {
    if (!pendingRole) return;
    setSavingId(pendingRole.person.id);
    setError("");
    try {
      await updateProfile(pendingRole.person.id, { role: pendingRole.role });
      if (pendingRole.person.id === user?.id) await refreshProfile();
      setPendingRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that role.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <Users size={26} />
        Manage users
      </h1>
      <p className="text-sm mt-1 mb-6" style={{ color: "var(--soft-ink)" }}>
        Change names, roles, and passwords. New people still create their own account on login.
      </p>

      {notice && (
        <p
          className="text-xs font-semibold mb-4 px-3 py-2 rounded-xl"
          style={{ background: "rgba(142,224,200,0.35)", color: "var(--ink)" }}
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          className="text-xs font-semibold mb-4 px-3 py-2 rounded-xl"
          style={{ background: "rgba(232,93,117,0.1)", color: "var(--record-red)" }}
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {people.map((person) => {
          const isYou = person.id === user?.id;
          const songCount = tracks.filter((t) => t.singerId === person.id).length;
          const dirty = displayName(person).trim() !== person.name;
          const Icon =
            person.role === "singer" ? Mic : person.role === "admin" ? Shield : Headphones;

          return (
            <div key={person.id} className="clay p-4" style={{ background: "white" }}>
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white clay-sm flex-shrink-0"
                  style={{
                    background:
                      person.role === "singer"
                        ? "var(--clay-rose)"
                        : person.role === "admin"
                          ? "var(--clay-lilac)"
                          : "var(--clay-mint)",
                  }}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={displayName(person)}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [person.id]: e.target.value }))
                      }
                      className="w-full clay-sm px-3 py-2 text-sm font-bold outline-none"
                      style={{ background: "var(--cream)", color: "var(--ink)" }}
                      aria-label={`Name for ${person.email}`}
                    />
                    {isYou && (
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: "var(--clay-peach)", color: "var(--ink)" }}
                      >
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--soft-ink)" }}>
                    {person.email}
                    {songCount > 0
                      ? ` · ${songCount} song${songCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
              </div>

              {dirty && (
                <button
                  type="button"
                  onClick={() => void saveName(person)}
                  disabled={savingId === person.id}
                  aria-busy={savingId === person.id}
                  className="clay-btn mt-3 w-full min-h-11 text-sm font-bold text-white"
                  style={{ background: "var(--clay-rose)" }}
                >
                  {savingId === person.id ? <ButtonDots /> : "Save name"}
                </button>
              )}

              <div className="grid grid-cols-3 gap-2 mt-3">
                {ROLES.map((role) => {
                  const selected = person.role === role.id;
                  const locked = isYou && role.id !== "admin";
                  return (
                    <button
                      key={role.id}
                      type="button"
                      disabled={locked || savingId === person.id}
                      onClick={() => {
                        if (selected || locked) return;
                        setPendingRole({ person, role: role.id });
                      }}
                      className="clay-btn min-h-12 px-2 py-2 text-[11px] font-bold leading-tight"
                      style={{
                        background: selected ? role.color : "var(--cream)",
                        color: "var(--ink)",
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      {role.label}
                      <span className="block text-[10px] font-semibold" style={{ color: "var(--soft-ink)" }}>
                        {locked ? "That's you" : role.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(58,47,69,0.08)" }}>
                <p className="text-xs font-bold mb-2" style={{ color: "var(--ink)" }}>
                  New password
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwords[person.id]?.next ?? ""}
                    onChange={(e) =>
                      setPasswords((prev) => ({
                        ...prev,
                        [person.id]: {
                          next: e.target.value,
                          confirm: prev[person.id]?.confirm ?? "",
                        },
                      }))
                    }
                    placeholder="New password"
                    className="flex-1 clay-sm px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cream)", color: "var(--ink)" }}
                    aria-label={`New password for ${person.name}`}
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwords[person.id]?.confirm ?? ""}
                    onChange={(e) =>
                      setPasswords((prev) => ({
                        ...prev,
                        [person.id]: {
                          next: prev[person.id]?.next ?? "",
                          confirm: e.target.value,
                        },
                      }))
                    }
                    placeholder="Type it again"
                    className="flex-1 clay-sm px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cream)", color: "var(--ink)" }}
                    aria-label={`Confirm password for ${person.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => void savePassword(person)}
                    disabled={savingId === person.id || !(passwords[person.id]?.next)}
                    aria-busy={savingId === person.id}
                    className="clay-btn min-h-11 px-4 text-xs font-bold text-white"
                    style={{ background: "var(--clay-rose)" }}
                  >
                    {savingId === person.id ? <ButtonDots /> : "Set password"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pendingRole && (
        <ConfirmDialog
          title={`Make ${pendingRole.person.name} a ${pendingRole.role}?`}
          message={
            pendingRole.role === "singer"
              ? "They will be able to record in Studio."
              : pendingRole.role === "admin"
                ? "They will be able to manage users and delete songs."
                : "They will listen and like songs, without Studio."
          }
          confirmLabel="Change role"
          busy={savingId === pendingRole.person.id}
          onConfirm={() => void saveRole()}
          onCancel={() => {
            if (!savingId) setPendingRole(null);
          }}
        />
      )}
    </div>
  );
}
