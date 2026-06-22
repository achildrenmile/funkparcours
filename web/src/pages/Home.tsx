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
      <Header title="Übungsleitung" />
      <Page>
        {prefill && mode === "login" && (
          <Banner kind="info">
            Sitzung abgelaufen für Spiel <b>{prefill}</b> – bitte Admin-Passwort eingeben.
          </Banner>
        )}

        <div className="card w-full max-w-md mx-auto space-y-3">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {err && <Banner kind="warn">{err}</Banner>}
          <button className="btn-primary w-full" disabled={busy} onClick={submit}>
            {mode === "create" ? "Spiel anlegen" : "Anmelden"}
          </button>
          <p className="text-xs text-slate-500">
            Das Funkgerät ist der Kanal. Die Plattform gibt nur die Aufgabe vor, prüft den Nachbau und wertet.
          </p>
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
