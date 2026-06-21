import { useEffect, useRef } from "react";

type Handler = (msg: any) => void;

/**
 * Reconnecting WS. On every (re)connect the caller should pull a fresh REST
 * snapshot — the socket only carries live signals, the DB holds the truth.
 */
export function useGameSocket(query: string | null, onMessage: Handler) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!query) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (closed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws?${query}`);
      ws.onmessage = (e) => {
        try {
          handlerRef.current(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      };
      ws.onopen = () => handlerRef.current({ type: "_connected" });
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [query]);
}
