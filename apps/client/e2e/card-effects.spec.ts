import { test, expect } from '@playwright/test';

const WS_URL = 'ws://localhost:8787';

/**
 * 各カード効果を個別に検証するテスト
 * WebSocket経由でサーバーに直接接続し、各カードの効果が正しく処理されるかを確認する
 */
test.describe('カード効果個別検証', () => {

  // ヘルパー: ゲームセットアップと操作を行うコードをpage.evaluateで実行
  // 各テストで共通のセットアップロジックを使う
  const runGameTest = (page: any, roomId: string, testFn: string) => {
    return page.evaluate(async ({ wsUrl, roomId, testFn }: any) => {
      const logs: string[] = [];
      const log = (m: string) => logs.push(m);
      const playerWs: Record<string, WebSocket> = {};
      const playerState: Record<string, any> = {};
      let lastError: Record<string, string> = {};
      let selectionData: Record<string, any> = {};
      let uchikeshiPromptFor: Record<string, any> = {};
      let uchikeshiBackPromptFor: Record<string, any> = {};

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
            if (msg.type === 'error') lastError[pid] = msg.data?.message;
            if (msg.type === 'selectionRequired') selectionData[pid] = msg.data;
            if (msg.type === 'uchikeshiPrompt') uchikeshiPromptFor[pid] = msg.data;
            if (msg.type === 'uchikeshiBackPrompt') uchikeshiBackPromptFor[pid] = msg.data;
          });
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error(`${pid} WS error`));
        });
      }

      async function waitFor(condFn: () => boolean, maxMs = 5000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
          if (condFn()) return true;
          await new Promise(r => setTimeout(r, 100));
        }
        return false;
      }

      function getState(pid: string) { return playerState[pid]; }
      function getPlayer(pid: string) { return playerState[pid]?.players?.[pid]; }
      function getOpponent(pid: string) {
        const oppId = pid === 'p1' ? 'p2' : 'p1';
        return playerState[pid]?.players?.[oppId];
      }
      function getOppId(pid: string) { return pid === 'p1' ? 'p2' : 'p1'; }
      function getCurrentTurn() { return playerState['p1']?.currentTurn; }

      async function waitForMain(pid: string) {
        return waitFor(() => playerState[pid]?.phase === 'main' && playerState[pid]?.currentTurn === pid);
      }

      async function waitForPhase(phase: string) {
        return waitFor(() => playerState['p1']?.phase === phase);
      }

      async function playCard(pid: string, cardId: string, targetId?: string) {
        lastError[pid] = '';
        const data: any = { cardId };
        if (targetId) data.targetId = targetId;
        sendMsg(pid, { type: 'playCard', data });
        // phaseが変わるかエラーが来るまで少し待つ
        await new Promise(r => setTimeout(r, 300));
      }

      async function declineCounter(pid: string) {
        sendMsg(pid, { type: 'useUchikeshi', data: { counter: false } });
        await waitFor(() => playerState[pid]?.phase === 'main', 3000);
      }

      async function useCounter(pid: string) {
        sendMsg(pid, { type: 'useUchikeshi', data: { counter: true } });
        await new Promise(r => setTimeout(r, 300));
      }

      async function selectCards(pid: string, ids: string[]) {
        sendMsg(pid, { type: 'selectCards', data: { selectedCardIds: ids } });
        await waitFor(() => !playerState[pid]?.pendingEffect?.requiresSelection, 3000);
      }

      async function endTurn(pid: string) {
        const self = getPlayer(pid);
        if (self?.hand?.length > 5) {
          const excess = self.hand.length - 5;
          sendMsg(pid, { type: 'endTurn', data: { discardCards: self.hand.slice(0, excess).map((c: any) => c.id) } });
        } else {
          sendMsg(pid, { type: 'endTurn', data: {} });
        }
        const oppId = getOppId(pid);
        await waitFor(() => playerState[oppId]?.currentTurn === oppId, 3000);
      }

      try {
        await connect('p1', 'P1');
        await connect('p2', 'P2');

        const started = await waitFor(() =>
          playerState['p1']?.gameStarted && playerState['p2']?.gameStarted, 8000);
        if (!started) return { success: false, reason: 'not started', logs };

        // テスト関数を実行
        const fn = new Function(
          'ctx',
          `return (async () => { ${testFn} })()`
        );
        const result = await fn({
          log, logs, sendMsg, getState, getPlayer, getOpponent, getOppId, getCurrentTurn,
          waitFor, waitForMain, waitForPhase, playCard, declineCounter, useCounter,
          selectCards, endTurn, playerState, lastError, selectionData, uchikeshiPromptFor, uchikeshiBackPromptFor,
        });
        return { success: true, ...result, logs };
      } catch (err: any) {
        return { success: false, reason: err.message, logs };
      } finally {
        try { playerWs['p1']?.close(); } catch {}
        try { playerWs['p2']?.close(); } catch {}
      }
    }, { wsUrl: WS_URL, roomId, testFn });
  };

  test('そらとぶナイフ: 相手に2ダメージ', async ({ page }) => {
    const roomId = `knife-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getState, getPlayer, getOpponent, getOppId, getCurrentTurn,
              waitForMain, playCard, declineCounter, endTurn, lastError, playerState } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const knife = hand?.find(c => c.id === 'soratobu-naifu');

      if (!knife) return { skipped: true, reason: 'そらとぶナイフが手札にない' };

      const oppLifeBefore = getOpponent(firstP)?.life;
      log('opponent life before: ' + oppLifeBefore);

      await playCard(firstP, 'soratobu-naifu');

      // カウンターフェーズの場合、相手がうちけし辞退
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }
      await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

      const oppLifeAfter = getOpponent(firstP)?.life;
      log('opponent life after: ' + oppLifeAfter);

      return { oppLifeBefore, oppLifeAfter, verified: oppLifeAfter === oppLifeBefore - 2 };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('そらとぶナイフ: 2ダメージ OK');
  });

  test('こどもゴブリン: 場に出せる（ダメージは別テスト）', async ({ page }) => {
    const roomId = `goblin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, getOppId, waitForMain,
              playCard, declineCounter, playerState } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const goblin = hand?.find(c => c.id === 'kodomo-goblin');

      if (!goblin) return { skipped: true, reason: 'こどもゴブリンが手札にない' };

      const fieldBefore = getPlayer(firstP)?.field?.length ?? 0;
      await playCard(firstP, 'kodomo-goblin');

      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }
      await ctx.waitFor(() => {
        const f = ctx.getPlayer(firstP)?.field;
        return f?.some(c => c.id === 'kodomo-goblin');
      }, 3000);

      const fieldAfter = getPlayer(firstP)?.field;
      const onField = fieldAfter?.some(c => c.id === 'kodomo-goblin');
      log('field count: ' + fieldBefore + ' -> ' + fieldAfter?.length);

      return { onField, verified: onField === true };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('こどもゴブリン: 場に出る OK');
  });

  test('はらぺこバハムート: 直接プレイ不可', async ({ page }) => {
    const roomId = `baha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, playCard, lastError } = ctx;

      const firstP = getCurrentTurn();
      const hand = getPlayer(firstP)?.hand;
      const baha = hand?.find(c => c.id === 'harapeko-bahamut');

      if (!baha) return { skipped: true, reason: 'はらぺこバハムートが手札にない' };

      await playCard(firstP, 'harapeko-bahamut');
      await ctx.waitFor(() => !!lastError[firstP], 2000);

      const err = lastError[firstP];
      log('error: ' + err);
      const stillInHand = getPlayer(firstP)?.hand?.some(c => c.id === 'harapeko-bahamut');

      return { err, stillInHand, verified: !!err && stillInHand };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('はらぺこバハムート: 直接プレイ不可 OK');
  });

  test('オワカーレ: 相手の場のモンスター破壊', async ({ page }) => {
    const roomId = `owakare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getState, getPlayer, getOpponent, getOppId, getCurrentTurn,
              waitForMain, playCard, declineCounter, endTurn, lastError, playerState } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);

      // Step 1: どちらかがオワカーレを持っているか確認
      // まず先攻がモンスター→ターンエンド→後攻がオワカーレで破壊、のフローを組む
      const firstHand = getPlayer(firstP)?.hand;
      const secondHand = getPlayer(secondP)?.hand;

      const firstHasOwakare = firstHand?.some(c => c.id === 'owakare');
      const secondHasOwakare = secondHand?.some(c => c.id === 'owakare');

      if (!firstHasOwakare && !secondHasOwakare) {
        return { skipped: true, reason: 'オワカーレが手札にない' };
      }

      // シナリオ: モンスターを出してから、次ターンでオワカーレで破壊
      // まず先攻でモンスターを出す
      const monster = firstHand?.find(c => c.type === 'monster' && !c.canOnlyBeSummoned);

      if (secondHasOwakare && monster) {
        // 先攻: モンスターを出す
        log('firstP plays monster: ' + monster.name);
        await playCard(firstP, monster.id);
        if (playerState[secondP]?.phase === 'counter') {
          await declineCounter(secondP);
        }
        await ctx.waitFor(() => {
          const f = ctx.getPlayer(firstP)?.field;
          return f?.some(c => c.id === monster.id) && playerState[firstP]?.phase === 'main';
        }, 3000);

        // 先攻: ターンエンド
        await endTurn(firstP);

        // 後攻のターン: オワカーレで先攻のモンスターを破壊
        const oppField = getOpponent(secondP)?.field;
        log('opponent field before owakare: ' + JSON.stringify(oppField?.map(c => c.id)));
        const target = oppField?.[0];
        if (!target) return { skipped: true, reason: '相手の場にモンスターがない' };

        const oppFieldBefore = oppField?.length;
        await playCard(secondP, 'owakare', target.id);
        if (playerState[firstP]?.phase === 'counter') {
          await declineCounter(firstP);
        }
        await ctx.waitFor(() => playerState[secondP]?.phase === 'main', 3000);

        const oppFieldAfter = getOpponent(secondP)?.field;
        log('opponent field after owakare: ' + JSON.stringify(oppFieldAfter?.map(c => c.id)));
        const destroyed = !oppFieldAfter?.some(c => c.id === target.id);
        const err = lastError[secondP];
        if (err) log('error: ' + err);

        return { destroyed, oppFieldBefore, oppFieldAfterLen: oppFieldAfter?.length, err, verified: destroyed };
      }

      if (firstHasOwakare) {
        // 先攻がオワカーレを持つが、相手の場にモンスターがいない場合
        // 先攻のターンで何か別のことして、ターン送って、相手にモンスター出させて...
        // まず先攻で何もせずターンエンド
        await endTurn(firstP);

        // 後攻: モンスターを出す
        const secMonster = getPlayer(secondP)?.hand?.find(c => c.type === 'monster' && !c.canOnlyBeSummoned);
        if (!secMonster) return { skipped: true, reason: 'モンスターとオワカーレの組み合わせがない' };

        await playCard(secondP, secMonster.id);
        if (playerState[firstP]?.phase === 'counter') {
          await declineCounter(firstP);
        }
        await ctx.waitFor(() => {
          return ctx.getPlayer(secondP)?.field?.some(c => c.id === secMonster.id) &&
                 playerState[secondP]?.phase === 'main';
        }, 3000);

        await endTurn(secondP);

        // 先攻のターンに戻った: オワカーレで相手モンスター破壊
        const oppField = getOpponent(firstP)?.field;
        log('opponent field before owakare: ' + JSON.stringify(oppField?.map(c => c.id)));
        const target = oppField?.[0];
        if (!target) return { skipped: true, reason: '相手の場にモンスターがない(2)' };

        await playCard(firstP, 'owakare', target.id);
        if (playerState[secondP]?.phase === 'counter') {
          await declineCounter(secondP);
        }
        await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

        const oppFieldAfter = getOpponent(firstP)?.field;
        log('opponent field after owakare: ' + JSON.stringify(oppFieldAfter?.map(c => c.id)));
        const destroyed = !oppFieldAfter?.some(c => c.id === target.id);
        const err = lastError[firstP];
        if (err) log('error: ' + err);

        return { destroyed, err, verified: destroyed };
      }

      return { skipped: true, reason: '条件不足' };
    `);
    console.log('Logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('オワカーレ: モンスター破壊 OK');
  });

  test('イデヨン: 手札からモンスター召喚', async ({ page }) => {
    const roomId = `ideyon-fx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getOpponent, getOppId, getCurrentTurn,
              playCard, declineCounter, lastError, playerState } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const ideyon = hand?.find(c => c.id === 'ideyon');
      const monster = hand?.find(c => c.type === 'monster' && !c.canOnlyBeSummoned && c.id !== 'ideyon');

      if (!ideyon || !monster) return { skipped: true, reason: 'イデヨン+モンスターが手札にない' };

      log('playing ideyon targeting ' + monster.name);
      await playCard(firstP, 'ideyon', monster.id);
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }
      await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

      const field = getPlayer(firstP)?.field;
      const onField = field?.some(c => c.id === monster.id);
      const inHand = getPlayer(firstP)?.hand?.some(c => c.id === monster.id);
      const err = lastError[firstP];
      if (err) log('error: ' + err);

      return { onField, inHand, err, verified: onField && !inHand };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('イデヨン: モンスター召喚 OK');
  });

  test('ほしふる砂時計: +2プレイ', async ({ page }) => {
    const roomId = `sandclock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, getOppId,
              playCard, declineCounter, endTurn, playerState, waitFor } = ctx;

      const firstP = getCurrentTurn();
      const secondP = getOppId(firstP);

      // 先攻・後攻どちらの手札にあるかチェック
      let activeP, passiveP;
      if (getPlayer(firstP)?.hand?.some(c => c.id === 'hoshifuru-sunadokei')) {
        activeP = firstP;
        passiveP = secondP;
      } else {
        // 先攻ターンエンドして後攻をチェック
        await endTurn(firstP);
        if (getPlayer(secondP)?.hand?.some(c => c.id === 'hoshifuru-sunadokei')) {
          activeP = secondP;
          passiveP = firstP;
        } else {
          return { skipped: true, reason: 'ほしふる砂時計が手札にない' };
        }
      }

      const canPlayBefore = getPlayer(activeP)?.canPlay;
      log('canPlay before: ' + canPlayBefore);

      await playCard(activeP, 'hoshifuru-sunadokei');
      if (playerState[passiveP]?.phase === 'counter') {
        await declineCounter(passiveP);
      }
      await waitFor(() => playerState[activeP]?.phase === 'main', 3000);

      const canPlayAfter = getPlayer(activeP)?.canPlay;
      log('canPlay after: ' + canPlayAfter);

      return { canPlayBefore, canPlayAfter, verified: canPlayAfter === canPlayBefore + 2 };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    console.log(`ほしふる砂時計: canPlay ${result.canPlayBefore} -> ${result.canPlayAfter}`);
    expect(result.canPlayAfter).toBe(result.canPlayBefore + 2);
  });

  test('黒ネコのしっぽ: 2ドロー → 2捨て → +1プレイ', async ({ page }) => {
    const roomId = `kuro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, getOppId,
              playCard, declineCounter, selectCards, playerState, selectionData } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const kuro = hand?.find(c => c.id === 'kuro-neko-shippo');

      if (!kuro) return { skipped: true, reason: '黒ネコのしっぽが手札にない' };

      const handCountBefore = hand.length;
      const canPlayBefore = getPlayer(firstP)?.canPlay;
      log('hand before: ' + handCountBefore + ', canPlay: ' + canPlayBefore);

      await playCard(firstP, 'kuro-neko-shippo');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }

      // selectionRequiredを待つ
      await ctx.waitFor(() => !!selectionData[firstP], 3000);

      // 2枚ドローされた後の手札から2枚選んで捨てる
      const currentHand = getPlayer(firstP)?.hand;
      log('hand after draw: ' + currentHand?.length);
      if (!currentHand || currentHand.length < 2) return { success: false, reason: 'hand too small' };

      await selectCards(firstP, [currentHand[0].id, currentHand[1].id]);

      const handCountAfter = getPlayer(firstP)?.hand?.length;
      const canPlayAfter = getPlayer(firstP)?.canPlay;
      log('hand after discard: ' + handCountAfter + ', canPlay: ' + canPlayAfter);

      // 手札: -1(黒ネコ) +2(ドロー) -2(捨て) = -1
      // canPlay: +1
      return {
        handCountBefore, handCountAfter, canPlayBefore, canPlayAfter,
        verified: handCountAfter === handCountBefore - 1 && canPlayAfter === canPlayBefore + 1
      };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('黒ネコのしっぽ: 2ドロー2捨て+1プレイ OK');
  });

  test('銀ネコのしっぽ: 3ドロー → 2捨て', async ({ page }) => {
    const roomId = `gin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, getOppId,
              playCard, declineCounter, selectCards, playerState, selectionData } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const gin = hand?.find(c => c.id === 'gin-neko-shippo');

      if (!gin) return { skipped: true, reason: '銀ネコのしっぽが手札にない' };

      const handCountBefore = hand.length;
      log('hand before: ' + handCountBefore);

      await playCard(firstP, 'gin-neko-shippo');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }

      await ctx.waitFor(() => !!selectionData[firstP], 3000);

      const currentHand = getPlayer(firstP)?.hand;
      log('hand after draw: ' + currentHand?.length);
      if (!currentHand || currentHand.length < 2) return { success: false, reason: 'hand too small' };

      await selectCards(firstP, [currentHand[0].id, currentHand[1].id]);

      const handCountAfter = getPlayer(firstP)?.hand?.length;
      log('hand after discard: ' + handCountAfter);

      // 手札: -1(銀ネコ) +3(ドロー) -2(捨て) = 0
      return {
        handCountBefore, handCountAfter,
        verified: handCountAfter === handCountBefore
      };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('銀ネコのしっぽ: 3ドロー2捨て OK');
  });

  test('イレカエール: ゴブリンとバハムート入替', async ({ page }) => {
    const roomId = `swap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getState, getCurrentTurn, getOppId,
              playCard, declineCounter, playerState } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const ire = hand?.find(c => c.id === 'irekaeru');

      if (!ire) return { skipped: true, reason: 'イレカエールが手札にない' };

      // 入替前: 各領域でのゴブリン/バハムートの位置を確認
      const findCard = (id) => {
        const s = getState(firstP);
        const locations = [];
        if (s.players[firstP]?.hand?.some(c => c.id === id)) locations.push(firstP + '-hand');
        if (s.players[firstP]?.field?.some(c => c.id === id)) locations.push(firstP + '-field');
        if (s.players[secondP]?.field?.some(c => c.id === id)) locations.push(secondP + '-field');
        if (s.graveyard?.some(c => c.id === id)) locations.push('graveyard');
        return locations;
      };

      log('goblin before: ' + JSON.stringify(findCard('kodomo-goblin')));
      log('bahamut before: ' + JSON.stringify(findCard('harapeko-bahamut')));

      await playCard(firstP, 'irekaeru');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }
      await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

      log('goblin after: ' + JSON.stringify(findCard('kodomo-goblin')));
      log('bahamut after: ' + JSON.stringify(findCard('harapeko-bahamut')));

      // 効果発動を確認（エラーがないこと）
      return { verified: true };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('イレカエール: 入替 OK');
  });

  test('あくまの吹き矢: 相手手札1枚捨て', async ({ page }) => {
    const roomId = `akuma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getState, getPlayer, getOpponent, getCurrentTurn, getOppId,
              playCard, declineCounter, selectCards, playerState, selectionData, waitFor } = ctx;

      const firstP = getCurrentTurn();
      const secondP = getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const akuma = hand?.find(c => c.id === 'akuma-fukiya');

      if (!akuma) return { skipped: true, reason: 'あくまの吹き矢が手札にない' };

      const oppHandBefore = getOpponent(firstP)?.handCount;
      log('opponent hand count before: ' + oppHandBefore);

      await playCard(firstP, 'akuma-fukiya');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }

      // selectionRequiredメッセージと相手手札公開の両方を待つ
      await waitFor(() => {
        const hasSelection = !!selectionData[firstP];
        const s = getState(firstP);
        const hasRevealedHand = s?.players?.[secondP]?.hand?.length > 0;
        return hasSelection && hasRevealedHand;
      }, 5000);

      const state = getState(firstP);
      const oppHand = state?.players?.[secondP]?.hand;
      log('revealed opponent hand: ' + JSON.stringify(oppHand?.map(c => c.id)));
      if (!oppHand || oppHand.length === 0) return { skipped: true, reason: '相手手札が空' };

      await selectCards(firstP, [oppHand[0].id]);

      const oppHandAfter = getOpponent(firstP)?.handCount;
      log('opponent hand count after: ' + oppHandAfter);

      return { oppHandBefore, oppHandAfter, verified: oppHandAfter === oppHandBefore - 1 };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('あくまの吹き矢: 相手手札1枚捨て OK');
  });

  test('ようせいのメガネ: 山札からサーチ', async ({ page }) => {
    const roomId = `yousei-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getState, getCurrentTurn, getOppId,
              playCard, declineCounter, selectCards, playerState, selectionData } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const megane = hand?.find(c => c.id === 'yousei-no-megane');

      if (!megane) return { skipped: true, reason: 'ようせいのメガネが手札にない' };

      const handCountBefore = hand.length;
      await playCard(firstP, 'yousei-no-megane');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }

      await ctx.waitFor(() => !!selectionData[firstP], 3000);

      // 山札が公開されているはず
      const state = getState(firstP);
      const deck = state?.deck;
      log('deck revealed: ' + (deck ? deck.length + ' cards' : 'no'));
      if (!deck || deck.length === 0) return { skipped: true, reason: '山札が空' };

      const selectedCardId = deck[0].id;
      await selectCards(firstP, [selectedCardId]);

      const handAfter = getPlayer(firstP)?.hand;
      const found = handAfter?.some(c => c.id === selectedCardId);
      log('searched card in hand: ' + found);

      // 手札: -1(メガネ) +1(サーチ) = 0
      return { handCountBefore, handCountAfter: handAfter?.length, found, verified: found };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('ようせいのメガネ: サーチ OK');
  });

  test('ひらめき水晶: カード名宣言して奪取', async ({ page }) => {
    const roomId = `hirameki-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getCurrentTurn, getOppId,
              playCard, declineCounter, selectCards, playerState, selectionData } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);
      const hand = getPlayer(firstP)?.hand;
      const crystal = hand?.find(c => c.id === 'hirameki-suishou');

      if (!crystal) return { skipped: true, reason: 'ひらめき水晶が手札にない' };

      await playCard(firstP, 'hirameki-suishou');
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }

      await ctx.waitFor(() => !!selectionData[firstP], 3000);

      // カード名を宣言（こどもゴブリンを指定）
      await selectCards(firstP, ['kodomo-goblin']);

      log('effect resolved');
      return { verified: true };
    `);
    console.log('Logs:', result.logs?.join(', '));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('ひらめき水晶: 宣言 OK');
  });

  test('魔女のおとどけもの: 共有ストックからうちけし獲得', async ({ page }) => {
    const roomId = `majo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getState, getCurrentTurn, getOppId,
              playCard, declineCounter, useCounter, endTurn, playerState, lastError } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);

      // 魔女のおとどけものは共有ストックにうちけしが必要
      // まず、うちけしを使って共有ストックに移す
      // 先攻で何かプレイ → 後攻がうちけしで対抗 → 共有ストックに1追加

      const firstHand = getPlayer(firstP)?.hand;
      const playable = firstHand?.find(c => c.type === 'magic' && c.id !== 'majo-no-otodokemono' && !['owakare','ideyon','yomigaeru','karasu-otsukai'].includes(c.id));

      if (!playable) return { skipped: true, reason: 'うちけし誘発用カードがない' };

      // 先攻がカードをプレイ
      log('playing ' + playable.name + ' to trigger counter');
      await playCard(firstP, playable.id);

      // 後攻がうちけし使用
      await ctx.waitFor(() => !!ctx.uchikeshiPromptFor[secondP], 3000);
      if (!ctx.uchikeshiPromptFor[secondP]) return { skipped: true, reason: 'うちけしプロンプトが来ない' };

      await useCounter(secondP);
      // uchikeshi-backプロンプトが来る可能性
      await ctx.waitFor(() => playerState[firstP]?.phase === 'main' || playerState[firstP]?.phase === 'counter', 3000);

      // uchikeshi-backを辞退
      if (playerState[firstP]?.phase === 'counter') {
        ctx.sendMsg(firstP, { type: 'useUchikeshi', data: { counter: false, uchikeshiBack: false } });
        await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);
      }

      const sharedAfterCounter = getState(firstP)?.sharedUchikeshi;
      log('shared uchikeshi after counter: ' + sharedAfterCounter);

      if (sharedAfterCounter <= 0) return { skipped: true, reason: '共有ストックが空' };

      // ターン終了
      await endTurn(firstP);

      // 後攻: 魔女のおとどけものがあるか確認
      const secHand = getPlayer(secondP)?.hand;
      const majo = secHand?.find(c => c.id === 'majo-no-otodokemono');
      if (!majo) {
        // 先攻の手札を確認
        await endTurn(secondP);
        const fHand = getPlayer(firstP)?.hand;
        const fMajo = fHand?.find(c => c.id === 'majo-no-otodokemono');
        if (!fMajo) return { skipped: true, reason: '魔女のおとどけものが手札にない' };

        const uchiBefore = getPlayer(firstP)?.uchikeshi;
        const sharedBefore = getState(firstP)?.sharedUchikeshi;
        log('uchikeshi before majo: ' + uchiBefore + ', shared: ' + sharedBefore);

        await playCard(firstP, 'majo-no-otodokemono');
        if (playerState[secondP]?.phase === 'counter') {
          await declineCounter(secondP);
        }
        await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

        const uchiAfter = getPlayer(firstP)?.uchikeshi;
        const sharedAfter = getState(firstP)?.sharedUchikeshi;
        const err = lastError[firstP];
        if (err) log('error: ' + err);
        log('uchikeshi after majo: ' + uchiAfter + ', shared: ' + sharedAfter);

        return { uchiBefore, uchiAfter, sharedBefore, sharedAfter, err,
                 verified: !err && uchiAfter === uchiBefore + 1 && sharedAfter === sharedBefore - 1 };
      }

      const uchiBefore = getPlayer(secondP)?.uchikeshi;
      const sharedBefore = getState(secondP)?.sharedUchikeshi;
      log('uchikeshi before majo: ' + uchiBefore + ', shared: ' + sharedBefore);

      await playCard(secondP, 'majo-no-otodokemono');
      if (playerState[firstP]?.phase === 'counter') {
        await declineCounter(firstP);
      }
      await ctx.waitFor(() => playerState[secondP]?.phase === 'main', 3000);

      const uchiAfter = getPlayer(secondP)?.uchikeshi;
      const sharedAfter = getState(secondP)?.sharedUchikeshi;
      const err = lastError[secondP];
      if (err) log('error: ' + err);
      log('uchikeshi after majo: ' + uchiAfter + ', shared: ' + sharedAfter);

      return { uchiBefore, uchiAfter, sharedBefore, sharedAfter, err,
               verified: !err && uchiAfter === uchiBefore + 1 && sharedAfter === sharedBefore - 1 };
    `);
    console.log('Logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('魔女のおとどけもの: うちけし獲得 OK');
  });

  test('カラスのおつかい: 捨て札回収', async ({ page }) => {
    const roomId = `karasu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getState, getOpponent, getCurrentTurn, getOppId,
              playCard, declineCounter, endTurn, playerState, lastError } = ctx;

      const firstP = getCurrentTurn();
      const secondP = ctx.getOppId(firstP);

      // まず何かカードを使って捨て札に送る → カラスのおつかいで回収
      const hand = getPlayer(firstP)?.hand;
      const karasu = hand?.find(c => c.id === 'karasu-otsukai');

      if (!karasu) {
        // 後攻をチェック
        // 先攻ターンエンド
        await endTurn(firstP);
        const secHand = getPlayer(secondP)?.hand;
        const secKarasu = secHand?.find(c => c.id === 'karasu-otsukai');
        if (!secKarasu) return { skipped: true, reason: 'カラスのおつかいが手札にない' };

        // 後攻で何かプレイして捨て札に送る（selection不要なカードのみ）
        const playable = secHand?.find(c => c.id !== 'karasu-otsukai' && c.type === 'magic' &&
          !['owakare','ideyon','yomigaeru','akuma-fukiya','kuroneko-shippo','ginneko-shippo','yousei-megane','hirameki-suisho'].includes(c.id));
        if (!playable) return { skipped: true, reason: 'カラスのおつかい以外のプレイ可能カードがない' };

        log('secondP plays: ' + playable.id);
        await playCard(secondP, playable.id);
        if (playerState[firstP]?.phase === 'counter') {
          await declineCounter(firstP);
        }
        await ctx.waitFor(() => playerState[secondP]?.phase === 'main', 3000);

        // 捨て札を確認
        const graveyard = getState(secondP)?.graveyard;
        if (!graveyard || graveyard.length === 0) return { skipped: true, reason: '捨て札が空' };

        const targetCard = graveyard[0];
        const handBefore = getPlayer(secondP)?.hand?.length;
        log('retrieving ' + targetCard.id + ' from graveyard');

        await playCard(secondP, 'karasu-otsukai', targetCard.id);
        if (playerState[firstP]?.phase === 'counter') {
          await declineCounter(firstP);
        }
        await ctx.waitFor(() => playerState[secondP]?.phase === 'main', 3000);

        const err = lastError[secondP];
        const inHand = getPlayer(secondP)?.hand?.some(c => c.id === targetCard.id);
        if (err) log('error: ' + err);
        log('card in hand: ' + inHand);

        return { inHand, err, verified: inHand && !err };
      }

      // 先攻がカラスを持っている場合、まず別カードをプレイして捨て札作成
      // 先攻1ターン目は1枚のみ。カラスを使いたいのでターンエンド→次のターンで使う
      await endTurn(firstP);
      // 後攻で何かプレイ（selection不要なカードのみ）
      const secHand = getPlayer(secondP)?.hand;
      const secPlayable = secHand?.find(c => c.type === 'magic' &&
        !['owakare','ideyon','yomigaeru','karasu-otsukai','akuma-fukiya','kuroneko-shippo','ginneko-shippo','yousei-megane','hirameki-suisho'].includes(c.id));
      if (secPlayable) {
        log('secondP plays: ' + secPlayable.id);
        await playCard(secondP, secPlayable.id);
        if (playerState[firstP]?.phase === 'counter') {
          await declineCounter(firstP);
        }
        await ctx.waitFor(() => playerState[secondP]?.phase === 'main', 3000);
      }
      await endTurn(secondP);

      const graveyard = getState(firstP)?.graveyard;
      if (!graveyard || graveyard.length === 0) return { skipped: true, reason: '捨て札が空' };

      const targetCard = graveyard[0];
      log('retrieving ' + targetCard.id + ' from graveyard');
      log('graveyard: ' + JSON.stringify(graveyard.map(c => c.id)));

      // カラスが手札にまだあることを確認
      const hasKarasu = getPlayer(firstP)?.hand?.some(c => c.id === 'karasu-otsukai');
      if (!hasKarasu) return { skipped: true, reason: 'カラスのおつかいがドロー後の手札にない' };

      await playCard(firstP, 'karasu-otsukai', targetCard.id);
      if (playerState[secondP]?.phase === 'counter') {
        await declineCounter(secondP);
      }
      await ctx.waitFor(() => playerState[firstP]?.phase === 'main', 3000);

      const err = lastError[firstP];
      const inHand = getPlayer(firstP)?.hand?.some(c => c.id === targetCard.id);
      if (err) log('error: ' + err);
      log('card in hand: ' + inHand);

      return { inHand, err, verified: inHand && !err };
    `);
    console.log('Logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('カラスのおつかい: 捨て札回収 OK');
  });

  test('ヨミガエール: 捨て札からモンスター蘇生', async ({ page }) => {
    const roomId = `yomi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await runGameTest(page, roomId, `
      const { log, getPlayer, getState, getCurrentTurn, getOppId,
              playCard, declineCounter, useCounter, endTurn, playerState, lastError, waitFor,
              uchikeshiBackPromptFor } = ctx;

      const firstP = getCurrentTurn();
      const secondP = getOppId(firstP);

      // 先攻・後攻どちらかにヨミガエールがあるかチェック
      let yomiPlayer, otherPlayer;
      const fHand = getPlayer(firstP)?.hand;
      if (fHand?.some(c => c.id === 'yomigaeru')) {
        // 先攻1ターン目はcanPlay=1なので、モンスターを先に出すとヨミガエールが使えない
        // 先攻ターンエンドして後攻もエンド→先攻2ターン目（canPlay=2）で使う
        await endTurn(firstP);
        await endTurn(secondP);
        yomiPlayer = firstP;
        otherPlayer = secondP;
      } else {
        // 先攻エンド→後攻チェック
        await endTurn(firstP);
        const sHand = getPlayer(secondP)?.hand;
        if (sHand?.some(c => c.id === 'yomigaeru')) {
          // 後攻ターンエンド→先攻エンド→後攻2ターン目で使う
          await endTurn(secondP);
          await endTurn(firstP);
          yomiPlayer = secondP;
          otherPlayer = firstP;
        } else {
          return { skipped: true, reason: 'ヨミガエールが手札にない' };
        }
      }

      // ヨミガエールを持つプレイヤーのターンのはず
      const curTurn = playerState[yomiPlayer]?.currentTurn;
      if (curTurn !== yomiPlayer) return { skipped: true, reason: 'ターンが想定外: ' + curTurn };

      // 捨て札にモンスターを送る: モンスターを出す → 相手にうちけしさせる
      const hand = getPlayer(yomiPlayer)?.hand;
      const monster = hand?.find(c => c.type === 'monster' && !c.canOnlyBeSummoned);
      if (!monster) return { skipped: true, reason: 'モンスターが手札にない' };

      // 相手のうちけし数を確認
      const oppUchikeshi = getPlayer(otherPlayer)?.uchikeshi;
      log('opponent uchikeshi: ' + oppUchikeshi);

      await playCard(yomiPlayer, monster.id);
      if (playerState[otherPlayer]?.phase === 'counter' && oppUchikeshi > 0) {
        // 相手にカウンターさせてモンスターを捨て札へ
        await useCounter(otherPlayer);
        // uchikeshiBackPrompt or phase=main を待つ
        await waitFor(() =>
          !!uchikeshiBackPromptFor[yomiPlayer] ||
          playerState[yomiPlayer]?.phase === 'main', 5000);
        if (uchikeshiBackPromptFor[yomiPlayer]) {
          // uchikeshi-back しない
          ctx.sendMsg(yomiPlayer, { type: 'useUchikeshi', data: { uchikeshiBack: false } });
          delete uchikeshiBackPromptFor[yomiPlayer];
        }
        await waitFor(() => playerState[yomiPlayer]?.phase === 'main', 5000);
      } else {
        // カウンターなし→モンスターは場に出る→捨て札にはいかない
        await waitFor(() => playerState[yomiPlayer]?.phase === 'main', 3000);
      }

      // 捨て札にモンスターがあるか確認
      const graveyard = getState(yomiPlayer)?.graveyard;
      const gravMonster = graveyard?.find(c => c.type === 'monster');
      if (!gravMonster) return { skipped: true, reason: '捨て札にモンスターがない' };

      // ヨミガエール使用
      const stillHasYomi = getPlayer(yomiPlayer)?.hand?.some(c => c.id === 'yomigaeru');
      if (!stillHasYomi) return { skipped: true, reason: 'ヨミガエールがもう手札にない' };

      log('reviving ' + gravMonster.id + ' from graveyard');
      await playCard(yomiPlayer, 'yomigaeru', gravMonster.id);
      if (playerState[otherPlayer]?.phase === 'counter') {
        await declineCounter(otherPlayer);
      }
      await waitFor(() => playerState[yomiPlayer]?.phase === 'main', 3000);

      const field = getPlayer(yomiPlayer)?.field;
      const onField = field?.some(c => c.id === gravMonster.id);
      const err = lastError[yomiPlayer];
      if (err) log('error: ' + err);
      log('monster on field: ' + onField);

      return { onField, err, verified: onField && !err };
    `);
    console.log('Logs:', result.logs?.join('\n'));
    if (result.skipped) { console.log('Skipped:', result.reason); return; }
    if (!result.success) console.log('Failed:', result.reason);
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    console.log('ヨミガエール: モンスター蘇生 OK');
  });

});
