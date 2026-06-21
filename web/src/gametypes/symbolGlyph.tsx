export const SHAPES = ["kreis", "dreieck", "quadrat", "stern"] as const;
export const COLORS = ["rot", "blau", "gruen", "gelb", "schwarz", "weiss"] as const;
export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];
export interface Sym {
  shape: Shape;
  color: Color;
}

export const COLOR_HEX: Record<Color, string> = {
  rot: "#dc2626",
  blau: "#2563eb",
  gruen: "#16a34a",
  gelb: "#eab308",
  schwarz: "#111827",
  weiss: "#f8fafc",
};

export const COLOR_LABEL: Record<Color, string> = {
  rot: "rot",
  blau: "blau",
  gruen: "grün",
  gelb: "gelb",
  schwarz: "schwarz",
  weiss: "weiß",
};

export const SHAPE_LABEL: Record<Shape, string> = {
  kreis: "Kreis",
  dreieck: "Dreieck",
  quadrat: "Quadrat",
  stern: "Stern",
};

export function SymbolGlyph({ shape, color, size = 28 }: { shape: Shape; color: Color; size?: number }) {
  const fill = COLOR_HEX[color];
  const stroke = color === "weiss" ? "#94a3b8" : "none";
  const sw = color === "weiss" ? 2 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label={`${color} ${shape}`}>
      {shape === "kreis" && <circle cx="16" cy="16" r="13" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === "quadrat" && <rect x="3" y="3" width="26" height="26" rx="3" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === "dreieck" && <polygon points="16,3 30,29 2,29" fill={fill} stroke={stroke} strokeWidth={sw} />}
      {shape === "stern" && (
        <polygon
          points="16,2 20,12 31,12 22,19 25,30 16,23 7,30 10,19 1,12 12,12"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      )}
    </svg>
  );
}

/** Stack rendered with a slight vertical offset, bottom-first. */
export function StackView({ stack, size = 26 }: { stack: Sym[]; size?: number }) {
  if (stack.length === 0) return null;
  return (
    <div className="relative" style={{ width: size, height: size + (stack.length - 1) * 8 }}>
      {stack.map((s, i) => (
        <div key={i} className="absolute left-0" style={{ top: i * 8, zIndex: i }}>
          <SymbolGlyph shape={s.shape} color={s.color} size={size} />
        </div>
      ))}
    </div>
  );
}
