interface Props {
  size?: number;
  className?: string;
}

export default function BrandLogo({ size = 36, className = "" }: Props) {
  return (
    <img
      src="/spotiyen.jpeg"
      alt="SpotiYen"
      width={size}
      height={size}
      className={`object-cover object-[center_18%] clay-sm flex-shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: size > 48 ? 24 : 14 }}
      draggable={false}
    />
  );
}
