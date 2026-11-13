/**
 * Lightweight inline-SVG scene illustrations (no image downloads, theme-aware via CSS variables).
 * Decorative: each has role="img" with a text alternative describing the scene.
 */

const ALT: Record<string, string> = {
  moto: "A moto rider waiting for a passenger on a city street, with distance markers along the road.",
  robot: "Kora, a small delivery robot, standing beside a package on a grid of streets.",
  momo: "A phone showing a mobile money payment screen with approve and reject options.",
  rider: "A delivery rider on a moto carrying parcels between houses along a route.",
  computer: "A laptop showing lines of code, with arrows for input, processing and output.",
  bulb: "A light bulb above a meter.",
};

export function Scene({ name, className }: { name?: string; className?: string }) {
  if (!name || name === "none" || !ALT[name]) return null;
  return (
    <svg viewBox="0 0 480 200" className={className ?? "h-auto w-full"} role="img" aria-label={ALT[name]}>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--gold-soft)" />
          <stop offset="1" stopColor="var(--paper-2)" />
        </linearGradient>
      </defs>
      <rect width="480" height="200" rx="20" fill="url(#sky)" />
      {/* rolling hills — a nod to the land of a thousand hills */}
      <path d="M0 150 Q80 110 160 140 T320 130 T480 140 V200 H0Z" fill="var(--teal-soft)" />
      <path d="M0 170 Q120 140 240 165 T480 160 V200 H0Z" fill="color-mix(in oklab, var(--teal) 25%, var(--teal-soft))" />
      {name === "moto" && <Moto />}
      {name === "rider" && <Rider />}
      {name === "robot" && <Robot />}
      {name === "momo" && <Momo />}
      {name === "computer" && <Computer />}
    </svg>
  );
}

function Road() {
  return (
    <g>
      <rect x="0" y="168" width="480" height="22" fill="var(--ink-2)" opacity="0.85" />
      {[20, 100, 180, 260, 340, 420].map((x) => (
        <rect key={x} x={x} y="177" width="40" height="4" rx="2" fill="var(--gold-soft)" />
      ))}
    </g>
  );
}

function MotoShape({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="40" r="16" fill="none" stroke="var(--ink)" strokeWidth="6" />
      <circle cx="78" cy="40" r="16" fill="none" stroke="var(--ink)" strokeWidth="6" />
      <path d="M0 40 L28 14 H58 L78 40" stroke="var(--coral)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M58 14 L66 0 H78" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <rect x="20" y="2" width="34" height="12" rx="6" fill="var(--ink)" />
      {/* rider in a green vest with helmet */}
      <path d="M32 2 L44 -30" stroke="var(--ink)" strokeWidth="10" strokeLinecap="round" />
      <rect x="34" y="-34" width="22" height="26" rx="8" fill="var(--teal)" transform="rotate(20 45 -21)" />
      <circle cx="50" cy="-46" r="11" fill="var(--blue)" />
      <path d="M48 -26 L66 -6" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

function Moto() {
  return (
    <g>
      <Road />
      <MotoShape x={170} y={112} />
      <g fill="var(--ink)" fontFamily="var(--font-mono)" fontSize="12">
        {[0, 1, 2, 3, 4].map((km) => (
          <g key={km} transform={`translate(${40 + km * 100} 150)`}>
            <rect x="-2" y="0" width="4" height="16" fill="var(--ink-3)" />
            <text x="6" y="10">{km} km</text>
          </g>
        ))}
      </g>
      {/* passenger */}
      <g transform="translate(400 108)">
        <circle cx="0" cy="0" r="10" fill="var(--coral)" />
        <rect x="-9" y="12" width="18" height="34" rx="8" fill="var(--violet)" />
      </g>
    </g>
  );
}

function Rider() {
  return (
    <g>
      <Road />
      {[60, 300, 420].map((x, i) => (
        <g key={x} transform={`translate(${x} 96)`}>
          <rect width="46" height="54" rx="4" fill={["var(--coral-soft)", "var(--blue-soft)", "var(--gold-soft)"][i]} stroke="var(--ink)" strokeWidth="2" />
          <path d="M-6 2 L23 -22 L52 2Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2" />
          <rect x="17" y="30" width="12" height="24" fill="var(--ink-2)" />
        </g>
      ))}
      <MotoShape x={150} y={112} />
      <rect x="208" y="96" width="26" height="20" rx="3" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2" />
    </g>
  );
}

function Robot() {
  return (
    <g>
      <g stroke="var(--line-strong)" strokeWidth="1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={`v${i}`} x1={120 + i * 48} y1="40" x2={120 + i * 48} y2="184" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <line key={`h${i}`} x1="120" y1={40 + i * 48} x2="360" y2={40 + i * 48} />
        ))}
      </g>
      <g transform="translate(150 98)" className="animate-float">
        <rect x="-4" y="-22" width="44" height="40" rx="12" fill="var(--teal)" stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="10" cy="-3" r="5" fill="var(--paper)" />
        <circle cx="26" cy="-3" r="5" fill="var(--paper)" />
        <circle cx="11" cy="-2" r="2.3" fill="var(--ink)" />
        <circle cx="27" cy="-2" r="2.3" fill="var(--ink)" />
        <line x1="18" y1="-22" x2="18" y2="-34" stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="18" cy="-37" r="4" fill="var(--coral)" />
        <rect x="2" y="18" width="32" height="8" rx="4" fill="var(--ink)" />
      </g>
      <g transform="translate(262 108)">
        <rect width="30" height="26" rx="3" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2" />
        <path d="M0 9h30M15 0v26" stroke="var(--ink)" strokeWidth="2" />
      </g>
      <g transform="translate(318 56)">
        <path d="M-4 18 18 0 40 18Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2" />
        <rect x="2" y="18" width="32" height="26" fill="var(--blue-soft)" stroke="var(--ink)" strokeWidth="2" />
      </g>
    </g>
  );
}

function Momo() {
  return (
    <g>
      <g transform="translate(190 26)">
        <rect width="100" height="168" rx="16" fill="var(--ink)" />
        <rect x="8" y="16" width="84" height="136" rx="8" fill="var(--card)" />
        <rect x="18" y="30" width="64" height="10" rx="5" fill="var(--gold)" />
        <text x="50" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15" fill="var(--ink)">5,000</text>
        <text x="50" y="88" textAnchor="middle" fontSize="9" fill="var(--ink-3)">RWF</text>
        <rect x="18" y="104" width="30" height="22" rx="6" fill="var(--good)" />
        <rect x="52" y="104" width="30" height="22" rx="6" fill="var(--bad)" />
        <path d="M26 115l4 4 8-8" stroke="white" strokeWidth="2.5" fill="none" />
        <path d="M61 109l12 12m0-12-12 12" stroke="white" strokeWidth="2.5" />
      </g>
      <path d="M120 110 Q150 70 185 90" stroke="var(--teal)" strokeWidth="3" strokeDasharray="6 6" fill="none" />
      <path d="M295 90 Q330 70 360 110" stroke="var(--coral)" strokeWidth="3" strokeDasharray="6 6" fill="none" />
    </g>
  );
}

function Computer() {
  return (
    <g>
      <g transform="translate(160 36)">
        <rect width="160" height="104" rx="10" fill="var(--ink)" />
        <rect x="8" y="8" width="144" height="88" rx="5" fill="var(--editor-bg)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={18 + (i % 2) * 14} y={20 + i * 14} width={[70, 90, 50, 80, 40][i]} height="6" rx="3" fill={["var(--teal)", "var(--coral)", "var(--blue)", "var(--gold)", "var(--violet)"][i]} />
        ))}
        <path d="M-18 112 H178 L166 120 H-6Z" fill="var(--ink-2)" />
      </g>
      <text x="80" y="96" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--teal)">input</text>
      <path d="M100 100 H150" stroke="var(--teal)" strokeWidth="3" />
      <text x="400" y="96" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--coral)">output</text>
      <path d="M330 100 H380" stroke="var(--coral)" strokeWidth="3" />
      <path d="M144 94l8 6-8 6M374 94l8 6-8 6" stroke="var(--ink)" strokeWidth="2.5" fill="none" />
    </g>
  );
}
