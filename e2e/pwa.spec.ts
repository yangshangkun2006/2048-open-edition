import { expect, test } from '@playwright/test';

test('manifest is linked and valid', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const manifest = await page.evaluate(async () => {
    const res = await fetch('/manifest.webmanifest');
    return res.json() as Promise<{ name: string; display: string; icons: unknown[] }>;
  });
  expect(manifest.name).toBe('2048 Open Edition');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test('service worker registers and serves the app offline', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg && !!reg.active && !!navigator.serviceWorker.controller;
    },
    undefined,
    { timeout: 15_000 },
  );
  // Give the runtime cache a moment to capture the hashed assets.
  await page.waitForTimeout(500);

  await page.context().setOffline(true);
  await page.reload();
  // #board carries aria-hidden (AT reads #board-sr), so probe via elements
  // outside it: the game must have booted and rendered tiles.
  await expect(page.locator('#score')).toBeVisible();
  const tileCount = await page.locator('.tile').count();
  expect(tileCount).toBe(2);
  await page.context().setOffline(false);
});

test('CSP meta is present in the production build', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
});
