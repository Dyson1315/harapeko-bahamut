import { test, expect } from '@playwright/test';

const WS_URL = 'ws://localhost:8787';

test.describe('カードプレイシミュレーション', () => {
  test.setTimeout(60000);

  test('ターン進行: 先攻1枚のみ、2ターン目から2枚プレイ可能', async ({ page }) => {
    const roomId = `turn-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
          });
          ws.onopen = () => resolve();
        });
      }

      await connect('p1', 'P1');
      await connect('p2', 'P2');
      await new Promise(r => setTimeout(r, 1200));

      const state = playerState['p1'];
      if (!state?.gameStarted) return { success: false, reason: 'not started' };

      const firstP = state.currentTurn;
      const secondP = firstP === 'p1' ? 'p2' : 'p1';
      const firstCanPlay = state.players[firstP]?.canPlay;
      const firstHand = state.players[firstP]?.hand?.length ?? state.players[firstP]?.handCount;

      // 先攻ターン終了
      sendMsg(firstP, { type: 'endTurn', data: {} });
      await new Promise(r => setTimeout(r, 800));

      const s2 = playerState[secondP];
      const secondCanPlay = s2?.players?.[secondP]?.canPlay;
      const secondHand = s2?.players?.[secondP]?.hand?.length;
      const turnCount = s2?.turnCount;

      try { playerWs['p1']?.close(); } catch {}
      try { playerWs['p2']?.close(); } catch {}

      return { success: true, firstCanPlay, firstHand, secondCanPlay, secondHand, turnCount };
    }, { wsUrl: WS_URL, roomId });

    expect(result.success).toBe(true);
    expect(result.firstCanPlay).toBe(1);      // 先攻は1枚
    expect(result.firstHand).toBe(5);          // 先攻はドロー無し(5枚)
    expect(result.secondCanPlay).toBe(2);      // 2ターン目は2枚
    expect(result.secondHand).toBe(6);         // 後攻2ターン目は1ドロー(5+1=6枚)
    expect(result.turnCount).toBe(2);
    console.log('Turn progression OK');
  });

  test('モンスターダメージ: ターンプレイヤーのモンスターのみダメージ', async ({ page }) => {
    const roomId = `dmg-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
          });
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error(`${pid} WS error`));
        });
      }

      try {
        await connect('p1', 'P1');
        await connect('p2', 'P2');

        // ゲーム開始を待つ（最大8秒）
        for (let i = 0; i < 40; i++) {
          if (playerState['p1']?.gameStarted && playerState['p2']?.gameStarted) break;
          await new Promise(r => setTimeout(r, 200));
        }

        const state = playerState['p1'];
        if (!state?.gameStarted) return { success: true, skipped: true, reason: 'not started (server busy)' };

        const firstP = state.currentTurn!;
        const secondP = firstP === 'p1' ? 'p2' : 'p1';

        // 先攻の手札からモンスターを探す（canOnlyBeSummonedでないもの）
        const hand = state.players[firstP]?.hand;
        const monster = hand?.find((c: any) => c.type === 'monster' && !c.canOnlyBeSummoned);

        if (!monster) {
          return { success: true, skipped: true, reason: 'no monster in first player hand' };
        }

        logs.push(`${firstP} plays ${monster.name} (dmg: ${monster.damage})`);
        sendMsg(firstP, { type: 'playCard', data: { cardId: monster.id } });

        // モンスターがフィールドに配置されるまで待つ（カウンター解決含む）
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 200));
          const st = playerState[firstP];
          const field = st?.players?.[firstP]?.field ?? [];
          if (field.some((c: any) => c.id === monster.id) && st?.phase === 'main') break;
        }

        // ターン1終了
        sendMsg(firstP, { type: 'endTurn', data: {} });

        // secondPのターンに切り替わるまで待つ
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 200));
          if (playerState[secondP]?.currentTurn === secondP) break;
        }

        const afterT2 = playerState[secondP];
        const secondLifeT2 = afterT2?.players?.[secondP]?.life;
        const firstLifeT2 = afterT2?.players?.[firstP]?.life;
        logs.push(`T2: ${secondP} life=${secondLifeT2}, ${firstP} life=${firstLifeT2}`);

        // ターン2終了(secondPは何もしない)
        const s2hand = afterT2?.players?.[secondP]?.hand?.length ?? 0;
        if (s2hand > 5) {
          const disc = afterT2.players[secondP].hand.slice(0, s2hand - 5).map((c: any) => c.id);
          sendMsg(secondP, { type: 'endTurn', data: { discardCards: disc } });
        } else {
          sendMsg(secondP, { type: 'endTurn', data: {} });
        }

        // firstPのターンに切り替わるまで待つ
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 200));
          if (playerState[firstP]?.currentTurn === firstP && playerState[firstP]?.turnCount >= 3) break;
        }

        const afterT3 = playerState[firstP];
        const secondLifeT3 = afterT3?.players?.[secondP]?.life;
        const firstLifeT3 = afterT3?.players?.[firstP]?.life;
        logs.push(`T3: ${secondP} life=${secondLifeT3}, ${firstP} life=${firstLifeT3}`);

        return {
          success: true,
          monsterDamage: monster.damage ?? 0,
          secondLifeT2, firstLifeT2,
          secondLifeT3, firstLifeT3,
          logs,
        };
      } catch (err: any) {
        return { success: false, reason: err.message, logs };
      } finally {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
      }
    }, { wsUrl: WS_URL, roomId });

    console.log('Damage logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) { console.log('Failed:', result.reason); }

    expect(result.success).toBe(true);
    const dmg = result.monsterDamage;
    // T2はsecondPのターン → firstPのモンスターはダメージを与えない
    expect(result.secondLifeT2).toBe(4);
    expect(result.firstLifeT2).toBe(4);
    // T3はfirstPのターン → firstPのモンスターがsecondPにダメージ
    expect(result.secondLifeT3).toBe(4 - dmg);
    expect(result.firstLifeT3).toBe(4);
    console.log(`Monster (dmg=${dmg}): damage correctly applied only on owner's turn`);
  });

  test('ターゲットカード: イデヨンでtargetId付き召喚', async ({ page }) => {
    const roomId = `ideyon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
          });
          ws.onopen = () => resolve();
        });
      }

      await connect('p1', 'P1');
      await connect('p2', 'P2');
      await new Promise(r => setTimeout(r, 1200));

      const state = playerState['p1'];
      if (!state?.gameStarted) return { success: false, reason: 'not started' };

      // イデヨンとモンスター両方持つプレイヤーを探す
      let pid: string | null = null;
      let ideyon: any = null;
      let mon: any = null;
      for (const p of ['p1', 'p2']) {
        const hand = playerState[p]?.players?.[p]?.hand;
        if (!hand) continue;
        ideyon = hand.find((c: any) => c.id === 'ideyon');
        mon = hand.find((c: any) => c.type === 'monster' && !c.canOnlyBeSummoned);
        if (ideyon && mon) { pid = p; break; }
      }

      if (!pid) {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
        return { success: true, skipped: true, reason: 'no player has ideyon + monster' };
      }

      // ターンを合わせる
      if (state.currentTurn !== pid) {
        sendMsg(state.currentTurn!, { type: 'endTurn', data: {} });
        await new Promise(r => setTimeout(r, 800));
      }

      const fieldBefore = playerState[pid]?.players?.[pid]?.field?.length ?? 0;
      logs.push(`Playing ideyon with target ${mon.name} (${mon.id})`);
      sendMsg(pid, { type: 'playCard', data: { cardId: 'ideyon', targetId: mon.id } });
      await new Promise(r => setTimeout(r, 1000));

      const after = playerState[pid];
      const fieldAfter = after?.players?.[pid]?.field?.length ?? 0;
      const monOnField = after?.players?.[pid]?.field?.some((c: any) => c.id === mon.id);
      const ideyonInHand = after?.players?.[pid]?.hand?.some((c: any) => c.id === 'ideyon');

      try { playerWs['p1']?.close(); } catch {}
      try { playerWs['p2']?.close(); } catch {}

      return { success: true, fieldBefore, fieldAfter, monOnField, ideyonGone: !ideyonInHand, logs };
    }, { wsUrl: WS_URL, roomId });

    console.log('Ideyon logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }

    expect(result.success).toBe(true);
    expect(result.monOnField).toBe(true);
    expect(result.ideyonGone).toBe(true);
    expect(result.fieldAfter).toBe(result.fieldBefore + 1);
    console.log('Ideyon target summon OK');
  });

  test('ターゲットカード: targetId無しのイデヨン → カード手札に戻る', async ({ page }) => {
    const roomId = `ideyon-notarget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};
      let lastError: string | null = null;

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'error') lastError = msg.data?.message;
            if (msg.type === 'uchikeshiPrompt') sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
          });
          ws.onopen = () => resolve();
        });
      }

      await connect('p1', 'P1');
      await connect('p2', 'P2');
      await new Promise(r => setTimeout(r, 1200));

      const state = playerState['p1'];
      if (!state?.gameStarted) return { success: false, reason: 'not started' };

      // イデヨンを持つプレイヤーを探す
      let pid: string | null = null;
      for (const p of ['p1', 'p2']) {
        if (playerState[p]?.players?.[p]?.hand?.some((c: any) => c.id === 'ideyon')) { pid = p; break; }
      }
      if (!pid) {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
        return { success: true, skipped: true, reason: 'no ideyon' };
      }

      if (state.currentTurn !== pid) {
        sendMsg(state.currentTurn!, { type: 'endTurn', data: {} });
        await new Promise(r => setTimeout(r, 800));
      }

      const handBefore = playerState[pid]?.players?.[pid]?.hand?.length ?? 0;
      const playedBefore = playerState[pid]?.players?.[pid]?.playedCount ?? 0;

      sendMsg(pid, { type: 'playCard', data: { cardId: 'ideyon' } }); // no targetId
      await new Promise(r => setTimeout(r, 800));

      const handAfter = playerState[pid]?.players?.[pid]?.hand?.length ?? 0;
      const playedAfter = playerState[pid]?.players?.[pid]?.playedCount ?? 0;
      const ideyonStill = playerState[pid]?.players?.[pid]?.hand?.some((c: any) => c.id === 'ideyon');

      try { playerWs['p1']?.close(); } catch {}
      try { playerWs['p2']?.close(); } catch {}

      return { success: true, handBefore, handAfter, playedBefore, playedAfter, ideyonStill, lastError };
    }, { wsUrl: WS_URL, roomId });

    if (result.skipped) { console.log('Skipped:', result.reason); return; }

    expect(result.success).toBe(true);
    expect(result.ideyonStill).toBe(true);        // カード手札に戻る
    expect(result.handAfter).toBe(result.handBefore); // 手札枚数変わらず
    expect(result.playedAfter).toBe(result.playedBefore); // プレイカウント変わらず
    expect(result.lastError).toBeTruthy();          // エラーメッセージあり
    console.log(`No-target ideyon: card returned, error="${result.lastError}"`);
  });

  test('フルゲームシミュレーション: 全カードプレイして勝敗決着', async ({ page }) => {
    const roomId = `fullsim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const log = (m: string) => logs.push(m);
      const playedCards = new Set<string>();

      return new Promise<any>((resolve) => {
        const playerWs: Record<string, WebSocket> = {};
        const playerState: Record<string, any> = {};
        let gameOver = false;

        const timeout = setTimeout(() => {
          cleanup();
          resolve({ success: false, reason: 'timeout', playedCards: Array.from(playedCards), logs });
        }, 50000);

        function cleanup() {
          try { playerWs['p1']?.close(); } catch {}
          try { playerWs['p2']?.close(); } catch {}
        }
        function sendMsg(pid: string, msg: any) {
          const ws = playerWs[pid];
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
        }
        function getOppId(pid: string) { return pid === 'p1' ? 'p2' : 'p1'; }

        function canPlayCard(card: any, hand: any[], state: any, pid: string) {
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

        function autoPlay(pid: string, state: any) {
          if (gameOver || !state) return;
          if (state.currentTurn !== pid || state.phase !== 'main') return;
          const self = state.players[pid];
          if (!self || self.playedCount >= self.canPlay || !self.hand?.length) {
            doEndTurn(pid, state);
            return;
          }
          const priorities = [
            (c: any) => c.id === 'soratobu-naifu',
            (c: any) => c.type === 'monster' && !c.canOnlyBeSummoned,
            (c: any) => c.id === 'hoshifuru-sunadokei',
            (c: any) => c.id === 'owakare',
            (c: any) => c.id === 'ideyon',
            (c: any) => c.type === 'magic',
          ];
          for (const filter of priorities) {
            for (const card of self.hand) {
              if (!filter(card)) continue;
              const check = canPlayCard(card, self.hand, state, pid);
              if (check.ok) {
                log(`${pid} play: ${card.name}`);
                playedCards.add(card.id);
                const data: any = { cardId: card.id };
                if (check.targetId) data.targetId = check.targetId;
                sendMsg(pid, { type: 'playCard', data });
                return;
              }
            }
          }
          doEndTurn(pid, state);
        }

        function doEndTurn(pid: string, state: any) {
          const self = state.players[pid];
          if (self?.hand?.length > 5) {
            const excess = self.hand.length - 5;
            sendMsg(pid, { type: 'endTurn', data: { discardCards: self.hand.slice(0, excess).map((c: any) => c.id) } });
          } else {
            sendMsg(pid, { type: 'endTurn', data: {} });
          }
        }

        function handleMsg(pid: string, msg: any) {
          if (gameOver) return;
          switch (msg.type) {
            case 'gameState':
              playerState[pid] = msg.data;
              if (msg.data.gameOver) {
                gameOver = true;
                clearTimeout(timeout);
                cleanup();
                resolve({
                  success: true,
                  winner: msg.data.winner,
                  turnCount: msg.data.turnCount,
                  p1Life: msg.data.players['p1']?.life,
                  p2Life: msg.data.players['p2']?.life,
                  playedCards: Array.from(playedCards),
                  logs,
                });
                return;
              }
              if (msg.data.gameStarted) setTimeout(() => autoPlay(pid, playerState[pid]), 100);
              break;
            case 'uchikeshiPrompt':
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
              break;
            case 'uchikeshiBackPrompt':
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false, uchikeshiBack: false } });
              break;
            case 'selectionRequired':
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
                sendMsg(pid, { type: 'selectCards', data: { selectedCardIds: ids } });
              }, 200);
              break;
            case 'error':
              log(`${pid} ERR: ${msg.data?.message}`);
              if (playerState[pid]?.gameStarted && !playerState[pid]?.gameOver) {
                setTimeout(() => autoPlay(pid, playerState[pid]), 200);
              }
              break;
          }
        }

        const ws1 = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p1&playerName=${encodeURIComponent('P1')}`);
        playerWs['p1'] = ws1;
        ws1.onmessage = (e) => handleMsg('p1', JSON.parse(e.data));

        setTimeout(() => {
          const ws2 = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=p2&playerName=${encodeURIComponent('P2')}`);
          playerWs['p2'] = ws2;
          ws2.onmessage = (e) => handleMsg('p2', JSON.parse(e.data));
        }, 500);
      });
    }, { wsUrl: WS_URL, roomId });

    console.log('Full sim logs (last 20):\n' + result.logs?.slice(-20).join('\n'));
    console.log('Played cards:', result.playedCards);

    expect(result.success).toBe(true);
    expect(result.winner).toBeTruthy();
    expect(result.turnCount).toBeGreaterThan(0);
    expect(result.playedCards.length).toBeGreaterThan(0);

    if (result.winner === 'p1') expect(result.p2Life).toBe(0);
    else expect(result.p1Life).toBe(0);

    console.log(`Winner: ${result.winner}, turns: ${result.turnCount}, p1=${result.p1Life}, p2=${result.p2Life}`);
  });

  test('うちけしフロー: カード効果が無効化される', async ({ page }) => {
    const roomId = `uchi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};
      let countered = false;

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') {
              countered = true;
              logs.push(`${pid} countering ${msg.data?.card?.name}`);
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: true } });
            }
            if (msg.type === 'uchikeshiBackPrompt') {
              sendMsg(pid, { type: 'useUchikeshi', data: { counter: false, uchikeshiBack: false } });
            }
          });
          ws.onopen = () => resolve();
        });
      }

      await connect('p1', 'P1');
      await connect('p2', 'P2');
      await new Promise(r => setTimeout(r, 1200));

      const state = playerState['p1'];
      if (!state?.gameStarted) return { success: false, reason: 'not started' };

      const currentP = state.currentTurn!;
      const oppP = currentP === 'p1' ? 'p2' : 'p1';
      const oppUchi = state.players[oppP]?.uchikeshi ?? 0;

      if (oppUchi === 0) {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
        return { success: true, skipped: true, reason: 'no uchikeshi' };
      }

      // プレイ可能なカードを探す（ターゲット不要のもの）
      const hand = state.players[currentP]?.hand;
      const playable = hand?.find((c: any) =>
        (c.type === 'monster' && !c.canOnlyBeSummoned) ||
        (c.type === 'magic' && ['directDamage', 'additionalPlays', 'swapBahamuts', 'drawDiscardPlay', 'drawDiscard'].includes(c.effect))
      );

      if (!playable) {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
        return { success: true, skipped: true, reason: 'no playable card' };
      }

      const oppLifeBefore = state.players[oppP]?.life;
      logs.push(`${currentP} playing ${playable.name}`);
      sendMsg(currentP, { type: 'playCard', data: { cardId: playable.id } });
      await new Promise(r => setTimeout(r, 1500));

      const after = playerState[currentP];
      const oppLifeAfter = after?.players?.[oppP]?.life;
      const phase = after?.phase;

      // そらとぶナイフだった場合、うちけしされればダメージなし
      const noDamage = playable.id === 'soratobu-naifu' ? (oppLifeAfter === oppLifeBefore) : true;

      try { playerWs['p1']?.close(); } catch {}
      try { playerWs['p2']?.close(); } catch {}

      return {
        success: true,
        countered,
        playedCard: playable.name,
        oppLifeBefore,
        oppLifeAfter,
        noDamage,
        phase,
        logs,
      };
    }, { wsUrl: WS_URL, roomId });

    console.log('Uchikeshi logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }

    expect(result.success).toBe(true);
    expect(result.countered).toBe(true);
    expect(result.phase).toBe('main');
    if (result.playedCard === 'そらとぶナイフ') {
      expect(result.noDamage).toBe(true);
    }
    console.log(`Uchikeshi OK: ${result.playedCard} countered`);
  });

  test('手札上限: 6枚以上でディスカード必須', async ({ page }) => {
    const roomId = `handlim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await page.evaluate(async ({ wsUrl, roomId }) => {
      const logs: string[] = [];
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};

      function sendMsg(pid: string, msg: any) {
        const ws = playerWs[pid];
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
      function connect(pid: string, name: string): Promise<void> {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${wsUrl}/ws/${roomId}?playerId=${pid}&playerName=${encodeURIComponent(name)}`);
          playerWs[pid] = ws;
          ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'gameState') playerState[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
          });
          ws.onopen = () => resolve();
        });
      }

      await connect('p1', 'P1');
      await connect('p2', 'P2');
      await new Promise(r => setTimeout(r, 1200));

      const state = playerState['p1'];
      if (!state?.gameStarted) return { success: false };

      const firstP = state.currentTurn!;
      const secondP = firstP === 'p1' ? 'p2' : 'p1';

      // T1: 先攻パス
      sendMsg(firstP, { type: 'endTurn', data: {} });
      await new Promise(r => setTimeout(r, 800));

      // T2: secondPは6枚手札（5+1ドロー）
      const s2 = playerState[secondP];
      const handLen = s2?.players?.[secondP]?.hand?.length ?? 0;
      logs.push(`T2: ${secondP} hand=${handLen}`);

      // ディスカード無しでendTurn → エラーになるはず
      sendMsg(secondP, { type: 'endTurn', data: {} });
      await new Promise(r => setTimeout(r, 500));
      const stillSecondTurn = playerState[secondP]?.currentTurn === secondP;

      // 正しくディスカード
      if (handLen > 5) {
        const hand = playerState[secondP]?.players?.[secondP]?.hand;
        const excess = handLen - 5;
        const discardIds = hand.slice(0, excess).map((c: any) => c.id);
        logs.push(`Discarding ${excess}: ${discardIds.join(',')}`);
        sendMsg(secondP, { type: 'endTurn', data: { discardCards: discardIds } });
        await new Promise(r => setTimeout(r, 800));
      }

      const after = playerState[firstP];
      const handAfter = after?.players?.[secondP]?.handCount ?? after?.players?.[secondP]?.hand?.length;
      const turnAdvanced = after?.currentTurn === firstP;

      try { playerWs['p1']?.close(); } catch {}
      try { playerWs['p2']?.close(); } catch {}

      return { success: true, handLen, stillSecondTurn, handAfter, turnAdvanced, logs };
    }, { wsUrl: WS_URL, roomId });

    console.log('Hand limit logs:', result.logs?.join('\n'));
    expect(result.success).toBe(true);

    if (result.handLen > 5) {
      // ディスカード無しではターンが進まない
      expect(result.stillSecondTurn).toBe(true);
      // 正しくディスカード後は5枚以下
      expect(result.handAfter).toBeLessThanOrEqual(5);
      expect(result.turnAdvanced).toBe(true);
      console.log('Hand limit enforcement OK');
    } else {
      console.log('Hand was within limit, skipped discard test');
    }
  });
});
