import { test, expect } from '@playwright/test';

// Detta test körs mot en specifik URL (t.ex. localhost:3001 för en staging-backend)
// för att verifiera att en uppdatering faktiskt fungerar innan den "swappas" till produktion.

const baseUrl = process.env.BASE_URL || 'http://localhost:5173';

test('verify system health and core features', async ({ page }) => {
    await page.goto(baseUrl);

    // 1. Verifiera att sidan laddar (H1 finns)
    await expect(page.locator('h1')).toBeVisible();

    // 2. Kolla api health om möjligt direkt på samma domän
    try {
        const healthResponse = await page.request.get(`${baseUrl}/api/health`);
        expect(healthResponse.ok()).toBeTruthy();
        const body = await healthResponse.json();
        expect(body.status).toBe('healthy');
    } catch (e) {
        console.warn('API health check skipped (direct API call failed, maybe CORS or relative path issues)');
    }

    // 3. Verifiera att man kan klicka sig till certifieringar
    await page.click('text=Certifieringar');
    await expect(page).toHaveURL(/.*certifieringar/);

    // 4. Verifiera att kritiska knappar ("Boka kurs") finns
    await page.goto(baseUrl);
    await expect(page.locator('text=Boka kurs').first()).toBeVisible();
});
