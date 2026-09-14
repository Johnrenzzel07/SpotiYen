interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
  tone?: "clay" | "light";
}

export default function ClaySpinner({
  size = 40,
  label,
  className = "",
  tone = "clay",
}: SpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }} aria-hidden>
        <span
          className="clay-spin absolute inset-0 rounded-full"
          style={{ background: tone === "light" ? "white" : "var(--clay-rose)" }}
        />
        <span
          className="clay-spin-delay absolute rounded-full"
          style={{
            inset: Math.max(4, size * 0.22),
            background: "var(--clay-lilac)",
          }}
        />
      </div>
      {label && (
        <p className="text-sm font-bold" style={{ color: "var(--soft-ink)" }}>
          {label}
        </p>
      )}
    </div>
  );
}

export function ButtonDots({ ink = false }: { ink?: boolean }) {
  return (
    <span className="inline-flex items-center justify-center gap-1" aria-hidden>
      <span className={`loading-dot ${ink ? "loading-dot-ink" : ""}`} />
      <span className={`loading-dot ${ink ? "loading-dot-ink" : ""}`} />
      <span className={`loading-dot ${ink ? "loading-dot-ink" : ""}`} />
    </span>
  );
}

export function LoadingScreen({ message = "Opening SpotiYen" }: { message?: string }) {
  return (
    <div className="clay-bg min-h-dvh flex items-center justify-center" role="status" aria-live="polite">
      <ClaySpinner size={56} label={message} />
    </div>
  );
}

export function LoadingOverlay({ message = "Working on it" }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center animate-fade"
      style={{
        background: "color-mix(in srgb, var(--cream) 78%, transparent)",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="clay-float px-8 py-6 flex flex-col items-center" style={{ background: "white" }}>
        <ClaySpinner size={48} label={message} />
      </div>
    </div>
  );
}

export function ClayProgress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full max-w-xs">
      <div
        className="h-3 rounded-full overflow-hidden"
        style={{ background: "var(--cream)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            background: "var(--clay-rose)",
          }}
        />
      </div>
      {label && (
        <p className="text-xs text-center mt-2 font-semibold" style={{ color: "var(--soft-ink)" }}>
          {label}
        </p>
      )}
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div
      className="px-4 md:px-8 py-5 md:py-10 max-w-4xl mx-auto"
      role="status"
      aria-live="polite"
      aria-label="Loading library"
    >
      <div className="skeleton h-8 w-52 mb-3" />
      <div className="skeleton h-4 w-40 mb-8" />
      <div className="flex gap-3 overflow-hidden mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton w-[132px] h-[168px] flex-shrink-0" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 4, 5].map((i) => (
          <div key={i} className="skeleton h-[76px] w-full" />
        ))}
      </div>
    </div>
  );
}

export function CollectionSkeleton() {
  return (
    <div
      className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto"
      role="status"
      aria-live="polite"
      aria-label="Loading albums"
    >
      <div className="skeleton h-8 w-64 mb-3" />
      <div className="skeleton h-4 w-48 mb-8" />
      <div className="skeleton h-16 w-full mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
