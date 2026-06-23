import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner } from "../components";
import { getFeGameType, listFeGameTypes } from "../gametypes/registry";
import { CrossIcon } from "../icons";
import { rememberGame } from "../recent";

interface PartDraft {
  type: string;
  config: any;
  verification: "auto" | "manual_photo";
  maxAttempts: number;
}
type Scoring =
  | { mode: "time" }
  | { mode: "accuracy_gate"; min_accuracy: number }
  | { mode: "weighted"; w_acc: number; w_speed: number; t_min: number; t_max: number }
  | { mode: "points_rank"; min_accuracy: number };

const SCORING_DEFAULTS: Record<string, Scoring> = {
  time: { mode: "time" },
  accuracy_gate: { mode: "accuracy_gate", min_accuracy: 0.9 },
  weighted: { mode: "weighted", w_acc: 0.7, w_speed: 0.3, t_min: 10000, t_max: 120000 },
  points_rank: { mode: "points_rank", min_accuracy: 0 },
};

export function AdminConfig() {
  const { code } = useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<string>("draft");
  const [title, setTitle] = useState("");
  const [groups, setGroups] = useState<string[]>(["Gruppe 1", "Gruppe 2"]);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [scoring, setScoring] = useState<Scoring>(SCORING_DEFAULTS.weighted);
  const [antiCheat, setAntiCheat] = useState<"unique_per_group" | "same_for_all">("unique_per_group");
  const [links, setLinks] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const g = await api.get<any>(`/api/games/${code}`);
      rememberGame(code!, g.game.title);
      setStatus(g.game.status);
      setTitle(g.game.title);
      setScoring(g.game.scoringConfig);
      setAntiCheat(g.game.antiCheatMode);
      if (g.groups.length) setGroups(g.groups.map((x: any) => x.name));
      if (g.parts.length)
        setParts(
          g.parts.map((p: any) => ({
            type: p.type,
            config: p.config,
            verification: p.verification,
            maxAttempts: p.maxAttempts,
          })),
        );
      setLinks(g.links);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) nav(`/?code=${code}`);
      else setErr(String(e));
    }
  };
  useEffect(() => {
    load();
  }, [code]);

  const logout = async () => {
    try {
      await api.post(`/api/games/${code}/logout`);
    } catch {
      /* ignore */
    }
    nav("/");
  };

  const addPart = (type: string) => {
    const ft = getFeGameType(type)!;
    setParts((p) => [...p, { type, config: { ...ft.defaultConfig }, verification: "auto", maxAttempts: 1 }]);
  };

  const save = async () => {
    setErr(null);
    setMsg(null);
    try {
      await api.put(`/api/games/${code}/config`, {
        title,
        scoringConfig: scoring,
        antiCheatMode: antiCheat,
        groups: groups.map((name) => ({ name })),
        parts,
      });
      setMsg("Gespeichert.");
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  };

  const start = async () => {
    try {
      await api.post(`/api/games/${code}/start`);
      nav(`/admin/${code}/dashboard`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  };

  const isDraft = status === "draft";

  return (
    <>
      <Header title="Konfiguration" sub={`Code ${code}`} help="admin-config" />
      <Page>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Spiel-Code <b className="font-mono text-ink">{code}</b>
          </span>
          <button className="btn-ghost text-sm px-3 min-h-[2.25rem]" onClick={logout}>
            Abmelden
          </button>
        </div>
        {!isDraft && (
          <Banner kind="info">
            Spiel läuft bereits.{" "}
            <button className="underline" onClick={() => nav(`/admin/${code}/dashboard`)}>
              Zum Live-Dashboard →
            </button>
          </Banner>
        )}
        {err && <Banner kind="warn">{err}</Banner>}
        {msg && <Banner kind="ok">{msg}</Banner>}

        <div className="card space-y-3">
          <div>
            <label className="label">Titel</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isDraft} />
          </div>
          <div>
            <label className="label">Funkgruppen</label>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input"
                    value={g}
                    disabled={!isDraft}
                    onChange={(e) => setGroups((gs) => gs.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {isDraft && groups.length > 1 && (
                    <button
                      className="btn-ghost px-3 shrink-0"
                      aria-label="Gruppe entfernen"
                      onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}
                    >
                      <CrossIcon size={18} />
                    </button>
                  )}
                </div>
              ))}
              {isDraft && (
                <button className="btn-ghost" onClick={() => setGroups((gs) => [...gs, `Gruppe ${gs.length + 1}`])}>
                  + Gruppe
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scoring + anti-cheat */}
        <div className="card space-y-3">
          <div>
            <label className="label">Wertungsmodus</label>
            <select
              className="input"
              value={scoring.mode}
              disabled={!isDraft}
              onChange={(e) => setScoring(SCORING_DEFAULTS[e.target.value])}
            >
              <option value="time">Zeit (schnellster gewinnt)</option>
              <option value="accuracy_gate">Genauigkeits-Gate, dann Zeit</option>
              <option value="weighted">Gewichtet (Genauigkeit + Tempo)</option>
              <option value="points_rank">Rangpunkte je Runde</option>
            </select>
          </div>
          <ScoringParams scoring={scoring} setScoring={setScoring} disabled={!isDraft} />
          <div>
            <label className="label">Anti-Cheat</label>
            <select
              className="input"
              value={antiCheat}
              disabled={!isDraft}
              onChange={(e) => setAntiCheat(e.target.value as any)}
            >
              <option value="unique_per_group">Eigene Vorlage je Gruppe (empfohlen)</option>
              <option value="same_for_all">Gleiche Vorlage für alle</option>
            </select>
          </div>
        </div>

        {/* Parts */}
        <div className="space-y-3">
          {parts.map((part, i) => {
            const ft = getFeGameType(part.type);
            return (
              <div key={i} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Spielteil {i + 1}: {ft?.label ?? part.type}
                  </h3>
                  {isDraft && (
                    <button className="btn-ghost" onClick={() => setParts((p) => p.filter((_, j) => j !== i))}>
                      Entfernen
                    </button>
                  )}
                </div>
                {ft && (
                  <fieldset disabled={!isDraft}>
                    <ft.ConfigForm
                      config={part.config}
                      onChange={(c) => setParts((p) => p.map((x, j) => (j === i ? { ...x, config: c } : x)))}
                    />
                  </fieldset>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">max. Versuche</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="input w-20"
                    disabled={!isDraft}
                    value={part.maxAttempts}
                    onChange={(e) =>
                      setParts((p) => p.map((x, j) => (j === i ? { ...x, maxAttempts: Number(e.target.value) } : x)))
                    }
                  />
                </div>
              </div>
            );
          })}
          {isDraft && (
            <div className="flex flex-wrap gap-2">
              {listFeGameTypes().map((ft) => (
                <button key={ft.id} className="btn-ghost" onClick={() => addPart(ft.id)}>
                  + {ft.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isDraft && (
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={save}>
              Speichern
            </button>
            <button className="btn-ghost" disabled={parts.length === 0} onClick={start} title="erst speichern">
              Spiel starten →
            </button>
          </div>
        )}

        {/* Stations & links live on a dedicated, shareable/printable page */}
        {links.length > 0 && (
          <div className="card flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Stationen & Links</h3>
              <p className="text-sm text-slate-500">
                {links.length} Gruppe{links.length > 1 ? "n" : ""} · QR-Codes, getrennte Ansichten für
                Sender/Empfänger, druckbar.
              </p>
            </div>
            <button className="btn-primary shrink-0" onClick={() => nav(`/admin/${code}/links`)}>
              Öffnen →
            </button>
          </div>
        )}
      </Page>
    </>
  );
}

function ScoringParams({
  scoring,
  setScoring,
  disabled,
}: {
  scoring: Scoring;
  setScoring: (s: Scoring) => void;
  disabled: boolean;
}) {
  const num = (label: string, key: string, value: number, step = 1) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step={step}
        className="input"
        disabled={disabled}
        value={value}
        onChange={(e) => setScoring({ ...(scoring as any), [key]: Number(e.target.value) })}
      />
    </div>
  );
  if (scoring.mode === "time") return null;
  if (scoring.mode === "accuracy_gate") return <div className="grid grid-cols-2 gap-3">{num("Min. Genauigkeit (0–1)", "min_accuracy", scoring.min_accuracy, 0.05)}</div>;
  if (scoring.mode === "points_rank") return <div className="grid grid-cols-2 gap-3">{num("Min. Genauigkeit (0–1)", "min_accuracy", scoring.min_accuracy, 0.05)}</div>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {num("Gewicht Genauigkeit", "w_acc", scoring.w_acc, 0.1)}
      {num("Gewicht Tempo", "w_speed", scoring.w_speed, 0.1)}
      {num("t_min (ms)", "t_min", scoring.t_min, 1000)}
      {num("t_max (ms)", "t_max", scoring.t_max, 1000)}
    </div>
  );
}
