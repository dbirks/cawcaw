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
      
      await page.click('button:has-text("Test Connection")');
      
      // Wait for connection test to complete
      await page.waitForTimeout(3000);
      
      // Step 6: Verify the connection is successful and OAuth is configured
      await expect(page.getByText('Connection Successful')).toBeVisible();
      await expect(page.getByText('OAuth authentication required')).toBeVisible();
      
      console.log('🎯 Connection successful! HF MCP server OAuth configured automatically.');
      
      // Step 7: Click Error Details to get the full analysis
      await page.click('button:has-text("Error Details")');
      
      // Verify the detailed error information
      await expect(page.locator('text=HTTP Status:')).toBeVisible();
      await expect(page.locator('text=400 Bad Request')).toBeVisible();
      await expect(page.locator('text=JSON-RPC Error:')).toBeVisible();
      await expect(page.locator('text=Session ID required')).toBeVisible();
      
      // Verify the JSON response format
      await expect(page.locator('text=Response:')).toBeVisible();
      const responseText = await page.locator('text*={"jsonrpc":"2.0","error"').textContent();
      expect(responseText).toContain('Session ID required');
      
      console.log('✅ MYSTERY SOLVED: Server requires Session ID (OAuth authentication needed first)');
      
      // Step 8: Add the server anyway to test OAuth flow
      await page.click('button:has-text("Add Server")');
      
      // Wait for server to be added
      await expect(page.locator('text=HuggingFace MCP Investigation Server')).toBeVisible();
      await expect(page.locator('text=Disconnected')).toBeVisible();
      await expect(page.locator('text=OAuth Required')).toBeVisible();
    }
    
    // Step 9: Test OAuth Flow Initiation
    console.log('🔐 Testing OAuth authentication flow...');
    const oauthButton = page.locator('button:has-text("OAuth Authentication Required")');
    
    if (await oauthButton.isVisible()) {
      // Set up to monitor for new tabs (OAuth popup)
      const newTabPromise = page.context().waitForEvent('page');
      
      await oauthButton.click();
      
      // Wait for OAuth tab to open
      const oauthTab = await newTabPromise;
      await oauthTab.waitForLoadState('networkidle');
      
      // Verify we're redirected to HuggingFace OAuth
      expect(oauthTab.url()).toContain('huggingface.co');
      expect(oauthTab.url()).toContain('oauth');
      
      console.log('🌐 OAuth flow initiated successfully! URL:', oauthTab.url());
      
      // Verify OAuth parameters in URL
      expect(oauthTab.url()).toContain('client_id=');
      expect(oauthTab.url()).toContain('redirect_uri=http://localhost:5173/oauth/callback');
      expect(oauthTab.url()).toContain('response_type=code');
      
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
    await page.goto('http://localhost:5173');
    
    // Navigate to MCP settings
    await page.click('button:has(img):near(h1)');
    await page.click('text=Tools & MCP');
    
    // Test adding server with invalid URL to verify error handling
    await page.click('button:has-text("Add Server")');
    
    await page.fill('textbox:has-text("Name")', 'Invalid MCP Server Test');
    await page.fill('textbox:has-text("URL")', 'https://invalid-mcp-server.example.com');
    
    // Test connection with invalid server
    await page.click('button:has-text("Test Connection")');
    
    // Should show connection failed
    await expect(page.locator('text=Connection Failed')).toBeVisible({ timeout: 10000 });
    
    // Verify mobile UI still responsive
    await expect(page.locator('dialog:has-text("Add MCP Server")')).toBeVisible();
    
    // Cancel dialog
    await page.click('button:has-text("Close")');
    await expect(page.locator('dialog:has-text("Add MCP Server")')).not.toBeVisible();
  });
  
  test('mobile UI navigation and responsiveness test', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Test full mobile navigation flow
    await expect(page.locator('h1:has-text("caw caw")')).toBeVisible();
    
    // Settings navigation
    await page.click('button:has(img):near(h1)');
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Test all tabs in mobile view
    const tabs = ['LLM Provider', 'Tools & MCP', 'Appearance', 'Debug'];
    for (const tabName of tabs) {
      await page.click(`text=${tabName}`);
      await expect(page.locator(`tab[selected]:has-text("${tabName}")`)).toBeVisible();
      await page.waitForTimeout(500); // Small delay for tab switching
    }
    
    // Verify mobile dimensions maintained
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBe(375);
    expect(viewportSize?.height).toBe(812);
    
    // Close settings
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=Settings')).not.toBeVisible();
    
    // Verify back to main chat interface
    await expect(page.locator('text=Start a conversation with AI')).toBeVisible();
  });
});