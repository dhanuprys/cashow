import type { FC, SVGProps } from "react";
import { cn } from "@/lib/utils";

export interface AvatarPreset {
  id: string;
  name: string;
  category: "persona" | "finance" | "minimal";
  bg: string;
  render: FC<SVGProps<SVGSVGElement>>;
}

/**
 * 8 Rock-solid, ultra-clean flat-illustrated SVG avatars.
 * Modern colors, precise geometric paths, with accessible titles and aria attributes.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "alex",
    name: "Alex (Kreatif)",
    category: "persona",
    bg: "from-sky-400 to-indigo-500",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Alex (Kreatif)"
        {...props}
      >
        <title>Avatar Alex (Kreatif)</title>
        <circle cx="50" cy="50" r="50" fill="#3B82F6" />
        <path d="M22 96C22 75 34 68 50 68C66 68 78 75 78 96" fill="#1E293B" />
        <path d="M42 68L50 78L58 68H42Z" fill="#F8FAFC" />
        <rect x="44" y="52" width="12" height="14" rx="6" fill="#FED7AA" />
        <circle cx="50" cy="42" r="18" fill="#FDBA74" />
        <path
          d="M32 38C32 26 40 22 50 22C60 22 68 26 68 38C68 39 65 33 50 33C35 33 32 39 32 38Z"
          fill="#1E1B4B"
        />
        <rect
          x="36"
          y="38"
          width="11"
          height="8"
          rx="3"
          stroke="#0F172A"
          strokeWidth="2.5"
          fill="#E0F2FE"
          fillOpacity="0.6"
        />
        <rect
          x="53"
          y="38"
          width="11"
          height="8"
          rx="3"
          stroke="#0F172A"
          strokeWidth="2.5"
          fill="#E0F2FE"
          fillOpacity="0.6"
        />
        <line x1="47" y1="42" x2="53" y2="42" stroke="#0F172A" strokeWidth="2.5" />
        <path d="M46 51C48 53 52 53 54 51" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "maya",
    name: "Maya (Analis)",
    category: "persona",
    bg: "from-rose-400 to-pink-500",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Maya (Analis)"
        {...props}
      >
        <title>Avatar Maya (Analis)</title>
        <circle cx="50" cy="50" r="50" fill="#EC4899" />
        <circle cx="50" cy="45" r="24" fill="#312E81" />
        <path d="M24 96C24 74 35 66 50 66C65 66 76 74 76 96" fill="#4338CA" />
        <circle cx="50" cy="74" r="3" fill="#F43F5E" />
        <circle cx="50" cy="42" r="16" fill="#FED7AA" />
        <path
          d="M34 40C34 28 42 24 50 24C58 24 66 28 66 40C66 33 60 28 50 28C40 28 34 33 34 40Z"
          fill="#312E81"
        />
        <path
          d="M34 38Q44 42 50 35Q56 42 66 38"
          stroke="#312E81"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="44" cy="42" r="2" fill="#1E293B" />
        <circle cx="56" cy="42" r="2" fill="#1E293B" />
        <circle cx="41" cy="46" r="2.5" fill="#FDA4AF" />
        <circle cx="59" cy="46" r="2.5" fill="#FDA4AF" />
        <path
          d="M47 48C48.5 50 51.5 50 53 48"
          stroke="#9A3412"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "budi",
    name: "Budi (Perencana)",
    category: "persona",
    bg: "from-amber-400 to-orange-500",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Budi (Perencana)"
        {...props}
      >
        <title>Avatar Budi (Perencana)</title>
        <circle cx="50" cy="50" r="50" fill="#F59E0B" />
        <path d="M23 96C23 76 34 67 50 67C66 67 77 76 77 96" fill="#047857" />
        <path d="M46 67H54V77L50 82L46 77V67Z" fill="#F59E0B" />
        <rect x="45" y="52" width="10" height="12" rx="4" fill="#FDBA74" />
        <circle cx="50" cy="41" r="17" fill="#FDBA74" />
        <ellipse cx="50" cy="27" rx="16" ry="7" fill="#18181B" />
        <circle cx="36" cy="34" r="4" fill="#18181B" />
        <circle cx="64" cy="34" r="4" fill="#18181B" />
        <circle cx="44" cy="41" r="2" fill="#18181B" />
        <circle cx="56" cy="41" r="2" fill="#18181B" />
        <path d="M46 48C48 51 52 51 54 48" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "siti",
    name: "Siti (Wirausaha)",
    category: "persona",
    bg: "from-teal-400 to-emerald-600",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Siti (Wirausaha)"
        {...props}
      >
        <title>Avatar Siti (Wirausaha)</title>
        <circle cx="50" cy="50" r="50" fill="#0D9488" />
        <path d="M22 96C22 72 32 60 50 60C68 60 78 72 78 96" fill="#0F766E" />
        <path
          d="M30 45C30 30 38 23 50 23C62 23 70 30 70 45C70 60 62 66 50 66C38 66 30 60 30 45Z"
          fill="#14B8A6"
        />
        <ellipse cx="50" cy="45" rx="13" ry="15" fill="#FED7AA" />
        <path
          d="M38 37C42 34 58 34 62 37"
          stroke="#0F766E"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="45" cy="44" r="1.8" fill="#1E293B" />
        <circle cx="55" cy="44" r="1.8" fill="#1E293B" />
        <path
          d="M47 51C48.5 53 51.5 53 53 51"
          stroke="#9A3412"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "rupiah",
    name: "Brankas (Vault)",
    category: "finance",
    bg: "from-emerald-400 to-teal-600",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Brankas"
        {...props}
      >
        <title>Avatar Brankas</title>
        <circle cx="50" cy="50" r="50" fill="#10B981" />
        <rect x="25" y="25" width="50" height="50" rx="12" fill="#064E3B" />
        <rect x="29" y="29" width="42" height="42" rx="9" fill="#047857" />
        <circle cx="50" cy="50" r="13" fill="#D1FAE5" />
        <circle cx="50" cy="50" r="9" fill="#047857" />
        <circle cx="50" cy="50" r="4" fill="#D1FAE5" />
        <line
          x1="50"
          y1="38"
          x2="50"
          y2="43"
          stroke="#D1FAE5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="57"
          x2="50"
          y2="62"
          stroke="#D1FAE5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="38"
          y1="50"
          x2="43"
          y2="50"
          stroke="#D1FAE5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="57"
          y1="50"
          x2="62"
          y2="50"
          stroke="#D1FAE5"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="65" cy="35" r="2.5" fill="#34D399" />
      </svg>
    ),
  },
  {
    id: "growth",
    name: "Pertumbuhan (Growth)",
    category: "finance",
    bg: "from-violet-500 to-purple-600",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Pertumbuhan"
        {...props}
      >
        <title>Avatar Pertumbuhan</title>
        <circle cx="50" cy="50" r="50" fill="#8B5CF6" />
        <circle cx="50" cy="50" r="30" fill="#5B21B6" />
        <path
          d="M32 62L46 48L54 56L68 36"
          stroke="#FCD34D"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M58 36H68V46"
          stroke="#FCD34D"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="34" cy="36" r="3" fill="#FDE68A" />
        <circle cx="64" cy="64" r="2" fill="#FDE68A" />
      </svg>
    ),
  },
  {
    id: "zen",
    name: "Zen (Keseimbangan)",
    category: "minimal",
    bg: "from-blue-500 to-cyan-500",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Zen"
        {...props}
      >
        <title>Avatar Zen</title>
        <circle cx="50" cy="50" r="50" fill="#0284C7" />
        <circle cx="50" cy="50" r="34" stroke="#7DD3FC" strokeWidth="3" strokeDasharray="4 4" />
        <circle cx="50" cy="50" r="24" fill="#0369A1" />
        <circle cx="50" cy="50" r="14" fill="#BAE6FD" />
        <circle cx="50" cy="50" r="6" fill="#0284C7" />
      </svg>
    ),
  },
  {
    id: "spark",
    name: "Kilau (Kemakmuran)",
    category: "minimal",
    bg: "from-amber-400 to-yellow-500",
    render: (props) => (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Avatar Kilau"
        {...props}
      >
        <title>Avatar Kilau</title>
        <circle cx="50" cy="50" r="50" fill="#F59E0B" />
        <circle cx="50" cy="50" r="32" fill="#D97706" />
        <circle cx="50" cy="50" r="28" fill="#FBBF24" />
        <path
          d="M50 28C50 39 50 39 61 50C50 50 50 50 50 61C50 50 50 50 39 50C50 39 50 39 50 28Z"
          fill="#FFFBEB"
        />
        <circle cx="50" cy="50" r="3.5" fill="#D97706" />
      </svg>
    ),
  },
];

export function getAvatarPreset(id: string | null | undefined): AvatarPreset | undefined {
  if (!id) return undefined;
  return AVATAR_PRESETS.find((p) => p.id === id);
}

interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
};

export function UserAvatar({ avatar, name, className, size = "md" }: UserAvatarProps) {
  const preset = getAvatarPreset(avatar);

  if (preset) {
    const SvgComponent = preset.render;
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl shadow-xs transition-transform",
          SIZE_MAP[size],
          className,
        )}
      >
        <SvgComponent className="size-full object-cover" />
      </div>
    );
  }

  // Fallback initials with consistent deterministic color
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || "CS"
    : "CS";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl font-semibold shadow-xs",
        "bg-linear-to-tr from-primary to-primary/80 text-primary-foreground",
        SIZE_MAP[size],
        className,
      )}
    >
      {initials}
    </div>
  );
}
