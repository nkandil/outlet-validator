import { expect, test } from "@playwright/test";

async function mockAuth(page, role: "admin" | "coordinator" | "reviewer" = "admin") {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: `${role}-id`, name: "Test User", email: `${role}@example.com`, role })
    });
  });
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([])
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("outlet-validator-auth-token", "test-token");
  });
}

async function mockAdminData(page) {
  await mockAuth(page, "admin");
  await page.route("**/api/users", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "admin-id", name: "Nour Kandil", email: "nour@example.com", role: "admin" },
        { id: "reviewer-id", name: "Field Reviewer With Long Name", email: "reviewer@example.com", role: "reviewer" }
      ])
    });
  });
  await page.route("**/api/groups", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "group-id", name: "HORECA - OOH", description: "New Cairo field coverage" }])
    });
  });
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "session-id",
          name: "New Cairo Outlet Validation Session",
          fileName: "new-cairo-outlets.xlsx",
          radiusKm: 5,
          outletCount: 128,
          reviewedCount: 17,
          createdAt: "2026-05-18T00:00:00.000Z",
          updatedAt: "2026-05-18T00:00:00.000Z"
        }
      ])
    });
  });
  await page.route("**/api/sessions/session-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "session-id",
        name: "New Cairo Outlet Validation Session",
        fileName: "new-cairo-outlets.xlsx",
        radiusKm: 5,
        outletCount: 128,
        reviewedCount: 17,
        createdAt: "2026-05-18T00:00:00.000Z",
        updatedAt: "2026-05-18T00:00:00.000Z",
        config: {
          confirmedMapping: {
            id: "outlet_id",
            lat: "latitude",
            lng: "longitude",
            displayField: "outlet_name",
            colorByField: "Segment",
            colorByValues: { Grocery: "#e30613", HORECA: "#2563eb" },
            shapeByField: "Segment",
            shapeByValues: { Grocery: "circle", HORECA: "diamond" }
          },
          visibleFields: ["outlet_name", "Segment"],
          fieldsToVerify: ["outlet_name"],
          reviewerName: "",
          rawHeaders: ["outlet_id", "outlet_name", "latitude", "longitude", "Segment", "Address", "Channel", "Status"]
        },
        outlets: [
          {
            outletKey: "A__row_0",
            rowIndex: 0,
            id: "A",
            latitude: 30,
            longitude: 31,
            originalData: {
              outlet_id: "A",
              outlet_name: "Alpha Market",
              latitude: 30,
              longitude: 31,
              Segment: "Grocery",
              Address: "New Cairo",
              Channel: "Retail",
              Status: "Open"
            },
            distanceKm: null
          }
        ],
        validations: {}
      })
    });
  });
  await page.route("**/api/sessions/session-id/assignments", async (route) => {
    const method = route.request().method();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(method === "PUT" ? { userIds: [], groupIds: ["group-id"] } : { userIds: [], groupIds: [] })
    });
  });
  await page.route("**/api/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalSessions: 1,
        activeSessions: 1,
        totalOutlets: 489,
        reviewedOutlets: 3,
        pendingOutlets: 486,
        validCount: 2,
        invalidCount: 1,
        needsUpdateCount: 0,
        duplicateCount: 0,
        gpsMissingCount: 1
      })
    });
  });
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(dimensions.documentWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function expectNoElementOverflow(page) {
  const offenders = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: (element.textContent ?? "").trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.right > viewportWidth + 1 || item.left < -1);
  });
  expect(offenders, JSON.stringify(offenders.slice(0, 5))).toEqual([]);
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
    validations: {
      "O-0__row_0": { status: "Valid", reviewedBy: "Tester", reviewedAt: new Date().toISOString(), notes: "", fieldUpdates: {} }
    },
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

test("admin page remains fully visible at lower desktop width", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1146, height: 982 });

  await mockAdminData(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.getByRole("button", { name: "Groups" }).click();
  await expect(page.getByText("HORECA - OOH")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.getByRole("button", { name: "Sessions" }).click();
  await page.getByRole("button", { name: /New Cairo Outlet Validation/ }).click();
  await page.getByLabel("HORECA - OOH").check();
  await page.getByRole("button", { name: "Save assignments" }).click();
  await expect(page.getByText("Assignments saved")).toBeVisible();
  await expect(page.getByLabel("Session configuration fields")).toBeVisible();
  const fieldsBox = await page.getByLabel("Session configuration fields").boundingBox();
  expect(fieldsBox ? fieldsBox.height > 300 : false).toBeTruthy();
  const configActions = page.getByLabel("Session configuration actions");
  await expect(configActions).toBeVisible();
  const actionsBox = await configActions.boundingBox();
  const viewport = page.viewportSize();
  expect(actionsBox && viewport ? actionsBox.y + actionsBox.height <= viewport.height : false).toBeTruthy();
  await expectNoPageOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("admin users list does not require horizontal scrolling on phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 982 });

  await mockAdminData(page);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Field Reviewer With Long Name")).toBeVisible();
  await expectNoPageOverflow(page);
  await expectNoElementOverflow(page);
});

test("admin users actions include password reset without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1146, height: 982 });

  await mockAdminData(page);
  await page.goto("/admin");

  await expect(page.getByRole("button", { name: /Change password for Field Reviewer With Long Name/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete Field Reviewer With Long Name/i })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("dashboard renders reviewed count and status percentages", async ({ page }) => {
  await page.setViewportSize({ width: 1146, height: 982 });

  await mockAdminData(page);
  await page.goto("/dashboard");

  await expect(page.getByText("1%", { exact: true })).toBeVisible();
  await expect(page.getByText("3 of 489 reviewed")).toBeVisible();
  await expect(page.getByLabel("Valid: 2, 0% of outlets")).toBeVisible();
  await expectNoPageOverflow(page);
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
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Valid" })).not.toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Field settings" })).toBeVisible();
  await expect(page.getByLabel("Nearby radius")).toBeVisible();
  await expect(page.getByLabel("Show nearest")).toBeVisible();
  await expect(page.getByLabel("Review status").getByRole("button", { name: "Unreviewed" })).toBeVisible();
  await expect(page.getByPlaceholder("Latitude")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "map" }).click();

  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByText("Showing the nearest 50 of 79 matching outlets.")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(51);
  expect(pageErrors).toEqual([]);
});

test("map marker popup shows visible fields and Google Maps action", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await mockAuth(page);
  await page.goto("/");
  await page.evaluate((state) => {
    localStorage.setItem("outlet-validator-session", JSON.stringify({ state: { ...state, userLocation: null }, version: 0 }));
  }, localSessionState());
  await page.reload();

  await page.getByText(/Local unsynced session/i).click();
  await page.getByRole("button", { name: "map" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.locator('.leaflet-marker-icon[title="Outlet 30"]').evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  await expect(page.locator(".leaflet-popup").getByText("name: Outlet 30")).toBeVisible();
  await expect(page.locator(".leaflet-popup").getByRole("link", { name: "Google Maps" })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=30.003%2C31");
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
