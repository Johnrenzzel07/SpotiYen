import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Music, Heart, Clock, Mic, LogOut, Upload, ListMusic, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";
import ClaySpinner from "./ClaySpinner";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const isSinger = user?.role === "singer";
  const isAdmin = user?.role === "admin";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
      isActive
        ? "clay-pressed"
        : "hover:bg-white/60"
    }`;

  const activeStyle = {
    background: "var(--clay-peach)",
    color: "var(--ink)",
  };

  return (
    <aside
      className="hidden md:flex flex-col w-64 h-screen sticky top-0 p-4 gap-2"
      style={{ background: "transparent" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-3 mb-4">
        <BrandLogo size={36} />
        <span
          className="text-xl font-extrabold tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          SpotiYen
        </span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        <NavLink
          to="/library"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <Home size={18} />
          Home
        </NavLink>

        <NavLink
          to="/library/songs"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <Music size={18} />
          All Songs
        </NavLink>

        <NavLink
          to="/library/liked"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <Heart size={18} />
          Liked
        </NavLink>

        <NavLink
          to="/library/recent"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <Clock size={18} />
          Recently Added
        </NavLink>

        <NavLink
          to="/collections"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <ListMusic size={18} />
          Albums
        </NavLink>

        <NavLink
          to="/upload"
          className={linkClass}
          style={({ isActive }) => (isActive ? activeStyle : {})}
        >
          <Upload size={18} />
          Upload
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/users"
            className={linkClass}
            style={({ isActive }) => (isActive ? activeStyle : {})}
          >
            <Users size={18} />
            Users
          </NavLink>
        )}

        {isSinger && (
          <NavLink
            to="/record"
            className={linkClass}
            style={({ isActive }) => (isActive ? activeStyle : {})}
          >
            <Mic size={18} />
            Studio
          </NavLink>
        )}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 px-4 py-3 mt-auto">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white clay-sm"
          style={{
            background: isSinger ? "var(--clay-rose)" : "var(--clay-mint)",
          }}
        >
          {user?.name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold truncate"
            style={{ color: "var(--ink)" }}
          >
            {user?.name}
          </p>
          <p className="text-[10px] capitalize" style={{ color: "var(--soft-ink)" }}>
            {user?.role}
          </p>
        </div>
        <button
          onClick={() => {
            setBusy(true);
            void logout().finally(() => setBusy(false));
          }}
          disabled={busy}
          aria-busy={busy}
          className="p-1.5 rounded-full hover:bg-black/5 transition-colors min-w-11 min-h-11 flex items-center justify-center"
          aria-label="Logout"
        >
          {busy ? <ClaySpinner size={16} /> : <LogOut size={16} style={{ color: "var(--soft-ink)" }} />}
        </button>
      </div>
    </aside>
  );
}
