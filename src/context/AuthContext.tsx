import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { User, UserRole } from "../types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { ensureProfile, fetchProfile } from "../lib/db";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; role?: UserRole }>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ) => Promise<{ ok: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  configured: false,
  login: async () => ({ ok: false }),
  signup: async () => ({ ok: false }),
  logout: async () => {},
  refreshProfile: async () => {},
});

async function profileFromAuthUser(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): Promise<User> {
  const meta = authUser.user_metadata ?? {};
  const role =
    meta.role === "singer" || meta.role === "listener" || meta.role === "admin"
      ? meta.role
      : undefined;
  return ensureProfile({
    id: authUser.id,
    email: authUser.email || "",
    name: typeof meta.name === "string" ? meta.name : undefined,
    role,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function applySession(session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null) {
      if (!session?.user) {
        if (!cancelled) setUser(null);
        return;
      }
      try {
        const profile =
          (await fetchProfile(session.user.id)) ??
          (await profileFromAuthUser(session.user));
        if (!cancelled) setUser(profile);
      } catch {
        try {
          const fallback = await profileFromAuthUser(session.user);
          if (!cancelled) setUser(fallback);
        } catch {
          /* Keep the current screen; a blip should not sign you out. */
        }
      }
    }

    void (async () => {
      const { data } = await supabase.auth.getSession();
      await applySession(data.session ?? null);
      if (!cancelled) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      void applySession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user) return { ok: false, error: "Could not sign in." };
    try {
      const profile = await profileFromAuthUser(data.user);
      setUser(profile);
      return { ok: true, role: profile.role };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Profile lookup failed. Run supabase/schema.sql in the SQL Editor.",
      };
    }
  }

  async function signup(
    email: string,
    password: string,
    name: string,
    role: UserRole
  ) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name:
            name.trim() ||
            (role === "singer" ? "Yen" : role === "admin" ? "Admin" : "John"),
          role,
        },
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data.session || !data.user) {
      return {
        ok: false,
        error:
          "Account created, but email confirmation is on. Turn it off in Supabase → Authentication → Providers → Email, then sign in.",
      };
    }
    try {
      const profile = await profileFromAuthUser(data.user);
      setUser(profile);
      return { ok: true, role: profile.role };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Profile create failed.",
      };
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    if (!id) return;
    const profile = await fetchProfile(id);
    if (profile) setUser(profile);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured: isSupabaseConfigured,
        login,
        signup,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
