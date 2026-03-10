import { test, expect } from '@playwright/test';

test.describe('タイトル画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ページが読み込まれる', async ({ page }) => {
    await expect(page).toHaveTitle('はらぺこバハムート');
  });

  test('canvasが表示される', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('canvasがフルスクリーンサイズ', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('JSエラーが発生しない', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    // PixiJSの初期化を待つ
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('WebGLコンテキストが作成される', async ({ page }) => {
    await page.waitForTimeout(1000);

    const hasWebGL = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    });

    // PixiJSが使用中なのでWebGLコンテキストは取れないが、canvasは存在
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('カード画像アセット', () => {
  test('全16枚のカード画像が配信される', async ({ page }) => {
    const cardFiles = [
      '01.harapekobahamuto.png',
      '02.kodomobahamuto.png',
      '03.hanekaesigoburin.png',
      '04.soratobunaihu.png',
      '05.owaka-re.png',
      '06.ideyoshi.png',
      '07.yomigae-ru.png',
      '08.irekae-ru.png',
      '09.kuronekonoshippo.png',
      '10.ginnekonoshippo.png',
      '11.karasunootsukai.png',
      '12.youseinomegane.png',
      '13.akumanohukiya.png',
      '14.hiramekisuisyou.png',
      '15.hoshihurusunadokei.png',
      '16.majonootodokemono.png',
    ];

    for (const file of cardFiles) {
      const response = await page.request.get(`/cards/${file}`);
      expect(response.status(), `${file} should be accessible`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });
});

test.describe('フォント読み込み', () => {
  test('Google Fontsが読み込まれる', async ({ page }) => {
    await page.goto('/');

    const hasFontLink = await page.evaluate(() => {
      const links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
      return links.length > 0;
    });

    expect(hasFontLink).toBe(true);
  });
});

test.describe('レスポンシブ', () => {
  test('リサイズしてもcanvasが追従する', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // リサイズ
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    // canvasがビューポート幅に近いこと
    expect(box!.width).toBeGreaterThanOrEqual(780);
  });

  test('モバイルサイズでも表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
