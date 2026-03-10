import { Card, CardType, MonsterCard, MagicCard } from '../types/card';

/** 全16枚のカード定義（クライアント側マスタデータ） */
const ALL_CARDS: Card[] = [
  // --- まものカード ---
  {
    id: 'harapeko-bahamut',
    name: 'はらぺこバハムート',
    type: 'monster',
    description: '場に出すと毎ターン4ダメージ。召喚カードでのみ場に出せる。',
    damage: 4,
    canOnlyBeSummoned: true,
  } as MonsterCard,
  {
    id: 'kodomo-goblin',
    name: 'こどもゴブリン',
    type: 'monster',
    description: '場に出すと毎ターン1ダメージ。',
    damage: 1,
  } as MonsterCard,
  {
    id: 'hanekaeshi-goblin',
    name: 'はねかえしゴブリン',
    type: 'monster',
    description: '場に出ている限り、受けるダメージは代わりに相手に与えられる。ただし「はらぺこバハムート」からの攻撃は防げない。',
  } as MonsterCard,

  // --- 魔法カード ---
  {
    id: 'soratobu-naifu',
    name: 'そらとぶナイフ',
    type: 'magic',
    description: '相手に2ダメージを与える。',
    effect: 'directDamage',
  } as MagicCard,
  {
    id: 'owakare',
    name: 'オワカーレ',
    type: 'magic',
    description: '場のまもの1体を破壊する。',
    effect: 'destroyMonster',
  } as MagicCard,
  {
    id: 'ideyon',
    name: 'イデヨン',
    type: 'magic',
    description: '手札からまもの1体を場に出す。',
    effect: 'summonFromHand',
  } as MagicCard,
  {
    id: 'yomigaeru',
    name: 'ヨミガエール',
    type: 'magic',
    description: '捨て札からまもの1体を場に出す。',
    effect: 'summonFromGraveyard',
  } as MagicCard,
  {
    id: 'irekaeru',
    name: 'イレカエール',
    type: 'magic',
    description: '自分と相手のバハムートを入れ替える。',
    effect: 'swapBahamuts',
  } as MagicCard,
  {
    id: 'kuro-neko-shippo',
    name: '黒ネコのしっぽ',
    type: 'magic',
    description: '山札から2枚引き、手札から2枚捨て、追加で1枚カードを使える。',
    effect: 'drawDiscardPlay',
  } as MagicCard,
  {
    id: 'gin-neko-shippo',
    name: '銀ネコのしっぽ',
    type: 'magic',
    description: '山札から3枚引き、手札から2枚捨てる。',
    effect: 'drawDiscard',
  } as MagicCard,
  {
    id: 'karasu-otsukai',
    name: 'カラスのおつかい',
    type: 'magic',
    description: '捨て札からカード1枚を手札に加える。',
    effect: 'retrieveFromGraveyard',
  } as MagicCard,
  {
    id: 'yousei-no-megane',
    name: 'ようせいのメガネ',
    type: 'magic',
    description: '山札からカード1枚を探して手札に加える。',
    effect: 'searchDeck',
  } as MagicCard,
  {
    id: 'akuma-fukiya',
    name: 'あくまの吹き矢',
    type: 'magic',
    description: '相手の手札を1枚捨てさせる。',
    effect: 'handDiscard',
  } as MagicCard,
  {
    id: 'hirameki-suishou',
    name: 'ひらめき水晶',
    type: 'magic',
    description: '相手の手札を見てカード名を宣言し、あれば奪う。',
    effect: 'stealNamedCard',
  } as MagicCard,
  {
    id: 'hoshifuru-sunadokei',
    name: 'ほしふる砂時計',
    type: 'magic',
    description: 'このターン追加で2枚カードを使える。',
    effect: 'additionalPlays',
  } as MagicCard,
  {
    id: 'majo-no-otodokemono',
    name: '魔女のおとどけもの',
    type: 'magic',
    description: 'うちけしを1つ得る。',
    effect: 'gainUchikeshi',
  } as MagicCard,
];

/** カードIDからカードを取得 */
export function getCardById(id: string): Card | undefined {
  return ALL_CARDS.find((card) => card.id === id);
}

/** 全カードを取得 */
export function getAllCards(): Card[] {
  return [...ALL_CARDS];
}

/** カードタイプに応じた色を返す */
export function getCardColor(type: CardType): number {
  switch (type) {
    case 'monster':
      return 0xf5c542; // 黄
    case 'magic':
      return 0x4287f5; // 青
  }
}

/** カードタイプのラベルを返す */
export function getCardTypeLabel(type: CardType): string {
  switch (type) {
    case 'monster':
      return 'まもの';
    case 'magic':
      return '魔法';
  }
}
