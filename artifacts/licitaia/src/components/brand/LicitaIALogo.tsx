interface LicitaIALogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "white";
  className?: string;
}

const SIZES = {
  sm:  { icon: 28, fontSize: 17, gap: 9 },
  md:  { icon: 36, fontSize: 21, gap: 11 },
  lg:  { icon: 48, fontSize: 27, gap: 14 },
  xl:  { icon: 64, fontSize: 36, gap: 18 },
};

export function LicitaIALogo({
  variant = "full",
  size = "md",
  theme = "dark",
  className = "",
}: LicitaIALogoProps) {
  const { icon: iconSize, fontSize, gap } = SIZES[size];
  const rx = iconSize * 0.22;

  const textColor = theme === "white" ? "#ffffff" : "#0f172a";

  const totalWidth = variant === "mark"
    ? iconSize
    : iconSize + gap + fontSize * 4.8;

  const textX = iconSize + gap;
  const textY = iconSize * 0.74;

  const uid = `logo-${size}-${theme}`;

  return (
    <svg
      width={totalWidth}
      height={iconSize}
      viewBox={`0 0 ${totalWidth} ${iconSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LicitaIA"
      role="img"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {/* Teal-to-cyan gradient for "IA" */}
        <linearGradient id={`${uid}-ia`} x1="0" y1="0" x2="1" y2="0"
          gradientUnits="userSpaceOnUse"
          x1={textX + fontSize * 2.88}
          y1="0"
          x2={textX + fontSize * 4.2}
          y2="0"
        >
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {/* ── Icon background ── */}
      <rect x="0" y="0" width={iconSize} height={iconSize} rx={rx} fill={`url(#${uid}-bg)`} />
      <rect x="0" y="0" width={iconSize} height={iconSize} rx={rx} fill={`url(#${uid}-shine)`} />

      {/* ── Document checklist icon ── */}
      {(() => {
        const pad = iconSize * 0.2;
        const w = iconSize - pad * 2;
        const lineH = iconSize * 0.055;
        const lineR = lineH / 2;

        const y1 = pad + w * 0.06;
        const y2 = y1 + w * 0.28;
        const y3 = y2 + w * 0.28;

        const cx = pad + w * 0.5;
        const cy = y3 + lineH / 2;
        const cs = w * 0.125;

        return (
          <>
            <rect x={pad} y={y1} width={w} height={lineH} rx={lineR} fill="rgba(255,255,255,0.92)" />
            <rect x={pad} y={y2} width={w} height={lineH} rx={lineR} fill="rgba(255,255,255,0.92)" />
            <rect x={pad} y={y3} width={w * 0.52} height={lineH} rx={lineR} fill="rgba(255,255,255,0.3)" />
            <polyline
              points={`${cx},${cy + cs * 0.55} ${cx + cs * 0.48},${cy + cs} ${cx + cs * 1.38},${cy - cs * 0.3}`}
              stroke="#2dd4bf"
              strokeWidth={iconSize * 0.063}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );
      })()}

      {/* ── Wordmark ── */}
      {variant === "full" && (
        <text
          x={textX}
          y={textY}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
          fontSize={fontSize}
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          <tspan fill={textColor}>Licita</tspan>
          <tspan fill={`url(#${uid}-ia)`} fontWeight="800">IA</tspan>
        </text>
      )}
    </svg>
  );
}
