import { test, expect } from '@playwright/test';

// Basic smoke tests to verify the app loads and core functionality works

test.describe('App Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page title contains expected text
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check that we don't have any obvious error messages
    const errorText = page.locator('text=/error|Error|failed|Failed/i');
    const errorCount = await errorText.count();
    
    // It's ok to have some error text in the UI (like error handling examples)
    // but we shouldn't have obvious unhandled errors
    if (errorCount > 0) {
      const visibleErrors = await errorText.filter({ hasText: /uncaught|unexpected|cannot read|undefined/i }).count();
      expect(visibleErrors).toBe(0);
    }
  });

  test('should have functional chat interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for chat-related elements
    const chatElements = page.locator('[data-testid*="chat"], .chat, textarea, input').filter({ hasText: /message|chat|type|send/i });
    const hasChatInterface = await chatElements.count() > 0;
    
    // Should have some kind of input mechanism
    const inputElements = page.locator('textarea, input[type="text"]');
    const hasInputs = await inputElements.count() > 0;
    
    expect(hasChatInterface || hasInputs).toBeTruthy();
  });

  test('should have accessible settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for settings button/link
    const settingsElement = page.locator('button, a, [role="button"]').filter({ hasText: /settings|Settings|⚙/i });
    const hasSettings = await settingsElement.count() > 0;
    
    if (hasSettings) {
      await settingsElement.first().click();
      
      // Should navigate to settings or show settings panel
      const settingsContent = page.locator('text=/settings|Settings|configuration|Configuration/i');
      await expect(settingsContent.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle viewport changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    
    // Should not have obvious layout breaks
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox?.width).toBeGreaterThan(0);
    expect(bodyBox?.height).toBeGreaterThan(0);
    
    // Test mobile viewport  
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Should still be functional
    const bodyBoxMobile = await body.boundingBox();
    expect(bodyBoxMobile?.width).toBeGreaterThan(0);
    expect(bodyBoxMobile?.height).toBeGreaterThan(0);
  });

  test('should not have console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected/harmless errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') &&
      !error.includes('chrome-extension') &&
      !error.includes('analytics') &&
      !error.includes('404') &&
      error.includes('Uncaught') || error.includes('TypeError') || error.includes('ReferenceError')
    );
    
    expect(criticalErrors).toHaveLength(0);
    
    if (criticalErrors.length > 0) {
      console.log('Critical console errors found:', criticalErrors);
    }
  });
});