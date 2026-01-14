import { test, expect } from '@playwright/test';

test('add', async ({ page }) => {
  await page.goto('https://juejin.cn/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/稀土掘金/);
});

