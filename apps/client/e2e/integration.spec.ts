import { test, expect } from '@playwright/test';

const SERVER_URL = 'http://localhost:8787';
const WS_URL = 'ws://localhost:8787';

test.describe('サーバーヘルスチェック', () => {
  test('ヘルスエンドポイントが応答する', async ({ request }) => {
    const res = await request.get(`${SERVER_URL}/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('harapeko-bahamut-server');
  });

  test('マッチメイキングステータスAPIが応答する', async ({ request }) => {
    const res = await request.get(`${SERVER_URL}/api/matchmaking/status`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('randomQueueSize');
    expect(body).toHaveProperty('ratingQueueSize');
  });
});

test.describe('WebSocket接続', () => {
  test('ゲームルームにWebSocket接続できる', async ({ page }) => {
    const roomId = `test-room-${Date.now()}`;
    const playerId = 'test-player-1';
    const playerName = 'テストプレイヤー1';

    // ページ内でWebSocket接続をテスト
    const result = await page.evaluate(async ({ wsUrl, roomId, playerId, playerName }) => {
      return new Promise<{ connected: boolean; messages: any[] }>((resolve) => {
        const messages: any[] = [];
        const url = `${wsUrl}/ws/${roomId}?playerId=${playerId}&playerName=${encodeURIComponent(playerName)}`;
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          ws.close();
          resolve({ connected: false, messages });
        }, 5000);

        ws.onopen = () => {
          // 接続成功
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          messages.push(msg);
          // connected と gameState を受け取ったら成功
          if (messages.length >= 2) {
            clearTimeout(timeout);
            ws.close();
            resolve({ connected: true, messages });
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({ connected: false, messages });
        };
      });
    }, { wsUrl: WS_URL, roomId, playerId, playerName });

    expect(result.connected).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);

    // connected メッセージの確認
    const connMsg = result.messages.find((m: any) => m.type === 'connected');
    expect(connMsg).toBeTruthy();
    expect(connMsg.data.playerId).toBe(playerId);
  });

  test('2人のプレイヤーが接続するとゲームが開始される', async ({ page }) => {
    const roomId = `test-room-2p-${Date.now()}`;

    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      return new Promise<{
        player1Messages: any[];
        player2Messages: any[];
        gameStarted: boolean;
      }>((resolve) => {
        const p1Messages: any[] = [];
        const p2Messages: any[] = [];
        let gameStarted = false;

        const timeout = setTimeout(() => {
          ws1.close();
          ws2.close();
          resolve({ player1Messages: p1Messages, player2Messages: p2Messages, gameStarted });
        }, 8000);

        const url1 = `${wsUrl}/ws/${roomId}?playerId=p1&playerName=${encodeURIComponent('プレイヤー1')}`;
        const ws1 = new WebSocket(url1);

        ws1.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          p1Messages.push(msg);
          checkDone();
        };

        // 少し遅延させてからプレイヤー2を接続
        setTimeout(() => {
          const url2 = `${wsUrl}/ws/${roomId}?playerId=p2&playerName=${encodeURIComponent('プレイヤー2')}`;
          const ws2Ref = new WebSocket(url2);

          ws2Ref.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            p2Messages.push(msg);
            checkDone();
          };

          (window as any).__ws2 = ws2Ref;
        }, 500);

        const ws2 = { close: () => { try { (window as any).__ws2?.close(); } catch {} } };

        function checkDone() {
          const p1HasState = p1Messages.some((m: any) => m.type === 'gameState' && m.data?.gameStarted);
          const p2HasState = p2Messages.some((m: any) => m.type === 'gameState' && m.data?.gameStarted);

          if (p1HasState && p2HasState) {
            gameStarted = true;
            clearTimeout(timeout);
            ws1.close();
            ws2.close();
            resolve({ player1Messages: p1Messages, player2Messages: p2Messages, gameStarted });
          }
        }
      });
    }, { wsUrl: WS_URL, roomId });

    expect(result.gameStarted).toBe(true);

    // ゲーム状態の検証
    const p1State = result.player1Messages.find(
      (m: any) => m.type === 'gameState' && m.data?.gameStarted
    );
    expect(p1State).toBeTruthy();

    const gameData = p1State.data;
    expect(gameData.gameStarted).toBe(true);
    expect(gameData.phase).toBe('main');
    expect(gameData.turnCount).toBe(1);
    expect(gameData.deckCount).toBe(6); // 16枚 - 5枚×2人 = 6枚
    expect(Object.keys(gameData.players)).toHaveLength(2);

    // 各プレイヤーの初期状態
    for (const player of Object.values(gameData.players) as any[]) {
      expect(player.life).toBe(4);
      expect(player.uchikeshi).toBe(2);
      expect(player.field).toHaveLength(0);
    }
  });

  test('ゲーム状態が正しくサニタイズされる（相手手札が非表示）', async ({ page }) => {
    const roomId = `test-room-sanitize-${Date.now()}`;

    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      return new Promise<{ p1State: any; p2State: any }>((resolve) => {
        let p1State: any = null;
        let p2State: any = null;

        const timeout = setTimeout(() => {
          ws1.close();
          resolve({ p1State, p2State });
        }, 8000);

        const ws1 = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p1&playerName=A`);
        let ws2Ref: WebSocket | null = null;

        ws1.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'gameState' && msg.data?.gameStarted) {
            p1State = msg.data;
            checkDone();
          }
        };

        setTimeout(() => {
          ws2Ref = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p2&playerName=B`);
          ws2Ref.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'gameState' && msg.data?.gameStarted) {
              p2State = msg.data;
              checkDone();
            }
          };
        }, 500);

        function checkDone() {
          if (p1State && p2State) {
            clearTimeout(timeout);
            ws1.close();
            ws2Ref?.close();
            resolve({ p1State, p2State });
          }
        }
      });
    }, { wsUrl: WS_URL, roomId });

    expect(result.p1State).toBeTruthy();
    expect(result.p2State).toBeTruthy();

    // プレイヤー1から見たデータ: 自分の手札はある、相手の手札はundefined
    const p1Self = result.p1State.players['p1'];
    const p1Opp = result.p1State.players['p2'];
    expect(p1Self.hand).toHaveLength(5); // 自分の手札は見える
    expect(p1Self.handCount).toBe(5);
    expect(p1Opp.hand).toBeUndefined(); // 相手の手札は見えない
    expect(p1Opp.handCount).toBe(5); // カード枚数だけわかる

    // プレイヤー2から見たデータも同様
    const p2Self = result.p2State.players['p2'];
    const p2Opp = result.p2State.players['p1'];
    expect(p2Self.hand).toHaveLength(5);
    expect(p2Opp.hand).toBeUndefined();
    expect(p2Opp.handCount).toBe(5);
  });
});

test.describe('カードプレイ', () => {
  test('カードをプレイできる', async ({ page }) => {
    const roomId = `test-room-play-${Date.now()}`;

    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      return new Promise<{
        playResult: any;
        stateAfterPlay: any;
        error: string | null;
      }>((resolve) => {
        let currentTurn: string | null = null;
        let turnPlayerHand: any[] = [];
        let stateAfterPlay: any = null;
        let error: string | null = null;
        let playResult: any = null;
        let hasSentPlay = false;

        const timeout = setTimeout(() => {
          ws1.close();
          resolve({ playResult, stateAfterPlay, error: error ?? 'timeout' });
        }, 10000);

        const ws1 = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p1&playerName=A`);
        let ws2: WebSocket | null = null;

        ws1.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'gameState' && msg.data?.gameStarted) {
            if (!hasSentPlay) {
              currentTurn = msg.data.currentTurn;
              // ターンプレイヤーの手札を取得
              const turnPlayer = msg.data.players[currentTurn!];
              if (turnPlayer?.hand) {
                turnPlayerHand = turnPlayer.hand;
              }
            } else {
              stateAfterPlay = msg.data;
              clearTimeout(timeout);
              ws1.close();
              ws2?.close();
              resolve({ playResult, stateAfterPlay, error });
            }
          }
          if (msg.type === 'error') {
            error = msg.data?.message;
          }
        };

        setTimeout(() => {
          ws2 = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p2&playerName=B`);
          ws2.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'gameState' && msg.data?.gameStarted && !hasSentPlay) {
              // ゲームが始まったら、ターンプレイヤーがカードをプレイ
              const turnWs = currentTurn === 'p1' ? ws1 : ws2!;
              const turnPlayer = msg.data.players[currentTurn!];
              if (turnPlayer?.hand) {
                turnPlayerHand = turnPlayer.hand;
              }

              // 直接プレイできるカード（canOnlyBeSummonedでないもの）を探す
              const playable = turnPlayerHand.find(
                (c: any) => c.type === 'magic' || (c.type === 'monster' && !c.canOnlyBeSummoned)
              );

              if (playable) {
                hasSentPlay = true;
                turnWs.send(JSON.stringify({
                  type: 'playCard',
                  data: { cardId: playable.id },
                }));
                playResult = { cardId: playable.id, cardName: playable.name };
              }
            }
          };
        }, 500);
      });
    }, { wsUrl: WS_URL, roomId });

    // カードのプレイに成功していることを検証
    expect(result.error).toBeNull();
    expect(result.playResult).toBeTruthy();
    // カードプレイ後のステートが更新されている
    expect(result.stateAfterPlay).toBeTruthy();
  });
});

test.describe('マッチメイキング', () => {
  test('マッチメイキングWebSocketに接続できる', async ({ page }) => {
    const result = await page.evaluate(async ({ wsUrl }) => {
      return new Promise<{ connected: boolean; messages: any[] }>((resolve) => {
        const messages: any[] = [];
        const playerId = `mm-test-${Date.now()}`;
        const url = `${wsUrl}/matchmaking?playerId=${playerId}&playerName=test&mode=random`;
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          ws.close();
          resolve({ connected: messages.length > 0, messages });
        }, 5000);

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          messages.push(msg);
          if (messages.length >= 2) {
            clearTimeout(timeout);
            ws.close();
            resolve({ connected: true, messages });
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({ connected: false, messages });
        };
      });
    }, { wsUrl: WS_URL });

    expect(result.connected).toBe(true);
    // matchmaking_connected と matchmaking_queued が来るはず
    const types = result.messages.map((m: any) => m.type);
    expect(types).toContain('matchmaking_connected');
  });

  test('2人がマッチメイキングに参加するとマッチが成立する', async ({ page }) => {
    const result = await page.evaluate(async ({ wsUrl }) => {
      return new Promise<{ matchFound: boolean; roomId: string | null }>((resolve) => {
        let matchFound = false;
        let roomId: string | null = null;

        const timeout = setTimeout(() => {
          ws1.close();
          resolve({ matchFound, roomId });
        }, 8000);

        const p1 = `mm-p1-${Date.now()}`;
        const p2 = `mm-p2-${Date.now()}`;

        const ws1 = new WebSocket(`${wsUrl}/matchmaking?playerId=${p1}&playerName=P1&mode=random`);
        let ws2Ref: WebSocket | null = null;

        ws1.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'matchFound') {
            matchFound = true;
            roomId = msg.data?.roomId;
            clearTimeout(timeout);
            ws1.close();
            ws2Ref?.close();
            resolve({ matchFound, roomId });
          }
        };

        // プレイヤー2を少し遅れて接続
        setTimeout(() => {
          ws2Ref = new WebSocket(`${wsUrl}/matchmaking?playerId=${p2}&playerName=P2&mode=random`);
          ws2Ref.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'matchFound' && !matchFound) {
              matchFound = true;
              roomId = msg.data?.roomId;
              clearTimeout(timeout);
              ws1.close();
              ws2Ref?.close();
              resolve({ matchFound, roomId });
            }
          };
        }, 1000);
      });
    }, { wsUrl: WS_URL });

    expect(result.matchFound).toBe(true);
    expect(result.roomId).toBeTruthy();
    expect(result.roomId).toContain('room-');
  });
});
