import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

const DIGIT_WORDS: Record<string, string> = {
  "0": "Null", "1": "Eins", "2": "Zwo", "3": "Drei", "4": "Vier",
  "5": "Fünf", "6": "Sechs", "7": "Sieben", "8": "Acht", "9": "Neun",
  ",": "Komma",
};

const spell = (s: string) => s.split("").map((ch) => DIGIT_WORDS[ch] ?? ch).join(" · ");

export function ZahlenLeit({ payload }: LeitViewProps) {
  const items: string[] = payload.items ?? [];
  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <span className="font-mono text-2xl tracking-widest">{w}</span>
            <span className="text-xs text-slate-500">{spell(w)}</span>
          </li>
        ))}
      </ol>
      {payload.showSpelling && (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer">Sprechtafel Ziffern</summary>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mt-2">
            {Object.entries(DIGIT_WORDS).map(([k, v]) => (
              <span key={k}>
                <b>{k}</b> {v}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ZahlenTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const count: number = config.count ?? 5;
  const [items, setItems] = useState<string[]>(Array(count).fill(""));
  const locked = lastResult != null;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Gehörte Zahlen/Frequenzen eintippen (Komma mit eingeben):</p>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
            <input
              className="input font-mono tracking-widest"
              inputMode="decimal"
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

export function ZahlenConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Modus</label>
        <select className="input" value={config.mode ?? "mix"} onChange={(e) => set({ mode: e.target.value })}>
          <option value="ziffern">Ziffernblöcke</option>
          <option value="frequenz">Frequenzen</option>
          <option value="kanal">Kanäle</option>
          <option value="mix">Mix</option>
        </select>
      </div>
      <div>
        <label className="label">Anzahl</label>
        <input type="number" min={1} max={20} className="input" value={config.count ?? 5}
          onChange={(e) => set({ count: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label">Ziffern je Block</label>
        <input type="number" min={2} max={8} className="input" value={config.groupSize ?? 4}
          onChange={(e) => set({ groupSize: Number(e.target.value) })} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.showSpelling ?? true}
          onChange={(e) => set({ showSpelling: e.target.checked })} />
        Sprechtafel auf Sendebild zeigen
      </label>
    </div>
  );
}
