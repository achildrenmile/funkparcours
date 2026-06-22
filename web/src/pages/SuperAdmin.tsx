import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Header, Page, Banner, fmt } from "../components";
import { CrossIcon } from "../icons";

export function SuperAdmin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [disabled, setDisabled] = useState(false);

  const check = useCallback(async () => {
    try {
      await api.get("/api/super/me");
      setAuthed(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setDisabled(true);
      setAuthed(false);
    }
  }, []);
  useEffect(() => {
    check();
  }, [check]);

  if (authed === null) return <Page>Laden…</Page>;
  return (
    <>
      <Header title="Superadmin" sub="Alle Spiele" />
      <Page>
        {disabled ? (
          <Banner kind="warn">
            Superadmin ist nicht konfiguriert. <code>SUPERADMIN_PASSWORD</code> in der Server-<code>.env</code>{" "}
            setzen und neu deployen.
          </Banner>
        ) : authed ? (
          <Overview onLogout={() => setAuthed(false)} />
        ) : (
          <Login onLogin={() => setAuthed(true)} />
        )}
      </Page>
    </>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.post("/api/super/login", { username, password });
      onLogin();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card w-full max-w-sm mx-auto space-y-3">
      <h2 className="font-semibold">Superadmin-Login</h2>
      <div>
        <label className="label">Benutzername</label>
        <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label className="label">Passwort</label>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      {err && <Banner kind="warn">{err}</Banner>}
      <button className="btn-primary w-full" disabled={busy} onClick={submit}>
        Anmelden
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card py-3 px-4 text-center">
      <div className="text-2xl font-extrabold text-brand">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Overview({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get("/api/super/overview"));
    } catch (e) {
      setErr(String(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    await api.post("/api/super/logout").catch(() => {});
    onLogout();
  };

  const del = async (id: string, title: string) => {
    if (!confirm(`Spiel „${title}" und alle zugehörigen Daten löschen?`)) return;
    try {
      await api.delete(`/api/super/games/${id}`);
    } catch (e) {
      setErr(String(e));
    }
    load();
  };

  if (err) return <Banner kind="warn">{err}</Banner>;
  if (!data) return <>Laden…</>;
  const s = data.stats;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-ghost" onClick={logout}>
          Abmelden
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Stat label="Spiele" value={s.games} />
        <Stat label="Gruppen" value={s.groups} />
        <Stat label="Spielteile" value={s.parts} />
        <Stat label="Runden" value={s.rounds} />
        <Stat label="Abgaben" value={s.submissions} />
        <Stat label="Events" value={s.events} />
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">Alle Spiele</h3>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-left text-slate-500">
            <tr className="border-b">
              <th className="py-2 pr-2">Code</th>
              <th className="pr-2">Titel</th>
              <th className="pr-2">Status</th>
              <th className="pr-2">Wertung</th>
              <th className="pr-2 text-right">Gr.</th>
              <th className="pr-2 text-right">Teile</th>
              <th className="pr-2 text-right">Abg.</th>
              <th className="pr-2">Angelegt</th>
              <th className="pr-2">Läuft ab</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.games.map((g: any) => (
              <RowGroup key={g.id} g={g} open={open === g.id} toggle={() => setOpen(open === g.id ? null : g.id)} del={del} />
            ))}
          </tbody>
        </table>
        {data.games.length === 0 && <p className="text-slate-500 py-3">Keine Spiele.</p>}
      </div>
    </div>
  );
}

function RowGroup({ g, open, toggle, del }: { g: any; open: boolean; toggle: () => void; del: (id: string, t: string) => void }) {
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    if (open && !detail) api.get(`/api/super/games/${g.id}`).then(setDetail).catch(() => {});
  }, [open, detail, g.id]);
  const date = (d: string | null) => (d ? new Date(d).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" }) : "–");

  return (
    <>
      <tr className="border-b hover:bg-slate-50 cursor-pointer" onClick={toggle}>
        <td className="py-2 pr-2 font-mono font-semibold">{g.code}</td>
        <td className="pr-2">{g.title}</td>
        <td className="pr-2">{g.status}</td>
        <td className="pr-2">{g.scoringMode}</td>
        <td className="pr-2 text-right">{g.groups}</td>
        <td className="pr-2 text-right">{g.parts}</td>
        <td className="pr-2 text-right">{g.submissions}</td>
        <td className="pr-2 whitespace-nowrap">{date(g.createdAt)}</td>
        <td className="pr-2 whitespace-nowrap">{date(g.expiresAt)}</td>
        <td className="text-right">
          <button
            className="btn-ghost px-2 min-h-[2rem]"
            aria-label="löschen"
            onClick={(e) => {
              e.stopPropagation();
              del(g.id, g.title);
            }}
          >
            <CrossIcon size={16} />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={10} className="p-3">
            {!detail ? (
              "Laden…"
            ) : (
              <div className="space-y-3 text-xs">
                <Detail title="Gruppen" rows={detail.groups.map((x: any) => `${x.name}  ·  leit=${x.leitToken}  ·  trupp=${x.truppToken}`)} />
                <Detail title="Spielteile" rows={detail.parts.map((x: any) => `#${x.orderIndex} ${x.type} (${x.verification}, max ${x.maxAttempts})`)} />
                <Detail
                  title="Runden"
                  rows={detail.rounds.map((x: any) => `${x.groupName}: ${x.status}${x.startedAt ? " · Start " + new Date(x.startedAt).toLocaleTimeString("de-AT") : ""}`)}
                />
                <Detail
                  title="Abgaben"
                  rows={detail.submissions.map(
                    (x: any) => `Versuch ${x.attemptNo}: acc=${x.accuracy ?? "–"} score=${x.score ?? "–"} ${x.durationMs != null ? "(" + fmt(x.durationMs) + ")" : ""}`,
                  )}
                />
                <Detail title="Events" rows={detail.events.map((x: any) => `${new Date(x.createdAt).toLocaleTimeString("de-AT")} ${x.type}`)} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <div className="font-semibold text-slate-600 mb-1">
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="text-slate-400">–</div>
      ) : (
        <ul className="space-y-0.5 font-mono break-all">
          {rows.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
