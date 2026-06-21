import type { WebSocket } from "ws";

export type ClientRole = "admin" | "leit" | "trupp";

interface Client {
  socket: WebSocket;
  gameId: string;
  role: ClientRole;
  groupId?: string;
}

export interface WsMessage {
  type: string;
  [k: string]: unknown;
}

/**
 * In-memory pub/sub for live signals only. The DB stays the source of truth;
 * on (re)connect the client pulls a fresh snapshot, so a dropped socket never
 * loses state. Survives nothing on restart — by design, nothing here needs to.
 */
class RoomHub {
  private clients = new Set<Client>();

  add(c: Client): void {
    this.clients.add(c);
  }

  remove(socket: WebSocket): void {
    for (const c of this.clients) {
      if (c.socket === socket) this.clients.delete(c);
    }
  }

  private send(c: Client, msg: WsMessage): void {
    if (c.socket.readyState === 1 /* OPEN */) {
      c.socket.send(JSON.stringify(msg));
    }
  }

  /** everyone in a game (admins + all stations) */
  toGame(gameId: string, msg: WsMessage): void {
    for (const c of this.clients) if (c.gameId === gameId) this.send(c, msg);
  }

  /** both stations of one group (+ admins of that game) */
  toGroup(gameId: string, groupId: string, msg: WsMessage): void {
    for (const c of this.clients) {
      if (c.gameId !== gameId) continue;
      if (c.role === "admin" || c.groupId === groupId) this.send(c, msg);
    }
  }

  toAdmins(gameId: string, msg: WsMessage): void {
    for (const c of this.clients) {
      if (c.gameId === gameId && c.role === "admin") this.send(c, msg);
    }
  }
}

export const hub = new RoomHub();
