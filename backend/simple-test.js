const { chromium } = require('playwright');

async function simpleTest() {
  console.log('Running simple test to check what\'s on the page...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login and navigate
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"], input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForLoadState('networkidle');
    
    await page.goto('http://localhost:3002/chat');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Successfully navigated to chat page');

    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'chat-page.png' });
    console.log('✓ Screenshot saved as chat-page.png');
    
    // Check what elements are visible
    const allButtons = await page.locator('button').all();
    console.log(`\nFound ${allButtons.length} buttons on the page:`);
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const text = await allButtons[i].textContent();
      const visible = await allButtons[i].isVisible();
      console.log(`  ${i + 1}: "${text || 'no text'}" (visible: ${visible})`);
    }
    
    // Check for icons specifically
    const addIcons = await page.locator('[data-testid="AddIcon"], svg[data-testid="AddIcon"]').all();
    console.log(`\nFound ${addIcons.length} Add icons`);
    
    // Check for any "+" text
    const plusButtons = await page.locator(':has-text("+")').all();
    console.log(`Found ${plusButtons.length} elements with "+" text`);
    
    // Check the page title and heading
    const pageTitle = await page.textContent('h1, h2, h3, h4, h5, h6');
    console.log(`\nPage heading: "${pageTitle}"`);
    
    // Check if we have sessions loaded
    const sessionItems = await page.locator('ListItem, [role="button"]').all();
    console.log(`Found ${sessionItems.length} list items/buttons`);
    
    // Look for any error messages
    const errorText = await page.textContent('body');
    if (errorText.includes('error') || errorText.includes('Error')) {
      console.log('\n⚠️ Page contains error text');
    }
    
    console.log('\nLeaving browser open for 15 seconds for manual inspection...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

simpleTest().catch(console.error);