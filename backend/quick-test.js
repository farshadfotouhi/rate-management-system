const { chromium } = require('playwright');

async function quickTest() {
  console.log('Testing fixed chat interface...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login and navigate to chat
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"], input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForLoadState('networkidle');
    
    await page.goto('http://localhost:3002/chat');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Logged in and navigated to chat');

    // Create new session
    const addButton = await page.locator('button:has-text("+"), button[title="New Chat"]').first();
    await addButton.click();
    await page.waitForTimeout(2000);
    
    console.log('✓ Created new session');

    // Send test message
    const testMessage = 'What shipping rates do you have from CNSHA to USLAX?';
    const inputField = await page.locator('textarea[placeholder*="Ask"], textarea').first();
    await inputField.fill(testMessage);
    
    const sendButton = await page.locator('button:has([data-testid="SendIcon"])').first();
    await sendButton.click();
    
    console.log('✓ Sent test message');
    console.log('⏳ Waiting for response (max 20 seconds)...');
    
    // Wait for loading indicator to appear
    await page.waitForSelector('[role="progressbar"], .MuiCircularProgress-root', { timeout: 5000 });
    console.log('✓ Loading indicator appeared');
    
    // Wait for response with longer timeout
    try {
      await page.waitForSelector('[role="assistant"], .assistant-message, Card:has-text("I")', { timeout: 20000 });
      console.log('✅ Assistant responded successfully!');
    } catch (e) {
      console.log('⚠️ No assistant response yet, checking for fallback/error message...');
      
      // Check for fallback or error message
      const messages = await page.locator('Card').count();
      console.log(`Total message cards: ${messages}`);
      
      // Check if we have system error message
      const systemMessages = await page.locator('Card:has-text("apologize"), Card:has-text("connectivity"), Card:has-text("error")').count();
      if (systemMessages > 0) {
        console.log('✅ Fallback error message displayed correctly');
      } else {
        console.log('❌ No response or error message shown');
      }
    }
    
    // Check loading state
    const stillLoading = await page.locator('[role="progressbar"], .MuiCircularProgress-root').isVisible();
    console.log(`Loading indicator still visible: ${stillLoading}`);
    
    console.log('\n=== Test completed ===');
    console.log('The chat interface should now handle timeouts and errors gracefully.');
    
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);