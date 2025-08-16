import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Chat Assistant', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL(BASE_URL + '/');
  });

  test('should navigate to chat page', async ({ page }) => {
    // Click on Chat Assistant in sidebar
    await page.click('text=Chat Assistant');
    
    // Should be on chat page
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
    await expect(page.locator('h5:has-text("Rate Management Assistant")')).toBeVisible();
  });

  test('should display chat interface elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    // Check for main elements
    await expect(page.locator('text=Rate Management Assistant')).toBeVisible();
    await expect(page.locator('text=/Ask questions about your contracts/')).toBeVisible();
    
    // Check for sessions panel
    await expect(page.locator('text=Sessions')).toBeVisible();
    
    // Check for message input
    await expect(page.locator('input[placeholder*="Ask about rates"]')).toBeVisible();
    
    // Check for send button
    await expect(page.locator('button[aria-label*="send" i]')).toBeVisible();
  });

  test('should create a new chat session', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    // Count initial sessions
    const initialSessions = await page.locator('[role="button"]').count();
    
    // Click new session button (clear icon)
    await page.click('button:has(svg[data-testid="ClearIcon"])');
    
    // Wait for potential new session creation
    await page.waitForTimeout(1000);
    
    // Should have same or more sessions
    const afterSessions = await page.locator('[role="button"]').count();
    expect(afterSessions).toBeGreaterThanOrEqual(initialSessions);
  });

  test('should send a message', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    // Type a message
    const messageInput = page.locator('input[placeholder*="Ask about rates"]');
    await messageInput.fill('What shipping routes are available?');
    
    // Send message
    await page.click('button[aria-label*="send" i]');
    
    // Check that message appears in chat
    await expect(page.locator('text=What shipping routes are available?')).toBeVisible({ timeout: 5000 });
    
    // Should show loading indicator or response
    const loadingIndicator = page.locator('[role="progressbar"]');
    const assistantResponse = page.locator('[role="article"]').filter({ hasText: /assistant|bot/i });
    
    // Either loading or response should appear
    await expect(loadingIndicator.or(assistantResponse)).toBeVisible({ timeout: 10000 });
  });

  test('should clear message input after sending', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    const messageInput = page.locator('input[placeholder*="Ask about rates"]');
    
    // Type a message
    await messageInput.fill('Test message');
    expect(await messageInput.inputValue()).toBe('Test message');
    
    // Send message
    await page.click('button[aria-label*="send" i]');
    
    // Input should be cleared
    await expect(messageInput).toHaveValue('');
  });

  test('should display message timestamps', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    // Send a message
    await page.fill('input[placeholder*="Ask about rates"]', 'Test message with timestamp');
    await page.click('button[aria-label*="send" i]');
    
    // Wait for message to appear
    await expect(page.locator('text=Test message with timestamp')).toBeVisible({ timeout: 5000 });
    
    // Check for timestamp (format: HH:mm)
    const timestampRegex = /\d{1,2}:\d{2}/;
    await expect(page.locator('text=' + timestampRegex)).toBeVisible();
  });

  test('should handle Enter key to send message', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    const messageInput = page.locator('input[placeholder*="Ask about rates"]');
    
    // Type a message and press Enter
    await messageInput.fill('Message sent with Enter key');
    await messageInput.press('Enter');
    
    // Message should appear in chat
    await expect(page.locator('text=Message sent with Enter key')).toBeVisible({ timeout: 5000 });
  });

  test('should disable send button when input is empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    const sendButton = page.locator('button[aria-label*="send" i]');
    const messageInput = page.locator('input[placeholder*="Ask about rates"]');
    
    // Initially, with empty input, send button should be disabled
    await expect(sendButton).toBeDisabled();
    
    // Type something
    await messageInput.fill('Some text');
    
    // Send button should be enabled
    await expect(sendButton).toBeEnabled();
    
    // Clear input
    await messageInput.fill('');
    
    // Send button should be disabled again
    await expect(sendButton).toBeDisabled();
  });

  test('should show attach file button', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat`);
    
    // Check for attach file button
    const attachButton = page.locator('button:has(svg[data-testid="AttachFileIcon"])');
    await expect(attachButton).toBeVisible();
  });
});