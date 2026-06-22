import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner } from "../components";

export function Home() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"create" | "login">("create");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const r = await api.post<{ code: string }>("/api/games", { title, adminPassword: password });
        nav(`/admin/${r.code}`);
      } else {
        await api.post(`/api/games/${code.toUpperCase()}/login`, { password });
        nav(`/admin/${code.toUpperCase()}`);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header title="Übungsleitung" />
      <Page>
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
      </Page>
    </>
  );
}
