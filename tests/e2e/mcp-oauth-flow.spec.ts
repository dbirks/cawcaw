import { test, expect } from '@playwright/test';

test.describe('MCP OAuth Flow', () => {
  test('complete OAuth flow for HuggingFace MCP server', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for app to load
    await expect(page.locator('h1')).toContainText('caw caw');
    
    // Open settings by clicking the settings button
    await page.click('[data-testid="settings-button"], button:has-text("Settings"), button[aria-label*="Settings"]');
    
    // Wait for settings modal/page to open
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Navigate to MCP tab
    await page.click('text=Tools & MCP');
    
    // Wait for MCP tab content to load
    await expect(page.locator('text=MCP Servers')).toBeVisible();
    
    // Add new MCP server
    await page.click('button:has-text("Add Server"), [data-testid="add-mcp-server"]');
    
    // Fill in server details
    await page.fill('input[name="name"], input[placeholder*="name"]', 'HuggingFace MCP');
    await page.fill('input[name="url"], input[placeholder*="url"]', 'https://hf.co/mcp');
    
    // Select HTTP transport if needed
    const transportSelect = page.locator('select[name="transport"], [data-testid="transport-select"]');
    if (await transportSelect.isVisible()) {
      await transportSelect.selectOption('http');
    }
    
    // Save the server configuration
    await page.click('button:has-text("Save"), button:has-text("Add Server")');
    
    // Wait for server to be added to the list
    await expect(page.locator('text=HuggingFace MCP')).toBeVisible();
    
    // Connect to the server (this should trigger OAuth flow)
    await page.click('button:has-text("Connect"):near([text="HuggingFace MCP"])');
    
    // Handle OAuth redirect - expect to be redirected to HuggingFace
    await page.waitForNavigation();
    
    // Verify we're on HuggingFace OAuth page
    await expect(page.url()).toContain('huggingface.co');
    await expect(page.locator('text=Sign in, text=Login, text=Authorize')).toBeVisible();
    
    // Check if credentials are provided via environment variables
    const username = process.env.HF_USERNAME;
    const password = process.env.HF_PASSWORD;
    
    if (!username || !password) {
      console.log('⚠️  HF_USERNAME and HF_PASSWORD environment variables not provided');
      console.log('   This test will fail at OAuth login step');
      console.log('   Please update .env file with your HuggingFace credentials');
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: 'test-results/oauth-login-page.png',
        fullPage: true 
      });
      
      // Mark test as skipped rather than failed
      test.skip(true, 'HuggingFace credentials not provided in environment variables');
      return;
    }
    
    // Fill in login credentials
    const usernameInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"], input[placeholder*="password"]');
    
    await usernameInput.fill(username);
    await passwordInput.fill(password);
    
    // Submit login form
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    
    // Handle potential authorization page
    const authorizeButton = page.locator('button:has-text("Authorize"), button:has-text("Allow")');
    if (await authorizeButton.isVisible({ timeout: 5000 })) {
      await authorizeButton.click();
    }
    
    // Wait for redirect back to our app
    await page.waitForURL('**/oauth/callback**', { timeout: 30000 });
    
    // Verify we're back in our app
    await expect(page.locator('h1')).toContainText('caw caw');
    
    // Verify MCP server is now connected
    await page.click('[data-testid="settings-button"], button:has-text("Settings")');
    await page.click('text=Tools & MCP');
    
    // Check server status
    const serverStatus = page.locator('[text="HuggingFace MCP"] ~ [text="Connected"], [data-testid="server-status"]:has-text("Connected")');
    await expect(serverStatus).toBeVisible();
    
    // Close settings
    await page.click('button:has-text("Close"), [data-testid="close-settings"]');
    
    // Verify MCP tools are now available in chat
    const mcpButton = page.locator('button:has-text("Model Context Protocol"), [data-testid="mcp-button"]');
    await expect(mcpButton).toBeVisible();
    
    // Optional: Test that we can see available tools
    if (await mcpButton.isVisible()) {
      await mcpButton.click();
      // Should show available tools from HuggingFace MCP server
      await expect(page.locator('text=Tools, text=Available Tools')).toBeVisible();
    }
  });
  
  test('handle OAuth flow errors gracefully', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Set up network interception to simulate OAuth errors
    await page.route('**/oauth/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_request' })
      });
    });
    
    // Follow same steps to add MCP server
    await page.click('[data-testid="settings-button"], button:has-text("Settings")');
    await page.click('text=Tools & MCP');
    await page.click('button:has-text("Add Server")');
    
    await page.fill('input[name="name"]', 'Test Server');
    await page.fill('input[name="url"]', 'https://hf.co/mcp');
    await page.click('button:has-text("Save")');
    
    // Attempt to connect (should fail)
    await page.click('button:has-text("Connect")');
    
    // Verify error handling
    await expect(page.locator('text=Error, text=Failed, text=Unable to connect')).toBeVisible();
    
    // Verify server status shows as disconnected/error
    const errorStatus = page.locator('[text="Test Server"] ~ [text="Error"], [data-testid="server-status"]:has-text("Error")');
    await expect(errorStatus).toBeVisible();
  });
});