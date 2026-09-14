import { coverToDataUrl } from "../lib/covers";
import type { Mood } from "../types";

interface Props {
  title: string;
  mood: Mood | "";
  seed: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  imageUrl?: string;
}

const SIZES = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-28 h-28",
  xl: "w-44 h-44",
};

export default function ClayCover({
  title,
  mood,
  seed,
  size = "md",
  className = "",
  imageUrl,
}: Props) {
  const src = imageUrl || coverToDataUrl(title, mood, seed);

  return (
    <div
      className={`${SIZES[size]} rounded-2xl overflow-hidden flex-shrink-0 clay-sm ${className}`}
      style={{ background: "var(--clay-lilac)" }}
    >
      <img
        src={src}
        alt={`Cover for ${title}`}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}
