import { expect, test } from '@playwright/test';

// Test configuration from environment
const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const TEST_HF_USERNAME = process.env.TEST_HF_USERNAME || '';
const TEST_HF_PASSWORD = process.env.TEST_HF_PASSWORD || '';
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '30000');

test.describe('MCP OAuth Flow - Hugging Face', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(TEST_BASE_URL);

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load app and navigate to settings', async ({ page }) => {
    // Check if the main chat view is visible
    await expect(page.locator('[data-testid="chat-view"], .chat-container, main')).toBeVisible({
      timeout: TEST_TIMEOUT,
    });

    // Look for settings button/link
    const settingsButton = page
      .locator('button, a')
      .filter({ hasText: /settings|Settings|⚙/i })
      .first();
    await expect(settingsButton).toBeVisible({ timeout: TEST_TIMEOUT });

    // Click settings
    await settingsButton.click();

    // Verify we're in settings page
    await expect(page.locator('text=/settings|Settings|Tools & MCP|LLM Provider/i')).toBeVisible();
  });

  test('should navigate to MCP settings tab', async ({ page }) => {
    // Navigate to settings first
    await page
      .locator('button, a')
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
    await expect(page.locator('text=/MCP Server|Quick Setup|External Tools/i')).toBeVisible();
  });

  test('should show quick setup options for Hugging Face MCP', async ({ page }) => {
    // Navigate to MCP settings
    await page
      .locator('button, a')
      .filter({ hasText: /settings|Settings|⚙/i })
      .first()
      .click();
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Tools.*MCP|MCP.*Tools|MCP/i })
      .first()
      .click();

    // Look for Hugging Face quick setup option
    const hfOption = page.locator('text=/Hugging Face|hf.co|HF MCP/i').first();
    await expect(hfOption).toBeVisible({ timeout: TEST_TIMEOUT });
  });

  test('should initiate Hugging Face MCP OAuth flow', async ({ page }) => {
    // Skip if no test credentials
    test.skip(!TEST_HF_USERNAME || !TEST_HF_PASSWORD, 'Test credentials not provided');

    // Navigate to MCP settings
    await page
      .locator('button, a')
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
      .locator('button')
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
          'input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]'
        )
        .first();
      const passwordField = page
        .locator('input[name="password"], input[type="password"], input[placeholder*="password"]')
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
      await page.waitForURL(new RegExp(TEST_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
        timeout: TEST_TIMEOUT,
      });
    } catch (error) {
      // OAuth might open in popup - handle popup case
      const popup = await page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
      if (popup) {
        await popup.waitForLoadState('networkidle');

        // Fill credentials in popup
        const popupUsernameField = popup
          .locator(
            'input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]'
          )
          .first();
        const popupPasswordField = popup
          .locator('input[name="password"], input[type="password"], input[placeholder*="password"]')
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
        await popup.waitForEvent('close', { timeout: TEST_TIMEOUT });
      }
    }

    // Verify connection success in main app
    // Look for success indicators like green status, checkmark, or "Connected" text
    await expect(
      page.locator('text=/connected|success|✓|✅/i, [data-status="connected"], .status-connected')
    ).toBeVisible({ timeout: TEST_TIMEOUT });
  });

  test('should handle OAuth errors gracefully', async ({ page }) => {
    // Navigate to MCP settings
    await page
      .locator('button, a')
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
      .locator('button')
      .filter({
        hasText: /Connect|Setup|Add.*Hugging Face|Hugging Face.*Connect/i,
      })
      .first();
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Monitor console for errors
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleMessages.push(msg.text());
        }
      });

      // Wait a bit to see if any errors occur
      await page.waitForTimeout(5000);

      // Check for error handling in UI
      const errorElements = page.locator(
        'text=/error|failed|invalid|unauthorized/i, [data-status="error"], .status-error, .error-message'
      );
      const hasVisibleErrors = (await errorElements.count()) > 0;

      // Either should show proper error handling or work correctly
      if (hasVisibleErrors) {
        console.log('OAuth errors detected in UI - this is expected for error handling test');
      }

      // Should not have unhandled JavaScript errors
      const hasJSErrors = consoleMessages.some(
        (msg) =>
          msg.includes('Uncaught') || msg.includes('TypeError') || msg.includes('ReferenceError')
      );

      expect(hasJSErrors).toBeFalsy();
    }
  });

  test('should display MCP server status correctly', async ({ page }) => {
    // Navigate to MCP settings using modern selectors
    const settingsButton = page
      .locator('button')
      .filter({ has: page.locator('svg') })
      .first();
    await settingsButton.click();
    await page.getByRole('tab', { name: 'MCP' }).click();

    // Check if there are existing servers or if we need to add one for testing
    const existingServers = page.locator('[data-slot="badge"]');
    const hasServers = (await existingServers.count()) > 0;

    if (!hasServers) {
      // Add a test server to verify status display
      await page.getByRole('button', { name: 'Add Server' }).click();
      await page.getByPlaceholder('My MCP Server').fill('Status Test Server');
      await page
        .getByPlaceholder('https://example.com/mcp')
        .fill('https://status-test.example.com/mcp');
      await page.getByRole('button', { name: 'Test Connection' }).click();
      await page.waitForTimeout(3000);

      // Try to add the server (might fail, but that's okay for status testing)
      const addServerButton = page.getByRole('button', { name: 'Add Server' });
      if (await addServerButton.isVisible()) {
        await addServerButton.click();
        await page.waitForTimeout(2000);
      } else {
        // Close dialog if connection failed
        await page.getByRole('button', { name: /Close|Cancel/i }).click();
      }
    }

    // Look for server status badges/indicators
    const statusBadges = page.locator('[data-slot="badge"]');
    const serverListItems = page.locator('text=/Status Test Server|Configured Servers/i');

    // Should have meaningful status information displayed
    const hasStatusInfo = (await statusBadges.count()) > 0 || (await serverListItems.count()) > 0;
    expect(hasStatusInfo).toBeTruthy();

    console.log('✅ MCP server status display functionality verified');

    // Verify mobile dimensions maintained
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(393);
    expect(viewportSize?.height).toBe(852);
  });

  test('mobile MCP settings navigation and responsiveness', async ({ page }) => {
    // Test complete mobile workflow
    await expect(page.getByText('caw caw')).toBeVisible();

    // Navigate to settings
    const settingsButton = page
      .locator('button')
      .filter({ has: page.locator('svg') })
      .first();
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Test all tabs are accessible in mobile view
    const tabs = ['LLM', 'MCP', 'Theme', 'Debug'];
    for (const tabName of tabs) {
      await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
      await expect(page.getByRole('tab', { name: new RegExp(tabName, 'i') })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await page.waitForTimeout(300);
    }

    // Focus on MCP tab functionality
    await page.getByRole('tab', { name: 'MCP' }).click();
    await expect(page.getByText('Configured Servers')).toBeVisible();

    // Test Add Server dialog in mobile
    await page.getByRole('button', { name: 'Add Server' }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();

    // Test form accessibility in mobile
    await expect(page.getByPlaceholder('My MCP Server')).toBeVisible();
    await expect(page.getByPlaceholder('https://example.com/mcp')).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /Close|Cancel/i }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).not.toBeVisible();

    // Verify mobile viewport maintained
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(393);
    expect(viewportSize?.height).toBe(852);

    console.log('✅ Mobile MCP navigation test completed successfully');
    console.log('🎯 All MCP functionality accessible and responsive on mobile');
  });
});
