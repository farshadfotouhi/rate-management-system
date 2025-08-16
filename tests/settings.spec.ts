import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Settings Page', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL(BASE_URL + '/');
  });

  test('should navigate to settings page', async ({ page }) => {
    // Click on Settings in sidebar
    await page.click('text=Settings');
    
    // Should be on settings page
    await expect(page).toHaveURL(`${BASE_URL}/settings`);
    await expect(page.locator('h4:has-text("Settings")')).toBeVisible();
  });

  test('should display all settings tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    
    // Check for all tabs
    await expect(page.locator('button[role="tab"]:has-text("Assistant")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Profile")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Security")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Notifications")')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    
    // Click Profile tab
    await page.click('button[role="tab"]:has-text("Profile")');
    await expect(page.locator('h6:has-text("Profile Information")')).toBeVisible();
    
    // Click Security tab
    await page.click('button[role="tab"]:has-text("Security")');
    await expect(page.locator('h6:has-text("Change Password")')).toBeVisible();
    
    // Click Notifications tab
    await page.click('button[role="tab"]:has-text("Notifications")');
    await expect(page.locator('h6:has-text("Notification Preferences")')).toBeVisible();
    
    // Click back to Assistant tab
    await page.click('button[role="tab"]:has-text("Assistant")');
    await expect(page.locator('h6:has-text("Assistant Instructions")')).toBeVisible();
  });

  test('should display assistant settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    
    // Should be on Assistant tab by default
    await expect(page.locator('h6:has-text("Assistant Instructions")')).toBeVisible();
    
    // Check for instructions textarea
    const instructionsTextarea = page.locator('textarea[placeholder*="Enter custom instructions"]');
    await expect(instructionsTextarea).toBeVisible();
    
    // Should have some default text
    const instructionsValue = await instructionsTextarea.inputValue();
    expect(instructionsValue).toContain('expert rate manager');
    
    // Check for save button
    await expect(page.locator('button:has-text("Save Assistant Settings")')).toBeVisible();
  });

  test('should update assistant instructions', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    
    const instructionsTextarea = page.locator('textarea[placeholder*="Enter custom instructions"]');
    
    // Clear and add new instructions
    await instructionsTextarea.clear();
    await instructionsTextarea.fill('Updated instructions for testing purposes.');
    
    // Click save
    await page.click('button:has-text("Save Assistant Settings")');
    
    // Should show success message
    await expect(page.locator('[role="alert"]:has-text("success")')).toBeVisible({ timeout: 5000 });
  });

  test('should display profile settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.click('button[role="tab"]:has-text("Profile")');
    
    // Check for profile fields
    await expect(page.locator('input[label*="First Name" i]')).toBeVisible();
    await expect(page.locator('input[label*="Last Name" i]')).toBeVisible();
    await expect(page.locator('input[label*="Email" i]')).toBeVisible();
    
    // Email should be disabled
    const emailInput = page.locator('input[label*="Email" i]');
    await expect(emailInput).toBeDisabled();
    
    // Check for save button
    await expect(page.locator('button:has-text("Save Profile")')).toBeVisible();
  });

  test('should display security settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.click('button[role="tab"]:has-text("Security")');
    
    // Check for password fields
    await expect(page.locator('input[label*="Current Password" i]')).toBeVisible();
    await expect(page.locator('input[label*="New Password" i]')).toBeVisible();
    await expect(page.locator('input[label*="Confirm New Password" i]')).toBeVisible();
    
    // All should be password type
    const passwordInputs = page.locator('input[type="password"]');
    expect(await passwordInputs.count()).toBe(3);
    
    // Check for save button
    await expect(page.locator('button:has-text("Change Password")')).toBeVisible();
  });

  test('should validate password change', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.click('button[role="tab"]:has-text("Security")');
    
    // Fill in mismatched passwords
    await page.fill('input[label*="Current Password" i]', 'Admin123!@#');
    await page.fill('input[label*="New Password" i]', 'NewPassword123!');
    await page.fill('input[label*="Confirm New Password" i]', 'DifferentPassword123!');
    
    // Try to save
    await page.click('button:has-text("Change Password")');
    
    // Should show error about passwords not matching
    await expect(page.locator('[role="alert"]:has-text(/not match|do not match/i)')).toBeVisible({ timeout: 5000 });
  });

  test('should display notification settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.click('button[role="tab"]:has-text("Notifications")');
    
    // Check for notification switches
    await expect(page.locator('text=Email Notifications')).toBeVisible();
    await expect(page.locator('text=Chat Response Notifications')).toBeVisible();
    await expect(page.locator('text=Contract Expiry Alerts')).toBeVisible();
    
    // Check for switches
    const switches = page.locator('input[type="checkbox"][role="switch"]');
    expect(await switches.count()).toBeGreaterThanOrEqual(3);
    
    // Check for save button
    await expect(page.locator('button:has-text("Save Notification Settings")')).toBeVisible();
  });

  test('should toggle notification settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.click('button[role="tab"]:has-text("Notifications")');
    
    // Find the first switch
    const firstSwitch = page.locator('input[type="checkbox"][role="switch"]').first();
    
    // Get initial state
    const initialState = await firstSwitch.isChecked();
    
    // Toggle it
    await firstSwitch.click();
    
    // Verify it toggled
    const newState = await firstSwitch.isChecked();
    expect(newState).toBe(!initialState);
    
    // Save
    await page.click('button:has-text("Save Notification Settings")');
    
    // Should show success message
    await expect(page.locator('[role="alert"]:has-text("success")')).toBeVisible({ timeout: 5000 });
  });
});