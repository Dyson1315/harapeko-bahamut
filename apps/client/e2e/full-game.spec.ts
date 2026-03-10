import { test, expect } from '@playwright/test';

const WS_URL = 'ws://localhost:8787';

/**
 * フルゲームプレイスルーテスト
 * 2人のプレイヤーがWebSocketで接続し、交互にカードをプレイして
 * 勝利（ライフ0）するまでゲームを進行させる
 */
test.describe('フルゲームプレイスルー', () => {
  test('2人対戦で勝利するまでプレイできる', async ({ page }) => {
    test.setTimeout(60000);

    const roomId = `full-game-${Date.now()}`;

    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const log = (msg: string) => { logs.push(msg); };

      return new Promise<{
        success: boolean;
        winner: string | null;
        turnCount: number;
        logs: string[];
        p1Life: number;
        p2Life: number;
      }>((resolve) => {
        let gameOver = false;
        let winner: string | null = null;
        let turnCount = 0;
        let p1Life = 4;
        let p2Life = 4;

        const playerState: Record<string, any> = {};
        const playerWs: Record<string, WebSocket> = {};

        const timeout = setTimeout(() => {
          log(`TIMEOUT: turnCount=${turnCount}, p1Life=${p1Life}, p2Life=${p2Life}`);
          cleanup();
          resolve({ success: false, winner, turnCount, logs, p1Life, p2Life });
        }, 50000);

        function cleanup() {
          try { playerWs['p1']?.close(); } catch {}
          try { playerWs['p2']?.close(); } catch {}
        }

        function sendMsg(pid: string, msg: any) {
          const ws = playerWs[pid];
          if (ws && ws.readyState === WebSocket.OPEN) {
            log(`${pid} SEND: ${msg.type} ${JSON.stringify(msg.data)}`);
            ws.send(JSON.stringify(msg));
          }
        }

        function getOpponentId(pid: string): string {
          return pid === 'p1' ? 'p2' : 'p1';
        }

        function handleMessage(pid: string, msg: any) {
          if (gameOver) return;
          log(`${pid} RECV: ${msg.type}`);

          switch (msg.type) {
            case 'gameState':
              playerState[pid] = msg.data;
              if (msg.data.gameOver) {
                gameOver = true;
                winner = msg.data.winner;
                turnCount = msg.data.turnCount;
                for (const [id, p] of Object.entries(msg.data.players) as any[]) {
                  if (id === 'p1') p1Life = p.life;
                  if (id === 'p2') p2Life = p.life;
                }
                log(`GAME OVER: winner=${winner}, p1=${p1Life}, p2=${p2Life}, turns=${turnCount}`);
                clearTimeout(timeout);
                cleanup();
                resolve({ success: true, winner, turnCount, logs, p1Life, p2Life });
                return;
              }
              if (msg.data.gameStarted) {
                turnCount = msg.data.turnCount;
                for (const [id, p] of Object.entries(msg.data.players) as any[]) {
                  if (id === 'p1') p1Life = p.life;
                  if (id === 'p2') p2Life = p.life;
                }
                tryPlay(pid, msg.data);
              }
              break;

            case 'uchikeshiPrompt':
              log(`${pid} declining uchikeshi`);
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
              break;

            case 'uchikeshiBackPrompt':
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false, uchikeshiBack: false } });
              break;

            case 'selectionRequired':
              // Wait for gameState with revealed data to arrive before processing
              setTimeout(() => handleSelection(pid, msg.data), 200);
              break;

            case 'error':
              log(`${pid} ERROR: ${msg.data?.message}`);
              // On error, try to continue playing (e.g., play another card or end turn)
              if (playerState[pid]?.gameStarted && !playerState[pid]?.gameOver) {
                setTimeout(() => tryPlay(pid, playerState[pid]), 100);
              }
              break;
          }
        }

        function handleSelection(pid: string, data: any) {
          const state = playerState[pid];
          if (!state) return;
          const self = state.players[pid];
          const oppId = getOpponentId(pid);
          const opp = state.players[oppId];
          const effect = data?.card?.effect;
          let ids: string[] = [];

          if (effect === 'drawDiscardPlay' || effect === 'drawDiscard') {
            // Select first 2 cards from refreshed hand
            if (self?.hand?.length >= 2) ids = [self.hand[0].id, self.hand[1].id];
          } else if (effect === 'handDiscard') {
            if (opp?.hand?.length > 0) ids = [opp.hand[0].id];
          } else if (effect === 'searchDeck') {
            if (state.deck?.length > 0) ids = [state.deck[0].id];
          } else if (effect === 'stealNamedCard') {
            ids = ['kodomo-goblin'];
          } else if (effect === 'summonFromGraveyard') {
            const m = state.graveyard?.find((c: any) => c.type === 'monster');
            if (m) ids = [m.id];
          } else if (effect === 'destroyMonster') {
            if (opp?.field?.length > 0) ids = [opp.field[0].id];
          }

          log(`${pid} select: [${ids.join(',')}] for ${effect}`);
          sendMsg(pid, { type: 'selectCards', data: { selectedCardIds: ids } });
        }

        /**
         * カードをプレイできるか判定。targetIdが必要なカードは条件を満たす場合のみプレイ。
         */
        function canPlayCard(card: any, hand: any[], state: any, pid: string): { playable: boolean; targetId?: string } {
          if (card.type === 'monster' && card.canOnlyBeSummoned) return { playable: false };

          const oppId = getOpponentId(pid);
          const opp = state.players[oppId];

          // targetIdが必要なカード
          if (card.id === 'owakare') {
            // 相手フィールドにモンスターが必要
            if (opp?.field?.length > 0) return { playable: true, targetId: opp.field[0].id };
            return { playable: false };
          }
          if (card.id === 'ideyon') {
            // 手札に他のモンスターが必要
            const monster = hand.find((c: any) => c.type === 'monster' && c.id !== card.id);
            if (monster) return { playable: true, targetId: monster.id };
            return { playable: false };
          }
          if (card.id === 'yomigaeru') {
            // 捨て札にモンスターが必要
            const monster = state.graveyard?.find((c: any) => c.type === 'monster');
            if (monster) return { playable: true, targetId: monster.id };
            return { playable: false };
          }
          if (card.id === 'karasu-otsukai') {
            // 捨て札にカードが必要
            if (state.graveyard?.length > 0) return { playable: true, targetId: state.graveyard[0].id };
            return { playable: false };
          }
          if (card.id === 'majo-no-otodokemono') {
            // 共有ストックにうちけしが必要
            if (state.sharedUchikeshi > 0) return { playable: true };
            return { playable: false };
          }

          return { playable: true };
        }

        function tryPlay(pid: string, state: any) {
          if (gameOver) return;
          if (state.currentTurn !== pid || state.phase !== 'main') return;

          const self = state.players[pid];
          if (!self) return;

          if (self.playedCount >= self.canPlay || !self.hand || self.hand.length === 0) {
            endTurn(pid, state);
            return;
          }

          // カード優先順位:
          // 1. そらとぶナイフ (直接2ダメージ)
          // 2. モンスター (場に出してダメージソース)
          // 3. ほしふる砂時計 (追加プレイ)
          // 4. その他プレイ可能な魔法
          const hand = self.hand;

          // Direct damage first
          let result = tryFindAndPlay(hand, (c: any) => c.id === 'soratobu-naifu', state, pid);
          if (result) return;

          // Playable monsters
          result = tryFindAndPlay(hand, (c: any) => c.type === 'monster' && !c.canOnlyBeSummoned, state, pid);
          if (result) return;

          // Additional plays if we have more cards
          if (hand.length > 1) {
            result = tryFindAndPlay(hand, (c: any) => c.id === 'hoshifuru-sunadokei', state, pid);
            if (result) return;
          }

          // Destroy opponent monster
          result = tryFindAndPlay(hand, (c: any) => c.id === 'owakare', state, pid);
          if (result) return;

          // Any other playable magic
          result = tryFindAndPlay(hand, (c: any) => c.type === 'magic', state, pid);
          if (result) return;

          // Nothing playable
          endTurn(pid, state);
        }

        function tryFindAndPlay(hand: any[], filter: (c: any) => boolean, state: any, pid: string): boolean {
          for (const card of hand) {
            if (!filter(card)) continue;
            const check = canPlayCard(card, hand, state, pid);
            if (check.playable) {
              log(`${pid} playing: ${card.name} (${card.id})`);
              const data: any = { cardId: card.id };
              if (check.targetId) data.targetId = check.targetId;
              sendMsg(pid, { type: 'playCard', data });
              return true;
            }
          }
          return false;
        }

        function endTurn(pid: string, state: any) {
          const self = state.players[pid];
          if (!self) return;
          if (self.hand && self.hand.length > 5) {
            const excess = self.hand.length - 5;
            const discardCards = self.hand.slice(0, excess).map((c: any) => c.id);
            log(`${pid} end turn, discard ${excess}`);
            sendMsg(pid, { type: 'endTurn', data: { discardCards } });
          } else {
            log(`${pid} end turn`);
            sendMsg(pid, { type: 'endTurn', data: {} });
          }
        }

        // Connect player 1
        const url1 = `${wsUrl}/ws/${roomId}?playerId=p1&playerName=${encodeURIComponent('プレイヤー1')}`;
        const ws1 = new WebSocket(url1);
        playerWs['p1'] = ws1;
        ws1.onmessage = (e) => handleMessage('p1', JSON.parse(e.data));
        ws1.onerror = () => log('p1 WS error');

        // Connect player 2 after delay
        setTimeout(() => {
          const url2 = `${wsUrl}/ws/${roomId}?playerId=p2&playerName=${encodeURIComponent('プレイヤー2')}`;
          const ws2 = new WebSocket(url2);
          playerWs['p2'] = ws2;
          ws2.onmessage = (e) => handleMessage('p2', JSON.parse(e.data));
          ws2.onerror = () => log('p2 WS error');
        }, 500);
      });
    }, { wsUrl: WS_URL, roomId });

    console.log('Game logs:\n' + result.logs.join('\n'));

    expect(result.success).toBe(true);
    expect(result.winner).toBeTruthy();
    expect(result.winner === 'p1' || result.winner === 'p2').toBe(true);
    expect(result.turnCount).toBeGreaterThan(0);

    if (result.winner === 'p1') {
      expect(result.p2Life).toBe(0);
    } else {
      expect(result.p1Life).toBe(0);
    }

    console.log(`Winner: ${result.winner}, Turns: ${result.turnCount}, P1=${result.p1Life}, P2=${result.p2Life}`);
  });

  test('マッチメイキングからフルゲームまで通して遊べる', async ({ page }) => {
    test.setTimeout(60000);

    const result = await page.evaluate(async ({ wsUrl }) => {
      const logs: string[] = [];
      const log = (msg: string) => { logs.push(msg); };

      return new Promise<{
        matchFound: boolean;
        gameCompleted: boolean;
        winner: string | null;
        logs: string[];
      }>((resolve) => {
        let matchFound = false;
        let gameCompleted = false;
        let winner: string | null = null;

        const timeout = setTimeout(() => {
          log('TIMEOUT');
          resolve({ matchFound, gameCompleted, winner, logs });
        }, 50000);

        const p1Id = `mm-fg-p1-${Date.now()}`;
        const p2Id = `mm-fg-p2-${Date.now()}`;

        const mmWs1 = new WebSocket(
          `${wsUrl}/matchmaking?playerId=${p1Id}&playerName=${encodeURIComponent('マッチP1')}&mode=random`
        );

        let mmWs2Ref: WebSocket | null = null;

        mmWs1.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          log(`MM P1: ${msg.type}`);
          if (msg.type === 'matchFound') {
            matchFound = true;
            const roomId = msg.data.roomId;
            log(`Match found! Room: ${roomId}`);
            mmWs1.close();
            mmWs2Ref?.close();
            setTimeout(() => startGame(roomId, p1Id, p2Id), 200);
          }
        };

        setTimeout(() => {
          mmWs2Ref = new WebSocket(
            `${wsUrl}/matchmaking?playerId=${p2Id}&playerName=${encodeURIComponent('マッチP2')}&mode=random`
          );
          mmWs2Ref.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            log(`MM P2: ${msg.type}`);
            if (msg.type === 'matchFound') {
              mmWs2Ref?.close();
            }
          };
        }, 800);

        function startGame(gameRoomId: string, pid1: string, pid2: string) {
          const playerWs: Record<string, WebSocket> = {};
          const playerState: Record<string, any> = {};
          let gameOver = false;
          // Prevent race conditions: track if a player is waiting for a response
          const waitingForResponse: Record<string, boolean> = {};

          function getOppId(pid: string) { return pid === pid1 ? pid2 : pid1; }

          function sendMsg(pid: string, msg: any) {
            const ws = playerWs[pid];
            if (ws && ws.readyState === WebSocket.OPEN) {
              log(`GAME ${pid} SEND: ${msg.type}`);
              ws.send(JSON.stringify(msg));
            }
          }

          function canPlayCard(card: any, hand: any[], state: any, pid: string): { ok: boolean; targetId?: string } {
            if (card.type === 'monster' && card.canOnlyBeSummoned) return { ok: false };
            const opp = state.players[getOppId(pid)];
            if (card.id === 'owakare') {
              if (opp?.field?.length > 0) return { ok: true, targetId: opp.field[0].id };
              return { ok: false };
            }
            if (card.id === 'ideyon') {
              const m = hand.find((c: any) => c.type === 'monster' && c.id !== card.id);
              if (m) return { ok: true, targetId: m.id };
              return { ok: false };
            }
            if (card.id === 'yomigaeru') {
              const m = state.graveyard?.find((c: any) => c.type === 'monster');
              if (m) return { ok: true, targetId: m.id };
              return { ok: false };
            }
            if (card.id === 'karasu-otsukai') {
              if (state.graveyard?.length > 0) return { ok: true, targetId: state.graveyard[0].id };
              return { ok: false };
            }
            if (card.id === 'majo-no-otodokemono') {
              if (state.sharedUchikeshi > 0) return { ok: true };
              return { ok: false };
            }
            return { ok: true };
          }

          function handleMsg(pid: string, msg: any) {
            if (gameOver) return;
            log(`GAME ${pid} RECV: ${msg.type}`);

            if (msg.type === 'gameState') {
              playerState[pid] = msg.data;
              waitingForResponse[pid] = false;
              if (msg.data.gameOver) {
                gameOver = true;
                gameCompleted = true;
                winner = msg.data.winner;
                log(`GAME OVER: winner=${winner}`);
                clearTimeout(timeout);
                try { playerWs[pid1]?.close(); } catch {}
                try { playerWs[pid2]?.close(); } catch {}
                resolve({ matchFound, gameCompleted, winner, logs });
                return;
              }
              if (msg.data.gameStarted && !waitingForResponse[pid]) {
                // Use setTimeout to avoid processing multiple gameState messages simultaneously
                setTimeout(() => {
                  if (!gameOver && !waitingForResponse[pid]) autoPlay(pid, playerState[pid]);
                }, 50);
              }
            } else if (msg.type === 'uchikeshiPrompt') {
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
            } else if (msg.type === 'uchikeshiBackPrompt') {
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false, uchikeshiBack: false } });
            } else if (msg.type === 'selectionRequired') {
              waitingForResponse[pid] = true;
              // Wait a tick to ensure we have the latest gameState
              setTimeout(() => {
                const state = playerState[pid];
                if (!state) return;
                const self = state.players[pid];
                const opp = state.players[getOppId(pid)];
                const effect = msg.data?.card?.effect;
                let ids: string[] = [];
                if (effect === 'drawDiscardPlay' || effect === 'drawDiscard') {
                  if (self?.hand?.length >= 2) ids = [self.hand[0].id, self.hand[1].id];
                } else if (effect === 'handDiscard') {
                  if (opp?.hand?.length > 0) ids = [opp.hand[0].id];
                } else if (effect === 'searchDeck') {
                  if (state.deck?.length > 0) ids = [state.deck[0].id];
                } else if (effect === 'stealNamedCard') {
                  ids = ['kodomo-goblin'];
                }
                log(`GAME ${pid} selecting [${ids.join(',')}] for ${effect}`);
                sendMsg(pid, { type: 'selectCards', data: { selectedCardIds: ids } });
                waitingForResponse[pid] = false;
              }, 100);
            } else if (msg.type === 'error') {
              log(`GAME ${pid} error: ${msg.data?.message}`);
              waitingForResponse[pid] = false;
              if (playerState[pid]?.gameStarted && !playerState[pid]?.gameOver) {
                setTimeout(() => {
                  if (!gameOver) autoPlay(pid, playerState[pid]);
                }, 200);
              }
            }
          }

          function autoPlay(pid: string, state: any) {
            if (gameOver || !state || waitingForResponse[pid]) return;
            if (state.currentTurn !== pid || state.phase !== 'main') return;
            const self = state.players[pid];
            if (!self) return;

            if (self.playedCount >= self.canPlay || !self.hand?.length) {
              if (self.hand && self.hand.length > 5) {
                const excess = self.hand.length - 5;
                sendMsg(pid, { type: 'endTurn', data: { discardCards: self.hand.slice(0, excess).map((c: any) => c.id) } });
              } else {
                sendMsg(pid, { type: 'endTurn', data: {} });
              }
              return;
            }

            waitingForResponse[pid] = true;
            for (const card of self.hand) {
              const check = canPlayCard(card, self.hand, state, pid);
              if (check.ok) {
                const data: any = { cardId: card.id };
                if (check.targetId) data.targetId = check.targetId;
                log(`GAME ${pid} play: ${card.name}`);
                sendMsg(pid, { type: 'playCard', data });
                return;
              }
            }
            sendMsg(pid, { type: 'endTurn', data: {} });
          }

          log(`Connecting to game room: ${gameRoomId}`);
          const ws1 = new WebSocket(`${wsUrl}/ws/${gameRoomId}?playerId=${pid1}&playerName=${encodeURIComponent('マッチP1')}`);
          playerWs[pid1] = ws1;
          ws1.onmessage = (e) => handleMsg(pid1, JSON.parse(e.data));
          ws1.onopen = () => log(`${pid1} connected to game`);
          ws1.onerror = () => log(`${pid1} WS error`);

          setTimeout(() => {
            const ws2 = new WebSocket(`${wsUrl}/ws/${gameRoomId}?playerId=${pid2}&playerName=${encodeURIComponent('マッチP2')}`);
            playerWs[pid2] = ws2;
            ws2.onmessage = (e) => handleMsg(pid2, JSON.parse(e.data));
            ws2.onopen = () => log(`${pid2} connected to game`);
            ws2.onerror = () => log(`${pid2} WS error`);
          }, 500);
        }
      });
    }, { wsUrl: WS_URL });

    console.log('Matchmaking → Game logs:\n' + result.logs.join('\n'));

    expect(result.matchFound).toBe(true);
    expect(result.gameCompleted).toBe(true);
    expect(result.winner).toBeTruthy();

    console.log(`Matchmaking → Full game completed! Winner: ${result.winner}`);
  });
});
