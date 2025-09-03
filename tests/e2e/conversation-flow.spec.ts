import { test, expect } from '@playwright/test';

test.describe('Conversation Flow', () => {
  test('complete conversation flow with OpenAI API', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    
    // Wait for app to load
    await expect(page.locator('h1')).toContainText('caw caw');
    
    // Check if we need to set up an API key
    const openaiApiKey = process.env.TEST_OPENAI_API_KEY;
    
    if (!openaiApiKey || !openaiApiKey.startsWith('sk-') || openaiApiKey.includes('your-test-openai-api-key')) {
      console.log('⚠️  TEST_OPENAI_API_KEY environment variable not provided or invalid');
      console.log('   This test will demonstrate the conversation flow but API calls will fail');
      console.log('   Please update .env file with a valid OpenAI API key');
      
      // Continue with test to show UI flow, but expect API errors
    }
    
    // Open settings to configure API key if provided
    if (openaiApiKey && openaiApiKey.startsWith('sk-') && !openaiApiKey.includes('your-test-openai-api-key')) {
      await page.click('button:has(img):near(h1)'); // Settings button
      await expect(page.locator('text=Settings')).toBeVisible();
      
      // Clear existing API key and enter the test key
      const apiKeyInput = page.locator('input[placeholder*="sk-"]');
      await apiKeyInput.clear();
      await apiKeyInput.fill(openaiApiKey);
      
      // Close settings
      await page.click('button:has-text("Close")');
    }
    
    // Verify we're back at the main chat interface
    await expect(page.locator('text=Start a conversation with AI')).toBeVisible();
    
    // Type a simple test message
    const testMessage = 'Say "Hello from the test!" and nothing else.';
    const messageInput = page.locator('input[placeholder*="Type your message"]');
    await messageInput.fill(testMessage);
    
    // Verify send button is enabled when message is entered
    const sendButton = page.locator('form button[type="submit"], button:near(input[placeholder*="Type your message"])').last();
    await expect(sendButton).toBeEnabled();
    
    // Send the message
    await sendButton.click();
    
    // Verify user message appears in chat
    await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    
    // Wait for AI response (with longer timeout for API call)
    const aiResponseLocator = page.locator('.message, [data-role="assistant"], [data-sender="ai"]').last();
    
    // Check if we have a valid API key
    if (!openaiApiKey || !openaiApiKey.startsWith('sk-') || openaiApiKey.includes('your-test-openai-api-key')) {
      // Expect error message for invalid/missing API key
      await expect(page.locator('text*=error, text*=API key, text*=check your API key')).toBeVisible({ timeout: 10000 });
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: 'test-results/conversation-api-key-error.png',
        fullPage: true 
      });
      
      console.log('✅ Conversation UI flow completed successfully');
      console.log('❌ API key validation working as expected (invalid key rejected)');
      console.log('   Add TEST_OPENAI_API_KEY to .env file for full testing');
      
      // Test passed - UI flow works, API validation works
      return;
    }
    
    // With valid API key, expect a real response
    await expect(aiResponseLocator).toBeVisible({ timeout: 30000 });
    
    // Get the AI response text
    const responseText = await aiResponseLocator.textContent();
    
    // Verify we got a reasonable response
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(0);
    
    // For our specific test message, expect the AI to follow instructions
    if (responseText!.toLowerCase().includes('hello from the test')) {
      console.log('✅ AI responded correctly to test instruction');
    } else {
      console.log(`ℹ️  AI response: "${responseText}"`);
      console.log('ℹ️  AI may not have followed exact instruction, but responded successfully');
    }
    
    // Verify message input is cleared after sending
    await expect(messageInput).toHaveValue('');
    
    // Verify we can send another message
    await messageInput.fill('What is 2 + 2?');
    await sendButton.click();
    
    // Wait for second response
    await expect(page.locator('.message, [data-role="assistant"]').nth(1)).toBeVisible({ timeout: 30000 });
    
    // Take screenshot of successful conversation
    await page.screenshot({ 
      path: 'test-results/successful-conversation.png',
      fullPage: true 
    });
    
    console.log('✅ Complete conversation flow successful');
  });
  
  test('conversation UI elements and interactions', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Test all UI elements are present
    await expect(page.locator('h1:has-text("caw caw")')).toBeVisible();
    await expect(page.locator('text=Start a conversation with AI')).toBeVisible();
    await expect(page.locator('input[placeholder*="Type your message"]')).toBeVisible();
    
    // Test Model Context Protocol button
    const mcpButton = page.locator('button:has-text("Model Context Protocol")');
    await expect(mcpButton).toBeVisible();
    // Note: Don't click MCP button unless we have MCP servers configured
    
    // Test model selector
    const modelSelector = page.locator('text=gpt-4o-mini');
    await expect(modelSelector).toBeVisible();
    
    // Test microphone button (if present)
    const micButton = page.locator('button:has([alt*="Mic"], button:has-text("Mic"))');
    if (await micButton.isVisible()) {
      await expect(micButton).toBeVisible();
    }
    
    // Test send button states
    const sendButton = page.locator('form button, button:near(input)').last();
    
    // Should be disabled when empty
    await expect(sendButton).toBeDisabled();
    
    // Should be enabled when message is typed
    await page.fill('input[placeholder*="Type your message"]', 'test');
    await expect(sendButton).toBeEnabled();
    
    // Clear message - should be disabled again
    await page.fill('input[placeholder*="Type your message"]', '');
    await expect(sendButton).toBeDisabled();
  });
  
  test('settings integration', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Open settings
    await page.click('button:has(img):near(h1)');
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Test all tabs are present
    await expect(page.locator('tab:has-text("LLM Provider")')).toBeVisible();
    await expect(page.locator('tab:has-text("Tools & MCP")')).toBeVisible();
    await expect(page.locator('tab:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('tab:has-text("Debug")')).toBeVisible();
    
    // Test LLM Provider tab (should be default)
    await expect(page.locator('text=OpenAI Configuration')).toBeVisible();
    await expect(page.locator('input[placeholder*="sk-"]')).toBeVisible();
    
    // Test model info display
    await expect(page.locator('text=GPT-4o Mini')).toBeVisible();
    await expect(page.locator('text=Fast & Cost-effective')).toBeVisible();
    
    // Test API key input functionality
    const apiKeyInput = page.locator('input[placeholder*="sk-"]');
    const currentValue = await apiKeyInput.inputValue();
    
    // Clear and type new value
    await apiKeyInput.clear();
    await apiKeyInput.fill('sk-test-new-key');
    await expect(apiKeyInput).toHaveValue('sk-test-new-key');
    
    // Restore original value if there was one
    if (currentValue) {
      await apiKeyInput.clear();
      await apiKeyInput.fill(currentValue);
    }
    
    // Close settings
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=Settings')).not.toBeVisible();
  });
});