import { DurableObject } from 'cloudflare:workers';
import { GameEngine } from '../game/game_engine';

interface SessionAttachment {
  playerId: string;
  playerName: string;
  roomId: string;
}

/**
 * Durable Object that manages a single game room.
 * Uses the Hibernation API for WebSocket management.
 */
export class GameRoom extends DurableObject {
  private engine: GameEngine | null = null;
  private rematchRequests: Set<string> = new Set();

  /**
   * Handle incoming HTTP/WebSocket requests.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const playerId = url.searchParams.get('playerId');
    const playerName = url.searchParams.get('playerName') ?? 'Player';
    const roomId = url.searchParams.get('roomId') ?? 'default';

    if (!playerId) {
      return new Response('Missing playerId', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept the WebSocket using Hibernation API
    this.ctx.acceptWebSocket(server);

    // Store session data on the WebSocket (survives hibernation)
    server.serializeAttachment({ playerId, playerName, roomId } satisfies SessionAttachment);

    // Initialize game engine if needed
    if (!this.engine) {
      this.engine = new GameEngine(roomId);
    }

    // Close old WebSocket for the same player (reconnection)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === server) continue;
      const att = ws.deserializeAttachment() as SessionAttachment | null;
      if (att?.playerId === playerId) {
        try { ws.close(1000, 'reconnected'); } catch {}
      }
    }

    // Add player to game if not already present
    if (!this.engine.playerExists(playerId)) {
      this.engine.addPlayer(playerId, playerName);
    }

    // Start game if two players are connected
    if (
      Object.keys(this.engine.state.players).length === 2 &&
      !this.engine.state.gameStarted
    ) {
      this.engine.startGame();
    }

    // Send initial messages immediately
    try {
      server.send(JSON.stringify({
        type: 'connected',
        data: { playerId, playerName },
      }));
    } catch {}

    this.broadcastGameState();

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages (Hibernation API).
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as SessionAttachment | null;
    if (!att) return;

    const { playerId } = att;

    let msg: { type: string; data?: any };
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    switch (msg.type) {
      case 'playCard':
        this.handlePlayCard(playerId, msg.data?.cardId, msg.data?.targetId);
        break;
      case 'useUchikeshi':
        this.handleUseUchikeshi(playerId, msg.data?.counter, msg.data?.uchikeshiBack);
        break;
      case 'endTurn':
        this.handleEndTurn(playerId, msg.data?.discardCards);
        break;
      case 'selectCards':
        this.handleSelectCards(playerId, msg.data?.selectedCardIds);
        break;
      case 'rematchRequest':
        this.handleRematchRequest(playerId);
        break;
      case 'pong':
        // heartbeat response — no action needed
        break;
      default:
        break;
    }
  }

  /**
   * Handle WebSocket close (Hibernation API).
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as SessionAttachment | null;
    if (att) {
      this.handleDisconnect(att.playerId);
    }
  }

  /**
   * Handle WebSocket error (Hibernation API).
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const att = ws.deserializeAttachment() as SessionAttachment | null;
    if (att) {
      this.handleDisconnect(att.playerId);
    }
  }

  // ----- Helper: find WebSocket by playerId -----

  private findWsByPlayerId(playerId: string): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SessionAttachment | null;
      if (att?.playerId === playerId) return ws;
    }
    return null;
  }

  // ----- Game Action Handlers -----

  private handlePlayCard(playerId: string, cardId?: string, targetId?: string): void {
    if (!this.engine || !cardId) return;

    const result = this.engine.playCard(playerId, cardId, targetId);

    if (!result.success) {
      this.sendError(playerId, result.message ?? 'Failed to play card');
      return;
    }

    if (result.awaitingCounter) {
      const opponentId = this.getOpponentId(playerId);
      if (opponentId) {
        this.sendToPlayer(opponentId, {
          type: 'uchikeshiPrompt',
          data: {
            card: this.engine.state.pendingEffect?.card,
            playerId,
          },
        });
        this.sendToPlayer(playerId, {
          type: 'waitingForCounter',
          data: { card: this.engine.state.pendingEffect?.card },
        });
      }
    }

    if (result.needsSelection) {
      this.sendSelectionRequired(playerId);
    }

    this.broadcastGameState();
    this.checkAndHandleGameEnd();
  }

  private handleUseUchikeshi(playerId: string, counter?: boolean, uchikeshiBack?: boolean): void {
    if (!this.engine) return;

    // Validate the correct player is responding
    if (uchikeshiBack !== undefined) {
      // Uchikeshi-back: only the original caster can respond
      if (this.engine.state.pendingEffect?.playerId !== playerId) {
        this.sendError(playerId, 'Not your uchikeshi-back decision');
        return;
      }
    } else {
      // Counter: only the opponent of the caster can respond
      const casterId = this.engine.state.pendingEffect?.playerId;
      if (casterId === playerId) {
        this.sendError(playerId, 'Cannot counter your own card');
        return;
      }
    }

    const result = this.engine.useUchikeshi(playerId, counter ?? false, uchikeshiBack);

    if (!result.success) {
      this.sendError(playerId, result.message ?? 'Failed to use uchikeshi');
      return;
    }

    if (result.awaitingUchikeshiBack) {
      const casterId = this.engine.state.pendingEffect?.playerId;
      if (casterId) {
        this.sendToPlayer(casterId, {
          type: 'uchikeshiBackPrompt',
          data: { card: this.engine.state.pendingEffect?.card },
        });
      }
      this.broadcastGameState();
      return;
    }

    this.resolveOrCancelEffect(result);
  }

  private resolveOrCancelEffect(result: { effectCancelled?: boolean; effectResolved?: boolean }): void {
    if (!this.engine) return;

    if (result.effectResolved) {
      if (this.engine.state.pendingEffect) {
        this.engine.state.pendingEffect.awaitingCounter = false;
      }
      const pendingPlayerId = this.engine.state.pendingEffect?.playerId;
      const effectResult = this.engine.executeCardEffect();
      if (!effectResult.success && pendingPlayerId) {
        this.sendError(pendingPlayerId, effectResult.message ?? 'Effect failed');
      } else if (effectResult.needsSelection) {
        const selPlayerId = this.engine.state.pendingEffect?.playerId;
        if (selPlayerId) {
          this.sendSelectionRequired(selPlayerId);
        }
      }
    } else if (result.effectCancelled) {
      this.engine.cardManager.cancelEffect(this.engine.state);
    }

    this.broadcastGameState();
    this.checkAndHandleGameEnd();
  }

  private sendSelectionRequired(playerId: string): void {
    if (!this.engine) return;
    this.sendToPlayer(playerId, {
      type: 'selectionRequired',
      data: {
        card: this.engine.state.pendingEffect?.card,
        selectionCount: this.engine.state.pendingEffect?.selectionCount,
        revealOpponentHand: this.engine.state.pendingEffect?.revealOpponentHand,
        revealDeck: this.engine.state.pendingEffect?.revealDeck,
        revealAllCards: this.engine.state.pendingEffect?.revealAllCards,
      },
    });
  }

  private handleEndTurn(playerId: string, discardCards?: string[]): void {
    if (!this.engine) return;

    const result = this.engine.endTurn(playerId, discardCards);

    if (!result.success) {
      this.sendError(playerId, result.message ?? 'Failed to end turn');
      return;
    }

    this.broadcastGameState();
    this.checkAndHandleGameEnd();
  }

  private handleSelectCards(playerId: string, selectedCardIds?: string[]): void {
    if (!this.engine || !selectedCardIds) return;

    const result = this.engine.completeCardSelection(playerId, selectedCardIds);

    if (!result.success) {
      this.sendError(playerId, result.message ?? 'Failed to select cards');
      return;
    }

    this.broadcastGameState();
    this.checkAndHandleGameEnd();
  }

  private handleRematchRequest(playerId: string): void {
    this.rematchRequests.add(playerId);

    this.broadcast({
      type: 'rematchRequested',
      data: { playerId, count: this.rematchRequests.size, needed: 2 },
    });

    if (this.rematchRequests.size >= 2) {
      this.rematchRequests.clear();
      const roomId = this.engine?.state.roomId ?? 'default';
      this.engine = new GameEngine(roomId);

      // Re-add all connected players
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as SessionAttachment | null;
        if (att) {
          this.engine.addPlayer(att.playerId, att.playerName);
        }
      }

      this.engine.startGame();
      this.broadcastGameState();
    }
  }

  private handleDisconnect(playerId: string): void {
    if (!this.engine) return;

    // If the game is active, set a forfeit alarm
    if (this.engine.state.gameStarted && !this.engine.state.gameOver) {
      // Check if the player still has any open WebSocket
      const ws = this.findWsByPlayerId(playerId);
      if (!ws) {
        // No connection left, forfeit after alarm (45s)
        this.ctx.storage.setAlarm(Date.now() + 45000);
      }
    }

    this.broadcast({
      type: 'playerDisconnected',
      data: { playerId, forfeit: false },
    });
  }

  /**
   * Alarm handler — used for disconnect forfeit.
   */
  async alarm(): Promise<void> {
    if (!this.engine || !this.engine.state.gameStarted || this.engine.state.gameOver) return;

    // Check if any player is disconnected
    const playerIds = Object.keys(this.engine.state.players);
    for (const pid of playerIds) {
      const ws = this.findWsByPlayerId(pid);
      if (!ws) {
        // Player is still disconnected, forfeit
        this.engine.state.gameOver = true;
        this.engine.state.phase = 'finished';
        this.engine.state.winner = this.getOpponentId(pid);

        this.broadcast({
          type: 'playerDisconnected',
          data: { playerId: pid, forfeit: true },
        });
        this.broadcastGameState();
        return;
      }
    }
  }

  // ----- State Broadcasting -----

  private getPublicGameState(forPlayerId: string): any {
    if (!this.engine) return null;

    const state = this.engine.state;
    const publicState: any = {
      roomId: state.roomId,
      currentTurn: state.currentTurn,
      phase: state.phase,
      turnCount: state.turnCount,
      deckCount: state.deck.length,
      graveyardCount: state.graveyard.length,
      graveyard: state.graveyard,
      sharedUchikeshi: state.sharedUchikeshi,
      gameStarted: state.gameStarted,
      gameOver: state.gameOver,
      winner: state.winner,
      pendingEffect: state.pendingEffect
        ? {
            playerId: state.pendingEffect.playerId,
            card: state.pendingEffect.card,
            awaitingCounter: state.pendingEffect.awaitingCounter,
            requiresSelection: state.pendingEffect.requiresSelection,
            selectionCount: state.pendingEffect.selectionCount,
            revealOpponentHand: state.pendingEffect.revealOpponentHand,
            revealDeck: state.pendingEffect.revealDeck,
            revealAllCards: state.pendingEffect.revealAllCards,
          }
        : undefined,
      players: {} as Record<string, any>,
    };

    for (const [id, player] of Object.entries(state.players)) {
      if (id === forPlayerId) {
        publicState.players[id] = {
          id: player.id,
          name: player.name,
          life: player.life,
          hand: player.hand,
          field: player.field,
          uchikeshi: player.uchikeshi,
          playedCount: player.playedCount,
          canPlay: player.canPlay,
          handCount: player.hand.length,
        };
      } else {
        const showHand =
          state.pendingEffect?.revealOpponentHand &&
          state.pendingEffect?.playerId === forPlayerId;

        publicState.players[id] = {
          id: player.id,
          name: player.name,
          life: player.life,
          hand: showHand ? player.hand : undefined,
          handCount: player.hand.length,
          field: player.field,
          uchikeshi: player.uchikeshi,
          playedCount: player.playedCount,
          canPlay: player.canPlay,
        };
      }
    }

    if (
      state.pendingEffect?.revealDeck &&
      state.pendingEffect?.playerId === forPlayerId
    ) {
      publicState.deck = state.deck;
    }

    return publicState;
  }

  private broadcastGameState(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SessionAttachment | null;
      if (!att) continue;
      const publicState = this.getPublicGameState(att.playerId);
      try {
        ws.send(JSON.stringify({ type: 'gameState', data: publicState }));
      } catch {}
    }
  }

  private broadcast(message: { type: string; data?: unknown }): void {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(payload); } catch {}
    }
  }

  private sendToPlayer(playerId: string, message: { type: string; data?: unknown }): void {
    const ws = this.findWsByPlayerId(playerId);
    if (!ws) return;
    try { ws.send(JSON.stringify(message)); } catch {}
  }

  private sendError(playerId: string, message: string): void {
    this.sendToPlayer(playerId, { type: 'error', data: { message } });
  }

  private getOpponentId(playerId: string): string | null {
    if (!this.engine) return null;
    const ids = Object.keys(this.engine.state.players);
    return ids.find((id) => id !== playerId) ?? null;
  }

  private checkAndHandleGameEnd(): void {
    if (!this.engine) return;
    if (this.engine.state.gameOver) {
      this.broadcast({
        type: 'gameOver',
        data: {
          winner: this.engine.state.winner,
          winnerName: this.engine.state.winner
            ? this.engine.state.players[this.engine.state.winner]?.name
            : null,
        },
      });
    }
  }
}
