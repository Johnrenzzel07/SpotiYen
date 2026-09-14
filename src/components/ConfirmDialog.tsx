import { ButtonDots } from "./ClaySpinner";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 animate-fade"
      style={{ background: "color-mix(in srgb, var(--cream) 78%, transparent)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="clay-float w-full max-w-sm p-6" style={{ background: "white" }}>
        <h2
          id="confirm-title"
          className="text-lg font-extrabold"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--soft-ink)" }}>
          {message}
        </p>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="clay-btn flex-1 min-h-12 text-sm font-bold"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="clay-btn flex-1 min-h-12 text-sm font-bold text-white"
            style={{ background: "var(--record-red)" }}
          >
            {busy ? <ButtonDots /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
