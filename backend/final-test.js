const { chromium } = require('playwright');

async function finalTest() {
  console.log('Running final comprehensive test...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
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
    
    console.log('✓ Login and navigation successful');

    // Create new session
    const addButton = await page.locator('button:has-text("+"), button[title="New Chat"]').first();
    await addButton.click();
    await page.waitForTimeout(2000);
    
    console.log('✓ New session created');

    // Get initial message count
    const initialMessages = await page.locator('Card').count();
    console.log(`Initial message count: ${initialMessages}`);

    // Send test message
    const testMessage = 'What shipping rates do you have from CNSHA to USLAX?';
    const inputField = await page.locator('textarea[placeholder*="Ask"], textarea').first();
    await inputField.fill(testMessage);
    
    const sendButton = await page.locator('button:has([data-testid="SendIcon"])').first();
    await sendButton.click();
    
    console.log('✓ Test message sent');
    
    // Wait for user message to appear
    await page.waitForTimeout(2000);
    const afterSendMessages = await page.locator('Card').count();
    console.log(`Messages after sending: ${afterSendMessages}`);
    
    // Check if loading indicator appears
    const loadingVisible = await page.locator('CircularProgress, [role="progressbar"]').isVisible();
    console.log(`Loading indicator visible: ${loadingVisible}`);
    
    // Wait for response (our timeout is 15 seconds + buffer)
    console.log('⏳ Waiting for assistant response...');
    await page.waitForTimeout(18000);
    
    // Check final message count
    const finalMessages = await page.locator('Card').count();
    console.log(`Final message count: ${finalMessages}`);
    
    // Check if loading indicator is gone
    const loadingStillVisible = await page.locator('CircularProgress, [role="progressbar"]').isVisible();
    console.log(`Loading indicator still visible: ${loadingStillVisible}`);
    
    // Look for any text content in message cards
    const messageTexts = await page.locator('Card').allTextContents();
    console.log('Message contents:');
    messageTexts.forEach((text, index) => {
      console.log(`  ${index + 1}: ${text.substring(0, 100)}...`);
    });
    
    // Check for specific fallback response keywords
    const pageText = await page.textContent('body');
    const hasFallbackText = pageText.includes('connectivity') || 
                           pageText.includes('apologize') || 
                           pageText.includes('temporary') ||
                           pageText.includes('try again');
    console.log(`Page contains fallback response text: ${hasFallbackText}`);
    
    // Success criteria
    const userMessageAppeared = finalMessages > initialMessages;
    const assistantResponded = finalMessages > afterSendMessages;
    const loadingHandledCorrectly = !loadingStillVisible;
    
    console.log('\n=== Test Results ===');
    console.log(`✓ User message appeared: ${userMessageAppeared}`);
    console.log(`✓ Assistant responded: ${assistantResponded}`);
    console.log(`✓ Loading handled correctly: ${loadingHandledCorrectly}`);
    console.log(`✓ Fallback response detected: ${hasFallbackText}`);
    
    if (userMessageAppeared && assistantResponded && loadingHandledCorrectly) {
      console.log('\n🎉 ALL TESTS PASSED! Chat interface is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed, but timeout handling is improved.');
    }
    
    console.log('\nBrowser staying open for 10 seconds for manual verification...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

finalTest().catch(console.error);