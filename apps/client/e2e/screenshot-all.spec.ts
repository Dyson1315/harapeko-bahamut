import { test } from '@playwright/test';

const WS_URL = 'ws://localhost:8787';

async function waitForApp(page: any) {
  await page.goto('/');
  await page.waitForTimeout(3000);
}

async function switchScene(page: any, name: string, data?: any) {
  await page.evaluate(({ name, data }: any) => {
    const fn = (window as any).__switchScene;
    if (typeof fn === 'function') fn(name, data);
  }, { name, data });
  await page.waitForTimeout(1500);
}

// ===== タイトル画面 =====
test('タイトル画面 - PC', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForApp(page);
  await page.screenshot({ path: 'e2e/screenshots/title-pc.png' });
});

test('タイトル画面 - モバイル', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await waitForApp(page);
  await page.screenshot({ path: 'e2e/screenshots/title-mobile.png' });
});

// ===== マッチメイキング画面 =====
test('マッチメイキング画面 - PC', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForApp(page);
  await switchScene(page, 'matchmaking', {
    playerId: 'ss-p1',
    playerName: 'テストプレイヤー',
  });
  await page.screenshot({ path: 'e2e/screenshots/matchmaking-pc.png' });
});

test('マッチメイキング画面 - モバイル', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await waitForApp(page);
  await switchScene(page, 'matchmaking', {
    playerId: 'ss-p1',
    playerName: 'テストプレイヤー',
  });
  await page.screenshot({ path: 'e2e/screenshots/matchmaking-mobile.png' });
});

// ===== バトル画面 =====
test('バトル画面 - PC', async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForApp(page);

  const roomId = `ss-battle-pc-${Date.now()}`;

  // バトルシーンに切替（サーバーに接続して相手待ち状態）
  await switchScene(page, 'battle', {
    roomId,
    playerId: 'ss-p1',
    playerName: 'プレイヤー1',
  });

  // サーバーに2人目を接続してゲーム開始
  await page.evaluate(async ({ wsUrl, roomId }: any) => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=ss-p2&playerName=${encodeURIComponent('プレイヤー2')}`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'gameState' && msg.data?.gameStarted) {
          // P2がモンスター召喚
          const self = msg.data.players['ss-p2'];
          if (self?.hand && msg.data.currentTurn === 'ss-p2' && self.playedCount === 0) {
            const monster = self.hand.find((c: any) => c.type === 'monster' && !c.canOnlyBeSummoned);
            if (monster) {
              ws.send(JSON.stringify({ type: 'playCard', data: { cardId: monster.id } }));
            }
          }
          setTimeout(() => { ws.close(); resolve(); }, 500);
        }
      };
      setTimeout(() => { ws.close(); resolve(); }, 5000);
    });
  }, { wsUrl: WS_URL, roomId });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/battle-pc.png' });
});

test('バトル画面 - モバイル', async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 375, height: 667 });
  await waitForApp(page);

  const roomId = `ss-battle-mob-${Date.now()}`;
  await switchScene(page, 'battle', {
    roomId,
    playerId: 'ss-p1',
    playerName: 'プレイヤー1',
  });

  await page.evaluate(async ({ wsUrl, roomId }: any) => {
    return new Promise<void>((resolve) => {
      const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=ss-p2&playerName=${encodeURIComponent('プレイヤー2')}`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'gameState' && msg.data?.gameStarted) {
          const self = msg.data.players['ss-p2'];
          if (self?.hand && msg.data.currentTurn === 'ss-p2' && self.playedCount === 0) {
            const monster = self.hand.find((c: any) => c.type === 'monster' && !c.canOnlyBeSummoned);
            if (monster) {
              ws.send(JSON.stringify({ type: 'playCard', data: { cardId: monster.id } }));
            }
          }
          setTimeout(() => { ws.close(); resolve(); }, 500);
        }
      };
      setTimeout(() => { ws.close(); resolve(); }, 5000);
    });
  }, { wsUrl: WS_URL, roomId });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/battle-mobile.png' });
});

// ===== リザルト画面 =====
test('リザルト画面（勝利） - PC', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForApp(page);
  await switchScene(page, 'result', { isWin: true, winnerName: 'プレイヤー1' });
  await page.screenshot({ path: 'e2e/screenshots/result-win-pc.png' });
});

test('リザルト画面（敗北） - PC', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitForApp(page);
  await switchScene(page, 'result', { isWin: false, winnerName: 'プレイヤー2' });
  await page.screenshot({ path: 'e2e/screenshots/result-lose-pc.png' });
});

test('リザルト画面（勝利） - モバイル', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await waitForApp(page);
  await switchScene(page, 'result', { isWin: true, winnerName: 'プレイヤー1' });
  await page.screenshot({ path: 'e2e/screenshots/result-mobile.png' });
});

test('リザルト画面（敗北） - モバイル', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await waitForApp(page);
  await switchScene(page, 'result', { isWin: false, winnerName: 'プレイヤー2' });
  await page.screenshot({ path: 'e2e/screenshots/result-lose-mobile.png' });
});
