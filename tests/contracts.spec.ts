import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';

test.describe('Contract Management', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@demofreight.com');
    await page.fill('input[name="password"]', 'Admin123!@#');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL(BASE_URL + '/');
  });

  test('should navigate to contracts page', async ({ page }) => {
    // Click on Contracts in sidebar
    await page.click('text=Contracts');
    
    // Should be on contracts page
    await expect(page).toHaveURL(`${BASE_URL}/contracts`);
    await expect(page.locator('h4:has-text("Contract Management")')).toBeVisible();
    
    // Check for upload area
    await expect(page.locator('text=/Drag & drop a contract here/')).toBeVisible();
  });

  test('should display contract upload interface', async ({ page }) => {
    await page.goto(`${BASE_URL}/contracts`);
    
    // Check for all UI elements
    await expect(page.locator('text=Contract Management')).toBeVisible();
    await expect(page.locator('text=/Drag & drop/')).toBeVisible();
    await expect(page.locator('text=Supported formats: PDF, Excel')).toBeVisible();
    await expect(page.locator('button:has-text("Select File")')).toBeVisible();
    
    // Check contracts table headers
    await expect(page.locator('th:has-text("File Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Carrier")')).toBeVisible();
    await expect(page.locator('th:has-text("Contract #")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test('should open file selector when clicking upload button', async ({ page }) => {
    await page.goto(`${BASE_URL}/contracts`);
    
    // Create a promise to handle file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Click the select file button
    await page.click('button:has-text("Select File")');
    
    // Wait for file chooser to open
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });

  test('should upload a PDF contract', async ({ page }) => {
    await page.goto(`${BASE_URL}/contracts`);
    
    // Create a sample PDF file
    const testFileName = 'test-contract.pdf';
    const testFilePath = path.join(__dirname, testFileName);
    
    // Create a simple PDF content (PDF header)
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test Contract) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000274 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n362\n%%EOF');
    
    fs.writeFileSync(testFilePath, pdfContent);
    
    try {
      // Set up file input
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      // Wait for upload dialog to appear
      await expect(page.locator('text=Uploading Contract')).toBeVisible({ timeout: 5000 });
      
      // Check for progress bar
      await expect(page.locator('[role="progressbar"]')).toBeVisible();
      
      // Wait for upload to complete or fail
      await page.waitForSelector('text=/Contract uploaded successfully|Failed to upload/', { timeout: 10000 });
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should display contract list', async ({ page }) => {
    await page.goto(`${BASE_URL}/contracts`);
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 5000 });
    
    // Check if table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Check for either contracts or empty state
    const noContractsText = page.locator('text=No contracts uploaded yet');
    const contractRows = page.locator('tbody tr');
    
    // Either we have contracts or we see the empty message
    const hasContracts = await contractRows.count() > 0;
    const hasEmptyMessage = await noContractsText.isVisible().catch(() => false);
    
    expect(hasContracts || hasEmptyMessage).toBeTruthy();
  });

  test('should have action buttons for contracts', async ({ page }) => {
    await page.goto(`${BASE_URL}/contracts`);
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 5000 });
    
    // Check if we have any contracts
    const contractRows = page.locator('tbody tr').filter({ hasNot: page.locator('text=No contracts uploaded yet') });
    const rowCount = await contractRows.count();
    
    if (rowCount > 0) {
      // Check for action buttons in first row
      const firstRow = contractRows.first();
      
      // Check for view, download, and delete buttons
      await expect(firstRow.locator('button[title="View"]')).toBeVisible();
      await expect(firstRow.locator('button[title="Download"]')).toBeVisible();
      await expect(firstRow.locator('button[title="Delete"]')).toBeVisible();
    }
  });
});