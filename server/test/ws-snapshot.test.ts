import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { buildApp } from "../src/app.js";
import { resetDb, roundOf, seedGame, startGroup } from "./helpers.js";

beforeEach(resetDb);

// WS carries live signals only; the reconnect snapshot is pulled over REST. This
// verifies the socket itself never pushes the template to a Trupp on connect.
describe("WS — Trupp socket receives no payload on connect", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | null = null;

  afterAll(async () => {
    if (app) await app.close();
  });

  it("first WS message is `hello` with no template", async () => {
    app = await buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const { port } = app.server.address() as AddressInfo;

    const s = await seedGame({ type: "symbolkarte" });
    const g = s.groups[0];
    await startGroup(s.partId, g.id); // even mid-transmission, the socket stays mute on payload
    const truth = await roundOf(s.partId, g.id);
    const truthCellsJson = JSON.stringify((truth.payload as { cells: unknown }).cells);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${g.truppToken}`);
    const messages: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400); // collect everything pushed in the first 400ms
      ws.on("message", (d) => messages.push(d.toString()));
      ws.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    ws.close();

    expect(messages.length).toBeGreaterThan(0);
    const first = JSON.parse(messages[0]);
    expect(first.type).toBe("hello");
    expect(first.role).toBe("trupp");
    // nothing pushed over the socket may carry the answer — key proxy AND raw content
    for (const m of messages) {
      expect(m).not.toContain('"payload"');
      expect(m).not.toContain('"cells"');
      expect(m).not.toContain(truthCellsJson); // backstop: answer leaked under any key
    }
  });
});
