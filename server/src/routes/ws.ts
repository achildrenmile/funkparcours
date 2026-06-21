import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { hub } from "../rooms.js";
import { resolveStation } from "./station.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { AdminClaims } from "../auth.js";

const { games } = schema;

/**
 * WS carries live signals only (start/timer/submit/leaderboard). Clients pull a
 * fresh REST snapshot on connect, so nothing is lost on reconnect or restart.
 */
export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket: WebSocket, req) => {
    const url = new URL(req.url ?? "/ws", "http://x");
    const token = url.searchParams.get("token");
    const code = url.searchParams.get("code");

    try {
      if (token) {
        const st = await resolveStation(token);
        if (!st) return socket.close(1008, "invalid token");
        hub.add({ socket, gameId: st.group.gameId, role: st.role, groupId: st.group.id });
        socket.send(JSON.stringify({ type: "hello", role: st.role, groupId: st.group.id }));
      } else if (code) {
        // admin: verify jwt cookie matches the game code
        const cookieToken = req.cookies?.["fp_admin"];
        if (!cookieToken) return socket.close(1008, "no session");
        const claims = app.jwt.verify<AdminClaims>(cookieToken);
        if (claims.code !== code) return socket.close(1008, "wrong game");
        const [game] = await db.select().from(games).where(eq(games.code, code));
        if (!game) return socket.close(1008, "no game");
        hub.add({ socket, gameId: game.id, role: "admin" });
        socket.send(JSON.stringify({ type: "hello", role: "admin" }));
      } else {
        return socket.close(1008, "missing token");
      }
    } catch {
      return socket.close(1011, "auth error");
    }

    socket.on("close", () => hub.remove(socket));
    socket.on("error", () => hub.remove(socket));
  });
}
