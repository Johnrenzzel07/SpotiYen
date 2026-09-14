import { NavLink } from "react-router-dom";
import { Home, Mic, Heart, Upload, ListMusic, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function useNavItems() {
  const { user } = useAuth();
  const isSinger = user?.role === "singer";
  const isAdmin = user?.role === "admin";

  return [
    { to: "/library", icon: Home, label: "Home", end: true },
    ...(isSinger
      ? [{ to: "/record", icon: Mic, label: "Studio", end: false }]
      : []),
    ...(isAdmin
      ? [{ to: "/users", icon: Users, label: "Users", end: false }]
      : []),
    { to: "/upload", icon: Upload, label: "Upload", end: false },
    { to: "/collections", icon: ListMusic, label: "Mixes", end: false },
    { to: "/library/liked", icon: Heart, label: "Liked", end: false },
  ];
}

export function NavTabs() {
  const items = useNavItems();

  return (
    <nav className="flex items-center justify-around px-1.5 pt-1 pb-0.5" aria-label="Main">
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-2xl text-[10px] font-semibold transition-all ${
              isActive ? "clay-sm" : ""
            }`
          }
          style={({ isActive }) =>
            isActive
              ? { background: "var(--clay-peach)", color: "var(--ink)" }
              : { color: "var(--soft-ink)" }
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
