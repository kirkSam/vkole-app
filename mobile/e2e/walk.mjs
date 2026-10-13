import { chromium } from "playwright";

const base = process.env.MOBILE_URL ?? "http://127.0.0.1:8090";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const opened = [];
await page.addInitScript(() => {
  window.open = (url) => {
    window.__opened = window.__opened ?? [];
    window.__opened.push(String(url));
    return null;
  };
});
page.on("pageerror", (error) => opened.push(`pageerror:${error.message}`));

async function assertNoClockCopy() {
  const text = await page.locator("body").innerText();
  if (/2\.5|two and a half|two-and-a-half|midnight Pacific|five quiet minutes|practice timer/i.test(text)) {
    throw new Error(`clock wording remains: ${text}`);
  }
}

await page.goto(base);
await page.getByRole("heading", { name: "Do the Impossible" }).waitFor();
await assertNoClockCopy();
await page.getByTestId("nav-practice").click();
const start = page.getByTestId("start-sheet");
await page.waitForFunction(() => {
  const button = document.querySelector('[data-testid="start-sheet"]');
  return button instanceof HTMLButtonElement && !button.disabled;
});
await page.getByTestId("grade").selectOption("8");
await start.click();
const stem = page.getByTestId("stem");
await stem.waitFor();
for (let i = 0; i < 6; i += 1) {
  const before = await page.getByTestId("stem").innerText();
  await page.getByTestId("choice").first().click();
  if (i < 5) {
    try {
      await page.waitForFunction((previous) => {
        const node = document.querySelector('[data-testid="stem"]');
        return node instanceof HTMLElement && node.innerText !== previous;
      }, before, { timeout: 3000 });
    } catch (error) {
      console.error("stuck", i, JSON.stringify(before), JSON.stringify(await page.getByTestId("stem").innerText()), opened);
      throw error;
    }
  }
}
await page.getByTestId("sheet-note").waitFor();
const note = await page.getByTestId("sheet-note").innerText();
if (!note.includes("Saved on this device only")) throw new Error(note);

await page.getByTestId("nav-home").click();
await page.getByTestId("open-privacy").click();
await page.getByRole("heading", { name: "Privacy" }).waitFor();
await assertNoClockCopy();
await page.getByTestId("nav-home").click();
await page.getByTestId("open-terms").click();
await page.getByRole("heading", { name: "Terms" }).waitFor();
await assertNoClockCopy();
await page.getByTestId("nav-home").click();
await page.getByTestId("open-purchases").click();
const body = await page.locator("body").innerText();
if (body.includes("$")) throw new Error("a price was shown");
const buy = page.getByTestId("buy-vkole_engine_monthly");
if (await buy.isEnabled()) throw new Error("purchase was enabled without a store key");

await page.getByTestId("nav-school").click();
await page.getByTestId("school-offices").click();
await page.getByTestId("gate-math").fill("1");
await page.getByTestId("gate-word").fill("parent");
await page.getByTestId("gate-submit").click();
await page.getByText("Ask a parent").waitFor();
await page.getByTestId("gate-math").fill("60");
await page.getByTestId("gate-word").fill("parent");
await page.getByTestId("gate-submit").click();
await page.waitForFunction(() => (window.__opened ?? []).length > 0);
const urls = await page.evaluate(() => window.__opened);
if (!urls.some((url) => url.startsWith("https://www.dotheimpossible.ai/home"))) {
  throw new Error(`opened ${urls.join(",")}`);
}

await page.goto(base);
await page.getByTestId("open-account").click();
await page.getByTestId("delete-device").click();
await page.getByTestId("gate-math").fill("60");
await page.getByTestId("gate-word").fill("parent");
await page.getByTestId("gate-submit").click();
await page.getByTestId("erased").waitFor();
await assertNoClockCopy();

await page.getByTestId("nav-practice").click();
await page.waitForFunction(() => {
  const grade = document.querySelector('[data-testid="grade"]');
  return grade instanceof HTMLSelectElement && grade.value === "3";
});

console.log("mobile walk passed");
await browser.close();
