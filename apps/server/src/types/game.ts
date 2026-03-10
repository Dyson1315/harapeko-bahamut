export type CardType = 'monster' | 'magic';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
}

export interface MonsterCard extends Card {
  type: 'monster';
  damage?: number;
  canOnlyBeSummoned?: boolean;
}

export interface MagicCard extends Card {
  type: 'magic';
  effect: string;
}

export type GamePhase = 'waiting' | 'starting' | 'draw' | 'main' | 'counter' | 'end' | 'finished';

export interface PlayerState {
  id: string;
  name: string;
  life: number;
  hand: Card[];
  field: MonsterCard[];
  uchikeshi: number;
  playedCount: number;
  canPlay: number;
}

export type Player = PlayerState;

export interface GameState {
  roomId: string;
  players: Record<string, PlayerState>;
  currentTurn: string | null;
  phase: GamePhase;
  turnCount: number;
  deck: Card[];
  graveyard: Card[];
  sharedUchikeshi: number;
  gameStarted: boolean;
  gameOver: boolean;
  winner: string | null;
  pendingEffect?: {
    playerId: string;
    card: Card;
    targetId?: string;
    targetRequired?: boolean;
    awaitingCounter?: boolean;
    requiresSelection?: boolean;
    selectionCount?: number;
    revealOpponentHand?: boolean;
    revealDeck?: boolean;
    revealAllCards?: boolean;
  };
}

export interface WSMessage {
  type: string;
  data?: unknown;
}

export interface PlayCardAction {
  type: 'playCard';
  cardId: string;
  targetId?: string;
}

export interface UseUchikeshiAction {
  type: 'useUchikeshi';
  counter: boolean;
  uchikeshiBack?: boolean;
}

export interface EndTurnAction {
  type: 'endTurn';
  discardCards?: string[];
}

export type PlayerAction = PlayCardAction | UseUchikeshiAction | EndTurnAction;

export interface ConnectedPlayer {
  id: string;
  name: string;
  websocket: WebSocket;
}
