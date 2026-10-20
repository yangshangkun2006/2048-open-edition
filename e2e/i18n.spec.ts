import { expect, test } from '@playwright/test';

test.describe('zh locale (default)', () => {
  test('first load is fully Chinese', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('#btn-new')).toHaveText('新游戏');
    await expect(page.locator('#notice-intro')).toContainText('滑动');
  });

  test('switching to English updates all text immediately and persists', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-settings').click();
    await expect(page.locator('#overlay-settings')).toBeVisible();
    await page.locator('#set-lang').selectOption('en');
    await expect(page.locator('#btn-new')).toHaveText('New Game');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.reload();
    await expect(page.locator('#btn-new')).toHaveText('New Game');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('en locale', () => {
  test.use({ locale: 'en-US' });

  test('first load is English', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#btn-new')).toHaveText('New Game');
  });
});
