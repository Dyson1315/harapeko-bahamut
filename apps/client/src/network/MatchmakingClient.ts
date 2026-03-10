import { MatchmakingClientMessage, MatchmakingServerMessage } from '../types/messages';

/**
 * マッチメイキング専用WebSocketクライアント
 *
 * マッチメイキングサーバーとの通信を担当する。
 */
export class MatchmakingClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  /** マッチメイキングサーバーに接続する */
  connect(serverUrl: string): void {
    if (this.ws) {
      this.disconnect();
    }

    try {
      this.ws = new WebSocket(serverUrl);

      this.ws.onopen = () => {
        console.log('[MatchmakingClient] Connected:', serverUrl);
        this.emit('connected');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('[MatchmakingClient] Disconnected:', event.code, event.reason);
        this.emit('disconnected', { code: event.code, reason: event.reason });
      };

      this.ws.onerror = (event: Event) => {
        console.error('[MatchmakingClient] Error:', event);
        this.emit('error', event);
      };
    } catch (err) {
      console.error('[MatchmakingClient] Connection failed:', err);
      this.emit('error', err);
    }
  }

  /** 接続を切断する */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** マッチメイキングに参加する */
  joinMatchmaking(playerId: string, playerName: string, mode: 'random' | 'rating'): void {
    this.send({
      type: 'joinMatchmaking',
      playerId,
      playerName,
      preferences: { mode },
    });
  }

  /** マッチメイキングから離脱する */
  leaveMatchmaking(playerId: string): void {
    this.send({
      type: 'leaveMatchmaking',
      playerId,
    });
  }

  /** イベントリスナーを登録する */
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /** イベントリスナーを解除する */
  off(event: string, callback: (data: unknown) => void): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  /** 接続中かどうか */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private send(message: MatchmakingClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[MatchmakingClient] Cannot send: connection not open');
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string) as MatchmakingServerMessage;
      const { type } = message;

      if (type === 'ping') {
        // pingに対して自動でpongを返す
        this.send({ type: 'pong' });
        return;
      }

      // 'data' フィールドがあるメッセージはdataを渡す
      const data = 'data' in message ? message.data : undefined;
      this.emit(type, data);
      this.emit('message', message);
    } catch (err) {
      console.error('[MatchmakingClient] Failed to parse message:', err);
    }
  }

  private emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[MatchmakingClient] Error in listener for "${event}":`, err);
        }
      }
    }
  }
}
