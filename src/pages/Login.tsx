import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Headphones, Heart, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";
import BrandLogo from "../components/BrandLogo";
import { ButtonDots } from "../components/ClaySpinner";

export default function Login() {
  const { login, signup, configured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("singer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function afterAuth(ok: boolean, err?: string, nextRole?: UserRole) {
    if (!ok) {
      setError(err || "Something went wrong.");
      return;
    }
    navigate(nextRole === "singer" ? "/record" : "/library");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await login(email, password);
        await afterAuth(result.ok, result.error, result.role);
      } else {
        const name =
          role === "singer" ? "Yen" : role === "admin" ? "Admin" : "John";
        const result = await signup(email, password, name, role);
        await afterAuth(result.ok, result.error, result.role);
      }
    } finally {
      setBusy(false);
    }
  }

  function fillQuick(nextRole: UserRole) {
    setRole(nextRole);
    setEmail(
      nextRole === "singer"
        ? "yen@spotiyen.app"
        : nextRole === "admin"
          ? "admin@spotiyen.app"
          : "john@spotiyen.app"
    );
  }

  if (!configured) {
    return (
      <div className="clay-bg min-h-screen flex items-center justify-center p-4">
        <div
          className="clay w-full max-w-md p-6"
          style={{ background: "white" }}
        >
          <h1
            className="text-2xl font-extrabold mb-2"
            style={{ color: "var(--ink)" }}
          >
            Connect Supabase
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--soft-ink)" }}>
            SpotiYen needs your project keys so Yen’s recordings can show up on John’s phone.
          </p>
          <ol
            className="text-sm leading-relaxed pl-4 list-decimal space-y-2"
            style={{ color: "var(--ink)" }}
          >
            <li>Create a project at supabase.com</li>
            <li>
              Run <code className="font-bold">supabase/schema.sql</code> in the SQL Editor
            </li>
            <li>
              Copy <code className="font-bold">.env.example</code> to{" "}
              <code className="font-bold">.env</code>
            </li>
            <li>
              Paste URL + anon key from Settings → API, then restart{" "}
              <code className="font-bold">npm run dev</code>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div
      className="clay-bg min-h-dvh flex items-center justify-center px-4 overflow-y-auto"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-sm py-6">
        <div className="flex flex-col items-center mb-8 animate-slide-up">
          <BrandLogo size={88} className="mb-4 clay" />
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            SpotiYen
          </h1>
          <p
            className="text-sm mt-1 text-center"
            style={{ color: "var(--soft-ink)" }}
          >
            Her voice. Your player.
          </p>
        </div>

        <div
          className="clay p-6 animate-slide-up"
          style={{ background: "white", animationDelay: "0.1s" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={busy}>
            <label
              htmlFor="email"
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yen@spotiyen.app"
              className="clay-sm px-4 py-3.5 text-base outline-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
              autoFocus
              required
              disabled={busy}
            />

            <label
              htmlFor="password"
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="clay-sm px-4 py-3.5 text-base outline-none"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
              minLength={6}
              required
              disabled={busy}
            />

            {mode === "signup" && (
              <div>
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--ink)" }}
                >
                  I am
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuick("singer")}
                    className="clay-btn flex-1 py-2 text-xs font-bold"
                    style={{
                      background:
                        role === "singer" ? "var(--clay-peach)" : "var(--cream)",
                      color: "var(--ink)",
                    }}
                  >
                    Yen · Singer
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuick("listener")}
                    className="clay-btn flex-1 py-2 text-xs font-bold"
                    style={{
                      background:
                        role === "listener" ? "var(--clay-mint)" : "var(--cream)",
                      color: "var(--ink)",
                    }}
                  >
                    John · Listener
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuick("admin")}
                    className="clay-btn flex-1 py-2 text-xs font-bold"
                    style={{
                      background:
                        role === "admin" ? "var(--clay-lilac)" : "var(--cream)",
                      color: "var(--ink)",
                    }}
                  >
                    Admin · Can delete songs
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p
                className="text-xs font-semibold px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(232,93,117,0.1)",
                  color: "var(--record-red)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="clay-btn py-3.5 min-h-12 text-sm font-bold text-white"
              style={{ background: "var(--clay-rose)" }}
            >
              {busy ? (
                <ButtonDots />
              ) : mode === "login" ? (
                "Enter SpotiYen"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="w-full mt-4 text-xs font-bold"
            style={{ color: "var(--soft-ink)" }}
          >
            {mode === "login"
              ? "First time? Create Yen, John, or Admin"
              : "Already have an account? Sign in"}
          </button>

          {mode === "login" && (
            <div className="mt-5 pt-4 border-t border-black/5">
              <p
                className="text-[10px] font-semibold mb-3 text-center uppercase tracking-wider"
                style={{ color: "var(--soft-ink)" }}
              >
                Fill email
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fillQuick("singer")}
                  className="clay-btn flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold"
                  style={{
                    background: "var(--clay-peach)",
                    color: "var(--ink)",
                  }}
                >
                  <Mic size={16} />
                  Yen
                </button>
                <button
                  type="button"
                  onClick={() => fillQuick("listener")}
                  className="clay-btn flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold"
                  style={{
                    background: "var(--clay-mint)",
                    color: "var(--ink)",
                  }}
                >
                  <Headphones size={16} />
                  John
                </button>
                <button
                  type="button"
                  onClick={() => fillQuick("admin")}
                  className="clay-btn flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold"
                  style={{
                    background: "var(--clay-lilac)",
                    color: "var(--ink)",
                  }}
                >
                  <Shield size={16} />
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>

        <p
          className="text-[10px] text-center mt-6 flex items-center justify-center gap-1.5"
          style={{ color: "var(--soft-ink)" }}
        >
          A private music app just for the two of you
          <Heart
            size={12}
            fill="var(--clay-rose)"
            style={{ color: "var(--clay-rose)" }}
            aria-hidden
          />
        </p>
      </div>
    </div>
  );
}
