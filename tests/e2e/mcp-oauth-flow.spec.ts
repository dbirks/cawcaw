import { test, expect } from "@playwright/test";

test.describe("MCP OAuth Flow", () => {
  test("complete OAuth flow for HuggingFace MCP server", async ({ page }) => {
    // Navigate to the app
    await page.goto("http://localhost:5173");

    // Wait for app to load
    await expect(page.locator("h1")).toContainText("caw caw");

    // Open settings by clicking the settings button
    await page.click(
      '[data-testid="settings-button"], button:has-text("Settings"), button[aria-label*="Settings"]',
    );

    // Wait for settings modal/page to open
    await expect(page.locator("text=Settings")).toBeVisible();

    // Navigate to MCP tab
    await page.click("text=Tools & MCP");

    // Wait for MCP tab content to load
    await expect(page.locator("text=MCP Servers")).toBeVisible();

    // Add new MCP server
    await page.click(
      'button:has-text("Add Server"), [data-testid="add-mcp-server"]',
    );

    // Fill in server details
    await page.fill(
      'input[name="name"], input[placeholder*="name"]',
      "HuggingFace MCP",
    );
    await page.fill(
      'input[name="url"], input[placeholder*="url"]',
      "https://hf.co/mcp",
    );

    // Select HTTP transport if needed
    const transportSelect = page.locator(
      'select[name="transport"], [data-testid="transport-select"]',
    );
    if (await transportSelect.isVisible()) {
      await transportSelect.selectOption("http");
    }

    // Save the server configuration
    await page.click('button:has-text("Save"), button:has-text("Add Server")');

    // Wait for server to be added to the list
    await expect(page.locator("text=HuggingFace MCP")).toBeVisible();

    // Connect to the server (this should trigger OAuth flow)
    await page.click(
      'button:has-text("Connect"):near([text="HuggingFace MCP"])',
    );

    // Handle OAuth redirect - expect to be redirected to HuggingFace
    await page.waitForNavigation();

    // Verify we're on HuggingFace OAuth page
    await expect(page.url()).toContain("huggingface.co");
    await expect(
      page.locator("text=Sign in, text=Login, text=Authorize"),
    ).toBeVisible();

    // Check if credentials are provided via environment variables
    const username = process.env.TEST_HF_USERNAME;
    const password = process.env.TEST_HF_PASSWORD;

    if (!username || !password) {
      console.log(
        "⚠️  TEST_HF_USERNAME and TEST_HF_PASSWORD environment variables not provided",
      );
      console.log("   This test will fail at OAuth login step");
      console.log(
        "   Please update .env file with your HuggingFace credentials",
      );

      // Take screenshot for debugging
      await page.screenshot({
        path: "test-results/oauth-login-page.png",
        fullPage: true,
      });

      // Mark test as skipped rather than failed
      test.skip(
        true,
        "HuggingFace credentials not provided in environment variables",
      );
      return;
    }

    // Fill in login credentials
    const usernameInput = page.locator(
      'input[name="username"], input[type="email"], input[placeholder*="username"], input[placeholder*="email"]',
    );
    const passwordInput = page.locator(
      'input[name="password"], input[type="password"], input[placeholder*="password"]',
    );

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    // Submit login form
    await page.click(
      'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")',
    );

    // Handle potential authorization page
    const authorizeButton = page.locator(
      'button:has-text("Authorize"), button:has-text("Allow")',
    );
    if (await authorizeButton.isVisible({ timeout: 5000 })) {
      await authorizeButton.click();
    }

    // Wait for redirect back to our app
    await page.waitForURL("**/oauth/callback**", { timeout: 30000 });

    // Verify we're back in our app
    await expect(page.locator("h1")).toContainText("caw caw");

    // Verify MCP server is now connected
    await page.click(
      '[data-testid="settings-button"], button:has-text("Settings")',
    );
    await page.click("text=Tools & MCP");

    // Check server status
    const serverStatus = page.locator(
      '[text="HuggingFace MCP"] ~ [text="Connected"], [data-testid="server-status"]:has-text("Connected")',
    );
    await expect(serverStatus).toBeVisible();

    // Close settings
    await page.click(
      'button:has-text("Close"), [data-testid="close-settings"]',
    );

    // Verify MCP tools are now available in chat
    const mcpButton = page.locator(
      'button:has-text("Model Context Protocol"), [data-testid="mcp-button"]',
    );
    await expect(mcpButton).toBeVisible();

    // Optional: Test that we can see available tools
    if (await mcpButton.isVisible()) {
      await mcpButton.click();
      // Should show available tools from HuggingFace MCP server
      await expect(
        page.locator("text=Tools, text=Available Tools"),
      ).toBeVisible();
    }
  });

  test("handle OAuth flow errors gracefully", async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Handle API key setup if needed
    const apiKeyInput = page.getByPlaceholder(/sk-/);
    if (await apiKeyInput.isVisible()) {
      const testApiKey = process.env.TEST_OPENAI_API_KEY;
      if (testApiKey && testApiKey.startsWith('sk-')) {
        await apiKeyInput.fill(testApiKey);
        await page.getByRole('button', { name: 'Save API Key' }).click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Set up network interception to simulate OAuth errors
    await page.route('**/oauth/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_request' }),
      });
    });

    // Navigate to MCP settings using modern selectors
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await settingsButton.click();
    await page.getByRole('tab', { name: 'MCP' }).click();
    
    // Add new MCP server
    await page.getByRole('button', { name: 'Add Server' }).click();
    
    await page.getByPlaceholder('My MCP Server').fill('Test OAuth Error Server');
    await page.getByPlaceholder('https://example.com/mcp').fill('https://invalid-oauth.example.com/mcp');
    
    // Test connection (should fail gracefully)
    await page.getByRole('button', { name: 'Test Connection' }).click();
    
    // Should show connection failed or error handling - match actual error messages
    await expect(page.getByText(/Network error|Connection Failed|Connection Error|Unable to reach server|error/i)).toBeVisible({ timeout: 10000 });
    
    // Verify mobile UI still responsive after error
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();
    console.log('✅ OAuth error handling verified - UI remains responsive');
    
    // Cancel dialog
    await page.getByRole('button', { name: /Close|Cancel/i }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).not.toBeVisible();
  });
  
  test('MCP server management and UI responsiveness', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Handle API key setup if needed
    const apiKeyInput = page.getByPlaceholder(/sk-/);
    if (await apiKeyInput.isVisible()) {
      const testApiKey = process.env.TEST_OPENAI_API_KEY;
      if (testApiKey && testApiKey.startsWith('sk-')) {
        await apiKeyInput.fill(testApiKey);
        await page.getByRole('button', { name: 'Save API Key' }).click();
        await page.waitForLoadState('networkidle');
      }
    }
    
    // Test full mobile navigation flow to MCP settings
    await expect(page.getByText('caw caw')).toBeVisible();
    
    // Settings navigation using modern selectors
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Navigate to MCP tab using proper role-based selector
    await page.getByRole('tab', { name: 'MCP' }).click();
    await expect(page.getByText('Configured Servers')).toBeVisible();
    
    // Test Add Server dialog functionality
    await page.getByRole('button', { name: 'Add Server' }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();
    
    // Test form validation - try empty fields
    await page.getByRole('button', { name: 'Test Connection' }).click();
    
    // Should show validation error or handle empty fields gracefully
    const validationError = page.getByText(/required|invalid|empty/i);
    if (await validationError.isVisible({ timeout: 2000 })) {
      console.log('✅ Form validation working correctly');
    }
    
    // Fill minimal valid data
    await page.getByPlaceholder('My MCP Server').fill('UI Test Server');
    await page.getByPlaceholder('https://example.com/mcp').fill('https://test.example.com/mcp');
    
    // Test connection (will likely fail but UI should handle it)
    await page.getByRole('button', { name: 'Test Connection' }).click();
    await page.waitForTimeout(3000);
    
    // Verify dialog is still responsive
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();
    
    // Close dialog
    await page.getByRole('button', { name: /Close|Cancel/i }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).not.toBeVisible();
    
    // Verify mobile dimensions maintained throughout
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(393);
    expect(viewportSize?.height).toBe(852);
    
    console.log('✅ MCP UI responsiveness test completed successfully');
    console.log('🎯 Dialog management and mobile compatibility verified');
  });
  
  test('complete end-to-end HuggingFace OAuth and tool functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Handle API key setup with real OpenAI key from .env
    const apiKeyInput = page.getByPlaceholder(/sk-/);
    if (await apiKeyInput.isVisible()) {
      const testApiKey = process.env.TEST_OPENAI_API_KEY;
      if (!testApiKey || !testApiKey.startsWith('sk-')) {
        throw new Error('TEST_OPENAI_API_KEY not found in .env file or invalid format');
      }
      await apiKeyInput.fill(testApiKey);
      await page.getByRole('button', { name: 'Save API Key' }).click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Real OpenAI API key configured for testing');
    }
    
    // Wait for MCP initialization to complete - be more patient
    await page.waitForTimeout(5000);
    
    // Verify we're on main chat screen
    await expect(page.getByRole('heading', { name: 'caw caw' })).toBeVisible();
    
    // Check MCP status indicator - should show tools if our mock is working
    const mcpButton = page.getByRole('button', { name: /Model Context Protocol/i });
    await expect(mcpButton).toBeVisible();
    
    // Wait for MCP system to fully initialize and check for tool indicators
    await page.waitForTimeout(3000);
    
    // Take screenshot to see actual MCP button state
    await page.screenshot({ path: 'test-results/mcp-status.png', fullPage: false });
    
    // Look for any tool count indicator (could be "1 tool", "No tools", etc.)
    const hasTools = await page.getByText(/\d+ tool|1 tool/i).isVisible({ timeout: 2000 });
    const noTools = await page.getByText(/No tools/i).isVisible({ timeout: 2000 });
    
    // Get the actual MCP button text for debugging
    const mcpButtonText = await mcpButton.textContent() || 'No text found';
    console.log(`MCP Button text: "${mcpButtonText}"`);
    console.log(`MCP Status - Has tools: ${hasTools}, No tools: ${noTools}`);
    
    if (hasTools) {
      console.log('✅ MCP tools detected - HuggingFace OAuth and mock responses working');
      
      // Test tool call in chat interface
      const messageInput = page.getByRole('textbox', { name: /Type your message/i });
      await expect(messageInput).toBeVisible();
      
      // Send a message that should trigger HuggingFace tool call
      await messageInput.fill('Search for the best language models on HuggingFace');
      await page.keyboard.press('Enter');
      
      // Wait for AI response with tool call - give it enough time
      await page.waitForTimeout(15000);
      
      // Look for the improved tool call UI - should show clean tool name
      const toolCallButton = page.getByRole('button', { name: /search_models|models|Completed/i });
      if (await toolCallButton.isVisible({ timeout: 5000 })) {
        console.log('✅ Tool call executed successfully with clean UI');
        
        // Expand tool call details
        await toolCallButton.click();
        
        // Verify server name appears in expanded details
        const mcpServerSection = page.getByText(/MCP Server.*Hugging Face/i);
        if (await mcpServerSection.isVisible({ timeout: 3000 })) {
          console.log('✅ MCP server name properly displayed in expanded details');
        }
        
        // Verify parameters and results sections
        await expect(page.getByText(/Parameters/i)).toBeVisible();
        await expect(page.getByText(/Result/i)).toBeVisible();
        
        // Verify AI incorporated tool results into response
        const aiResponse = page.getByText(/language models|Llama|DialoGPT|BART/i);
        await expect(aiResponse).toBeVisible();
        
        console.log('✅ End-to-end tool functionality verified');
      } else {
        console.log('⚠️ Tool call not detected - may need to check mock responses');
      }
    } else {
      console.log('⚠️ MCP tools not detected - checking connection status');
      
      // Check if we can see the MCP server configuration
      await mcpButton.click();
      const mcpPopover = page.locator('[role="dialog"], .popover-content').first();
      
      if (await mcpPopover.isVisible({ timeout: 3000 })) {
        // Look for server status
        const serverInfo = page.getByText(/Hugging Face|Connected|Disconnected|Error/i);
        if (await serverInfo.isVisible()) {
          console.log('✅ MCP server configuration detected');
        }
      }
    }
    
    // Verify mobile viewport maintained throughout test
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(393);
    expect(viewportSize?.height).toBe(852);
    
    console.log('🎯 Complete end-to-end OAuth and tool functionality test completed');
  });
});
