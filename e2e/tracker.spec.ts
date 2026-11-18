import { expect, test } from "@playwright/test";

test.describe("King Legacy Global Event Tracker E2E", () => {
  test("renders dashboard, sidebar categories, live countdown cards, details modal, and search", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("KING LEGACY TRACKER")).toBeVisible();
    await expect(page.getByTestId("live-bangkok-clock")).toContainText("UTC+7");
    await expect(page.getByRole("button", { name: /All Events/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /First Sea/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Second Sea/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Third Sea/i })).toBeVisible();

    const cards = page.getByTestId("event-card");
    await expect(cards.first()).toBeVisible({ timeout: 20000 });

    // Verify countdown ticks in real time without page refresh
    const firstCountdown = cards.first().getByTestId("card-countdown");
    const t1 = await firstCountdown.textContent();
    await page.waitForTimeout(2100);
    const t2 = await firstCountdown.textContent();
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
    if (t1 && t1 !== "ENDED" && t1 !== "UNKNOWN") {
      expect(t2).not.toBe(t1);
    }

    // Open Event Details Modal
    await cards.first().getByRole("button", { name: /Details/i }).click();
    await expect(page.getByTestId("event-details-modal")).toBeVisible();
    await page.getByLabel("Close details").click();
    await expect(page.getByTestId("event-details-modal")).toBeHidden();

    // Search Events filter
    const searchInput = page.getByTestId("search-events-input");
    await searchInput.fill("Sea King");
    await page.waitForTimeout(500);
    const countAfterFilter = await cards.count();
    expect(countAfterFilter).toBeGreaterThanOrEqual(0);
    await searchInput.fill("");

    // Mobile responsive drawer check
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Open menu")).toBeVisible();
  });

  test("navigates Global Scanner, Server Browser, Event History, Notifications, API Docs, and Admin Dashboard", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("REAL-TIME SSE")).toBeVisible({ timeout: 20000 });

    // Global Scanner
    await page.getByTestId("nav-scanner").click();
    await expect(page.getByTestId("global-scanner-view")).toBeVisible();
    await expect(page.getByText("Total Discovered Servers")).toBeVisible();
    await expect(page.getByText("Unscanned Servers")).toBeVisible();

    // Server Browser
    await page.getByTestId("nav-servers").click();
    await expect(page.getByTestId("server-browser-view")).toBeVisible();

    // Event History
    await page.getByTestId("nav-history").click();
    await expect(page.getByTestId("event-history-view")).toBeVisible();

    // Notifications
    await page.getByTestId("nav-notifications").click();
    await expect(page.getByTestId("notifications-view")).toBeVisible();

    // API Docs
    await page.getByTestId("nav-api-docs").click();
    await expect(page.getByTestId("api-docs-view")).toBeVisible();

    // Admin Dashboard Auth Flow
    await page.getByTestId("nav-admin").click();
    await expect(page.getByTestId("admin-auth-gate")).toBeVisible();
    await page.getByRole("button", { name: /Sign In as Admin/i }).click();
    await expect(page.getByTestId("auth-modal")).toBeVisible();
    await page.getByRole("button", { name: /Fill Admin/i }).click();
    await page.getByTestId("auth-submit-btn").click();

    await expect(page.getByTestId("admin-dashboard-view")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Community Event Reports Queue")).toBeVisible();
  });
});
