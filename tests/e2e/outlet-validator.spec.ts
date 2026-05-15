import { expect, test } from "@playwright/test";

async function mockAuth(page, role: "admin" | "coordinator" | "reviewer" = "admin") {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: `${role}-id`, name: "Test User", email: `${role}@example.com`, role })
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("outlet-validator-auth-token", "test-token");
  });
}

function localSessionState(outletCount = 80) {
  return {
    fileName: "seed.xlsx",
    sessionId: null,
    sessionName: "",
    radiusKm: 5,
    confirmedMapping: {
      id: "id",
      lat: "lat",
      lng: "lng",
      displayField: "name",
      colorByField: "",
      colorByValues: {},
      shapeByField: "",
      shapeByValues: {}
    },
    visibleFields: ["name"],
    fieldsToVerify: [],
    reviewerName: "Tester",
    outlets: Array.from({ length: outletCount }, (_, index) => ({
      outletKey: `O-${index}__row_${index}`,
      rowIndex: index,
      id: `O-${index}`,
      latitude: 30 + index / 10000,
      longitude: 31,
      originalData: {
        id: `O-${index}`,
        lat: 30 + index / 10000,
        lng: 31,
        name: `Outlet ${index}`
      },
      distanceKm: index / 100
    })),
    userLocation: { latitude: 30, longitude: 31 },
    validations: {},
    pendingSync: true,
    sheetNames: [],
    selectedSheet: "",
    rawHeaders: ["id", "lat", "lng", "name"],
    rawRows: []
  };
}

test("session picker renders without a backend", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Outlet Validator" })).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Start New Session" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("local session opens map and caps outlet markers to nearest 50", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");
  await page.evaluate((state) => {
    localStorage.setItem("outlet-validator-session", JSON.stringify({ state, version: 0 }));
  }, localSessionState());
  await page.reload();

  await page.getByText(/Local unsynced session/i).click();
  await page.getByRole("button", { name: "map" }).click();

  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByText("Showing the nearest 50 of 80 matching outlets on the map.")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(51);
  expect(pageErrors).toEqual([]);
});

test("map marker popup shows visible fields and Google Maps action", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");
  await page.evaluate((state) => {
    localStorage.setItem("outlet-validator-session", JSON.stringify({ state, version: 0 }));
  }, localSessionState());
  await page.reload();

  await page.getByText(/Local unsynced session/i).click();
  await page.getByRole("button", { name: "map" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.locator(".leaflet-marker-icon").nth(1).click();

  await expect(page.locator(".leaflet-popup").getByText("name: Outlet 0")).toBeVisible();
  await expect(page.locator(".leaflet-popup").getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=30%2C31");
  expect(pageErrors).toEqual([]);
});

test("csv upload wizard reaches visible field mode without backend", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");
  await page.locator("header").getByRole("button", { name: "Start New Session" }).click();
  await page.locator('input[type="file"]').setInputFiles("tests/e2e/fixtures/outlets.csv");
  await expect(page.getByText("3 loaded rows")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Outlet ID")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("3 valid coordinate rows")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Visible outlet fields" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Fields to verify" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Reviewer" })).toBeVisible();
  await page.getByRole("button", { name: "Start Validation" }).click();
  await expect(page.getByText("Alpha Market")).toBeVisible();
  await page.getByRole("button", { name: "map" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("csv upload preserves Arabic outlet names in the browser", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");
  await page.locator("header").getByRole("button", { name: "Start New Session" }).click();
  await page.locator('input[type="file"]').setInputFiles("tests/e2e/fixtures/arabic-outlets.csv");
  await expect(page.getByText("1 loaded rows")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Reviewer" })).toBeVisible();
  await page.getByRole("button", { name: "Start Validation" }).click();

  await expect(page.getByText("كوكا كولا")).toBeVisible();
  await expect(page.getByText("????")).not.toBeVisible();
  expect(pageErrors).toEqual([]);
});
