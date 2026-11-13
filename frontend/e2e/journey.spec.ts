import { expect, test, type Page } from "@playwright/test";

/** Sets Monaco's content through its public API (same onChange path as typing), then waits for React to re-render. */
async function setCode(page: Page, editorLabel: string, code: string) {
  await page.waitForFunction(() => (window as unknown as { monaco?: unknown }).monaco);
  await page.evaluate(([label, value]) => {
    const m = (window as unknown as { monaco: { editor: { getEditors: () => { getDomNode: () => HTMLElement; setValue: (v: string) => void }[] } } }).monaco;
    m.editor.getEditors().find((e) => e.getDomNode().closest(`[aria-label="${label}"]`))!.setValue(value);
  }, [editorLabel, code]);
  await page.waitForTimeout(200);
}

async function register(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("What should we call you?").fill("E2E Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("kigali-moto-route-77");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

async function onboard(page: Page) {
  await page.getByRole("button", { name: /Never/ }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Enter CodeVerse" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("beginner journey: register → onboard → lesson → Python → assessment → XP persists", async ({ page }) => {
  await register(page);
  await onboard(page);
  await expect(page.getByRole("heading", { name: "What Is Programming?" })).toBeVisible();
  await expect(page.getByText("0 / 100 XP")).toBeVisible();

  // World 0 lesson, completed through the real activity UIs.
  await page.getByRole("link", { name: "Continue learning" }).click();
  await expect(page.getByRole("heading", { name: "What Is Programming?" })).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  // Sequence: reorder until correct, using only the accessible buttons.
  const target = ["Open the mobile money menu", "Choose “Send money”", "Enter the receiver's phone number", "Enter the amount", "Enter your PIN to confirm", "Show the confirmation message"];
  for (let pos = 0; pos < target.length; pos++) {
    const items = page.locator("ol li span.flex-1");
    let current = await items.allTextContents();
    while (current.indexOf(target[pos]) > pos) {
      await page.getByRole("button", { name: `Move “${target[pos]}” up` }).click();
      current = await items.allTextContents();
    }
  }
  await page.getByRole("button", { name: "Check my order" }).click();
  await expect(page.getByText("That's the right order.")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByText("Follow the steps exactly").click();
  await page.getByRole("button", { name: "Lock in my prediction" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByLabel(/Name one app/).fill("Mobile money: I type an amount, it checks my balance, then shows a receipt.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await page.getByRole("button", { name: "Complete lesson" }).click();
  await expect(page.getByText("Lesson complete!")).toBeVisible();

  // Python lesson: run real Python in the browser, see an error, fix it, submit to the server grader.
  await page.goto("/learn/hello-python");
  await page.getByRole("button", { name: /A Two-Line Greeting/ }).click();
  const label = "Code for A Two-Line Greeting";
  await setCode(page, label, 'print("Hello, CodeVerse!")\nprint(I am learning Python.)');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "SyntaxError" })).toBeVisible({ timeout: 90_000 });

  await setCode(page, label, 'print("Hello, CodeVerse!")\nprint("I am learning Python.")');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator('pre[aria-live="polite"]')).toContainText("I am learning Python.");

  await page.getByRole("button", { name: "Submit for assessment" }).click();
  await expect(page.getByText("Challenge passed!")).toBeVisible();
  await expect(page.getByText("Achievement unlocked: First Programmer")).toBeVisible();

  // Progress persists across a reload and shows on the dashboard.
  await page.reload();
  await page.goto("/dashboard");
  await expect(page.getByText(/^\d+ \/ \d+ XP$/)).not.toHaveText("0 / 100 XP");
  await expect(page.getByText("First Programmer", { exact: true })).toBeVisible();
  await expect(page.getByText("Achievement: First Programmer")).toBeVisible(); // XP ledger entry
});

test("locked lessons explain what to finish first", async ({ page }) => {
  await register(page);
  await onboard(page);
  await page.goto("/learn/rider-day-summary");
  await expect(page.getByText(/Complete first:/)).toBeVisible();
});

test("mobile layout has no horizontal scroll @mobile", async ({ page }) => {
  await register(page);
  await onboard(page);
  for (const path of ["/dashboard", "/map", "/learn/what-is-programming", "/lab"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
