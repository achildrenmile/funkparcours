import { useState } from "react";
import type { LeitViewProps, TruppViewProps, ConfigFormProps } from "./registry";

export function StoerfunkLeit({ token }: LeitViewProps) {
  const [nonce, setNonce] = useState(0);
  const src = `/api/station/${token}/audio?n=${nonce}`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Verrauschten Funkspruch abspielen und <b>über Funk</b> übertragen (Handy ans Mikrofon). Beliebig oft
        wiederholbar – der Text wird nicht angezeigt.
      </p>
      <audio key={nonce} controls src={src} className="w-full" />
      <button className="btn-ghost" onClick={() => setNonce((n) => n + 1)}>
        Neu erzeugen / wiederholen
      </button>
    </div>
  );
}

export function StoerfunkTrupp({ onSubmit, submitting, lastResult }: TruppViewProps) {
  const [text, setText] = useState("");
  const locked = lastResult != null;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm text-slate-500">Gehörten Spruch trotz Störung möglichst wortgetreu mitschreiben:</p>
        <textarea
          className="input min-h-28"
          disabled={locked}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z.B. Florian 1 an Basis 1: Brand im Erdgeschoss, kommen."
        />
      </div>
      {!locked && (
        <button className="btn-primary w-full" disabled={submitting || !text.trim()} onClick={() => onSubmit({ text })}>
          {submitting ? "Sende…" : "Abgeben"}
        </button>
      )}
    </div>
  );
}

export function StoerfunkConfigForm({ config, onChange }: ConfigFormProps) {
  const set = (p: Record<string, unknown>) => onChange({ ...config, ...p });
  const noise = config.noise ?? 0.4;
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Nachrichtenlänge</label>
        <select className="input" value={config.length ?? "kurz"} onChange={(e) => set({ length: e.target.value })}>
          <option value="kurz">Kurz</option>
          <option value="normal">Normal</option>
          <option value="lang">Lang</option>
        </select>
      </div>
      <div>
        <label className="label">Störstärke: {Math.round(noise * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          className="w-full"
          value={noise}
          onChange={(e) => set({ noise: Number(e.target.value) })}
        />
      </div>
      <p className="text-xs text-slate-500">
        Die Plattform erzeugt verrauschtes Audio (Sprachausgabe + Störgeräusch). Die Leitstation spielt es über
        Funk; der Empfangstrupp schreibt mit. Wertung = Ähnlichkeit zum Original.
      </p>
    </div>
  );
}
