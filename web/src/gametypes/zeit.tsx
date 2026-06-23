import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

export function ZeitLeit({ payload }: LeitViewProps) {
  const items: string[] = payload.items ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Im Funkformat vorlesen (Datum: Tag/Monat, Uhrzeit: Stunde/Minute).</p>
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <span className="font-mono text-2xl tracking-widest">{w}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ZeitTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const count: number = config.count ?? 5;
  const [items, setItems] = useState<string[]>(Array(count).fill(""));
  const locked = lastResult != null;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Gehörte Zeit/Datum eintippen (z.B. 14:32 oder 15.06.):</p>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <input
              className="input font-mono tracking-widest"
              inputMode="numeric"
              disabled={locked}
              value={items[i] ?? ""}
              onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </div>
        ))}
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ items })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function ZeitConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Modus</label>
        <select className="input" value={config.mode ?? "mix"} onChange={(e) => set({ mode: e.target.value })}>
          <option value="uhrzeit">Uhrzeit</option>
          <option value="datum">Datum</option>
          <option value="datum_zeit">Datum + Uhrzeit</option>
          <option value="mix">Mix</option>
        </select>
      </div>
      <div>
        <label className="label">Anzahl</label>
        <input type="number" min={1} max={20} className="input" value={config.count ?? 5}
          onChange={(e) => set({ count: Number(e.target.value) })} />
      </div>
    </div>
  );
}
