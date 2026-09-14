import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";
import ClaySpinner from "./ClaySpinner";

export default function MobileHeader() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 pb-3"
      style={{
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: "color-mix(in srgb, var(--cream) 88%, white)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <BrandLogo size={32} />
        <div className="min-w-0">
          <p
            className="text-sm font-extrabold leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            SpotiYen
          </p>
          <p
            className="text-[10px] font-semibold truncate"
            style={{ color: "var(--soft-ink)" }}
          >
            {user?.name} · {user?.role}
          </p>
        </div>
      </div>
      <button
        onClick={() => void handleLogout()}
        disabled={busy}
        aria-busy={busy}
        className="clay-btn w-11 h-11 flex items-center justify-center flex-shrink-0"
        style={{ background: "white", color: "var(--ink)" }}
        aria-label="Logout"
      >
        {busy ? <ClaySpinner size={18} /> : <LogOut size={18} />}
      </button>
    </header>
  );
}
