import { SHAPES, COLORS, SHAPE_LABEL, COLOR_LABEL, type Shape, type Color } from "./symbolGlyph";
import type { ConfigFormProps } from "./registry";

export function SymbolkarteConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch });
  const shapes: Shape[] = config.shapes ?? [...SHAPES];
  const colors: Color[] = config.colors ?? ["rot", "blau", "gruen", "gelb"];

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Spalten</label>
        <input
          type="number"
          min={1}
          max={12}
          className="input"
          value={config.cols ?? 5}
          onChange={(e) => set({ cols: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="label">Zeilen</label>
        <input
          type="number"
          min={1}
          max={12}
          className="input"
          value={config.rows ?? 5}
          onChange={(e) => set({ rows: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="label">Anzahl Symbole</label>
        <input
          type="number"
          min={1}
          max={64}
          className="input"
          value={config.symbolCount ?? 6}
          onChange={(e) => set({ symbolCount: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="label">Stapeln</label>
        <div className="flex items-center gap-2 h-10">
          <input
            type="checkbox"
            checked={!!config.stacking}
            onChange={(e) => set({ stacking: e.target.checked })}
          />
          <input
            type="number"
            min={1}
            max={5}
            className="input w-20"
            disabled={!config.stacking}
            value={config.maxStack ?? 3}
            onChange={(e) => set({ maxStack: Number(e.target.value) })}
          />
          <span className="text-xs text-slate-500">max</span>
        </div>
      </div>
      <div className="col-span-2">
        <label className="label">Formen</label>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ shapes: toggle(shapes, s) })}
              className={`px-2 py-1 rounded border text-sm ${
                shapes.includes(s) ? "bg-funk-600 text-white border-funk-600" : "bg-white border-slate-300"
              }`}
            >
              {SHAPE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <label className="label">Farben</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ colors: toggle(colors, c) })}
              className={`px-2 py-1 rounded border text-sm ${
                colors.includes(c) ? "bg-funk-600 text-white border-funk-600" : "bg-white border-slate-300"
              }`}
            >
              {COLOR_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
