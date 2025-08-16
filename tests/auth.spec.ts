import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3000';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    
    // Check for login form elements
    await expect(page.locator('h1:has-text("Rate Management System")')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill in login form
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    
    // Click sign in button
    await page.click('button:has-text("Sign In")');
    
    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // Check for dashboard elements
    await expect(page.locator('text=/Welcome back/')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Fill in invalid credentials
    await page.fill('input[name="email"]', 'invalid@email.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Click sign in button
    await page.click('button:has-text("Sign In")');
    
    // Should show error message - wait for either Alert component or error text
    await expect(page.locator('.MuiAlert-root, text=/Invalid credentials|Login failed/')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // Click on profile icon button - look for the avatar/icon button
    await page.click('button:has(.MuiAvatar-root)');
    
    // Click logout in dropdown menu
    await page.click('li:has-text("Logout")');
    
    // Should redirect to login page
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});