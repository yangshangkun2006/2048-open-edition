import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('axe: no critical or serious violations on the main page', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('axe: no critical or serious violations with settings open', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-settings').click();
  await expect(page.locator('#overlay-settings')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('#overlay-settings').analyze();
  const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('board has table semantics and the skip link is reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board-sr')).toHaveAttribute('role', 'table');
  await expect(page.locator('#board-sr [role="row"]')).toHaveCount(4);
  await expect(page.locator('#board-sr [role="cell"]')).toHaveCount(16);
  const skip = page.locator('.skip-link');
  await expect(skip).toHaveAttribute('href', '#board');
});

test('keyboard-only: Tab moves focus, settings opens and Esc closes', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className ?? '');
  expect(focused).toBeTruthy();
  await page.locator('#btn-settings').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-settings')).toBeHidden();
});

test('aria-live region announces moves', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  const text = await page.locator('#announcer').textContent();
  expect(text).toBeTruthy();
});
