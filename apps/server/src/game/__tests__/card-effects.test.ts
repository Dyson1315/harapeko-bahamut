import { describe, it, expect } from 'vitest';
import { GameEngine } from '../game_engine';
import { getCardById } from '../../data/cards';
import type { Card, MonsterCard } from '../../types/game';

/**
 * ヘルパー: 制御されたゲームを開始
 * うちけしはデフォルト0にしてカウンターフェーズを回避
 */
function setup(opts?: {
  p1Hand?: string[];
  p2Hand?: string[];
  deck?: string[];
  firstPlayer?: string;
  p1Uchikeshi?: number;
  p2Uchikeshi?: number;
}): GameEngine {
  const engine = new GameEngine('test-room');
  engine.addPlayer('p1', 'Player1');
  engine.addPlayer('p2', 'Player2');
  engine.startGame();

  if (opts?.p1Hand) {
    engine.state.players['p1'].hand = opts.p1Hand.map(id => ({ ...getCardById(id)! }));
  }
  if (opts?.p2Hand) {
    engine.state.players['p2'].hand = opts.p2Hand.map(id => ({ ...getCardById(id)! }));
  }
  if (opts?.deck !== undefined) {
    engine.state.deck = opts.deck.map(id => ({ ...getCardById(id)! }));
  }
  if (opts?.firstPlayer) {
    engine.state.currentTurn = opts.firstPlayer;
  }

  // デフォルト: うちけし0でカウンターフェーズを回避
  engine.state.players['p1'].uchikeshi = opts?.p1Uchikeshi ?? 0;
  engine.state.players['p2'].uchikeshi = opts?.p2Uchikeshi ?? 0;
  engine.state.players['p1'].canPlay = 2;
  engine.state.players['p1'].playedCount = 0;
  engine.state.players['p2'].canPlay = 2;
  engine.state.players['p2'].playedCount = 0;

  return engine;
}

function card(id: string): Card {
  return { ...getCardById(id)! };
}

// ============================================================
// そらとぶナイフ: 相手に2ダメージ
// ============================================================
describe('そらとぶナイフ', () => {
  it('相手に2ダメージを与える', () => {
    const e = setup({ p1Hand: ['soratobu-naifu'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'soratobu-naifu');
    expect(r.success).toBe(true);
    expect(e.state.players['p2'].life).toBe(2);
    expect(e.state.players['p1'].life).toBe(4);
    expect(e.state.graveyard.some(c => c.id === 'soratobu-naifu')).toBe(true);
  });

  it('相手ライフ0でゲームオーバー', () => {
    const e = setup({ p1Hand: ['soratobu-naifu'], firstPlayer: 'p1' });
    e.state.players['p2'].life = 2;
    e.playCard('p1', 'soratobu-naifu');
    expect(e.state.players['p2'].life).toBe(0);
    expect(e.state.gameOver).toBe(true);
    expect(e.state.winner).toBe('p1');
  });

  it('はねかえしゴブリンでダメージ反射', () => {
    const e = setup({ p1Hand: ['soratobu-naifu'], firstPlayer: 'p1' });
    e.state.players['p2'].field.push(card('hanekaeshi-goblin') as MonsterCard);
    e.playCard('p1', 'soratobu-naifu');
    expect(e.state.players['p2'].life).toBe(4); // 反射
    expect(e.state.players['p1'].life).toBe(2); // 自分がダメージ
  });
});

// ============================================================
// こどもゴブリン
// ============================================================
describe('こどもゴブリン', () => {
  it('場に出せる', () => {
    const e = setup({ p1Hand: ['kodomo-goblin'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field).toHaveLength(1);
    expect(e.state.players['p1'].field[0].id).toBe('kodomo-goblin');
  });

  it('ターン開始時に1ダメージ', () => {
    const e = setup({
      p1Hand: ['kodomo-goblin'],
      p2Hand: ['soratobu-naifu', 'owakare', 'irekaeru', 'kodomo-goblin', 'gin-neko-shippo'],
      deck: ['hoshifuru-sunadokei', 'kuro-neko-shippo'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'kodomo-goblin');
    e.endTurn('p1');
    // p2ターン開始: p2のモンスターなし→ダメージなし
    expect(e.state.players['p2'].life).toBe(4);
    e.endTurn('p2', ['soratobu-naifu']); // 6枚→1枚捨て
    // p1ターン開始: p1のゴブリン→p2に1ダメージ
    expect(e.state.players['p2'].life).toBe(3);
  });
});

// ============================================================
// はらぺこバハムート
// ============================================================
describe('はらぺこバハムート', () => {
  it('手札から直接プレイできない', () => {
    const e = setup({ p1Hand: ['harapeko-bahamut'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'harapeko-bahamut');
    expect(r.success).toBe(false);
    expect(e.state.players['p1'].hand).toHaveLength(1);
  });

  it('イデヨンで召喚できる', () => {
    const e = setup({ p1Hand: ['ideyon', 'harapeko-bahamut'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'ideyon', 'harapeko-bahamut');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field).toHaveLength(1);
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');
  });

  it('毎ターン4ダメージ、はねかえし無効', () => {
    const e = setup({
      p1Hand: ['ideyon', 'harapeko-bahamut'],
      p2Hand: ['hanekaeshi-goblin', 'owakare', 'irekaeru', 'kodomo-goblin', 'gin-neko-shippo'],
      deck: ['hoshifuru-sunadokei', 'kuro-neko-shippo'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'ideyon', 'harapeko-bahamut');
    e.endTurn('p1');
    // p2がはねかえしゴブリンを出す
    e.playCard('p2', 'hanekaeshi-goblin');
    e.endTurn('p2', ['owakare']);
    // p1ターン開始: バハムート4ダメ→はねかえし無効→p2に4ダメ
    expect(e.state.players['p2'].life).toBe(0);
    expect(e.state.players['p1'].life).toBe(4);
    expect(e.state.gameOver).toBe(true);
  });
});

// ============================================================
// はねかえしゴブリン
// ============================================================
describe('はねかえしゴブリン', () => {
  it('場に出せる', () => {
    const e = setup({ p1Hand: ['hanekaeshi-goblin'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'hanekaeshi-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('hanekaeshi-goblin');
  });

  it('こどもゴブリンのダメージも反射', () => {
    const e = setup({
      p1Hand: ['hanekaeshi-goblin', 'soratobu-naifu', 'owakare', 'irekaeru', 'gin-neko-shippo'],
      p2Hand: ['kodomo-goblin', 'soratobu-naifu', 'owakare', 'irekaeru', 'gin-neko-shippo'],
      deck: ['hoshifuru-sunadokei', 'kuro-neko-shippo'],
      firstPlayer: 'p2',
    });
    e.playCard('p2', 'kodomo-goblin');
    e.endTurn('p2');
    e.playCard('p1', 'hanekaeshi-goblin');
    e.endTurn('p1', ['soratobu-naifu']);
    // p2ターン開始: p2のゴブリン→p1へ1ダメ→はねかえし→p2に反射
    expect(e.state.players['p1'].life).toBe(4);
    expect(e.state.players['p2'].life).toBe(3);
  });

  it('そらとぶナイフのダメージも反射', () => {
    const e = setup({ p1Hand: ['soratobu-naifu'], firstPlayer: 'p1' });
    e.state.players['p2'].field.push(card('hanekaeshi-goblin') as MonsterCard);
    e.playCard('p1', 'soratobu-naifu');
    expect(e.state.players['p1'].life).toBe(2);
    expect(e.state.players['p2'].life).toBe(4);
  });
});

// ============================================================
// オワカーレ: 相手の場のモンスター破壊
// ============================================================
describe('オワカーレ', () => {
  it('相手の場のモンスターを破壊する', () => {
    const e = setup({ p1Hand: ['owakare'], firstPlayer: 'p1' });
    e.state.players['p2'].field.push(card('kodomo-goblin') as MonsterCard);
    const r = e.playCard('p1', 'owakare', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p2'].field).toHaveLength(0);
    expect(e.state.graveyard.some(c => c.id === 'kodomo-goblin')).toBe(true);
  });

  it('ターゲット未指定でカードが手札に戻る', () => {
    const e = setup({ p1Hand: ['owakare'], firstPlayer: 'p1' });
    e.state.players['p2'].field.push(card('kodomo-goblin') as MonsterCard);
    const r = e.playCard('p1', 'owakare');
    expect(r.success).toBe(false);
    expect(e.state.players['p1'].hand.some(c => c.id === 'owakare')).toBe(true);
    expect(e.state.players['p1'].playedCount).toBe(0);
  });

  it('存在しないモンスターを指定すると失敗', () => {
    const e = setup({ p1Hand: ['owakare'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'owakare', 'kodomo-goblin');
    // カウンターフェーズをスキップして解決するが、フィールドにいないので失敗
    expect(r.success).toBe(false);
  });
});

// ============================================================
// イデヨン: 手札からモンスター召喚
// ============================================================
describe('イデヨン', () => {
  it('手札のモンスターを場に出す', () => {
    const e = setup({ p1Hand: ['ideyon', 'kodomo-goblin'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'ideyon', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field).toHaveLength(1);
    expect(e.state.players['p1'].field[0].id).toBe('kodomo-goblin');
    expect(e.state.graveyard.some(c => c.id === 'ideyon')).toBe(true);
    expect(e.state.players['p1'].hand.some(c => c.id === 'kodomo-goblin')).toBe(false);
  });

  it('魔法カードを対象にできない', () => {
    const e = setup({ p1Hand: ['ideyon', 'soratobu-naifu'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'ideyon', 'soratobu-naifu');
    expect(r.success).toBe(false);
  });

  it('ターゲット未指定でカードが手札に戻る', () => {
    const e = setup({ p1Hand: ['ideyon', 'kodomo-goblin'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'ideyon');
    expect(r.success).toBe(false);
    expect(e.state.players['p1'].hand.some(c => c.id === 'ideyon')).toBe(true);
    expect(e.state.players['p1'].playedCount).toBe(0);
  });

  it('canOnlyBeSummonedのモンスターも召喚できる', () => {
    const e = setup({ p1Hand: ['ideyon', 'harapeko-bahamut'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'ideyon', 'harapeko-bahamut');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');
  });
});

// ============================================================
// ヨミガエール: 捨て札からモンスター蘇生
// ============================================================
describe('ヨミガエール', () => {
  it('捨て札のモンスターを場に出す', () => {
    const e = setup({ p1Hand: ['yomigaeru'], firstPlayer: 'p1' });
    e.state.graveyard.push(card('kodomo-goblin'));
    const r = e.playCard('p1', 'yomigaeru', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('kodomo-goblin');
    expect(e.state.graveyard.some(c => c.id === 'kodomo-goblin')).toBe(false);
  });

  it('魔法カードは対象にできない', () => {
    const e = setup({ p1Hand: ['yomigaeru'], firstPlayer: 'p1' });
    e.state.graveyard.push(card('soratobu-naifu'));
    const r = e.playCard('p1', 'yomigaeru', 'soratobu-naifu');
    expect(r.success).toBe(false);
  });

  it('捨て札にないモンスターは蘇生できない', () => {
    const e = setup({ p1Hand: ['yomigaeru'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'yomigaeru', 'kodomo-goblin');
    expect(r.success).toBe(false);
  });

  it('はらぺこバハムートも蘇生できる', () => {
    const e = setup({ p1Hand: ['yomigaeru'], firstPlayer: 'p1' });
    e.state.graveyard.push(card('harapeko-bahamut'));
    const r = e.playCard('p1', 'yomigaeru', 'harapeko-bahamut');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');
  });
});

// ============================================================
// イレカエール: ゴブリン⇔バハムート入替
// ============================================================
describe('イレカエール', () => {
  it('手札のゴブリンとバハムートが入れ替わる', () => {
    const e = setup({
      p1Hand: ['irekaeru', 'kodomo-goblin'],
      p2Hand: ['harapeko-bahamut'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'irekaeru');
    expect(e.state.players['p1'].hand.some(c => c.id === 'harapeko-bahamut')).toBe(true);
    expect(e.state.players['p2'].hand.some(c => c.id === 'kodomo-goblin')).toBe(true);
  });

  it('場のモンスターも入れ替わる', () => {
    const e = setup({ p1Hand: ['irekaeru'], firstPlayer: 'p1' });
    e.state.players['p1'].field.push(card('kodomo-goblin') as MonsterCard);
    e.state.players['p2'].field.push(card('harapeko-bahamut') as MonsterCard);
    e.playCard('p1', 'irekaeru');
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');
    expect(e.state.players['p2'].field[0].id).toBe('kodomo-goblin');
  });

  it('山札・捨て札も入れ替わる', () => {
    const e = setup({
      p1Hand: ['irekaeru'],
      deck: ['kodomo-goblin'],
      firstPlayer: 'p1',
    });
    e.state.graveyard.push(card('harapeko-bahamut'));
    e.playCard('p1', 'irekaeru');
    expect(e.state.deck[0].id).toBe('harapeko-bahamut');
    expect(e.state.graveyard.some(c => c.id === 'kodomo-goblin')).toBe(true);
  });

  it('どちらも存在しない場合は何も変わらない', () => {
    const e = setup({
      p1Hand: ['irekaeru', 'soratobu-naifu'],
      p2Hand: ['owakare'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'irekaeru');
    expect(e.state.players['p1'].hand[0].id).toBe('soratobu-naifu');
    expect(e.state.players['p2'].hand[0].id).toBe('owakare');
  });
});

// ============================================================
// 黒ネコのしっぽ: 2ドロー → 2捨て → +1プレイ
// ============================================================
describe('黒ネコのしっぽ', () => {
  it('2枚ドローしselectionを要求', () => {
    const e = setup({
      p1Hand: ['kuro-neko-shippo'],
      deck: ['soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    const r = e.playCard('p1', 'kuro-neko-shippo');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(2);
    expect(e.state.pendingEffect?.requiresSelection).toBe(true);
  });

  it('2枚捨ててcanPlay+1', () => {
    const e = setup({
      p1Hand: ['kuro-neko-shippo'],
      deck: ['soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'kuro-neko-shippo');
    const before = e.state.players['p1'].canPlay;
    const r = e.completeCardSelection('p1', ['soratobu-naifu', 'owakare']);
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(0);
    expect(e.state.players['p1'].canPlay).toBe(before + 1);
  });

  it('1枚だと失敗', () => {
    const e = setup({
      p1Hand: ['kuro-neko-shippo'],
      deck: ['soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'kuro-neko-shippo');
    const r = e.completeCardSelection('p1', ['soratobu-naifu']);
    expect(r.success).toBe(false);
  });
});

// ============================================================
// 銀ネコのしっぽ: 3ドロー → 2捨て
// ============================================================
describe('銀ネコのしっぽ', () => {
  it('3枚ドローしselectionを要求', () => {
    const e = setup({
      p1Hand: ['gin-neko-shippo'],
      deck: ['soratobu-naifu', 'owakare', 'irekaeru'],
      firstPlayer: 'p1',
    });
    const r = e.playCard('p1', 'gin-neko-shippo');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(3);
  });

  it('2枚捨てる（canPlayは変わらない）', () => {
    const e = setup({
      p1Hand: ['gin-neko-shippo'],
      deck: ['soratobu-naifu', 'owakare', 'irekaeru'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'gin-neko-shippo');
    const before = e.state.players['p1'].canPlay;
    const r = e.completeCardSelection('p1', ['soratobu-naifu', 'owakare']);
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(1);
    expect(e.state.players['p1'].hand[0].id).toBe('irekaeru');
    expect(e.state.players['p1'].canPlay).toBe(before);
  });
});

// ============================================================
// カラスのおつかい: 捨て札から1枚回収
// ============================================================
describe('カラスのおつかい', () => {
  it('捨て札のカードを手札に加える', () => {
    const e = setup({ p1Hand: ['karasu-otsukai'], firstPlayer: 'p1' });
    e.state.graveyard.push(card('soratobu-naifu'));
    const r = e.playCard('p1', 'karasu-otsukai', 'soratobu-naifu');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].hand.some(c => c.id === 'soratobu-naifu')).toBe(true);
    expect(e.state.graveyard.some(c => c.id === 'karasu-otsukai')).toBe(true);
    expect(e.state.graveyard.some(c => c.id === 'soratobu-naifu')).toBe(false);
  });

  it('捨て札にないカードは回収できない', () => {
    const e = setup({ p1Hand: ['karasu-otsukai'], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'karasu-otsukai', 'soratobu-naifu');
    expect(r.success).toBe(false);
  });

  it('モンスターも回収できる', () => {
    const e = setup({ p1Hand: ['karasu-otsukai'], firstPlayer: 'p1' });
    e.state.graveyard.push(card('kodomo-goblin'));
    const r = e.playCard('p1', 'karasu-otsukai', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].hand.some(c => c.id === 'kodomo-goblin')).toBe(true);
  });
});

// ============================================================
// ようせいのメガネ: 山札サーチ
// ============================================================
describe('ようせいのメガネ', () => {
  it('山札からカードを選んで手札に加える', () => {
    const e = setup({
      p1Hand: ['yousei-no-megane'],
      deck: ['soratobu-naifu', 'owakare', 'kodomo-goblin'],
      firstPlayer: 'p1',
    });
    const r = e.playCard('p1', 'yousei-no-megane');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBe(true);
    expect(e.state.pendingEffect?.revealDeck).toBe(true);

    const sr = e.completeCardSelection('p1', ['owakare']);
    expect(sr.success).toBe(true);
    expect(e.state.players['p1'].hand.some(c => c.id === 'owakare')).toBe(true);
    expect(e.state.deck.some(c => c.id === 'owakare')).toBe(false);
  });

  it('山札が空なら効果なし', () => {
    const e = setup({ p1Hand: ['yousei-no-megane'], deck: [], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'yousei-no-megane');
    // 山札空→success: true (効果なし)
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBeUndefined();
  });
});

// ============================================================
// あくまの吹き矢: 相手手札公開→1枚捨て
// ============================================================
describe('あくまの吹き矢', () => {
  it('相手の手札から1枚捨てさせる', () => {
    const e = setup({
      p1Hand: ['akuma-fukiya'],
      p2Hand: ['soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    const r = e.playCard('p1', 'akuma-fukiya');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBe(true);
    expect(e.state.pendingEffect?.revealOpponentHand).toBe(true);

    const sr = e.completeCardSelection('p1', ['soratobu-naifu']);
    expect(sr.success).toBe(true);
    expect(e.state.players['p2'].hand).toHaveLength(1);
    expect(e.state.players['p2'].hand[0].id).toBe('owakare');
    expect(e.state.graveyard.some(c => c.id === 'soratobu-naifu')).toBe(true);
  });

  it('相手の手札が空なら効果なし', () => {
    const e = setup({ p1Hand: ['akuma-fukiya'], p2Hand: [], firstPlayer: 'p1' });
    const r = e.playCard('p1', 'akuma-fukiya');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBeUndefined();
  });
});

// ============================================================
// ひらめき水晶: カード名宣言→奪取
// ============================================================
describe('ひらめき水晶', () => {
  it('相手の手札にあるカードを奪える', () => {
    const e = setup({
      p1Hand: ['hirameki-suishou'],
      p2Hand: ['soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    const r = e.playCard('p1', 'hirameki-suishou');
    expect(r.success).toBe(true);
    expect(r.needsSelection).toBe(true);
    expect(e.state.pendingEffect?.revealAllCards).toBe(true);

    const sr = e.completeCardSelection('p1', ['soratobu-naifu']);
    expect(sr.success).toBe(true);
    expect(e.state.players['p1'].hand.some(c => c.id === 'soratobu-naifu')).toBe(true);
    expect(e.state.players['p2'].hand.some(c => c.id === 'soratobu-naifu')).toBe(false);
  });

  it('持っていないカードを宣言しても成功（ハズレ）', () => {
    const e = setup({
      p1Hand: ['hirameki-suishou'],
      p2Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'hirameki-suishou');
    const sr = e.completeCardSelection('p1', ['owakare']);
    expect(sr.success).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(0);
  });

  it('ひらめき水晶自身は選択できない', () => {
    const e = setup({
      p1Hand: ['hirameki-suishou'],
      p2Hand: ['hirameki-suishou'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'hirameki-suishou');
    const sr = e.completeCardSelection('p1', ['hirameki-suishou']);
    expect(sr.success).toBe(false);
  });
});

// ============================================================
// ほしふる砂時計: +2プレイ
// ============================================================
describe('ほしふる砂時計', () => {
  it('canPlayが+2される', () => {
    const e = setup({ p1Hand: ['hoshifuru-sunadokei'], firstPlayer: 'p1' });
    const before = e.state.players['p1'].canPlay;
    e.playCard('p1', 'hoshifuru-sunadokei');
    expect(e.state.players['p1'].canPlay).toBe(before + 2);
  });

  it('追加プレイで更にカードを使える', () => {
    const e = setup({
      p1Hand: ['hoshifuru-sunadokei', 'soratobu-naifu', 'owakare'],
      firstPlayer: 'p1',
    });
    e.state.players['p1'].canPlay = 1;
    e.playCard('p1', 'hoshifuru-sunadokei'); // canPlay: 1+2=3, played: 1
    const r = e.playCard('p1', 'soratobu-naifu'); // played: 2
    expect(r.success).toBe(true);
    expect(e.state.players['p2'].life).toBe(2);
  });
});

// ============================================================
// 魔女のおとどけもの: うちけし獲得
// ============================================================
describe('魔女のおとどけもの', () => {
  it('共有ストックからうちけし1獲得', () => {
    const e = setup({ p1Hand: ['majo-no-otodokemono'], firstPlayer: 'p1' });
    e.state.sharedUchikeshi = 2;
    const before = e.state.players['p1'].uchikeshi;
    e.playCard('p1', 'majo-no-otodokemono');
    expect(e.state.players['p1'].uchikeshi).toBe(before + 1);
    expect(e.state.sharedUchikeshi).toBe(1);
  });

  it('共有ストックが空だと失敗', () => {
    const e = setup({ p1Hand: ['majo-no-otodokemono'], firstPlayer: 'p1' });
    e.state.sharedUchikeshi = 0;
    const r = e.playCard('p1', 'majo-no-otodokemono');
    expect(r.success).toBe(false);
  });
});

// ============================================================
// うちけし機構
// ============================================================
describe('うちけし機構', () => {
  it('カウンターでカードを無効化', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
      p2Uchikeshi: 1,
    });
    const r = e.playCard('p1', 'soratobu-naifu');
    expect(r.awaitingCounter).toBe(true);
    expect(e.state.phase).toBe('counter');

    // p2がカウンター（p1のuchikeshi=0なのでuchikeshi-back不可→即キャンセル）
    const uc = e.useUchikeshi('p2', true);
    expect(uc.success).toBe(true);
    expect(uc.effectCancelled).toBe(true);

    e.cardManager.cancelEffect(e.state);
    expect(e.state.players['p2'].life).toBe(4);
    expect(e.state.players['p2'].uchikeshi).toBe(0);
    expect(e.state.sharedUchikeshi).toBe(1);
    expect(e.state.graveyard.some(c => c.id === 'soratobu-naifu')).toBe(true);
  });

  it('うちけし返しで効果を通す', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
      p1Uchikeshi: 2,
      p2Uchikeshi: 1,
    });
    e.playCard('p1', 'soratobu-naifu');
    const uc = e.useUchikeshi('p2', true);
    expect(uc.awaitingUchikeshiBack).toBe(true);

    // p1がうちけし返し（使う）
    const back = e.useUchikeshi('p1', false, true);
    expect(back.effectResolved).toBe(true);

    e.state.pendingEffect!.awaitingCounter = false;
    const er = e.executeCardEffect();
    expect(er.success).toBe(true);
    expect(e.state.players['p2'].life).toBe(2);
    expect(e.state.players['p1'].uchikeshi).toBe(0);
    expect(e.state.sharedUchikeshi).toBe(3); // 1(counter) + 2(back)
  });

  it('うちけし返しを使わない場合キャンセル', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
      p1Uchikeshi: 2,
      p2Uchikeshi: 1,
    });
    e.playCard('p1', 'soratobu-naifu');
    e.useUchikeshi('p2', true);
    const back = e.useUchikeshi('p1', false, false);
    expect(back.effectCancelled).toBe(true);
    e.cardManager.cancelEffect(e.state);
    expect(e.state.players['p2'].life).toBe(4);
  });

  it('カウンターしない場合効果通る', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
      p2Uchikeshi: 1,
    });
    e.playCard('p1', 'soratobu-naifu');
    const uc = e.useUchikeshi('p2', false);
    expect(uc.effectResolved).toBe(true);

    e.state.pendingEffect!.awaitingCounter = false;
    e.executeCardEffect();
    expect(e.state.players['p2'].life).toBe(2);
  });

  it('うちけし0ならカウンターフェーズスキップ', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      firstPlayer: 'p1',
      p2Uchikeshi: 0,
    });
    const r = e.playCard('p1', 'soratobu-naifu');
    expect(r.awaitingCounter).toBeUndefined();
    expect(e.state.players['p2'].life).toBe(2);
  });

  it('モンスターもうちけしで無効化', () => {
    const e = setup({
      p1Hand: ['kodomo-goblin'],
      firstPlayer: 'p1',
      p2Uchikeshi: 1,
    });
    e.playCard('p1', 'kodomo-goblin');
    e.useUchikeshi('p2', true);
    e.cardManager.cancelEffect(e.state);
    expect(e.state.players['p1'].field).toHaveLength(0);
    expect(e.state.graveyard.some(c => c.id === 'kodomo-goblin')).toBe(true);
  });

  it('うちけし使用後は共有プールに移動（ターン変更で自動配布されない）', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      p2Hand: ['soratobu-naifu', 'owakare', 'irekaeru', 'kodomo-goblin', 'gin-neko-shippo'],
      deck: ['hoshifuru-sunadokei'],
      firstPlayer: 'p1',
      p2Uchikeshi: 1,
    });
    e.playCard('p1', 'soratobu-naifu');
    e.useUchikeshi('p2', true);
    e.cardManager.cancelEffect(e.state);
    expect(e.state.sharedUchikeshi).toBe(1);

    // ターンエンド→次のターン
    e.endTurn('p1');
    // 共有プールは変わらない（自動配布されない）
    expect(e.state.sharedUchikeshi).toBe(1);
    expect(e.state.players['p1'].uchikeshi).toBe(0);
    expect(e.state.players['p2'].uchikeshi).toBe(0);
  });
});

// ============================================================
// ターン管理
// ============================================================
describe('ターン管理', () => {
  it('自分のターンでないとプレイできない', () => {
    const e = setup({ p1Hand: ['soratobu-naifu'], firstPlayer: 'p2' });
    const r = e.playCard('p1', 'soratobu-naifu');
    expect(r.success).toBe(false);
  });

  it('canPlayを超えてプレイできない', () => {
    const e = setup({ p1Hand: ['soratobu-naifu', 'owakare'], firstPlayer: 'p1' });
    e.state.players['p1'].canPlay = 1;
    e.playCard('p1', 'soratobu-naifu');
    const r = e.playCard('p1', 'owakare', 'kodomo-goblin');
    expect(r.success).toBe(false);
  });

  it('手札6枚以上で捨てないとターンエンドできない', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu', 'owakare', 'ideyon', 'kodomo-goblin', 'irekaeru', 'gin-neko-shippo'],
      p2Hand: ['soratobu-naifu', 'owakare', 'ideyon', 'kodomo-goblin', 'irekaeru'],
      deck: ['hoshifuru-sunadokei'],
      firstPlayer: 'p1',
    });
    const r = e.endTurn('p1');
    expect(r.success).toBe(false);
    expect(r.message).toContain('discard');
  });

  it('正しい枚数捨てればエンドできる', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu', 'owakare', 'ideyon', 'kodomo-goblin', 'irekaeru', 'gin-neko-shippo'],
      p2Hand: ['soratobu-naifu', 'owakare', 'ideyon', 'kodomo-goblin', 'irekaeru'],
      deck: ['hoshifuru-sunadokei'],
      firstPlayer: 'p1',
    });
    const r = e.endTurn('p1', ['gin-neko-shippo']);
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].hand).toHaveLength(5);
  });

  it('先攻1ターン目はcanPlay=1', () => {
    const e = new GameEngine('test');
    e.addPlayer('p1', 'P1');
    e.addPlayer('p2', 'P2');
    e.startGame();
    const first = e.state.currentTurn!;
    expect(e.state.players[first].canPlay).toBe(1);
  });
});

// ============================================================
// デッキリシャッフル
// ============================================================
describe('デッキリシャッフル', () => {
  it('デッキ空でドロー時に捨て札からリシャッフル', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu'],
      p2Hand: ['owakare', 'ideyon', 'kodomo-goblin', 'irekaeru', 'gin-neko-shippo'],
      deck: [],
      firstPlayer: 'p1',
    });
    e.state.graveyard = [card('hoshifuru-sunadokei'), card('kuro-neko-shippo')];
    e.playCard('p1', 'soratobu-naifu');
    e.endTurn('p1');
    e.endTurn('p2', ['owakare']);
    // p1ドロー: デッキ空→捨て札(ナイフ+砂時計+黒ネコ+オワカーレ)リシャッフル→1枚ドロー
    expect(e.state.players['p1'].hand.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 複合シナリオ
// ============================================================
describe('複合シナリオ', () => {
  it('イデヨン→バハムート→オワカーレで除去', () => {
    const e = setup({
      p1Hand: ['ideyon', 'harapeko-bahamut'],
      p2Hand: ['owakare', 'soratobu-naifu', 'irekaeru', 'kodomo-goblin', 'gin-neko-shippo'],
      deck: ['hoshifuru-sunadokei', 'kuro-neko-shippo'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'ideyon', 'harapeko-bahamut');
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');

    e.endTurn('p1');
    const r = e.playCard('p2', 'owakare', 'harapeko-bahamut');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field).toHaveLength(0);
    expect(e.state.graveyard.some(c => c.id === 'harapeko-bahamut')).toBe(true);
  });

  it('黒ネコ→砂時計→ナイフの連続プレイ', () => {
    const e = setup({
      p1Hand: ['kuro-neko-shippo', 'hoshifuru-sunadokei', 'soratobu-naifu', 'owakare', 'ideyon'],
      deck: ['kodomo-goblin', 'irekaeru'],
      firstPlayer: 'p1',
    });
    // 黒ネコ: 2ドロー→selection
    e.playCard('p1', 'kuro-neko-shippo');
    e.completeCardSelection('p1', ['owakare', 'ideyon']);
    // canPlay=2+1=3, played=1, 手札: sunadokei, naifu, goblin, irekaeru

    e.playCard('p1', 'hoshifuru-sunadokei'); // canPlay=3+2=5, played=2
    const r = e.playCard('p1', 'soratobu-naifu'); // played=3
    expect(r.success).toBe(true);
    expect(e.state.players['p2'].life).toBe(2);
  });

  it('イレカエール→イデヨンでバハムート召喚', () => {
    const e = setup({
      p1Hand: ['irekaeru', 'ideyon', 'kodomo-goblin'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'irekaeru');
    expect(e.state.players['p1'].hand.some(c => c.id === 'harapeko-bahamut')).toBe(true);
    // イデヨンは使えなくなっている場合はplayedCountチェック
    // played=1, canPlay=2 → まだプレイ可
    // ただしイデヨンはイレカエールで変換されない（ideyon ≠ goblin/bahamut）
    const r = e.playCard('p1', 'ideyon', 'harapeko-bahamut');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('harapeko-bahamut');
  });

  it('うちけし→共有→魔女のおとどけもので回収', () => {
    const e = setup({
      p1Hand: ['soratobu-naifu', 'majo-no-otodokemono'],
      firstPlayer: 'p1',
      p2Uchikeshi: 1,
    });
    e.state.sharedUchikeshi = 0;

    e.playCard('p1', 'soratobu-naifu');
    e.useUchikeshi('p2', true);
    e.cardManager.cancelEffect(e.state);
    expect(e.state.sharedUchikeshi).toBe(1);

    const r = e.playCard('p1', 'majo-no-otodokemono');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].uchikeshi).toBe(1);
    expect(e.state.sharedUchikeshi).toBe(0);
  });

  it('カラスのおつかい→ヨミガエール連携', () => {
    const e = setup({
      p1Hand: ['karasu-otsukai', 'yomigaeru'],
      firstPlayer: 'p1',
    });
    e.state.graveyard.push(card('kodomo-goblin'));

    e.playCard('p1', 'karasu-otsukai', 'kodomo-goblin');
    expect(e.state.players['p1'].hand.some(c => c.id === 'kodomo-goblin')).toBe(true);

    const r = e.playCard('p1', 'kodomo-goblin');
    expect(r.success).toBe(true);
    expect(e.state.players['p1'].field[0].id).toBe('kodomo-goblin');
  });

  it('あくまの吹き矢で奪った後にカウンター要素なし', () => {
    const e = setup({
      p1Hand: ['akuma-fukiya'],
      p2Hand: ['soratobu-naifu', 'majo-no-otodokemono'],
      firstPlayer: 'p1',
    });
    e.playCard('p1', 'akuma-fukiya');
    e.completeCardSelection('p1', ['majo-no-otodokemono']);
    expect(e.state.players['p2'].hand).toHaveLength(1);
    expect(e.state.players['p2'].hand[0].id).toBe('soratobu-naifu');
    expect(e.state.graveyard.some(c => c.id === 'majo-no-otodokemono')).toBe(true);
  });
});
