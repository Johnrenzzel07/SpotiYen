import { NavLink } from "react-router-dom";
import { Home, Mic, Heart, Upload, ListMusic, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function BottomNav() {
  const { user } = useAuth();
  const isSinger = user?.role === "singer";
  const isAdmin = user?.role === "admin";

  const items = [
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

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 pt-2"
      style={{
        background: "color-mix(in srgb, var(--cream) 92%, white)",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        boxShadow: "0 -8px 24px rgba(58, 47, 69, 0.06)",
      }}
    >
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 min-w-0 min-h-11 flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-2xl text-[10px] font-semibold transition-all ${
              isActive ? "clay-sm" : ""
            }`
          }
          style={({ isActive }) =>
            isActive
              ? { background: "var(--clay-peach)", color: "var(--ink)" }
              : { color: "var(--soft-ink)" }
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
