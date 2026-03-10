import { test } from '@playwright/test';

test('タイトル画面のスクリーンショット', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/title.png', fullPage: true });
});
