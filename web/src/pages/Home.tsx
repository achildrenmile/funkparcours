import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner } from "../components";
import { listRecent, rememberGame, forgetGame, type RecentGame } from "../recent";
import { CrossIcon } from "../icons";

export function Home() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const prefill = params.get("code");
  const [mode, setMode] = useState<"create" | "login">(prefill ? "login" : "create");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState(prefill ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentGame[]>([]);

  useEffect(() => setRecent(listRecent()), []);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const r = await api.post<{ code: string }>("/api/games", { title, adminPassword: password });
        rememberGame(r.code, title);
        nav(`/admin/${r.code}`);
      } else {
        const c = code.trim().toUpperCase();
        const r = await api.post<{ title?: string }>(`/api/games/${c}/login`, { password });
        rememberGame(c, r.title);
        nav(`/admin/${c}`);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const drop = (c: string) => {
    forgetGame(c);
    setRecent(listRecent());
  };

  return (
    <>
      <Header title="Übungsleitung" help="home" />
      <Page>
        {prefill && mode === "login" && (
          <Banner kind="info">
            Sitzung abgelaufen für Spiel <b>{prefill}</b> – bitte Admin-Passwort eingeben.
          </Banner>
        )}

        {/* Intro / what is this */}
        <div className="max-w-2xl mx-auto space-y-4 text-center">
          <img
            src="/funkparcours-hero.png"
            alt="FunkParcours"
            className="w-full rounded-2xl border border-slate-200 shadow-card"
          />
          <h1 className="text-2xl font-bold">Funkübungen, die wirklich über Funk laufen</h1>
          <p className="text-slate-600 leading-relaxed">
            Die <b>Leitstation</b> sieht eine Aufgabe am Bildschirm und gibt sie <b>über echtes Funkgerät</b>{" "}
            durch. Der <b>Empfangstrupp</b> hört zu und baut die Aufgabe an seinem eigenen Schirm nach. Die
            Plattform überträgt nichts selbst – sie zeigt nur die Vorlage, prüft den Nachbau und wertet nach{" "}
            <b>Genauigkeit und Zeit</b>.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 text-left">
            <RoleCard title="Übungsleitung" desc="Legt das Spiel an, konfiguriert Gruppen & Aufgaben, startet und sieht das Live-Ranking. Das machst du hier." />
            <RoleCard title="Leitstation (Sender)" desc="Bekommt die Vorlage am Schirm und funkt sie durch. Zugang per Link/QR von der Übungsleitung." />
            <RoleCard title="Empfangstrupp (Empfänger)" desc="Baut die gefunkte Aufgabe am Schirm nach und gibt ab. Zugang per Link/QR von der Übungsleitung." />
          </div>
          <Banner kind="info">
            Du bist <b>Station</b> und hast einen Link oder QR-Code bekommen? Einfach öffnen – kein Login nötig.
            Diese Seite ist nur für die <b>Übungsleitung</b>.
          </Banner>
        </div>

        <div className="card w-full max-w-md mx-auto space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">
            Übungsleitung
          </p>
          <div className="flex gap-2">
            <button
              className={mode === "create" ? "btn-primary flex-1" : "btn-ghost flex-1"}
              onClick={() => setMode("create")}
            >
              Neues Spiel
            </button>
            <button
              className={mode === "login" ? "btn-primary flex-1" : "btn-ghost flex-1"}
              onClick={() => setMode("login")}
            >
              Anmelden
            </button>
          </div>

          {mode === "create" ? (
            <div>
              <label className="label">Titel der Übung</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Übung Bezirk Nord" />
            </div>
          ) : (
            <div>
              <label className="label">Spiel-Code</label>
              <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" />
            </div>
          )}

          <div>
            <label className="label">Admin-Passwort</label>
            <input
              className="input"
              type="password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <p className="text-xs text-slate-500 mt-1">
              {mode === "create"
                ? "Frei wählbar – du legst es jetzt fest. Damit verwaltest du das Spiel später, also gut merken."
                : "Das Passwort, das beim Anlegen des Spiels gesetzt wurde."}
            </p>
          </div>

          {err && <Banner kind="warn">{err}</Banner>}
          <button className="btn-primary w-full" disabled={busy} onClick={submit}>
            {mode === "create" ? "Spiel anlegen" : "Anmelden"}
          </button>
        </div>

        {recent.length > 0 && (
          <div className="card w-full max-w-md mx-auto">
            <h2 className="font-semibold mb-1">Meine Spielrunden</h2>
            <p className="text-xs text-slate-500 mb-3">
              Auf diesem Gerät gemerkt. Antippen öffnet die Runde wieder (Passwort nur, falls die Sitzung
              abgelaufen ist).
            </p>
            <ul className="divide-y">
              {recent.map((g) => (
                <li key={g.code} className="flex items-center gap-2 py-2">
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => {
                      rememberGame(g.code, g.title);
                      nav(`/admin/${g.code}`);
                    }}
                  >
                    <div className="font-medium truncate">{g.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{g.code}</div>
                  </button>
                  <button
                    className="btn-ghost px-3 shrink-0"
                    aria-label="aus Liste entfernen"
                    onClick={() => drop(g.code)}
                  >
                    <CrossIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Page>
    </>
  );
}

function RoleCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-3">
      <div className="font-semibold text-sm">{title}</div>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
    </div>
  );
}
