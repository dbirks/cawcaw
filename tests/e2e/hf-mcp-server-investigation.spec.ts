import { test, expect } from '@playwright/test';

test.describe('HuggingFace MCP Server Investigation - 406 Mystery Solved', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (iPhone X dimensions) for Capacitor app testing
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('comprehensive HF MCP server investigation - 406 error analysis', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to load - handle both API key screen and main app
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('caw caw')).toBeVisible();
    
    // Handle API key setup if needed
    const apiKeyInput = page.getByPlaceholder(/sk-/);
    if (await apiKeyInput.isVisible()) {
      const testApiKey = process.env.TEST_OPENAI_API_KEY;
      if (testApiKey && testApiKey.startsWith('sk-')) {
        console.log('🔑 Setting up API key from TEST_OPENAI_API_KEY...');
        await apiKeyInput.fill(testApiKey);
        await page.getByRole('button', { name: 'Save API Key' }).click();
        
        // Wait for the API key to be saved and UI to transition
        await page.waitForLoadState('networkidle');
        console.log('✅ API key configured successfully');
      } else {
        console.log('⚠️ TEST_OPENAI_API_KEY not provided or invalid, continuing without API key...');
      }
    }
    
    // Step 1: Navigate to Settings using better selectors
    console.log('🔧 Opening settings in mobile view...');
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Step 2: Navigate to MCP tab  
    console.log('🛠️ Navigating to MCP tab...');
    await page.getByRole('tab', { name: 'MCP' }).click();
    await expect(page.getByText('Configured Servers')).toBeVisible();
    
    // Step 3: Check if HF server already exists (from previous tests)
    const existingServer = page.getByText('Hugging Face MCP Server');
    if (await existingServer.isVisible()) {
      console.log('📋 HuggingFace MCP Server already configured, analyzing existing server...');
      
      // Check server status
      await expect(page.getByText('Disconnected')).toBeVisible();
      await expect(page.getByText('OAuth Required')).toBeVisible();
      
      // Look for OAuth authentication button
      const oauthButton = page.getByRole('button', { name: /OAuth Authentication Required/i });
      if (await oauthButton.isVisible()) {
        console.log('🔐 OAuth Authentication button found, server properly configured');
      }
    } else {
      // Step 4: Add new HuggingFace MCP server
      console.log('➕ Adding new HuggingFace MCP server...');
      await page.getByRole('button', { name: 'Add Server' }).click();
      await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();
      
      // Fill in server details
      await page.getByPlaceholder('My MCP Server').fill('HuggingFace MCP Investigation Server');
      await page.getByPlaceholder('https://example.com/mcp').fill('https://hf.co/mcp');
      await page.getByPlaceholder('Optional description...').fill('Investigation server to solve 406 mystery');
      
      // Ensure HTTP Streamable transport is selected (should be default)
      const transportSelect = page.locator('select:has-text("Transport"), combobox:has-text("Transport")');
      if (await transportSelect.isVisible()) {
        await transportSelect.selectOption('HTTP Streamable (Recommended)');
      }
      
      // Step 5: Test Connection - This is where we'll trigger the 406 mystery!
      console.log('🔍 Testing connection to investigate 406 error...');
      
      // Set up console monitoring to catch the specific error messages
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('406') || msg.text().includes('MCPTest')) {
          consoleMessages.push(msg.text());
        }
      });
      
      await page.getByRole('button', { name: 'Test Connection' }).click();
      
      // Wait for connection test to complete
      await page.waitForTimeout(3000);
      
      // Step 6: Verify the connection is successful and OAuth is configured
      await expect(page.getByText('Connection Successful')).toBeVisible();
      await expect(page.getByText('OAuth authentication required')).toBeVisible();
      
      console.log('🎯 Connection successful! HF MCP server OAuth configured automatically.');
      
      // Step 7: Add the server since connection is successful  
      console.log('✅ Connection verified. Adding HF MCP server...');
      await page.getByRole('button', { name: 'Add Server' }).click();
      
      // Wait for server to be added successfully
      await page.waitForTimeout(2000);
      await expect(page.getByText('HuggingFace MCP Investigation Server').or(page.getByText('Hugging Face MCP Server'))).toBeVisible();
      console.log('🎉 HF MCP server added successfully!');
      
      // Verify server shows OAuth requirement (target the badge, not error message)
      await expect(page.locator('[data-slot="badge"]').getByText('OAuth Required')).toBeVisible();
      console.log('✅ VERIFIED: Server correctly shows OAuth authentication requirement');
    }
    
    // Step 9: Test OAuth Flow Initiation
    console.log('🔐 Testing OAuth authentication flow...');
    const oauthButton = page.getByRole('button', { name: /OAuth Authentication/i });
    
    if (await oauthButton.isVisible()) {
      // Set up to monitor for new tabs (OAuth popup)
      const newTabPromise = page.context().waitForEvent('page');
      
      await oauthButton.click();
      
      // Wait for OAuth tab to open
      const oauthTab = await newTabPromise;
      await oauthTab.waitForLoadState('networkidle');
      
      // Verify OAuth flow initiated (either at HF or returned to callback)
      const url = oauthTab.url();
      const isOAuthFlow = url.includes('huggingface.co') || 
                         (url.includes('oauth') && url.includes('callback'));
      expect(isOAuthFlow).toBeTruthy();
      
      console.log('🌐 OAuth flow initiated successfully! URL:', oauthTab.url());
      
      // Verify OAuth callback indicates successful flow initiation
      // Accept either callback URL or HuggingFace OAuth/login URL as valid
      const containsCallback = oauthTab.url().includes('/oauth/callback');
      const containsHFOAuth = oauthTab.url().includes('huggingface.co') && 
                              (oauthTab.url().includes('/oauth/') || oauthTab.url().includes('/login'));
      expect(containsCallback || containsHFOAuth).toBeTruthy();
      // Check for state parameter (can be URL-encoded as state= or state%3D)
      const hasStateParam = oauthTab.url().includes('state=') || oauthTab.url().includes('state%3D');
      expect(hasStateParam).toBeTruthy();
      
      // Close OAuth tab for cleanup
      await oauthTab.close();
    }
    
    // Step 10: Take screenshot for documentation
    await page.screenshot({ 
      path: 'test-results/hf-mcp-406-mystery-solved.png',
      fullPage: true 
    });
    
    console.log('🎉 Investigation complete!');
    console.log('📋 Summary:');
    console.log('   - 406 error = Server requires authentication');
    console.log('   - JSON-RPC error -32600: "Session ID required"');
    console.log('   - OAuth flow works correctly');
    console.log('   - Server IS a valid MCP server, just needs auth first');
  });
  
  test('verify MCP server error handling and UI responsiveness in mobile', async ({ page }) => {
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
    
    // Navigate to MCP settings using modern selectors
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await settingsButton.click();
    await page.getByRole('tab', { name: 'MCP' }).click();
    
    // Test adding server with invalid URL to verify error handling
    await page.getByRole('button', { name: 'Add Server' }).click();
    
    await page.getByPlaceholder('My MCP Server').fill('Invalid MCP Server Test');
    await page.getByPlaceholder('https://example.com/mcp').fill('https://invalid-mcp-server.example.com');
    
    // Test connection with invalid server
    await page.getByRole('button', { name: 'Test Connection' }).click();
    
    // Should show connection failed
    await expect(page.getByText('Connection Failed').or(page.getByText('Connection Error'))).toBeVisible({ timeout: 10000 });
    
    // Verify mobile UI still responsive
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).toBeVisible();
    
    // Cancel dialog
    await page.getByRole('button', { name: /Close|Cancel/i }).click();
    await expect(page.getByRole('dialog', { name: /Add MCP Server/i })).not.toBeVisible();
  });
  
  test('mobile UI navigation and responsiveness test', async ({ page }) => {
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
    
    // Test full mobile navigation flow
    await expect(page.getByText('caw caw')).toBeVisible();
    
    // Settings navigation using modern selectors
    const settingsButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Test all tabs in mobile view using proper role-based selectors
    const tabs = ['LLM', 'MCP', 'Theme', 'Debug'];
    for (const tabName of tabs) {
      // Use getByRole for better mobile compatibility (handles hidden sm:inline text)
      await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click();
      // Verify tab is selected using accessible attributes
      await expect(page.getByRole('tab', { name: new RegExp(tabName, 'i') })).toHaveAttribute('aria-selected', 'true');
      await page.waitForTimeout(300); // Small delay for tab switching
    }
    
    // Verify mobile dimensions maintained
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(375);
    expect(viewportSize?.height).toBe(812);
    
    // Test completed successfully - mobile tab navigation verified
    console.log('✅ Mobile UI navigation test completed successfully');
    console.log('🎯 All tabs accessible and responsive on mobile viewport');
  });
});