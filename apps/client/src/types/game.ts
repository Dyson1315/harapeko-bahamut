import { Card, MonsterCard } from './card';

/** ゲームのフェーズ */
export type GamePhase = 'waiting' | 'starting' | 'draw' | 'main' | 'counter' | 'end' | 'finished';

/** プレイヤーの状態 */
export interface PlayerState {
  id: string;
  name: string;
  life: number;
  hand: Card[];
  handCount: number;
  field: MonsterCard[];
  uchikeshi: number;
  playedCount: number;
  canPlay: number;
}

/** 保留中のエフェクト */
export interface PendingEffect {
  playerId: string;
  card: Card;
  targetId?: string;
  awaitingCounter?: boolean;
  requiresSelection?: boolean;
  selectionCount?: number;
  revealOpponentHand?: boolean;
  revealDeck?: boolean;
  revealAllCards?: boolean;
}

/** ゲーム全体の状態 */
export interface GameState {
  roomId: string;
  players: Record<string, PlayerState>;
  currentTurn: string | null;
  phase: GamePhase;
  turnCount: number;
  deckCount: number;
  deck?: Card[];
  graveyard: Card[];
  sharedUchikeshi: number;
  gameStarted: boolean;
  gameOver: boolean;
  winner: string | null;
  pendingEffect?: PendingEffect;
}
