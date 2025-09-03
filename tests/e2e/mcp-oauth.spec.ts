import { test, expect } from "@playwright/test";

// Test configuration from environment
const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5173";
const TEST_HF_USERNAME = process.env.TEST_HF_USERNAME || "";
const TEST_HF_PASSWORD = process.env.TEST_HF_PASSWORD || "";
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || "30000");

test.describe("MCP OAuth Flow - Hugging Face", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(TEST_BASE_URL);

    // Wait for app to load
    await page.waitForLoadState("networkidle");
  });

  test("should load app and navigate to settings", async ({ page }) => {
    // Check if the main chat view is visible
    await expect(
      page.locator('[data-testid="chat-view"], .chat-container, main'),
    ).toBeVisible({ timeout: TEST_TIMEOUT });

    // Look for settings button/link
    const settingsButton = page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first();
    await expect(settingsButton).toBeVisible({ timeout: TEST_TIMEOUT });

    // Click settings
    await settingsButton.click();

    // Verify we're in settings page
    await expect(
      page.locator("text=/settings|Settings|Tools & MCP|LLM Provider/i"),
    ).toBeVisible();
  });

  test("should navigate to MCP settings tab", async ({ page }) => {
    // Navigate to settings first
    await page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();

    // Look for Tools & MCP tab
    const mcpTab = page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first();
    await expect(mcpTab).toBeVisible({ timeout: TEST_TIMEOUT });

    // Click MCP tab
    await mcpTab.click();

    // Verify MCP settings content is visible
    await expect(
      page.locator("text=/MCP Server|Quick Setup|External Tools/i"),
    ).toBeVisible();
  });

  test("should show quick setup options for Hugging Face MCP", async ({
    page,
  }) => {
    // Navigate to MCP settings
    await page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first()
      .click();

    // Look for Hugging Face quick setup option
    const hfOption = page.locator("text=/Hugging Face|hf\.co|HF MCP/i").first();
    await expect(hfOption).toBeVisible({ timeout: TEST_TIMEOUT });
  });

  test("should initiate Hugging Face MCP OAuth flow", async ({ page }) => {
    // Skip if no test credentials
    test.skip(
      !TEST_HF_USERNAME || !TEST_HF_PASSWORD,
      "Test credentials not provided",
    );

    // Navigate to MCP settings
    await page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first()
      .click();

    // Click Hugging Face setup/connect button
    const connectButton = page
      .locator("button")
      .filter({
        hasText: /Connect|Setup|Add.*Hugging Face|Hugging Face.*Connect/i,
      })
      .first();
    await expect(connectButton).toBeVisible({ timeout: TEST_TIMEOUT });
    await connectButton.click();

    // Should either open OAuth popup or redirect
    // Wait for either OAuth page or popup
    try {
      // Check if we get redirected to Hugging Face OAuth
      await page.waitForURL(/huggingface\.co.*oauth/i, { timeout: 10000 });

      // Fill in OAuth credentials
      const usernameField = page
        .locator(
          'input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]',
        )
        .first();
      const passwordField = page
        .locator(
          'input[name="password"], input[type="password"], input[placeholder*="password"]',
        )
        .first();

      if (await usernameField.isVisible()) {
        await usernameField.fill(TEST_HF_USERNAME);
        await passwordField.fill(TEST_HF_PASSWORD);

        // Submit form
        const submitButton = page
          .locator('button[type="submit"], input[type="submit"], button')
          .filter({ hasText: /sign in|login|authorize/i })
          .first();
        await submitButton.click();
      }

      // Wait for redirect back to app
      await page.waitForURL(
        new RegExp(TEST_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        { timeout: TEST_TIMEOUT },
      );
    } catch (error) {
      // OAuth might open in popup - handle popup case
      const popup = await page
        .waitForEvent("popup", { timeout: 10000 })
        .catch(() => null);
      if (popup) {
        await popup.waitForLoadState("networkidle");

        // Fill credentials in popup
        const popupUsernameField = popup
          .locator(
            'input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]',
          )
          .first();
        const popupPasswordField = popup
          .locator(
            'input[name="password"], input[type="password"], input[placeholder*="password"]',
          )
          .first();

        if (await popupUsernameField.isVisible()) {
          await popupUsernameField.fill(TEST_HF_USERNAME);
          await popupPasswordField.fill(TEST_HF_PASSWORD);

          const popupSubmitButton = popup
            .locator('button[type="submit"], input[type="submit"], button')
            .filter({ hasText: /sign in|login|authorize/i })
            .first();
          await popupSubmitButton.click();
        }

        // Wait for popup to close (successful OAuth)
        await popup.waitForEvent("close", { timeout: TEST_TIMEOUT });
      }
    }

    // Verify connection success in main app
    // Look for success indicators like green status, checkmark, or "Connected" text
    await expect(
      page.locator(
        'text=/connected|success|✓|✅/i, [data-status="connected"], .status-connected',
      ),
    ).toBeVisible({ timeout: TEST_TIMEOUT });
  });

  test("should handle OAuth errors gracefully", async ({ page }) => {
    // Navigate to MCP settings
    await page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first()
      .click();

    // Click connect button
    const connectButton = page
      .locator("button")
      .filter({
        hasText: /Connect|Setup|Add.*Hugging Face|Hugging Face.*Connect/i,
      })
      .first();
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Monitor console for errors
      const consoleMessages: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleMessages.push(msg.text());
        }
      });

      // Wait a bit to see if any errors occur
      await page.waitForTimeout(5000);

      // Check for error handling in UI
      const errorElements = page.locator(
        'text=/error|failed|invalid|unauthorized/i, [data-status="error"], .status-error, .error-message',
      );
      const hasVisibleErrors = (await errorElements.count()) > 0;

      // Either should show proper error handling or work correctly
      if (hasVisibleErrors) {
        console.log(
          "OAuth errors detected in UI - this is expected for error handling test",
        );
      }

      // Should not have unhandled JavaScript errors
      const hasJSErrors = consoleMessages.some(
        (msg) =>
          msg.includes("Uncaught") ||
          msg.includes("TypeError") ||
          msg.includes("ReferenceError"),
      );

      expect(hasJSErrors).toBeFalsy();
    }
  });

  test("should display MCP server status correctly", async ({ page }) => {
    // Navigate to MCP settings
    await page
      .locator("button, a")
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first()
      .click();

    // Look for server status indicators
    const statusElements = page.locator(
      "[data-status], .status, text=/status|connected|disconnected|connecting/i",
    );

    // Should have at least some status information visible
    await expect(statusElements.first()).toBeVisible({ timeout: TEST_TIMEOUT });

    // Check for proper status styling/indicators
    const statusClasses =
      (await statusElements.first().getAttribute("class")) || "";
    const statusText = (await statusElements.first().textContent()) || "";

    // Should contain meaningful status information
    expect(statusText.length).toBeGreaterThan(0);
  });
});
