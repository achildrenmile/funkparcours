import { randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Station token: 128 bits of entropy, base62, not guessable. */
export function stationToken(): string {
  // 22 base62 chars ~ 131 bits.
  const bytes = randomBytes(16);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (out.length < 22) {
    out = BASE62[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out;
}

const codeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/** Short, human-shareable, unambiguous game code (no O/0/I/1). */
export function gameCode(): string {
  return codeAlphabet();
}
