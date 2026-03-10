import type { GameState, Card, MonsterCard, PlayerState } from '../types/game';
import { createDeck, shuffleDeck } from '../data/cards';
import { CardManager } from './card_manager';
import { UchikeshiManager, type UchikeshiResult } from './uchikeshi_manager';
import { PlayerManager } from './player_manager';
import { drawCards, checkGameEnd, reshuffleDeck, dealDamage, getOpponentId } from './effects';

/**
 * Core game engine orchestrating all game logic.
 */
export class GameEngine {
  public state: GameState;
  public cardManager: CardManager;
  public uchikeshiManager: UchikeshiManager;
  public playerManager: PlayerManager;

  constructor(roomId: string) {
    this.cardManager = new CardManager();
    this.uchikeshiManager = new UchikeshiManager();
    this.playerManager = new PlayerManager();

    this.state = {
      roomId,
      players: {},
      currentTurn: null,
      phase: 'waiting',
      turnCount: 0,
      deck: [],
      graveyard: [],
      sharedUchikeshi: 0,
      gameStarted: false,
      gameOver: false,
      winner: null,
    };
  }

  /**
   * Add a player to the game.
   */
  addPlayer(playerId: string, playerName: string): PlayerState {
    return this.playerManager.addPlayer(this.state, playerId, playerName);
  }

  /**
   * Check if a player exists.
   */
  playerExists(playerId: string): boolean {
    return this.playerManager.playerExists(this.state, playerId);
  }

  /**
   * Start the game: create deck, deal hands, determine first player.
   */
  startGame(): void {
    if (this.state.gameStarted) return;
    if (!this.playerManager.canStartGame(this.state)) return;

    // Create and shuffle deck
    this.state.deck = shuffleDeck(createDeck());

    const playerIds = Object.keys(this.state.players);

    // Deal 5 cards to each player
    for (const id of playerIds) {
      drawCards(this.state, id, 5);
    }

    // Determine first player randomly
    const firstPlayerIndex = Math.floor(Math.random() * playerIds.length);
    this.state.currentTurn = playerIds[firstPlayerIndex];

    // First player gets only 1 play on their first turn
    this.state.players[this.state.currentTurn].canPlay = 1;

    this.state.gameStarted = true;
    this.state.phase = 'main';
    this.state.turnCount = 1;
  }

  /**
   * Play a card from the current player's hand.
   */
  playCard(
    playerId: string,
    cardId: string,
    targetId?: string
  ): { success: boolean; message?: string; awaitingCounter?: boolean; needsSelection?: boolean } {
    return this.cardManager.playCard(this.state, playerId, cardId, targetId);
  }

  /**
   * Handle uchikeshi action.
   */
  useUchikeshi(
    playerId: string,
    counter: boolean,
    uchikeshiBack?: boolean
  ): UchikeshiResult {
    return this.uchikeshiManager.handleUchikeshi(this.state, playerId, counter, uchikeshiBack);
  }

  /**
   * Execute the pending card effect (after uchikeshi resolution).
   */
  executeCardEffect(): { success: boolean; needsSelection?: boolean; message?: string } {
    return this.cardManager.resolveCurrentEffect(this.state);
  }

  /**
   * Complete a card selection (e.g. choosing cards to discard).
   */
  completeCardSelection(
    playerId: string,
    selectedCardIds: string[]
  ): { success: boolean; message?: string } {
    return this.cardManager.completeCardSelection(this.state, playerId, selectedCardIds);
  }

  /**
   * End the current player's turn.
   */
  endTurn(playerId: string, discardCards?: string[]): { success: boolean; message?: string } {
    if (this.state.currentTurn !== playerId) {
      return { success: false, message: 'Not your turn' };
    }

    if (this.state.phase !== 'main') {
      return { success: false, message: 'Cannot end turn in this phase' };
    }

    const player = this.state.players[playerId];
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Handle hand limit (max 5 cards)
    const handLimit = 5;
    if (player.hand.length > handLimit) {
      const discardCount = player.hand.length - handLimit;
      if (!discardCards || discardCards.length !== discardCount) {
        return {
          success: false,
          message: `Must discard ${discardCount} card(s) to meet hand limit`,
        };
      }

      // Validate: no duplicate IDs
      const uniqueIds = new Set(discardCards);
      if (uniqueIds.size !== discardCards.length) {
        return { success: false, message: 'Duplicate card IDs in discard list' };
      }

      // Validate: all cards exist in hand before removing any
      for (const cardId of discardCards) {
        if (!player.hand.some((c) => c.id === cardId)) {
          return { success: false, message: `Card ${cardId} not found in hand` };
        }
      }

      for (const cardId of discardCards) {
        const idx = player.hand.findIndex((c) => c.id === cardId);
        const [discarded] = player.hand.splice(idx, 1);
        this.state.graveyard.push(discarded);
      }
    }

    this.nextTurn();
    return { success: true };
  }

  /**
   * Advance to the next turn.
   */
  private nextTurn(): void {
    const playerIds = Object.keys(this.state.players);
    const currentIndex = playerIds.indexOf(this.state.currentTurn!);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    const nextPlayerId = playerIds[nextIndex];

    this.state.currentTurn = nextPlayerId;
    this.state.turnCount++;

    // Process turn start: field monsters deal damage
    this.processTurnStart(nextPlayerId);

    if (this.state.gameOver) return;

    // Draw a card
    drawCards(this.state, nextPlayerId, 1);

    // Reset play count
    this.playerManager.resetPlayCount(this.state, nextPlayerId);
    this.playerManager.setCanPlay(this.state, nextPlayerId, 2);

    this.state.phase = 'main';
  }

  /**
   * Process the start of a turn: deal damage from the current turn player's field monsters.
   * Only the turn player's monsters deal damage to the opponent.
   */
  private processTurnStart(playerId: string): void {
    const opponentId = getOpponentId(this.state, playerId);
    if (!opponentId) return;

    const player = this.state.players[playerId];
    if (!player) return;

    for (const monster of player.field) {
      if (monster.damage && monster.damage > 0) {
        const isFromHarapeko = monster.id === 'harapeko-bahamut';
        dealDamage(this.state, opponentId, monster.damage, isFromHarapeko);
        if (this.state.gameOver) return;
      }
    }
  }
}
