import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Dashboard Navigation', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL(BASE_URL + '/');
  });

  test('Quick Actions - should navigate to chat', async ({ page }) => {
    // Click on "Start a new chat session"
    await page.click('text=Start a new chat session');
    
    // Should navigate to chat page
    await expect(page).toHaveURL(`${BASE_URL}/chat`);
    await expect(page.locator('h5:has-text("Rate Management Assistant")')).toBeVisible();
  });

  test('Quick Actions - should navigate to contracts for upload', async ({ page }) => {
    // Click on "Upload a new contract"
    await page.click('text=Upload a new contract');
    
    // Should navigate to contracts page
    await expect(page).toHaveURL(`${BASE_URL}/contracts`);
    await expect(page.locator('h4:has-text("Contract Management")')).toBeVisible();
  });

  test('Quick Actions - should navigate to contracts for viewing', async ({ page }) => {
    // Click on "View all contracts"
    await page.click('text=View all contracts');
    
    // Should navigate to contracts page
    await expect(page).toHaveURL(`${BASE_URL}/contracts`);
    await expect(page.locator('h4:has-text("Contract Management")')).toBeVisible();
  });

  test('Quick Actions - should navigate to settings', async ({ page }) => {
    // Click on "Configure assistant settings"
    await page.click('text=Configure assistant settings');
    
    // Should navigate to settings page
    await expect(page).toHaveURL(`${BASE_URL}/settings`);
    await expect(page.locator('h4:has-text("Settings")')).toBeVisible();
    
    // Should be on Assistant tab by default
    await expect(page.locator('h6:has-text("Assistant Instructions")')).toBeVisible();
  });
});