const { chromium } = require('playwright');

async function detailedChatTest() {
  console.log('Starting detailed chat interface tests...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const issues = [];

  try {
    // Test 1: Login and navigation
    console.log('\n=== Test 1: Login and Navigation ===');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.fill('input[type="email"], input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForLoadState('networkidle');
    
    // Navigate to chat
    await page.goto('http://localhost:3002/chat');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Successfully navigated to chat page');

    // Test 2: Check initial state
    console.log('\n=== Test 2: Initial State Check ===');
    
    // Check if sessions are loaded
    const sessionsList = await page.locator('[role="button"]:has-text("Chat"), ListItem').count();
    console.log(`Initial sessions count: ${sessionsList}`);
    
    // Check if new chat button is present
    const addButton = await page.locator('button:has-text("+"), button[title="New Chat"]').first();
    const addButtonVisible = await addButton.isVisible();
    console.log(`Add button visible: ${addButtonVisible}`);
    
    if (!addButtonVisible) {
      issues.push('New chat button (+) is not visible or accessible');
    }

    // Test 3: Create new session and check for proper initialization
    console.log('\n=== Test 3: New Session Creation ===');
    
    if (addButtonVisible) {
      await addButton.click();
      await page.waitForTimeout(2000);
      
      // Check if a new session was added
      const newSessionsList = await page.locator('[role="button"]:has-text("Chat"), ListItem').count();
      console.log(`Sessions after creation: ${newSessionsList}`);
      
      if (newSessionsList <= sessionsList) {
        issues.push('New session was not properly created or added to the list');
      }
      
      // Check if input field is available
      const inputField = await page.locator('textarea[placeholder*="Ask"], textarea').first();
      const inputVisible = await inputField.isVisible();
      console.log(`Input field visible: ${inputVisible}`);
      
      if (!inputVisible) {
        issues.push('Message input field is not visible after creating a new session');
      }
    }

    // Test 4: Message sending with timeout check
    console.log('\n=== Test 4: Message Sending ===');
    
    const testMessage = 'What are the main features of this rate management system?';
    const inputField = await page.locator('textarea[placeholder*="Ask"], textarea').first();
    
    if (await inputField.isVisible()) {
      await inputField.fill(testMessage);
      
      // Check send button state
      const sendButton = await page.locator('button:has([data-testid="SendIcon"]), button:has-text("Send")').first();
      const sendButtonEnabled = await sendButton.isEnabled();
      console.log(`Send button enabled: ${sendButtonEnabled}`);
      
      if (!sendButtonEnabled) {
        issues.push('Send button is not enabled after typing message');
      }
      
      // Send message
      await sendButton.click();
      
      // Wait for user message to appear
      await page.waitForTimeout(1000);
      const userMessages = await page.locator('[role="user"], .user-message, [data-role="user"]').count();
      console.log(`User messages visible: ${userMessages}`);
      
      // Wait for loading indicator
      console.log('Waiting for assistant response...');
      await page.waitForTimeout(5000);
      
      // Check for loading state
      const loadingIndicator = await page.locator('CircularProgress, .loading, [role="progressbar"]').isVisible();
      console.log(`Loading indicator visible: ${loadingIndicator}`);
      
      // Wait for response (give it more time)
      await page.waitForTimeout(10000);
      
      // Check for assistant response
      const assistantMessages = await page.locator('[role="assistant"], .assistant-message, [data-role="assistant"]').count();
      console.log(`Assistant messages visible: ${assistantMessages}`);
      
      if (assistantMessages === 0) {
        issues.push('Assistant did not respond to the message within reasonable time');
      }
      
      // Check for error messages
      const errorMessages = await page.locator(':has-text("error"), :has-text("failed"), :has-text("Sorry"), [role="system"]').count();
      if (errorMessages > 0) {
        issues.push('Error message detected in chat');
      }
    }

    // Test 5: Session management
    console.log('\n=== Test 5: Session Management ===');
    
    // Check delete button functionality
    const deleteButtons = await page.locator('button:has([data-testid="DeleteIcon"]), IconButton:has(DeleteIcon)').count();
    console.log(`Delete buttons found: ${deleteButtons}`);
    
    if (deleteButtons > 0) {
      const initialSessions = await page.locator('[role="button"]:has-text("Chat"), ListItem').count();
      
      // Click first delete button
      const firstDeleteButton = await page.locator('button:has([data-testid="DeleteIcon"]), IconButton:has(DeleteIcon)').first();
      await firstDeleteButton.click();
      
      // Handle confirmation if it appears
      await page.waitForTimeout(1000);
      try {
        await page.click('button:has-text("OK"), button:has-text("Yes"), button:has-text("Delete")');
      } catch (e) {
        // No confirmation dialog
      }
      
      await page.waitForTimeout(2000);
      
      const finalSessions = await page.locator('[role="button"]:has-text("Chat"), ListItem').count();
      console.log(`Sessions after deletion: ${finalSessions}`);
      
      if (finalSessions >= initialSessions) {
        issues.push('Session deletion did not properly remove session from list');
      }
    } else {
      issues.push('No delete buttons found for session management');
    }

    // Test 6: UI Responsiveness
    console.log('\n=== Test 6: UI Responsiveness ===');
    
    // Test rapid clicking of new session button
    if (await addButton.isVisible()) {
      console.log('Testing rapid session creation...');
      await addButton.click();
      await page.waitForTimeout(500);
      await addButton.click();
      await page.waitForTimeout(500);
      await addButton.click();
      await page.waitForTimeout(2000);
      
      // Check if multiple sessions were created inappropriately
      const rapidSessions = await page.locator('[role="button"]:has-text("Chat"), ListItem').count();
      console.log(`Sessions after rapid clicking: ${rapidSessions}`);
    }

    // Test 7: Input validation
    console.log('\n=== Test 7: Input Validation ===');
    
    const emptyInput = await page.locator('textarea[placeholder*="Ask"], textarea').first();
    if (await emptyInput.isVisible()) {
      // Clear input and check send button state
      await emptyInput.fill('');
      const sendButtonDisabled = await page.locator('button:has([data-testid="SendIcon"])').first().isDisabled();
      console.log(`Send button disabled for empty input: ${sendButtonDisabled}`);
      
      if (!sendButtonDisabled) {
        issues.push('Send button should be disabled when input is empty');
      }
      
      // Test very long message
      const longMessage = 'A'.repeat(5000);
      await emptyInput.fill(longMessage);
      await page.waitForTimeout(1000);
      
      const inputValue = await emptyInput.inputValue();
      console.log(`Long message handled properly: ${inputValue.length <= 5000}`);
    }

    console.log('\n=== Test Results Summary ===');
    if (issues.length === 0) {
      console.log('✅ All tests passed! No issues found.');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    console.log('\nKeeping browser open for manual inspection...');
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error('Test failed with error:', error);
    issues.push(`Test execution error: ${error.message}`);
  } finally {
    await browser.close();
    return issues;
  }
}

// Run the detailed test
detailedChatTest().then(issues => {
  if (issues.length > 0) {
    console.log('\n=== ISSUES TO FIX ===');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  }
}).catch(console.error);