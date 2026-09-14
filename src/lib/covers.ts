import type { Mood } from "../types";

const PALETTES: Record<string, [string, string, string]> = {
  "Late night": ["#3A2F45", "#C5B4F0", "#6B5C78"],
  "For you": ["#F2A6B8", "#FFC89A", "#C5B4F0"],
  "Warm-up": ["#FFC89A", "#8EE0C8", "#F4EFE6"],
  "Full send": ["#E85D75", "#F2A6B8", "#C5B4F0"],
  default: ["#C5B4F0", "#8EE0C8", "#F2A6B8"],
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function generateCoverSVG(
  title: string,
  mood: Mood | "",
  seed: number
): string {
  const rng = seededRandom(seed);
  const pal = PALETTES[mood || "default"];
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const blobCount = 3 + Math.floor(rng() * 2);
  let blobs = "";
  for (let i = 0; i < blobCount; i++) {
    const cx = 20 + rng() * 60;
    const cy = 20 + rng() * 60;
    const rx = 15 + rng() * 25;
    const ry = 15 + rng() * 25;
    const fill = pal[i % pal.length];
    const opacity = 0.4 + rng() * 0.35;
    blobs += `<ellipse cx="${cx}%" cy="${cy}%" rx="${rx}%" ry="${ry}%" fill="${fill}" opacity="${opacity}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="32" fill="${pal[0]}"/>
    ${blobs}
    <rect width="200" height="200" rx="32" fill="url(#hl)" opacity="0.35"/>
    <defs>
      <linearGradient id="hl" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="white" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <text x="100" y="115" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="48" fill="white" opacity="0.9">${initials}</text>
  </svg>`;
}

export function coverToDataUrl(
  title: string,
  mood: Mood | "",
  seed: number
): string {
  const svg = generateCoverSVG(title, mood, seed);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
