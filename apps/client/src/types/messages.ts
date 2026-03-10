import { Card } from './card';
import { GameState } from './game';

/** サーバーからクライアントへのメッセージ */
export type ServerMessage =
  | { type: 'gameState'; data: GameState }
  | { type: 'gameStarted'; data: GameState }
  | { type: 'gameEnded'; data: { winner: string; winnerName: string; reason?: string } }
  | { type: 'uchikeshiPrompt'; data: { card: Card; playerId: string } }
  | { type: 'uchikeshiBackPrompt'; data: { card: Card } }
  | { type: 'waitingForCounter'; data: { card: Card; opponentId: string } }
  | { type: 'waitingForUchikeshiBack'; data: { card: Card; originalPlayerId: string } }
  | { type: 'effectResolved'; data: { card: Card; playerId: string } }
  | { type: 'effectCancelled'; data: Record<string, never> }
  | { type: 'playerJoined'; data: { playerId: string; playerName: string; playerCount: number } }
  | { type: 'playerDisconnected'; data: { playerId: string; playerName: string; reconnectTimeLeft?: number } }
  | { type: 'playerReconnected'; data: { playerId: string; playerName: string } }
  | { type: 'rematchRequested'; data: { fromPlayerId: string; fromPlayerName: string } }
  | { type: 'rematchWaiting'; data: { opponentName: string } }
  | { type: 'rematchStarted'; data: Record<string, never> }
  | { type: 'rematchDeclined'; data: { declinedBy: string; declinedByName: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'ping'; data: { timestamp: number; playerId?: string } };

/** クライアントからサーバーへのメッセージ */
export type ClientMessage =
  | { type: 'playCard'; data: { cardId: string; targetId?: string } }
  | { type: 'useUchikeshi'; data: { counter: boolean; uchikeshiBack?: boolean } }
  | { type: 'endTurn'; data: { discardCards?: string[] } }
  | { type: 'selectCards'; data: { selectedCards: string[] } }
  | { type: 'rematchRequest'; data: { accept: boolean } }
  | { type: 'pong'; data: { timestamp: number; originalTimestamp: number } };

/** マッチメイキング: クライアントからサーバーへのメッセージ */
export type MatchmakingClientMessage =
  | { type: 'joinMatchmaking'; playerId: string; playerName: string; rating?: number; preferences: { mode: 'random' | 'rating' } }
  | { type: 'leaveMatchmaking'; playerId: string }
  | { type: 'pong' };

/** マッチメイキング: サーバーからクライアントへのメッセージ */
export type MatchmakingServerMessage =
  | { type: 'matchmakingJoined'; data: { mode: string; position: number; estimatedWaitTime: number } }
  | { type: 'matchFound'; data: { roomId: string; opponent: { id: string; name: string; rating?: number }; mode: string } }
  | { type: 'gameReady'; data: { roomId: string; playerId: string } }
  | { type: 'matchmakingLeft'; data: { playerId: string } }
  | { type: 'matchError'; data: { message: string } }
  | { type: 'ping'; data: { timestamp: number } };
