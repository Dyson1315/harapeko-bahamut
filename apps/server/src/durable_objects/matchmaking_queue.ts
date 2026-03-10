import { DurableObject } from 'cloudflare:workers';

interface PlayerAttachment {
  playerId: string;
  playerName: string;
  mode: string;
  rating: number;
  joinedAt: number;
}

/**
 * Durable Object that manages a matchmaking queue.
 * Matches two players together and creates a game room.
 */
export class MatchmakingQueue extends DurableObject {
  /**
   * Handle incoming HTTP/WebSocket requests.
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      // Status endpoint
      const queued = this.getQueuedPlayers();
      return new Response(
        JSON.stringify({
          randomQueueSize: queued.filter((p) => p.mode === 'random').length,
          ratingQueueSize: queued.filter((p) => p.mode === 'rating').length,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    const playerName = url.searchParams.get('playerName') ?? 'Player';
    const mode = url.searchParams.get('mode') ?? 'random';
    const rating = parseInt(url.searchParams.get('rating') ?? '1000', 10);

    if (!playerId) {
      return new Response('Missing playerId', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);

    const attachment: PlayerAttachment = {
      playerId,
      playerName,
      mode,
      rating,
      joinedAt: Date.now(),
    };
    server.serializeAttachment(attachment);

    // Remove existing WebSocket for same player
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === server) continue;
      const att = ws.deserializeAttachment() as PlayerAttachment | null;
      if (att?.playerId === playerId) {
        try { ws.close(1000, 'reconnected'); } catch {}
      }
    }

    // Send connected confirmation immediately
    try {
      server.send(JSON.stringify({
        type: 'matchmaking_connected',
        data: { playerId, playerName },
      }));
      server.send(JSON.stringify({
        type: 'matchmaking_queued',
        data: { mode, queuePosition: this.ctx.getWebSockets().length },
      }));
    } catch {}

    // Try to match
    this.tryMatchmaking(mode);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages (Hibernation API).
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    if (!att) return;

    let msg: { type: string; data?: any };
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    switch (msg.type) {
      case 'leaveMatchmaking':
        try { ws.close(1000, 'left'); } catch {}
        break;
      case 'pong':
        // heartbeat response — no action needed
        break;
      default:
        break;
    }
  }

  /**
   * Handle WebSocket close.
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    // WebSocket is automatically removed from ctx.getWebSockets()
  }

  /**
   * Handle WebSocket error.
   */
  async webSocketError(ws: WebSocket): Promise<void> {
    try { ws.close(); } catch {}
  }

  // ----- Matchmaking Logic -----

  private getQueuedPlayers(): PlayerAttachment[] {
    const players: PlayerAttachment[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as PlayerAttachment | null;
      if (att) players.push(att);
    }
    return players;
  }

  private tryMatchmaking(mode: string): void {
    const allWs = this.ctx.getWebSockets();

    // Build a list of {ws, attachment} pairs for the requested mode
    const candidates: { ws: WebSocket; att: PlayerAttachment }[] = [];
    for (const ws of allWs) {
      const att = ws.deserializeAttachment() as PlayerAttachment | null;
      if (att && att.mode === mode) {
        candidates.push({ ws, att });
      }
    }

    if (candidates.length < 2) return;

    if (mode === 'rating') {
      // Sort by rating and match closest pair
      candidates.sort((a, b) => a.att.rating - b.att.rating);
      this.createMatch(candidates[0], candidates[1]);
    } else {
      // Random: match first two
      this.createMatch(candidates[0], candidates[1]);
    }
  }

  private createMatch(
    p1: { ws: WebSocket; att: PlayerAttachment },
    p2: { ws: WebSocket; att: PlayerAttachment }
  ): void {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const matchData = {
      roomId,
      players: [
        { id: p1.att.playerId, name: p1.att.playerName },
        { id: p2.att.playerId, name: p2.att.playerName },
      ],
    };

    const matchMessage = JSON.stringify({ type: 'matchFound', data: matchData });

    try { p1.ws.send(matchMessage); } catch {}
    try { p2.ws.send(matchMessage); } catch {}

    // Close the matchmaking WebSockets — clients will connect to the game room
    try { p1.ws.close(1000, 'matched'); } catch {}
    try { p2.ws.close(1000, 'matched'); } catch {}
  }
}
