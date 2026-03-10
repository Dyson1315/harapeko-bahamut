import type { GameState, Card, MonsterCard } from '../types/game';
import { getCardById } from '../data/cards';

// ----- Utility Functions -----

export function getOpponentId(state: GameState, playerId: string): string | null {
  const playerIds = Object.keys(state.players);
  return playerIds.find((id) => id !== playerId) ?? null;
}

export function dealDamage(
  state: GameState,
  targetId: string,
  amount: number,
  isFromHarapeko: boolean
): void {
  const target = state.players[targetId];
  const attackerId = getOpponentId(state, targetId);
  if (!target || !attackerId) return;

  const attacker = state.players[attackerId];

  // はねかえしゴブリン: はらぺこバハムート以外のダメージを反射
  if (!isFromHarapeko && target.field.some((m) => m.id === 'hanekaeshi-goblin')) {
    attacker.life = Math.max(0, attacker.life - amount);
  } else {
    target.life = Math.max(0, target.life - amount);
  }

  checkGameEnd(state);
}

export function checkGameEnd(state: GameState): string | null {
  if (state.gameOver) return state.winner;

  const deadPlayers = Object.keys(state.players).filter(
    (id) => state.players[id].life <= 0
  );

  if (deadPlayers.length === 0) return null;

  if (deadPlayers.length >= 2) {
    // Both players dead simultaneously: current turn player loses (their action caused it)
    const loserId = state.currentTurn;
    const winnerId = loserId ? getOpponentId(state, loserId) : null;
    state.gameOver = true;
    state.winner = winnerId;
    return winnerId;
  }

  // One player dead
  const winnerId = getOpponentId(state, deadPlayers[0]);
  if (winnerId) {
    state.gameOver = true;
    state.winner = winnerId;
    return winnerId;
  }
  return null;
}

export function drawCards(state: GameState, playerId: string, count: number): void {
  const player = state.players[playerId];
  if (!player) return;

  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      reshuffleDeck(state);
    }
    if (state.deck.length === 0) break;
    const card = state.deck.pop()!;
    player.hand.push(card);
  }
}

export function reshuffleDeck(state: GameState): void {
  if (state.graveyard.length === 0) return;
  state.deck = [...state.graveyard];
  state.graveyard = [];
  for (let i = state.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
  }
}

function swapCardsInArray(array: Card[], cardId1: string, cardId2: string): void {
  const card1Template = getCardById(cardId1);
  const card2Template = getCardById(cardId2);
  if (!card1Template || !card2Template) return;

  for (let i = 0; i < array.length; i++) {
    if (array[i].id === cardId1) {
      array[i] = { ...card2Template };
    } else if (array[i].id === cardId2) {
      array[i] = { ...card1Template };
    }
  }
}

// ----- Effect Context / Result (for CardManager integration) -----

export interface EffectContext {
  gameState: GameState;
  playerId: string;
  targetId?: string;
  selectedCards?: string[];
}

export interface EffectResult {
  success: boolean;
  message?: string;
  requiresTarget?: boolean;
  requiresSelection?: boolean;
  revealOpponentHand?: boolean;
  revealDeck?: boolean;
  revealAllCards?: boolean;
}

// ----- Effect Dispatcher -----

export function executeCardEffect(effect: string, context: EffectContext): EffectResult {
  switch (effect) {
    case 'directDamage': return executeDirectDamage(context);
    case 'destroyMonster': return executeDestroyMonster(context);
    case 'summonFromHand': return executeSummonFromHand(context);
    case 'summonFromGraveyard': return executeSummonFromGraveyard(context);
    case 'swapBahamuts': return executeSwapBahamuts(context);
    case 'drawDiscardPlay': return executeDrawDiscardPlay(context);
    case 'drawDiscard': return executeDrawDiscard(context);
    case 'retrieveFromGraveyard': return executeRetrieveFromGraveyard(context);
    case 'searchDeck': return executeSearchDeck(context);
    case 'handDiscard': return executeHandDiscard(context);
    case 'stealNamedCard': return executeStealNamedCard(context);
    case 'additionalPlays': return executeAdditionalPlays(context);
    case 'gainUchikeshi': return executeGainUchikeshi(context);
    default: return { success: false, message: '不明な効果です' };
  }
}

// ----- Individual Effects -----

// そらとぶナイフ: 相手に2ダメージ
function executeDirectDamage(ctx: EffectContext): EffectResult {
  const opponentId = getOpponentId(ctx.gameState, ctx.playerId);
  if (!opponentId) return { success: false, message: '対戦相手が見つかりません' };
  dealDamage(ctx.gameState, opponentId, 2, false);
  return { success: true };
}

// オワカーレ: 相手の場のまもの除去
function executeDestroyMonster(ctx: EffectContext): EffectResult {
  const { gameState, playerId, targetId } = ctx;
  if (!targetId) return { success: false, requiresTarget: true };

  const opponentId = getOpponentId(gameState, playerId);
  if (!opponentId) return { success: false, message: '対戦相手が見つかりません' };

  const opponent = gameState.players[opponentId];
  const cardIndex = opponent.field.findIndex((c) => c.id === targetId);
  if (cardIndex === -1) return { success: false, message: '相手の場にそのカードがありません' };

  const [removed] = opponent.field.splice(cardIndex, 1);
  gameState.graveyard.push(removed);
  return { success: true };
}

// イデヨン: 手札からまもの召喚
function executeSummonFromHand(ctx: EffectContext): EffectResult {
  const { gameState, playerId, targetId } = ctx;
  if (!targetId) return { success: false, requiresTarget: true };

  const player = gameState.players[playerId];
  const cardIndex = player.hand.findIndex((c) => c.id === targetId);
  if (cardIndex === -1) return { success: false, message: '手札にそのカードがありません' };

  const card = player.hand[cardIndex];
  if (card.type !== 'monster') return { success: false, message: 'まものカードを選択してください' };

  player.hand.splice(cardIndex, 1);
  player.field.push(card as MonsterCard);
  return { success: true };
}

// ヨミガエール: 捨て札からまもの蘇生
function executeSummonFromGraveyard(ctx: EffectContext): EffectResult {
  const { gameState, playerId, targetId } = ctx;
  if (!targetId) return { success: false, requiresTarget: true };

  const cardIndex = gameState.graveyard.findIndex((c) => c.id === targetId);
  if (cardIndex === -1) return { success: false, message: '捨て札にそのカードがありません' };

  const card = gameState.graveyard[cardIndex];
  if (card.type !== 'monster') return { success: false, message: 'まものカードを選択してください' };

  const player = gameState.players[playerId];
  gameState.graveyard.splice(cardIndex, 1);
  player.field.push(card as MonsterCard);
  return { success: true };
}

// イレカエール: 全領域でこどもゴブリンとはらぺこバハムートを入替
function executeSwapBahamuts(ctx: EffectContext): EffectResult {
  const { gameState } = ctx;
  swapCardsInArray(gameState.deck, 'kodomo-goblin', 'harapeko-bahamut');
  swapCardsInArray(gameState.graveyard, 'kodomo-goblin', 'harapeko-bahamut');
  for (const pid of Object.keys(gameState.players)) {
    const player = gameState.players[pid];
    swapCardsInArray(player.hand, 'kodomo-goblin', 'harapeko-bahamut');
    swapCardsInArray(player.field as Card[], 'kodomo-goblin', 'harapeko-bahamut');
  }
  return { success: true };
}

// 黒ネコのしっぽ: 2ドロー → 2捨て → +1プレイ
function executeDrawDiscardPlay(ctx: EffectContext): EffectResult {
  const { gameState, playerId, selectedCards } = ctx;
  const player = gameState.players[playerId];

  if (!selectedCards || selectedCards.length === 0) {
    drawCards(gameState, playerId, 2);
    return { success: false, requiresSelection: true };
  }

  if (selectedCards.length !== 2) {
    return { success: false, message: '2枚のカードを選択してください' };
  }

  for (const cardId of selectedCards) {
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return { success: false, message: '選択されたカードが手札にありません' };
  }

  for (const cardId of selectedCards) {
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const [discarded] = player.hand.splice(idx, 1);
      gameState.graveyard.push(discarded);
    }
  }

  player.canPlay += 1;
  return { success: true };
}

// 銀ネコのしっぽ: 3ドロー → 2捨て
function executeDrawDiscard(ctx: EffectContext): EffectResult {
  const { gameState, playerId, selectedCards } = ctx;
  const player = gameState.players[playerId];

  if (!selectedCards || selectedCards.length === 0) {
    drawCards(gameState, playerId, 3);
    return { success: false, requiresSelection: true };
  }

  if (selectedCards.length !== 2) {
    return { success: false, message: '2枚のカードを選択してください' };
  }

  for (const cardId of selectedCards) {
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return { success: false, message: '選択されたカードが手札にありません' };
  }

  for (const cardId of selectedCards) {
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const [discarded] = player.hand.splice(idx, 1);
      gameState.graveyard.push(discarded);
    }
  }

  return { success: true };
}

// カラスのおつかい: 捨て札から1枚回収
function executeRetrieveFromGraveyard(ctx: EffectContext): EffectResult {
  const { gameState, playerId, targetId } = ctx;
  if (!targetId) return { success: false, requiresTarget: true };

  const cardIndex = gameState.graveyard.findIndex((c) => c.id === targetId);
  if (cardIndex === -1) return { success: false, message: '捨て札にそのカードがありません' };

  const [retrieved] = gameState.graveyard.splice(cardIndex, 1);
  gameState.players[playerId].hand.push(retrieved);
  return { success: true };
}

// ようせいのメガネ: 山札全公開→1枚手札に→シャッフル
function executeSearchDeck(ctx: EffectContext): EffectResult {
  const { gameState, playerId, selectedCards } = ctx;

  if (gameState.deck.length === 0) {
    return { success: true, message: '山札が空のため効果なし' };
  }

  if (!selectedCards || selectedCards.length === 0) {
    return { success: false, requiresSelection: true, revealDeck: true };
  }

  if (selectedCards.length !== 1) {
    return { success: false, message: '1枚のカードを選択してください' };
  }

  const cardIndex = gameState.deck.findIndex((c) => c.id === selectedCards[0]);
  if (cardIndex === -1) return { success: false, message: '選択されたカードが山札にありません' };

  const [searched] = gameState.deck.splice(cardIndex, 1);
  gameState.players[playerId].hand.push(searched);

  // シャッフル
  for (let i = gameState.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
  }

  return { success: true };
}

// あくまの吹き矢: 相手手札公開→1枚選んで捨て
function executeHandDiscard(ctx: EffectContext): EffectResult {
  const { gameState, playerId, selectedCards } = ctx;
  const opponentId = getOpponentId(gameState, playerId);
  if (!opponentId) return { success: false, message: '対戦相手が見つかりません' };

  const opponent = gameState.players[opponentId];
  if (opponent.hand.length === 0) {
    return { success: true, message: '相手の手札が空のため効果なし' };
  }

  if (!selectedCards || selectedCards.length === 0) {
    return { success: false, requiresSelection: true, revealOpponentHand: true };
  }

  if (selectedCards.length !== 1) {
    return { success: false, message: '1枚のカードを選択してください' };
  }

  const cardIndex = opponent.hand.findIndex((c) => c.id === selectedCards[0]);
  if (cardIndex === -1) return { success: false, message: '選択されたカードが相手の手札にありません' };

  const [discarded] = opponent.hand.splice(cardIndex, 1);
  gameState.graveyard.push(discarded);
  return { success: true };
}

// ひらめき水晶: カード名宣言→相手手札にあれば奪取
function executeStealNamedCard(ctx: EffectContext): EffectResult {
  const { gameState, playerId, selectedCards } = ctx;
  const opponentId = getOpponentId(gameState, playerId);
  if (!opponentId) return { success: false, message: '対戦相手が見つかりません' };

  if (!selectedCards || selectedCards.length === 0) {
    return { success: false, requiresSelection: true, revealAllCards: true };
  }

  if (selectedCards.length !== 1) {
    return { success: false, message: '1枚のカードを選択してください' };
  }

  const selectedCardId = selectedCards[0];
  if (selectedCardId === 'hirameki-suishou') {
    return { success: false, message: 'ひらめき水晶自身は選択できません' };
  }

  const opponent = gameState.players[opponentId];
  const cardIndex = opponent.hand.findIndex((c) => c.id === selectedCardId);

  if (cardIndex === -1) {
    const cardDef = getCardById(selectedCardId);
    const cardName = cardDef ? cardDef.name : selectedCardId;
    return { success: true, message: `相手は「${cardName}」を持っていませんでした` };
  }

  const [stolen] = opponent.hand.splice(cardIndex, 1);
  gameState.players[playerId].hand.push(stolen);
  return { success: true };
}

// ほしふる砂時計: +2プレイ
function executeAdditionalPlays(ctx: EffectContext): EffectResult {
  const player = ctx.gameState.players[ctx.playerId];
  player.canPlay += 2;
  return { success: true };
}

// 魔女のおとどけもの: 共有ストックからうちけし1獲得
function executeGainUchikeshi(ctx: EffectContext): EffectResult {
  const { gameState, playerId } = ctx;
  const player = gameState.players[playerId];

  if (gameState.sharedUchikeshi > 0) {
    gameState.sharedUchikeshi--;
    player.uchikeshi++;
    return { success: true };
  }

  return { success: false, message: '共有ストックにうちけしの書がありません' };
}

