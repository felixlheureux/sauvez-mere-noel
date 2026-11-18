import type { Speaker } from "@/i18n/fr-QC";

/** Tiny hand-drawn SVG portraits for the dialogue box. */
export function Portrait({ speaker, className = "" }: { speaker: Speaker; className?: string }) {
  const evil = speaker === "possede" || speaker === "fouettard" || speaker === "tiguy";
  const skin =
    speaker === "possede" || speaker === "tiguy"
      ? "#a9b79c"
      : speaker === "fouettard"
        ? "#8e9a85"
        : "#ffd0b0";
  const common = (
    <>
      <circle cx="50" cy="56" r="26" fill={skin} />
      <circle cx="41" cy="54" r={evil ? 4.5 : 4} fill={evil ? "#ff2238" : "#2a2230"} />
      <circle cx="59" cy="54" r={evil ? 4.5 : 4} fill={evil ? "#ff2238" : "#2a2230"} />
      {!evil && (
        <>
          <circle cx="42.5" cy="52.5" r="1.4" fill="#fff" />
          <circle cx="60.5" cy="52.5" r="1.4" fill="#fff" />
          <circle cx="34" cy="63" r="4" fill="#ff9fb2" opacity="0.8" />
          <circle cx="66" cy="63" r="4" fill="#ff9fb2" opacity="0.8" />
        </>
      )}
    </>
  );
  let extra: React.ReactNode = null;
  switch (speaker) {
    case "pere":
      extra = (
        <>
          <path d="M28 64 Q50 104 72 64 Q60 72 50 70 Q40 72 28 64Z" fill="#fff" />
          <path d="M38 64 Q50 58 62 64 Q50 68 38 64Z" fill="#fff" />
          <circle cx="50" cy="61" r="3.5" fill="#ff9fb2" />
          <path d="M24 44 Q48 6 76 30 L70 42 Z" fill="#e2384d" />
          <rect x="22" y="38" width="56" height="10" rx="5" fill="#fff" />
          <circle cx="78" cy="28" r="6" fill="#fff" />
        </>
      );
      break;
    case "mere":
      extra = (
        <>
          <path d="M24 52 Q24 26 50 26 Q76 26 76 52 Q70 36 50 36 Q30 36 24 52Z" fill="#c9ccd8" />
          <circle cx="50" cy="22" r="9" fill="#c9ccd8" />
          <circle cx="41" cy="54" r="7" fill="none" stroke="#ffc94a" strokeWidth="2" />
          <circle cx="59" cy="54" r="7" fill="none" stroke="#ffc94a" strokeWidth="2" />
          <path
            d="M44 70 Q50 74 56 70"
            stroke="#a3172b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "fouettard":
      extra = (
        <>
          <path d="M30 66 Q50 100 70 66 Q50 74 30 66Z" fill="#555066" />
          <path d="M28 40 L18 18 L36 34Z" fill="#3b3442" />
          <path d="M72 40 L82 18 L64 34Z" fill="#3b3442" />
          <path d="M26 42 Q50 0 74 42Z" fill="#1d1622" />
          <path d="M40 46 L46 50 M60 46 L54 50" stroke="#1d1622" strokeWidth="3" />
        </>
      );
      break;
    case "gerard":
      extra = (
        <>
          <path d="M30 66 Q50 92 70 66 Q50 72 30 66Z" fill="#eee" />
          <path d="M20 54 L28 46 L30 60Z" fill={skin} />
          <path d="M80 54 L72 46 L70 60Z" fill={skin} />
          <path d="M28 42 Q40 0 78 18 L70 40Z" fill="#3dbb7a" />
          <circle cx="78" cy="18" r="5" fill="#ffc94a" />
          <rect
            x="34"
            y="50"
            width="14"
            height="9"
            rx="4"
            fill="none"
            stroke="#2a2230"
            strokeWidth="2"
          />
          <rect
            x="52"
            y="50"
            width="14"
            height="9"
            rx="4"
            fill="none"
            stroke="#2a2230"
            strokeWidth="2"
          />
        </>
      );
      break;
    case "possede":
      extra = (
        <>
          <path d="M20 54 L28 46 L30 60Z" fill={skin} />
          <path d="M80 54 L72 46 L70 60Z" fill={skin} />
          <path d="M28 42 Q34 6 70 22 L72 40Z" fill="#a3172b" />
          <rect x="40" y="66" width="20" height="6" fill="#2a2230" />
          <path d="M43 66 v4 M48 66 v4 M53 66 v4 M57 66 v4" stroke="#fff" strokeWidth="2" />
          <path d="M35 46 L46 50 M65 46 L54 50" stroke="#2a2230" strokeWidth="3" />
        </>
      );
      break;
    case "tiguy":
      // Possessed elf in a hockey helmet with a cage visor.
      extra = (
        <>
          <path d="M20 54 L28 46 L30 60Z" fill={skin} />
          <path d="M80 54 L72 46 L70 60Z" fill={skin} />
          <path d="M24 46 Q50 8 76 46 L76 40 Q50 14 24 40Z" fill="#e2384d" />
          <path d="M24 46 Q50 18 76 46" fill="#e2384d" />
          <path
            d="M30 60 H70 M30 70 H70 M40 50 V78 M50 50 V80 M60 50 V78"
            stroke="#c9ccd6"
            strokeWidth="2"
          />
          <path d="M35 46 L46 50 M65 46 L54 50" stroke="#2a2230" strokeWidth="3" />
        </>
      );
      break;
    case "narrateur":
      return (
        <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="#2b1d3f" />
          <path
            d="M50 18 L58 40 L82 40 L62 54 L70 78 L50 64 L30 78 L38 54 L18 40 L42 40Z"
            fill="#ffc94a"
          />
        </svg>
      );
    default:
      extra = (
        <>
          <path d="M20 54 L28 46 L30 60Z" fill={skin} />
          <path d="M80 54 L72 46 L70 60Z" fill={skin} />
          <path d="M28 42 Q36 2 76 20 L72 40Z" fill={speaker === "mimi" ? "#e2384d" : "#3dbb7a"} />
          <rect x="26" y="38" width="48" height="8" rx="4" fill="#fff" />
          <circle cx="77" cy="20" r="5" fill="#ffc94a" />
          <path
            d="M44 68 Q50 73 56 68"
            stroke="#a3172b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
  }
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill={evil ? "#2b1d3f" : "#fff1f6"} />
      {common}
      {extra}
    </svg>
  );
}
