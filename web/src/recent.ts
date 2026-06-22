// Local-only memory of the admin's own game rounds on THIS device/browser.
// Stores just code + title (no password, no token) so the organiser can jump
// back into the right /admin/:code. Access still requires the signed session.
const KEY = "fp_admin_games";
const MAX = 12;

export interface RecentGame {
  code: string;
  title: string;
  ts: number; // last opened (ms)
}

function read(): RecentGame[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: RecentGame[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function listRecent(): RecentGame[] {
  return read().sort((a, b) => b.ts - a.ts);
}

/** add or refresh an entry (called after create/login/open) */
export function rememberGame(code: string, title?: string) {
  const list = read();
  const i = list.findIndex((g) => g.code === code);
  const ts = Date.now();
  if (i >= 0) {
    list[i] = { code, title: title ?? list[i].title, ts };
  } else {
    list.push({ code, title: title || code, ts });
  }
  write(list);
}

export function forgetGame(code: string) {
  write(read().filter((g) => g.code !== code));
}
