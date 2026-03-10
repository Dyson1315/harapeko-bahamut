/// <reference types="@cloudflare/workers-types" />

declare module 'cloudflare:workers' {
  export abstract class DurableObject {
    ctx: DurableObjectState;
    env: unknown;
    constructor(ctx: DurableObjectState, env: unknown);
    fetch?(request: Request): Promise<Response>;
    alarm?(): Promise<void>;
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): Promise<void>;
  }
}

type CloudflareBindings = {
  GAME_ROOM: DurableObjectNamespace;
  MATCHMAKING_QUEUE: DurableObjectNamespace;
  [key: string]: unknown;
};
