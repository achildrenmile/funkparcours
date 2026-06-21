import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { Header, Page, Banner, Pct, fmt } from "../components";
import { useGameSocket } from "../ws";

export function AdminDashboard() {
  const { code } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/api/games/${code}/dashboard`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) nav("/");
      else setErr(String(e));
    }
  }, [code, nav]);

  useEffect(() => {
    load();
  }, [load]);
  useGameSocket(code ? `code=${code}` : null, () => load());

  if (!data) return <Page>{err ? <Banner kind="warn">{err}</Banner> : "Laden…"}</Page>;

  const status = data.game.status;
  const partIndex = data.parts.findIndex((p: any) => p.id === data.currentPartId);

  return (
    <>
      <Header title="Live-Dashboard" sub={`Code ${code} · ${status}`} />
      <Page>
        <div className="flex flex-wrap gap-2 items-center">
          {status === "running" && (
            <>
              <span className="text-sm text-slate-600">
                Spielteil {partIndex + 1}/{data.parts.length}
              </span>
              <button className="btn-primary" onClick={() => api.post(`/api/games/${code}/next`).then(load)}>
                Nächster Spielteil →
              </button>
              <button className="btn-ghost" onClick={() => api.post(`/api/games/${code}/finish`).then(load)}>
                Beenden
              </button>
            </>
          )}
          {status === "finished" && <Banner kind="ok">Spiel beendet.</Banner>}
          <a className="btn-ghost ml-auto" href={`/api/games/${code}/stats.csv`}>
            CSV export
          </a>
        </div>

        {/* Current part status */}
        {status === "running" && (
          <div className="card">
            <h3 className="font-semibold mb-2">Aktueller Spielteil</h3>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th>Gruppe</th>
                  <th>Status</th>
                  <th>Genauigkeit</th>
                  <th>Zeit</th>
                </tr>
              </thead>
              <tbody>
                {data.currentGroups.map((g: any) => (
                  <tr key={g.groupId} className="border-t">
                    <td className="py-1 font-medium">{g.name}</td>
                    <td><StatusPill s={g.status} /></td>
                    <td><Pct v={g.accuracy} /></td>
                    <td>{g.durationMs != null ? fmt(g.durationMs) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Overall leaderboard */}
        <div className="card">
          <h3 className="font-semibold mb-2">Gesamtwertung</h3>
          <ol className="space-y-1">
            {data.totals.map((t: any, i: number) => (
              <li key={t.groupId} className="flex items-center justify-between border-t py-1 first:border-t-0">
                <span>
                  <b className="w-6 inline-block">{i + 1}.</b> {t.name}
                </span>
                <span className="font-mono">{t.total.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Per-part breakdown */}
        <div className="card">
          <h3 className="font-semibold mb-2">Pro Spielteil</h3>
          <div className="space-y-3">
            {data.perPartScores.map((part: any, pi: number) => (
              <div key={part.partId}>
                <div className="text-sm text-slate-500 mb-1">
                  Spielteil {pi + 1} ({data.parts[pi]?.type})
                </div>
                <div className="flex flex-wrap gap-2">
                  {part.entries
                    .slice()
                    .sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99))
                    .map((e: any) => (
                      <span key={e.groupId} className="text-sm bg-slate-100 rounded px-2 py-1">
                        {e.rank ? `#${e.rank} ` : ""}
                        {e.name}: <Pct v={e.accuracy} /> · {e.score.toFixed(2)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Page>
    </>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    wartet: "bg-slate-200 text-slate-700",
    sendet: "bg-amber-100 text-amber-800",
    abgegeben: "bg-green-100 text-green-800",
  };
  return <span className={`text-xs rounded px-2 py-0.5 ${map[s] ?? ""}`}>{s}</span>;
}
