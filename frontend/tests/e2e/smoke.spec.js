import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dykgaraget/);
});

test('header has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Hem' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Certifieringar' })).toBeVisible();
});

test('responsive mobile menu toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const menuToggle = page.getByRole('button', { name: 'Meny' });
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();
    await expect(page.getByRole('link', { name: 'Hem' })).toBeVisible();
});
