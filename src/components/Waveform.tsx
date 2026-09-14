interface Props {
  data: number[];
  progress?: number;
  color?: string;
  activeColor?: string;
  height?: number;
  className?: string;
  onClick?: (pct: number) => void;
}

export default function Waveform({
  data,
  progress = 0,
  color = "var(--clay-lilac)",
  activeColor = "var(--clay-rose)",
  height = 48,
  className = "",
  onClick,
}: Props) {
  const bars = data.length || 40;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onClick(Math.max(0, Math.min(1, pct)));
  }

  return (
    <svg
      viewBox={`0 0 ${bars * 4} ${height}`}
      className={`w-full ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ height }}
      onClick={handleClick}
      role="img"
      aria-label="Audio waveform"
    >
      {data.map((v, i) => {
        const barH = Math.max(3, v * height * 0.85);
        const x = i * 4 + 0.5;
        const y = (height - barH) / 2;
        const pct = i / bars;
        const fill = pct <= progress ? activeColor : color;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={2.5}
            height={barH}
            rx={1.25}
            fill={fill}
            opacity={pct <= progress ? 1 : 0.5}
          />
        );
      })}
    </svg>
  );
}
