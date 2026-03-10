import type { Card, MonsterCard, MagicCard } from '../types/game';

/** Monster cards (3 types) */
const monsterCards: MonsterCard[] = [
  {
    id: 'harapeko-bahamut',
    name: 'はらぺこバハムート',
    type: 'monster',
    description: '場に出すと毎ターン4ダメージ。召喚カードでのみ場に出せる。',
    damage: 4,
    canOnlyBeSummoned: true,
  },
  {
    id: 'kodomo-goblin',
    name: 'こどもゴブリン',
    type: 'monster',
    description: '場に出すと毎ターン1ダメージ。',
    damage: 1,
  },
  {
    id: 'hanekaeshi-goblin',
    name: 'はねかえしゴブリン',
    type: 'monster',
    description: '場に出ている限り、受けるダメージは代わりに相手に与えられる。ただし「はらぺこバハムート」からの攻撃は防げない。',
  },
];

/** Magic cards (13 types) */
const magicCards: MagicCard[] = [
  {
    id: 'soratobu-naifu',
    name: 'そらとぶナイフ',
    type: 'magic',
    description: '相手に2ダメージを与える。',
    effect: 'directDamage',
  },
  {
    id: 'owakare',
    name: 'オワカーレ',
    type: 'magic',
    description: '場のまもの1体を破壊する。',
    effect: 'destroyMonster',
  },
  {
    id: 'ideyon',
    name: 'イデヨン',
    type: 'magic',
    description: '手札からまもの1体を場に出す。',
    effect: 'summonFromHand',
  },
  {
    id: 'yomigaeru',
    name: 'ヨミガエール',
    type: 'magic',
    description: '捨て札からまもの1体を場に出す。',
    effect: 'summonFromGraveyard',
  },
  {
    id: 'irekaeru',
    name: 'イレカエール',
    type: 'magic',
    description: '自分と相手のバハムートを入れ替える。',
    effect: 'swapBahamuts',
  },
  {
    id: 'kuro-neko-shippo',
    name: '黒ネコのしっぽ',
    type: 'magic',
    description: '山札から2枚引き、手札から2枚捨て、追加で1枚カードを使える。',
    effect: 'drawDiscardPlay',
  },
  {
    id: 'gin-neko-shippo',
    name: '銀ネコのしっぽ',
    type: 'magic',
    description: '山札から3枚引き、手札から2枚捨てる。',
    effect: 'drawDiscard',
  },
  {
    id: 'karasu-otsukai',
    name: 'カラスのおつかい',
    type: 'magic',
    description: '捨て札からカード1枚を手札に加える。',
    effect: 'retrieveFromGraveyard',
  },
  {
    id: 'yousei-no-megane',
    name: 'ようせいのメガネ',
    type: 'magic',
    description: '山札からカード1枚を探して手札に加える。',
    effect: 'searchDeck',
  },
  {
    id: 'akuma-fukiya',
    name: 'あくまの吹き矢',
    type: 'magic',
    description: '相手の手札を1枚捨てさせる。',
    effect: 'handDiscard',
  },
  {
    id: 'hirameki-suishou',
    name: 'ひらめき水晶',
    type: 'magic',
    description: '相手の手札を見てカード名を宣言し、あれば奪う。',
    effect: 'stealNamedCard',
  },
  {
    id: 'hoshifuru-sunadokei',
    name: 'ほしふる砂時計',
    type: 'magic',
    description: 'このターン追加で2枚カードを使える。',
    effect: 'additionalPlays',
  },
  {
    id: 'majo-no-otodokemono',
    name: '魔女のおとどけもの',
    type: 'magic',
    description: 'うちけしを1つ得る。',
    effect: 'gainUchikeshi',
  },
];

/** All card definitions */
const allCards: Card[] = [...monsterCards, ...magicCards];

/**
 * Get a card definition by its ID.
 */
export function getCardById(id: string): Card | undefined {
  return allCards.find((c) => c.id === id);
}

/**
 * Get all card definitions.
 */
export function getAllCards(): Card[] {
  return [...allCards];
}

/**
 * Create a new deck (16 cards, one of each).
 */
export function createDeck(): Card[] {
  return allCards.map((card) => ({ ...card }));
}

/**
 * Shuffle a deck in-place using Fisher-Yates algorithm.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
