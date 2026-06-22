import { cn } from "@/lib/utils";

export type StickerVariant = "cat" | "ghost" | "rocket" | "robot" | "mug";

/**
 * Illustrated die-cut stickers. The white "cut" edge is produced by drawing a
 * fat white stroke *behind* each filled shape (paint-order: stroke), so the
 * silhouette gets a clean sticker border. A soft drop shadow lifts it off the
 * page, and a slight tilt makes it feel hand-placed.
 */
export function Sticker({
  variant = "cat",
  tilt = -7,
  className,
}: {
  variant?: StickerVariant;
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-block", className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <svg
        viewBox="0 0 220 220"
        className="size-44 sm:size-52"
        role="img"
        aria-label={`${variant} sticker`}
      >
        <defs>
          <filter id={`sh-${variant}`} x="-25%" y="-25%" width="150%" height="160%">
            <feDropShadow
              dx="0"
              dy="7"
              stdDeviation="7"
              floodColor="#1b1a17"
              floodOpacity="0.22"
            />
          </filter>
        </defs>
        <g filter={`url(#sh-${variant})`}>{ART[variant]}</g>
      </svg>
    </div>
  );
}

const CUT = {
  stroke: "#fffdf9",
  strokeWidth: 14,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
  paintOrder: "stroke" as const,
};

const ART: Record<StickerVariant, React.ReactNode> = {
  cat: (
    <>
      <g {...CUT}>
        <path
          d="M150 166 C198 158 196 96 168 92 C148 89 146 112 158 122"
          fill="#a9824e"
        />
        <path
          d="M70 180 C60 122 78 96 110 96 C142 96 160 122 150 180 Z"
          fill="#b88a4e"
        />
        <path d="M78 68 L84 34 L108 58 Z" fill="#b88a4e" />
        <path d="M142 68 L136 34 L112 58 Z" fill="#b88a4e" />
        <circle cx="110" cy="84" r="40" fill="#b88a4e" />
      </g>
      <path d="M87 56 L90 40 L101 54 Z" fill="#e7c89b" />
      <path d="M133 56 L130 40 L119 54 Z" fill="#e7c89b" />
      <path d="M90 84 q8 9 16 0" fill="none" stroke="#241f17" strokeWidth="5" strokeLinecap="round" />
      <path d="M114 84 q8 9 16 0" fill="none" stroke="#241f17" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="84" cy="98" rx="7" ry="4.5" fill="#e0906e" opacity="0.55" />
      <ellipse cx="136" cy="98" rx="7" ry="4.5" fill="#e0906e" opacity="0.55" />
      <path d="M104 95 L116 95 L110 102 Z" fill="#7a4a3a" />
      <path d="M110 102 q-6 8 -14 5 M110 102 q6 8 14 5" fill="none" stroke="#241f17" strokeWidth="3.5" strokeLinecap="round" />
      <g stroke="#241f17" strokeWidth="3" strokeLinecap="round" opacity="0.75">
        <path d="M72 90 h-22" />
        <path d="M72 99 l-22 6" />
        <path d="M148 90 h22" />
        <path d="M148 99 l22 6" />
      </g>
      <ellipse cx="92" cy="172" rx="10" ry="7" fill="#9a6f3f" />
      <ellipse cx="128" cy="172" rx="10" ry="7" fill="#9a6f3f" />
    </>
  ),
  ghost: (
    <>
      <g {...CUT}>
        <path
          d="M58 112 C58 64 90 42 110 42 C130 42 162 64 162 112 L162 170 q-13 -15 -23 0 q-11 15 -22 0 q-12 15 -23 0 q-11 15 -23 0 Z"
          fill="#efe7d6"
        />
      </g>
      <circle cx="93" cy="100" r="8.5" fill="#241f17" />
      <circle cx="127" cy="100" r="8.5" fill="#241f17" />
      <ellipse cx="110" cy="122" rx="9" ry="11" fill="#241f17" />
      <ellipse cx="78" cy="116" rx="7.5" ry="5" fill="#e0906e" opacity="0.55" />
      <ellipse cx="142" cy="116" rx="7.5" ry="5" fill="#e0906e" opacity="0.55" />
    </>
  ),
  rocket: (
    <>
      <g {...CUT}>
        <path d="M86 124 L62 166 L88 152 Z" fill="#9a6f3f" />
        <path d="M134 124 L158 166 L132 152 Z" fill="#9a6f3f" />
        <path
          d="M110 28 C142 50 146 112 130 152 L90 152 C74 112 78 50 110 28 Z"
          fill="#b88a4e"
        />
        <path d="M96 152 q14 26 28 0 q-5 20 -14 30 q-9 -10 -14 -30 Z" fill="#e0a24e" />
      </g>
      <circle cx="110" cy="80" r="16" fill="#cfe6f0" stroke="#fffdf9" strokeWidth="6" />
      <circle cx="110" cy="80" r="7" fill="#7fa6c0" opacity="0.7" />
    </>
  ),
  robot: (
    <>
      <g {...CUT}>
        <rect x="106" y="36" width="8" height="22" rx="4" fill="#9a6f3f" />
        <circle cx="110" cy="32" r="8" fill="#b88a4e" />
        <rect x="48" y="86" width="14" height="28" rx="6" fill="#9a6f3f" />
        <rect x="158" y="86" width="14" height="28" rx="6" fill="#9a6f3f" />
        <rect x="62" y="56" width="96" height="82" rx="22" fill="#b88a4e" />
      </g>
      <rect x="78" y="74" width="64" height="46" rx="13" fill="#241f17" />
      <circle cx="96" cy="94" r="7" fill="#8fe0c0" />
      <circle cx="124" cy="94" r="7" fill="#8fe0c0" />
      <path d="M96 107 q14 10 28 0" fill="none" stroke="#8fe0c0" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  mug: (
    <>
      <g stroke="#c7a877" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M94 42 q-9 -10 0 -22" />
        <path d="M112 42 q9 -10 0 -22" />
      </g>
      <g {...CUT}>
        <path
          d="M150 96 q42 0 42 38 q0 36 -42 32 l0 -18 q22 2 22 -14 q0 -18 -22 -18 Z"
          fill="#9a6f3f"
        />
        <path d="M56 86 h94 l-9 76 q-2 16 -18 16 H83 q-16 0 -18 -16 Z" fill="#b88a4e" />
      </g>
      <path d="M86 118 q7 9 14 0" fill="none" stroke="#241f17" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M106 118 q7 9 14 0" fill="none" stroke="#241f17" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M95 136 q15 11 30 0" fill="none" stroke="#241f17" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="80" cy="132" rx="7.5" ry="5" fill="#e0906e" opacity="0.5" />
      <ellipse cx="130" cy="132" rx="7.5" ry="5" fill="#e0906e" opacity="0.5" />
    </>
  ),
};
