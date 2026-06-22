import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";
import { CheckIcon, CrossIcon } from "../icons";

const CATALOG: Record<string, { label: string; kind: string }> = {
  von: { label: "Von", kind: "callsign" },
  an: { label: "An", kind: "callsign" },
  datum_zeit: { label: "Datum/Zeit", kind: "datetime" },
  ort: { label: "Ort", kind: "place" },
  lage: { label: "Lage", kind: "phrase" },
  anzahl_personen: { label: "Anzahl Personen", kind: "number" },
  prioritaet: { label: "Priorität", kind: "priority" },
  meldetext: { label: "Meldetext", kind: "sentence" },
};
const PRIORITIES = ["Sofort", "Dringend", "Normal"];
const ALL_KEYS = Object.keys(CATALOG);

export function MeldungLeit({ payload }: LeitViewProps) {
  const fields: { key: string; label: string }[] = payload.fields ?? [];
  return (
    <dl className="divide-y">
      {fields.map((f) => (
        <div key={f.key} className="py-2 grid grid-cols-3 gap-2">
          <dt className="text-slate-500 text-sm">{f.label}</dt>
          <dd className="col-span-2 font-medium">{payload.values[f.key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MeldungTrupp({ config, onSubmit, submitting, lastResult }: TruppViewProps) {
  const keys: string[] = config.fields ?? ALL_KEYS;
  const [values, setValues] = useState<Record<string, string>>({});
  const locked = lastResult != null;
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const detail = lastResult?.detail?.perField;

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        {keys.map((k) => {
          const def = CATALOG[k] ?? { label: k, kind: "text" };
          const fieldOk = detail?.[k]?.ok;
          return (
            <div key={k}>
              <label className="label flex justify-between">
                <span>{def.label}</span>
                {locked &&
                  (fieldOk ? (
                    <CheckIcon size={18} className="text-emerald-600" />
                  ) : (
                    <CrossIcon size={18} className="text-brand" />
                  ))}
              </label>
              {def.kind === "priority" ? (
                <select className="input" disabled={locked} value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
                  <option value="">–</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : def.kind === "sentence" ? (
                <textarea className="input" rows={2} disabled={locked} value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
              ) : (
                <input
                  className="input"
                  type={def.kind === "number" ? "number" : "text"}
                  disabled={locked}
                  value={values[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting} onClick={() => onSubmit({ values })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function MeldungConfigForm({ config, onChange }: ConfigFormProps) {
  const fields: string[] = config.fields ?? ALL_KEYS;
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  const toggle = (k: string) => set({ fields: fields.includes(k) ? fields.filter((x) => x !== k) : [...fields, k] });
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Felder</label>
        <div className="flex flex-wrap gap-2">
          {ALL_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`px-2 py-1 rounded border text-sm ${
                fields.includes(k) ? "bg-funk-600 text-white border-funk-600" : "bg-white border-slate-300"
              }`}
            >
              {CATALOG[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.fuzzy ?? true} onChange={(e) => set({ fuzzy: e.target.checked })} />
          Tippfehler-Toleranz
        </label>
        <input
          type="number" step={0.05} min={0} max={1} className="input w-24"
          disabled={!(config.fuzzy ?? true)}
          value={config.fuzzyThreshold ?? 0.85}
          onChange={(e) => set({ fuzzyThreshold: Number(e.target.value) })}
        />
        <span className="text-xs text-slate-500">Schwelle</span>
      </div>
    </div>
  );
}
