import type { GameState, PlayerState } from '../types/game';

/**
 * Manages player lifecycle and state within a game.
 */
export class PlayerManager {
  /**
   * Add a new player to the game state.
   */
  addPlayer(state: GameState, playerId: string, playerName: string): PlayerState {
    const player: PlayerState = {
      id: playerId,
      name: playerName,
      life: 4,
      hand: [],
      field: [],
      uchikeshi: 2,
      playedCount: 0,
      canPlay: 2,
    };

    state.players[playerId] = player;
    return player;
  }

  /**
   * Check if a player already exists in the game state.
   */
  playerExists(state: GameState, playerId: string): boolean {
    return playerId in state.players;
  }

  /**
   * Get a player from the game state.
   */
  getPlayer(state: GameState, playerId: string): PlayerState | undefined {
    return state.players[playerId];
  }

  /**
   * Get the opponent's player ID.
   */
  getOpponentId(state: GameState, playerId: string): string | null {
    const ids = Object.keys(state.players);
    return ids.find((id) => id !== playerId) ?? null;
  }

  /**
   * Check if the game can start (2 players present).
   */
  canStartGame(state: GameState): boolean {
    return Object.keys(state.players).length === 2;
  }

  /**
   * Change a player's life by a delta amount.
   */
  changePlayerLife(state: GameState, playerId: string, delta: number): void {
    const player = state.players[playerId];
    if (!player) return;
    player.life += delta;
  }

  /**
   * Set a player's life to an absolute value.
   */
  setPlayerLife(state: GameState, playerId: string, life: number): void {
    const player = state.players[playerId];
    if (!player) return;
    player.life = life;
  }

  /**
   * Reset the played count for a player.
   */
  resetPlayCount(state: GameState, playerId: string): void {
    const player = state.players[playerId];
    if (!player) return;
    player.playedCount = 0;
  }

  /**
   * Set the number of cards a player can play this turn.
   */
  setCanPlay(state: GameState, playerId: string, canPlay: number): void {
    const player = state.players[playerId];
    if (!player) return;
    player.canPlay = canPlay;
  }
}
