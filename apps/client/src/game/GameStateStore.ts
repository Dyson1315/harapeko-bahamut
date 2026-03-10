import { GameState, PlayerState } from '../types/game';

/** GameStateStoreが発火するイベント型 */
export type GameEvent =
  | 'stateChanged'
  | 'gameStarted'
  | 'gameEnded'
  | 'uchikeshiPrompt'
  | 'uchikeshiBackPrompt'
  | 'waitingForCounter'
  | 'waitingForUchikeshiBack'
  | 'effectResolved'
  | 'effectCancelled'
  | 'playerJoined'
  | 'playerDisconnected'
  | 'playerReconnected'
  | 'rematchRequested'
  | 'rematchStarted'
  | 'rematchDeclined'
  | 'error';

type GameEventCallback = (data?: unknown) => void;

/**
 * ゲーム状態管理ストア
 *
 * EventEmitterパターンでUI層に状態変更を通知する。
 * Reactを使用しない代わりに、リスナーベースの更新を提供する。
 */
export class GameStateStore {
  private state: GameState | null = null;
  private myPlayerId: string | null = null;
  private listeners: Map<string, Set<GameEventCallback>> = new Map();

  /** 自分のプレイヤーIDを設定する */
  setMyPlayerId(id: string): void {
    this.myPlayerId = id;
  }

  /** ゲーム状態を更新し stateChanged イベントを発火する */
  updateState(newState: GameState): void {
    this.state = newState;
    this.emit('stateChanged', newState);
  }

  /** 現在のゲーム状態を取得する */
  getState(): GameState | null {
    return this.state;
  }

  /** イベントリスナーを登録する */
  on(event: GameEvent, callback: GameEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /** イベントリスナーを解除する */
  off(event: GameEvent, callback: GameEventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  /** イベントを発火する */
  emit(event: GameEvent, data?: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[GameStateStore] Error in listener for "${event}":`, err);
        }
      }
    }
  }

  /** 自分のプレイヤー状態 */
  get myPlayer(): PlayerState | null {
    if (!this.state || !this.myPlayerId) return null;
    return this.state.players[this.myPlayerId] ?? null;
  }

  /** 相手のプレイヤー状態 */
  get opponentPlayer(): PlayerState | null {
    if (!this.state || !this.myPlayerId) return null;
    const opponentId = Object.keys(this.state.players).find((id) => id !== this.myPlayerId);
    if (!opponentId) return null;
    return this.state.players[opponentId] ?? null;
  }

  /** 自分のターンかどうか */
  get isMyTurn(): boolean {
    if (!this.state || !this.myPlayerId) return false;
    return this.state.currentTurn === this.myPlayerId;
  }

  /** カードをプレイできるかどうか */
  get canPlayCard(): boolean {
    if (!this.isMyTurn) return false;
    if (!this.state || this.state.phase !== 'main') return false;
    const player = this.myPlayer;
    if (!player) return false;
    return player.playedCount < player.canPlay;
  }

  /** 現在のフェーズ */
  get phase(): string | null {
    return this.state?.phase ?? null;
  }
}
