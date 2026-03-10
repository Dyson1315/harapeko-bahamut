/**
 * 汎用WebSocketクライアント
 *
 * EventEmitterパターンで各種イベントをリスナーに通知する。
 * 自動再接続、ping/pong応答を内蔵。
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /** WebSocket接続を開始する */
  connect(): void {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.createConnection();
  }

  /** WebSocket接続を切断する */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** メッセージを送信する */
  send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocketClient] Cannot send: connection not open');
    }
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

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocketClient] Connected:', this.url);
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('[WebSocketClient] Disconnected:', event.code, event.reason);
        this.emit('disconnected', { code: event.code, reason: event.reason });
        this.attemptReconnect();
      };

      this.ws.onerror = (event: Event) => {
        console.error('[WebSocketClient] Error:', event);
        this.emit('error', event);
      };
    } catch (err) {
      console.error('[WebSocketClient] Connection failed:', err);
      this.attemptReconnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string);
      const { type, data } = message;

      if (type === 'ping') {
        this.handlePing(data);
        return;
      }

      // タイプ名でイベントを発火する
      this.emit(type, data);
      // 全メッセージを受け取りたいリスナー向け
      this.emit('message', message);
    } catch (err) {
      console.error('[WebSocketClient] Failed to parse message:', err);
    }
  }

  /** pingメッセージに自動でpongを返す */
  private handlePing(data: { timestamp: number; playerId?: string }): void {
    this.send({
      type: 'pong',
      data: {
        timestamp: Date.now(),
        originalTimestamp: data.timestamp,
      },
    });
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocketClient] Max reconnect attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, delay);
  }

  private emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[WebSocketClient] Error in listener for "${event}":`, err);
        }
      }
    }
  }
}
