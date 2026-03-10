/** カードの種類 */
export type CardType = 'monster' | 'magic';

/** カードの基本インターフェース */
export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
}

/** まものカード */
export interface MonsterCard extends Card {
  type: 'monster';
  damage?: number;
  canOnlyBeSummoned?: boolean;
}

/** 魔法カード */
export interface MagicCard extends Card {
  type: 'magic';
  effect: string;
}
