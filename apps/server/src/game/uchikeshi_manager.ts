import type { GameState } from '../types/game';
import { getOpponentId } from './effects';

/**
 * Result of uchikeshi handling.
 */
export interface UchikeshiResult {
  success: boolean;
  message?: string;
  effectCancelled?: boolean;
  effectResolved?: boolean;
  awaitingUchikeshiBack?: boolean;
}

/**
 * Manages uchikeshi (counter) mechanics.
 */
export class UchikeshiManager {
  /**
   * Main handler for uchikeshi actions.
   */
  handleUchikeshi(
    state: GameState,
    playerId: string,
    counter: boolean,
    uchikeshiBack?: boolean
  ): UchikeshiResult {
    if (uchikeshiBack !== undefined) {
      return this.handleUchikeshiBack(state, playerId, uchikeshiBack);
    }

    if (counter) {
      return this.useUchikeshi(state, playerId);
    }

    // Player chose not to counter
    return {
      success: true,
      effectResolved: true,
    };
  }

  /**
   * Use an uchikeshi to counter a card effect.
   * The counter player spends 1 uchikeshi, the shared pool gains 1.
   * Then prompt the original caster if they want to uchikeshi-back.
   */
  useUchikeshi(state: GameState, playerId: string): UchikeshiResult {
    const player = state.players[playerId];
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    if (!this.canUseUchikeshi(state, playerId)) {
      return { success: false, message: 'No uchikeshi available' };
    }

    // Spend uchikeshi
    player.uchikeshi -= 1;
    state.sharedUchikeshi += 1;

    // Check if the caster can uchikeshi-back
    const casterId = state.pendingEffect?.playerId;
    if (casterId) {
      const caster = state.players[casterId];
      if (caster && caster.uchikeshi >= 2) {
        // Caster can uchikeshi-back, await their decision
        return {
          success: true,
          awaitingUchikeshiBack: true,
        };
      }
    }

    // Caster cannot uchikeshi-back, effect is cancelled
    return {
      success: true,
      effectCancelled: true,
    };
  }

  /**
   * Handle the uchikeshi-back decision from the caster.
   * If they use it: spend 2 uchikeshi and resolve the effect.
   * If they don't: the effect is cancelled.
   */
  handleUchikeshiBack(
    state: GameState,
    playerId: string,
    useBack: boolean
  ): UchikeshiResult {
    if (useBack) {
      if (!this.canUseUchikeshiBack(state, playerId)) {
        return { success: false, message: 'Not enough uchikeshi for uchikeshi-back' };
      }

      const player = state.players[playerId];
      if (!player) {
        return { success: false, message: 'Player not found' };
      }

      // Uchikeshi-back costs 2
      player.uchikeshi -= 2;
      state.sharedUchikeshi += 2;

      return {
        success: true,
        effectResolved: true,
      };
    }

    // Chose not to uchikeshi-back, effect is cancelled
    return {
      success: true,
      effectCancelled: true,
    };
  }

  /**
   * Check if a player can use uchikeshi (needs at least 1).
   */
  canUseUchikeshi(state: GameState, playerId: string): boolean {
    const player = state.players[playerId];
    return player ? player.uchikeshi >= 1 : false;
  }

  /**
   * Check if a player can use uchikeshi-back (needs at least 2).
   */
  canUseUchikeshiBack(state: GameState, playerId: string): boolean {
    const player = state.players[playerId];
    return player ? player.uchikeshi >= 2 : false;
  }

  /**
   * Distribute shared uchikeshi evenly between players at turn start.
   */
  distributeSharedUchikeshi(state: GameState): void {
    if (state.sharedUchikeshi <= 0) return;

    const playerIds = Object.keys(state.players);
    if (playerIds.length < 2) return;

    const perPlayer = Math.floor(state.sharedUchikeshi / playerIds.length);
    const remainder = state.sharedUchikeshi % playerIds.length;

    for (const id of playerIds) {
      state.players[id].uchikeshi += perPlayer;
    }

    // Remainder stays in the shared pool
    state.sharedUchikeshi = remainder;
  }

  /**
   * Return uchikeshi from a player to the shared pool.
   */
  returnToSharedUchikeshi(state: GameState, playerId: string, count: number): void {
    const player = state.players[playerId];
    if (!player) return;

    const actual = Math.min(count, player.uchikeshi);
    player.uchikeshi -= actual;
    state.sharedUchikeshi += actual;
  }
}
