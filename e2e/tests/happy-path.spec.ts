import { test, expect, type Page } from "@playwright/test";

/**
 * Symbolkarte happy path through the real UI:
 *   create game → save config → start → Leit reveals → Trupp submits → leaderboard shows a score.
 *
 * Plus the e2e mirror of the server-invariant suite (#2): the Trupp browser never
 * receives the template (payload / answer cells) over the network. The Trupp can't
 * even build a correct grid — that's the point — so we submit an empty grid and only
 * assert that *a* score lands and that nothing leaked.
 */

const PASSWORD = "e2e-pass-123";

/** Pull the `/s/<token>` path for a role off the (role-filtered) links page. */
async function stationPath(page: Page, code: string, role: "leit" | "trupp"): Promise<string> {
  await page.goto(`/admin/${code}/links?role=${role}`);
  const href = await page.locator('a[href*="/s/"]').first().getAttribute("href");
  expect(href, `${role} link should be present`).toBeTruthy();
  const path = new URL(href!, "http://x").pathname; // strip host; keep /s/<token>
  expect(path).toContain("/s/");
  return path;
}

test("symbolkarte: create → play → leaderboard, with no template leak to the Trupp", async ({
  page,
}) => {
  // 1. Create a game (lands on /admin/:code with two default groups).
  await page.goto("/");
  await page.locator('input[placeholder="z.B. Übung Bezirk Nord"]').fill("E2E Übung");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Spiel anlegen" }).click();

  await page.waitForURL(/\/admin\/[^/]+$/);
  const code = page.url().split("/admin/")[1].replace(/\/.*$/, "");
  expect(code).toBeTruthy();

  // 2. Add a symbolkarte part, save, start.
  await page.getByRole("button", { name: "+ Symbolkarte" }).click();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Spiel starten →" }).click();
  await page.waitForURL(new RegExp(`/admin/${code}/dashboard`));

  // 3. Grab the Leit + Trupp station links for the first group.
  const leitPath = await stationPath(page, code, "leit");
  const truppPath = await stationPath(page, code, "trupp");
  const leitToken = leitPath.split("/s/")[1];
  const truppToken = truppPath.split("/s/")[1];

  // Capture every JSON response addressed to the Trupp token (for the leak check).
  const truppResponses: { url: string; body: string }[] = [];
  page.on("response", async (res) => {
    if (!res.url().includes(truppToken)) return;
    if (!(res.headers()["content-type"] ?? "").includes("application/json")) return;
    try {
      truppResponses.push({ url: res.url(), body: await res.text() });
    } catch {
      /* body already consumed / non-text */
    }
  });

  // 4. Leit reveals the template (starts the server-side timer). Sync on the network,
  //    not on rendered text — the reveal is done when /start returns 200.
  await page.goto(leitPath);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`${leitToken}/start`) && r.ok()),
    page.getByRole("button", { name: "Übertragung starten" }).click(),
  ]);

  // 5. Trupp opens (initial GET is captured), then submits an empty grid.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(truppToken) && r.request().method() === "GET"),
    page.goto(truppPath),
  ]);
  const submit = page.getByRole("button", { name: "Abgeben" });
  await expect(submit).toBeEnabled();
  const [submitRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`${truppToken}/submit`)),
    submit.click(),
  ]);
  expect(submitRes.ok(), "submit should succeed").toBeTruthy();

  // INVARIANT (e2e mirror of #2): nothing the Trupp received carried the template.
  expect(truppResponses.length, "captured Trupp traffic").toBeGreaterThan(0);
  for (const r of truppResponses) {
    expect(r.body, `leak in ${r.url}`).not.toContain('"payload"');
    expect(r.body, `leak in ${r.url}`).not.toContain('"cells"');
    expect(JSON.parse(r.body)?.part?.payload, "Trupp must never receive part.payload").toBeUndefined();
  }

  // 6. Leaderboard shows a score — an empty-but-timely submission still scores > 0.
  await page.goto(`/admin/${code}/dashboard`);
  await expect(page.getByText("Gesamtwertung")).toBeVisible();
  const scores = page.locator(".card", { hasText: "Gesamtwertung" }).locator("span.font-mono");
  await expect(scores.first()).toBeVisible();
  const values = (await scores.allTextContents()).map((v) => Number(v.trim()));
  expect(values.some((v) => v > 0), `a group should have a score > 0 (got ${values.join(", ")})`).toBe(true);
});
