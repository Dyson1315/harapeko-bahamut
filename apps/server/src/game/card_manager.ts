import type { GameState, Card, MonsterCard, MagicCard } from '../types/game';
import {
  executeCardEffect,
  getOpponentId,
  checkGameEnd,
  type EffectContext,
  type EffectResult,
} from './effects';

/**
 * Manages card play, effect resolution, and card manipulation on the game state.
 */
export class CardManager {
  /**
   * Play a card from a player's hand.
   * Both monster and magic cards can be countered by uchikeshi.
   */
  playCard(
    state: GameState,
    playerId: string,
    cardId: string,
    targetId?: string
  ): { success: boolean; message?: string; awaitingCounter?: boolean; needsSelection?: boolean } {
    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };
    if (state.currentTurn !== playerId) return { success: false, message: 'Not your turn' };
    if (state.phase !== 'main') return { success: false, message: 'Cannot play cards in this phase' };
    if (player.playedCount >= player.canPlay) return { success: false, message: 'No more plays available this turn' };

    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return { success: false, message: 'Card not found in hand' };

    const card = player.hand[cardIndex];

    // Monsters with canOnlyBeSummoned cannot be played directly from hand
    if (card.type === 'monster' && (card as MonsterCard).canOnlyBeSummoned) {
      return { success: false, message: 'This monster can only be summoned by a spell' };
    }

    // Remove card from hand and increment play count
    player.hand.splice(cardIndex, 1);
    player.playedCount++;

    // Set up pending effect for counter check (both monster and magic)
    state.pendingEffect = {
      playerId,
      card,
      targetId,
    };

    // Check if opponent can counter
    const opponentId = getOpponentId(state, playerId);
    if (opponentId) {
      const opponent = state.players[opponentId];
      if (opponent.uchikeshi > 0) {
        state.pendingEffect.awaitingCounter = true;
        state.phase = 'counter';
        return { success: true, awaitingCounter: true };
      }
    }

    // No counter available, resolve immediately
    return this.resolveCurrentEffect(state);
  }

  /**
   * Resolve the current pending effect.
   * Handles both monster summoning and magic card effects.
   */
  resolveCurrentEffect(
    state: GameState
  ): { success: boolean; message?: string; needsSelection?: boolean } {
    if (!state.pendingEffect) return { success: false, message: 'No pending effect' };

    const { playerId, card, targetId } = state.pendingEffect;

    // Monster cards: summon to field
    if (card.type === 'monster') {
      const player = state.players[playerId];
      player.field.push(card as MonsterCard);
      delete state.pendingEffect;
      state.phase = 'main';
      return { success: true };
    }

    // Magic cards: resolve effect
    const magicCard = card as MagicCard;

    if (!magicCard.effect) {
      state.graveyard.push(card);
      delete state.pendingEffect;
      state.phase = 'main';
      return { success: true };
    }

    const ctx: EffectContext = {
      gameState: state,
      playerId,
      targetId,
    };

    const result = executeCardEffect(magicCard.effect, ctx);

    if (!result.success) {
      if (result.requiresTarget) {
        // ターゲット未指定: カードを手札に戻してプレイカウントを元に戻す
        const player = state.players[playerId];
        player.hand.push(card);
        player.playedCount--;
        delete state.pendingEffect;
        state.phase = 'main';
        return { success: false, message: result.message ?? 'ターゲットを選択してください' };
      }
      if (result.requiresSelection) {
        state.pendingEffect.requiresSelection = true;
        state.pendingEffect.revealOpponentHand = result.revealOpponentHand;
        state.pendingEffect.revealDeck = result.revealDeck;
        state.pendingEffect.revealAllCards = result.revealAllCards;
        state.phase = 'main';
        return { success: true, needsSelection: true };
      }
      state.graveyard.push(card);
      delete state.pendingEffect;
      state.phase = 'main';
      return { success: false, message: result.message };
    }

    state.graveyard.push(card);
    delete state.pendingEffect;
    state.phase = 'main';
    checkGameEnd(state);
    return { success: true };
  }

  /**
   * Complete a card selection for a pending effect.
   */
  completeCardSelection(
    state: GameState,
    playerId: string,
    selectedCardIds: string[]
  ): { success: boolean; message?: string } {
    if (!state.pendingEffect) return { success: false, message: 'No pending effect' };
    if (!state.pendingEffect.requiresSelection) return { success: false, message: 'No selection required' };
    if (state.pendingEffect.playerId !== playerId) return { success: false, message: 'Not your selection to make' };

    const { card } = state.pendingEffect;
    const magicCard = card as MagicCard;

    const ctx: EffectContext = {
      gameState: state,
      playerId: state.pendingEffect.playerId,
      selectedCards: selectedCardIds,
    };

    const result = executeCardEffect(magicCard.effect, ctx);

    if (!result.success) {
      return { success: false, message: result.message };
    }

    state.graveyard.push(card);
    delete state.pendingEffect;
    state.phase = 'main';
    checkGameEnd(state);
    return { success: true };
  }

  /**
   * Cancel a pending effect (e.g., countered by uchikeshi).
   * Both monster and magic cards go to graveyard when countered.
   */
  cancelEffect(state: GameState): void {
    if (state.pendingEffect) {
      state.graveyard.push(state.pendingEffect.card);
      delete state.pendingEffect;
    }
    state.phase = 'main';
  }
}
