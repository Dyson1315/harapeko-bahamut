import { WebSocketClient } from '../network/WebSocketClient';
import { GameStateStore } from './GameStateStore';
import { GameState } from '../types/game';
import { Card } from '../types/card';

/**
 * ゲームマネージャー
 *
 * WebSocketClient と GameStateStore を統合し、
 * BattleScene からの操作APIとサーバーメッセージのハンドリングを提供する。
 */
export class GameManager {
  readonly store: GameStateStore;
  private wsClient: WebSocketClient | null = null;

  constructor() {
    this.store = new GameStateStore();
  }

  /** サーバーに接続してゲームルームに参加する */
  connect(serverUrl: string, roomId: string, playerId: string, playerName: string): void {
    this.store.setMyPlayerId(playerId);

    // WebSocket URLの構築
    const wsProtocol = serverUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsProtocol}/ws/${encodeURIComponent(roomId)}?playerId=${encodeURIComponent(playerId)}&playerName=${encodeURIComponent(playerName)}`;

    this.wsClient = new WebSocketClient(wsUrl);

    // サーバーメッセージのハンドリングを登録
    this.wsClient.on('message', (data: unknown) => {
      const message = data as { type: string; data: unknown };
      this.handleServerMessage(message.type, message.data);
    });

    this.wsClient.on('connected', () => {
      console.log('[GameManager] Connected to game server');
    });

    this.wsClient.on('disconnected', () => {
      console.log('[GameManager] Disconnected from game server');
    });

    this.wsClient.on('reconnectFailed', () => {
      console.error('[GameManager] Failed to reconnect to game server');
      this.store.emit('error', { message: 'サーバーとの接続が切れました' });
    });

    this.wsClient.connect();
  }

  /** サーバーとの接続を切断する */
  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
  }

  // --- ユーザー操作API ---

  /** カードをプレイする */
  playCard(cardId: string, targetId?: string): void {
    this.wsClient?.send({
      type: 'playCard',
      data: { cardId, targetId },
    });
  }

  /** うちけしの書を使用するかどうか応答する */
  useUchikeshi(counter: boolean, uchikeshiBack?: boolean): void {
    this.wsClient?.send({
      type: 'useUchikeshi',
      data: { counter, uchikeshiBack },
    });
  }

  /** ターンを終了する */
  endTurn(discardCards?: string[]): void {
    this.wsClient?.send({
      type: 'endTurn',
      data: { discardCards },
    });
  }

  /** カードを選択する（黒ネコのしっぽ等の選択要求への応答） */
  selectCards(selectedCardIds: string[]): void {
    this.wsClient?.send({
      type: 'selectCards',
      data: { selectedCardIds },
    });
  }

  /** リマッチを要求/承諾/拒否する */
  requestRematch(accept: boolean): void {
    this.wsClient?.send({
      type: 'rematchRequest',
      data: { accept },
    });
  }

  // --- サーバーメッセージハンドリング ---

  private handleServerMessage(type: string, data: unknown): void {
    switch (type) {
      case 'gameState':
        this.store.updateState(data as GameState);
        break;

      case 'gameStarted':
        this.store.updateState(data as GameState);
        this.store.emit('gameStarted', data);
        break;

      case 'gameEnded':
        this.store.emit('gameEnded', data);
        break;

      case 'uchikeshiPrompt':
        this.store.emit('uchikeshiPrompt', data);
        break;

      case 'uchikeshiBackPrompt':
        this.store.emit('uchikeshiBackPrompt', data);
        break;

      case 'waitingForCounter':
        this.store.emit('waitingForCounter', data);
        break;

      case 'waitingForUchikeshiBack':
        this.store.emit('waitingForUchikeshiBack', data);
        break;

      case 'effectResolved':
        this.store.emit('effectResolved', data);
        break;

      case 'effectCancelled':
        this.store.emit('effectCancelled', data);
        break;

      case 'playerJoined':
        this.store.emit('playerJoined', data);
        break;

      case 'playerDisconnected':
        this.store.emit('playerDisconnected', data);
        break;

      case 'playerReconnected':
        this.store.emit('playerReconnected', data);
        break;

      case 'rematchRequested':
        this.store.emit('rematchRequested', data);
        break;

      case 'rematchStarted':
        this.store.emit('rematchStarted', data);
        break;

      case 'rematchDeclined':
        this.store.emit('rematchDeclined', data);
        break;

      case 'error':
        this.store.emit('error', data);
        break;

      // ping はWebSocketClient内部で自動応答するのでここでは何もしない
      case 'ping':
        break;

      default:
        console.warn(`[GameManager] Unknown message type: ${type}`, data);
        break;
    }
  }
}
