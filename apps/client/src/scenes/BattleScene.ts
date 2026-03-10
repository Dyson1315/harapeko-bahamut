import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene, SceneSwitcher, SceneData } from './BaseScene';
import { GameManager } from '../game/GameManager';
import { GameState, PlayerState } from '../types/game';
import { Card, MagicCard } from '../types/card';
import { CardSprite } from '../ui/CardSprite';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { COLORS, FONT, GAME, responsive, ResponsiveLayout } from '../utils/constants';
import { getAllCards } from '../data/cards';

/** ターゲットが必要なエフェクトとターゲット候補の取得方法 */
type TargetSource = 'myHandMonsters' | 'opponentFieldMonsters' | 'graveyardMonsters' | 'graveyardAll';

const TARGET_EFFECTS: Record<string, { source: TargetSource; title: string }> = {
  summonFromHand: { source: 'myHandMonsters', title: '場に出すまものを選択' },
  destroyMonster: { source: 'opponentFieldMonsters', title: '破壊するまものを選択' },
  summonFromGraveyard: { source: 'graveyardMonsters', title: '蘇生するまものを選択' },
  retrieveFromGraveyard: { source: 'graveyardAll', title: '回収するカードを選択' },
};

/**
 * バトル画面
 */
export class BattleScene extends BaseScene {
  private gm: GameManager;
  private boardBg: Graphics;
  private layout: ResponsiveLayout;

  // 行コンテナ
  private opponentHandRow: Container;
  private opponentFieldRow: Container;
  private centerRow: Container;
  private myFieldRow: Container;
  private myHandRow: Container;

  // フィールドゾーン背景
  private oppFieldBg: Graphics;
  private myFieldBg: Graphics;

  // ステータスバー
  private oppStatusBar: Graphics;
  private myStatusBar: Graphics;
  private oppNameText: Text;
  private myNameText: Text;
  private oppHpLabel: Text;
  private myHpLabel: Text;
  private oppUchikeshiLabel: Text;
  private myUchikeshiLabel: Text;
  private playCountText: Text;

  // ターン表示
  private turnAccentOpp: Graphics;
  private turnAccentMy: Graphics;
  private turnText: Text;

  // 中央
  private deckPile: Graphics;
  private deckCountLabel: Text;
  private graveyardPile: Graphics;
  private graveyardCountLabel: Text;
  private sharedBookLabel: Text;

  // ボタン（ゲームエリア内配置）
  private endTurnBtn: Button;

  // フィールドスロット表示
  private oppSlotGfx: Graphics;
  private mySlotGfx: Graphics;

  // カード情報バー
  private cardInfoBg: Graphics;
  private cardInfoName: Text;
  private cardInfoDesc: Text;
  private cardInfoHint: Text;

  // カウンター待ちバナー
  private counterBanner: Graphics;
  private counterBannerText: Text;

  // モーダル
  private currentModal: Modal | null = null;

  // 状態
  private selectedHandCardId: string | null = null;
  private myPlayerId: string;

  constructor(app: Application, switchScene: SceneSwitcher, data?: SceneData) {
    super(app, switchScene);

    this.layout = responsive(app.screen.width, app.screen.height);
    this.gm = new GameManager();
    this.myPlayerId = (data?.playerId as string) ?? '';
    const L = this.layout;

    // 背景
    this.boardBg = new Graphics();
    this.container.addChild(this.boardBg);

    // フィールドゾーン背景
    this.oppFieldBg = new Graphics();
    this.container.addChild(this.oppFieldBg);
    this.myFieldBg = new Graphics();
    this.container.addChild(this.myFieldBg);

    // ステータスバー
    this.oppStatusBar = new Graphics();
    this.container.addChild(this.oppStatusBar);
    this.myStatusBar = new Graphics();
    this.container.addChild(this.myStatusBar);

    // ターンアクセント（ステータスバー左端の色帯）
    this.turnAccentOpp = new Graphics();
    this.container.addChild(this.turnAccentOpp);
    this.turnAccentMy = new Graphics();
    this.container.addChild(this.turnAccentMy);

    // 相手ステータス
    this.oppNameText = this.makeText('', L.fontSmall, COLORS.TEXT_PRIMARY, true);
    this.oppHpLabel = this.makeText('', L.fontSmall, COLORS.LIFE_FULL, true);
    this.oppUchikeshiLabel = this.makeText('', L.fontTiny, COLORS.UCHIKESHI, true);

    // 自分ステータス
    this.myNameText = this.makeText('', L.fontSmall, COLORS.TEXT_PRIMARY, true);
    this.myHpLabel = this.makeText('', L.fontSmall, COLORS.LIFE_FULL, true);
    this.myUchikeshiLabel = this.makeText('', L.fontTiny, COLORS.UCHIKESHI, true);
    this.playCountText = this.makeText('', L.fontSmall, 0x1565c0, true);

    // 行コンテナ
    this.opponentHandRow = new Container();
    this.container.addChild(this.opponentHandRow);
    this.opponentFieldRow = new Container();
    this.container.addChild(this.opponentFieldRow);
    this.centerRow = new Container();
    this.container.addChild(this.centerRow);
    this.myFieldRow = new Container();
    this.container.addChild(this.myFieldRow);
    this.myHandRow = new Container();
    this.container.addChild(this.myHandRow);

    // ターン表示テキスト（中央ゾーン）
    this.turnText = this.makeText('', L.fontSmall, COLORS.TEXT_WHITE, true);
    this.turnText.anchor.set(0.5, 0.5);

    // 中央パイル
    this.deckPile = new Graphics();
    this.centerRow.addChild(this.deckPile);
    this.deckCountLabel = this.makeText('', L.fontSmall, COLORS.TEXT_PRIMARY, true, this.centerRow);
    this.deckCountLabel.anchor.set(0.5, 0.5);
    this.graveyardPile = new Graphics();
    this.centerRow.addChild(this.graveyardPile);
    this.graveyardCountLabel = this.makeText('', L.fontSmall, COLORS.TEXT_PRIMARY, true, this.centerRow);
    this.graveyardCountLabel.anchor.set(0.5, 0.5);

    // 共有うちけしの書
    this.sharedBookLabel = this.makeText('', L.fontTiny, COLORS.UCHIKESHI, true, this.centerRow);
    this.sharedBookLabel.anchor.set(0.5, 0.5);

    // フィールドスロット表示（空の場にカード置場を示す）
    this.oppSlotGfx = new Graphics();
    this.container.addChild(this.oppSlotGfx);
    this.mySlotGfx = new Graphics();
    this.container.addChild(this.mySlotGfx);

    // カード情報バー（選択時に表示）
    this.cardInfoBg = new Graphics();
    this.cardInfoBg.visible = false;
    this.container.addChild(this.cardInfoBg);
    this.cardInfoName = this.makeText('', L.fontSmall, 0xffffff, true);
    this.cardInfoName.visible = false;
    this.cardInfoDesc = this.makeText('', L.fontTiny, 0xe0e0e0, false);
    this.cardInfoDesc.visible = false;
    this.cardInfoHint = this.makeText('', L.fontTiny, 0xffd54f, true);
    this.cardInfoHint.anchor.set(1, 0.5);
    this.cardInfoHint.visible = false;

    // カウンター待ちバナー
    this.counterBanner = new Graphics();
    this.counterBanner.visible = false;
    this.container.addChild(this.counterBanner);
    this.counterBannerText = this.makeText('相手がうちけしを検討中...', L.fontSmall, COLORS.TEXT_WHITE, true);
    this.counterBannerText.anchor.set(0.5, 0.5);
    this.counterBannerText.visible = false;

    // ボタン
    this.endTurnBtn = new Button('ターン終了', L.buttonW, L.buttonH, COLORS.BUTTON_SECONDARY);
    this.endTurnBtn.on('pointertap', () => this.onEndTurn());
    this.container.addChild(this.endTurnBtn);

    // イベント
    this.gm.store.on('stateChanged', () => this.renderState());
    this.gm.store.on('uchikeshiPrompt', (d) => this.showUchikeshiModal(d));
    this.gm.store.on('uchikeshiBackPrompt', (d) => this.showUchikeshiBackModal(d));
    this.gm.store.on('gameEnded', (d) => this.onGameEnded(d));
    this.gm.store.on('error', (d) => {
      console.error('[Battle]', (d as { message: string })?.message ?? 'Error');
    });

    let lastSelectionKey = '';
    this.gm.store.on('stateChanged', () => {
      const state = this.gm.store.getState();
      if (state?.pendingEffect?.requiresSelection && state.pendingEffect.playerId === this.myPlayerId) {
        const key = `${state.pendingEffect.card?.id}-${state.turnCount}`;
        if (key !== lastSelectionKey) {
          lastSelectionKey = key;
          this.showSelectionModal(state);
        }
      }
    });

    // 接続
    const serverUrl = location.origin;
    const roomId = (data?.roomId as string) ?? 'default';
    const playerId = this.myPlayerId || `player-${Date.now()}`;
    const playerName = (data?.playerName as string) ?? 'プレイヤー';
    this.gm.connect(serverUrl, roomId, playerId, playerName);

    this.onResize();
  }

  // ===== ヘルパー =====

  private makeText(
    text: string, fontSize: number, color: number, bold: boolean,
    parent?: Container
  ): Text {
    const t = new Text(text, new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize,
      fill: color,
      fontWeight: bold ? 'bold' : 'normal',
    }));
    (parent ?? this.container).addChild(t);
    return t;
  }

  private hpColor(life: number, max: number): number {
    const ratio = life / max;
    if (ratio > 0.75) return 0x43a047;
    if (ratio > 0.5) return COLORS.LIFE_FULL;
    if (ratio > 0.25) return 0xf9a825;
    return 0xe53935;
  }

  // ===== レンダリング =====

  private renderState(): void {
    const state = this.gm.store.getState();
    if (!state) return;

    const me = this.gm.store.myPlayer;
    const opp = this.gm.store.opponentPlayer;
    const isMyTurn = this.gm.store.isMyTurn;

    this.updateStatusContent(me, opp, state, isMyTurn);
    this.renderOpponentHand(opp);
    this.renderOpponentField(opp);
    this.renderMyField(me);
    this.renderMyHand(me);
    this.drawCenterPiles(state);

    this.endTurnBtn.disabled = !isMyTurn || state.phase !== 'main';

    this.updateCardInfo(me);
    this.layoutAll(state, isMyTurn);
  }

  private updateStatusContent(
    me: PlayerState | null, opp: PlayerState | null,
    state: GameState, isMyTurn: boolean
  ): void {
    const max = GAME.MAX_LIFE;

    // 名前
    this.oppNameText.text = opp?.name ?? '相手';
    this.myNameText.text = me?.name ?? '自分';

    // HP（色付き）
    const ol = opp?.life ?? 0;
    const ml = me?.life ?? 0;
    this.oppHpLabel.text = `HP ${ol}/${max}`;
    this.oppHpLabel.style.fill = this.hpColor(ol, max);
    this.myHpLabel.text = `HP ${ml}/${max}`;
    this.myHpLabel.style.fill = this.hpColor(ml, max);

    // うちけし
    const ouCount = opp?.uchikeshi ?? 0;
    const muCount = me?.uchikeshi ?? 0;
    this.oppUchikeshiLabel.text = ouCount > 0 ? `うちけし×${ouCount}` : 'うちけし×0';
    this.oppUchikeshiLabel.style.fill = ouCount > 0 ? COLORS.UCHIKESHI : 0xaaaaaa;
    this.myUchikeshiLabel.text = muCount > 0 ? `うちけし×${muCount}` : 'うちけし×0';
    this.myUchikeshiLabel.style.fill = muCount > 0 ? COLORS.UCHIKESHI : 0xaaaaaa;

    // 共有うちけしの書
    const sharedU = state.sharedUchikeshi ?? 0;
    this.sharedBookLabel.text = `うちけしの書 ×${sharedU}`;

    // プレイ残り回数
    if (me && isMyTurn) {
      const remain = Math.max(0, me.canPlay - me.playedCount);
      this.playCountText.text = `あと${remain}回`;
      this.playCountText.visible = true;
    } else {
      this.playCountText.visible = false;
    }

    // ターン表示
    const phase = this.phaseLabel(state.phase);
    this.turnText.text = isMyTurn ? `あなたのターン - ${phase}` : `相手のターン - ${phase}`;

    // 中央ラベル
    this.deckCountLabel.text = `山札\n${state.deckCount}`;
    this.graveyardCountLabel.text = `捨て札\n${state.graveyard?.length ?? 0}`;

    // カウンター待ちバナー
    const showCounter = state.phase === 'counter' && state.pendingEffect?.playerId === this.myPlayerId;
    this.counterBanner.visible = showCounter;
    this.counterBannerText.visible = showCounter;
  }

  private phaseLabel(phase: string): string {
    switch (phase) {
      case 'waiting': return '待機中';
      case 'main': return 'メイン';
      case 'counter': return 'うちけし';
      case 'finished': return '終了';
      default: return '';
    }
  }

  /** 選択中カードの情報バーを更新 */
  private updateCardInfo(me: PlayerState | null): void {
    if (!this.selectedHandCardId || !me) {
      this.cardInfoBg.visible = false;
      this.cardInfoName.visible = false;
      this.cardInfoDesc.visible = false;
      this.cardInfoHint.visible = false;
      return;
    }
    const card = me.hand.find(c => c.id === this.selectedHandCardId);
    if (!card) {
      this.cardInfoBg.visible = false;
      this.cardInfoName.visible = false;
      this.cardInfoDesc.visible = false;
      this.cardInfoHint.visible = false;
      return;
    }
    const typeLabel = card.type === 'monster' ? 'まもの' : 'まほう';
    this.cardInfoName.text = `【${typeLabel}】${card.name}`;
    this.cardInfoDesc.text = card.description;
    this.cardInfoHint.text = 'タップで使用';
    this.cardInfoBg.visible = true;
    this.cardInfoName.visible = true;
    this.cardInfoDesc.visible = true;
    this.cardInfoHint.visible = true;
  }

  /** 空フィールドにカードスロット表示 */
  private drawFieldSlots(
    gfx: Graphics, fieldY: number, cardCount: number,
    cw: number, ch: number, maxSlots: number, w: number
  ): void {
    gfx.clear();
    if (cardCount >= maxSlots) return;
    const gap = Math.max(3, cw * 0.08);
    const totalW = (maxSlots - 1) * (cw + gap) + cw;
    const sx = w / 2 - totalW / 2;
    const r = Math.round(cw * 0.08);

    for (let i = 0; i < maxSlots; i++) {
      if (i < cardCount) continue;
      const x = sx + i * (cw + gap);
      const y = fieldY - ch / 2;
      gfx.lineStyle(1, COLORS.CARD_BORDER, 0.2);
      gfx.beginFill(0xffffff, 0.04);
      gfx.drawRoundedRect(x, y, cw, ch, r);
      gfx.endFill();
    }
  }

  // --- カード描画 ---

  private renderOpponentHand(opp: PlayerState | null): void {
    this.opponentHandRow.removeChildren();
    if (!opp) return;
    const count = opp.handCount ?? 0;
    const L = this.layout;
    const { oppHandCardW: cw, oppHandCardH: ch } = L;

    const availW = L.screenW * 0.6;
    const maxGap = cw * 1.08;
    const gap = count > 1 ? Math.min(maxGap, (availW - cw) / (count - 1)) : maxGap;
    const totalW = count > 0 ? (count - 1) * gap + cw : 0;
    const sx = -totalW / 2;

    for (let i = 0; i < count; i++) {
      const card = new CardSprite(null, false, cw, ch, L.cardRadius * 0.5);
      card.x = sx + i * gap;
      card.y = -ch / 2;
      this.opponentHandRow.addChild(card);
    }
  }

  private renderOpponentField(opp: PlayerState | null): void {
    this.opponentFieldRow.removeChildren();
    if (!opp?.field.length) return;
    const L = this.layout;
    const { fieldCardW: cw, fieldCardH: ch, fieldCardGap: gap } = L;
    const totalW = (opp.field.length - 1) * (cw + gap) + cw;
    const sx = -totalW / 2;
    for (let i = 0; i < opp.field.length; i++) {
      const cs = new CardSprite(opp.field[i], true, cw, ch, L.cardRadius * 0.7);
      cs.x = sx + i * (cw + gap);
      cs.y = -ch / 2;
      this.opponentFieldRow.addChild(cs);
    }
  }

  private renderMyField(me: PlayerState | null): void {
    this.myFieldRow.removeChildren();
    if (!me?.field.length) return;
    const L = this.layout;
    const { fieldCardW: cw, fieldCardH: ch, fieldCardGap: gap } = L;
    const totalW = (me.field.length - 1) * (cw + gap) + cw;
    const sx = -totalW / 2;
    for (let i = 0; i < me.field.length; i++) {
      const cs = new CardSprite(me.field[i], true, cw, ch, L.cardRadius * 0.7);
      cs.x = sx + i * (cw + gap);
      cs.y = -ch / 2;
      this.myFieldRow.addChild(cs);
    }
  }

  private renderMyHand(me: PlayerState | null): void {
    this.myHandRow.removeChildren();
    if (!me) return;
    const { hand } = me;
    const L = this.layout;
    const { cardW: cw, cardH: ch } = L;

    const availW = L.screenW * 0.88;
    const maxGap = cw * 1.06;
    const gap = hand.length > 1 ? Math.min(maxGap, (availW - cw) / (hand.length - 1)) : maxGap;
    const totalW = hand.length > 0 ? (hand.length - 1) * gap + cw : 0;
    const sx = -totalW / 2;
    const canPlay = this.gm.store.canPlayCard;

    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      const cs = new CardSprite(c, true, cw, ch, L.cardRadius);
      cs.setPosition(sx + i * gap, -ch / 2);
      cs.hoverable = canPlay;
      cs.selected = this.selectedHandCardId === c.id;
      if (canPlay) cs.on('pointertap', () => this.onHandCardTap(c));
      this.myHandRow.addChild(cs);
    }
  }

  private drawCenterPiles(state: GameState): void {
    const L = this.layout;
    const { pileW: pw, pileH: ph } = L;
    const r = Math.round(pw * 0.12);

    // 山札
    this.deckPile.clear();
    // シャドウ
    this.deckPile.beginFill(0x000000, 0.07);
    this.deckPile.drawRoundedRect(1, 2, pw, ph, r);
    this.deckPile.endFill();
    if (state.deckCount > 0) {
      this.deckPile.beginFill(COLORS.DECK);
      this.deckPile.drawRoundedRect(0, 0, pw, ph, r);
      this.deckPile.endFill();
      // ハイライト
      this.deckPile.beginFill(0xffffff, 0.12);
      this.deckPile.drawRoundedRect(1, 0, pw - 2, ph * 0.35, r);
      this.deckPile.endFill();
      this.deckPile.lineStyle(1, 0x4caf50, 0.4);
      this.deckPile.drawRoundedRect(0, 0, pw, ph, r);
    } else {
      this.deckPile.beginFill(COLORS.DECK, 0.12);
      this.deckPile.drawRoundedRect(0, 0, pw, ph, r);
      this.deckPile.endFill();
      this.deckPile.lineStyle(1, COLORS.CARD_BORDER, 0.35);
      this.deckPile.drawRoundedRect(0, 0, pw, ph, r);
    }

    // 捨て札
    this.graveyardPile.clear();
    this.graveyardPile.beginFill(0x000000, 0.07);
    this.graveyardPile.drawRoundedRect(1, 2, pw, ph, r);
    this.graveyardPile.endFill();
    if ((state.graveyard?.length ?? 0) > 0) {
      this.graveyardPile.beginFill(COLORS.GRAVEYARD);
      this.graveyardPile.drawRoundedRect(0, 0, pw, ph, r);
      this.graveyardPile.endFill();
      this.graveyardPile.beginFill(0xffffff, 0.1);
      this.graveyardPile.drawRoundedRect(1, 0, pw - 2, ph * 0.35, r);
      this.graveyardPile.endFill();
      this.graveyardPile.lineStyle(1, 0x8d6e63, 0.4);
      this.graveyardPile.drawRoundedRect(0, 0, pw, ph, r);
    } else {
      this.graveyardPile.beginFill(COLORS.GRAVEYARD, 0.18);
      this.graveyardPile.drawRoundedRect(0, 0, pw, ph, r);
      this.graveyardPile.endFill();
      this.graveyardPile.lineStyle(1, COLORS.CARD_BORDER, 0.4);
      this.graveyardPile.drawRoundedRect(0, 0, pw, ph, r);
    }
  }

  // ===== レイアウト =====

  private layoutAll(state: GameState, isMyTurn: boolean): void {
    const L = this.layout;
    const { screenW: w, screenH: h, cx, statusH } = L;

    // --- 背景 ---
    this.boardBg.clear();
    this.boardBg.beginFill(COLORS.BACKGROUND);
    this.boardBg.drawRect(0, 0, w, h);
    this.boardBg.endFill();

    // 上半分（相手エリア）
    this.boardBg.beginFill(COLORS.BOARD_TOP, 0.35);
    this.boardBg.drawRect(0, statusH, w, L.centerY - statusH);
    this.boardBg.endFill();

    // 下半分（自分エリア）
    this.boardBg.beginFill(COLORS.BOARD_BOTTOM, 0.25);
    this.boardBg.drawRect(0, L.centerY, w, h - L.centerY - statusH);
    this.boardBg.endFill();

    // 中央ライン
    this.boardBg.lineStyle(1, COLORS.DIVIDER, 0.35);
    this.boardBg.moveTo(0, L.centerY);
    this.boardBg.lineTo(w, L.centerY);

    // --- フィールドゾーン背景 ---
    const zonePadX = w * 0.06;
    const zonePadY = 6;
    const zoneR = 10;

    const oppFT = L.oppFieldY - L.fieldCardH / 2 - zonePadY;
    const oppFB = L.oppFieldY + L.fieldCardH / 2 + zonePadY;
    this.oppFieldBg.clear();
    this.oppFieldBg.beginFill(COLORS.FIELD_OPPONENT, 0.25);
    this.oppFieldBg.drawRoundedRect(zonePadX, oppFT, w - zonePadX * 2, oppFB - oppFT, zoneR);
    this.oppFieldBg.endFill();
    // 点線風ボーダー
    this.oppFieldBg.lineStyle(1, COLORS.FIELD_OPPONENT, 0.3);
    this.oppFieldBg.drawRoundedRect(zonePadX, oppFT, w - zonePadX * 2, oppFB - oppFT, zoneR);

    const myFT = L.myFieldY - L.fieldCardH / 2 - zonePadY;
    const myFB = L.myFieldY + L.fieldCardH / 2 + zonePadY;
    this.myFieldBg.clear();
    this.myFieldBg.beginFill(COLORS.FIELD_BG, 0.25);
    this.myFieldBg.drawRoundedRect(zonePadX, myFT, w - zonePadX * 2, myFB - myFT, zoneR);
    this.myFieldBg.endFill();
    this.myFieldBg.lineStyle(1, COLORS.FIELD_BG, 0.3);
    this.myFieldBg.drawRoundedRect(zonePadX, myFT, w - zonePadX * 2, myFB - myFT, zoneR);

    // --- ステータスバー ---
    this.oppStatusBar.clear();
    this.oppStatusBar.beginFill(COLORS.STATUS_BAR_OPP);
    this.oppStatusBar.drawRect(0, 0, w, statusH);
    this.oppStatusBar.endFill();
    // 下ボーダー
    this.oppStatusBar.beginFill(0x000000, 0.06);
    this.oppStatusBar.drawRect(0, statusH - 1, w, 1);
    this.oppStatusBar.endFill();

    this.myStatusBar.clear();
    this.myStatusBar.beginFill(COLORS.STATUS_BAR_MY);
    this.myStatusBar.drawRect(0, h - statusH, w, statusH);
    this.myStatusBar.endFill();
    // 上ボーダー
    this.myStatusBar.beginFill(0x000000, 0.06);
    this.myStatusBar.drawRect(0, h - statusH, w, 1);
    this.myStatusBar.endFill();

    // ターンアクセント（アクティブ側に色帯 + 微かなグロー）
    const accentW = 4;
    this.turnAccentOpp.clear();
    this.turnAccentMy.clear();
    if (!isMyTurn) {
      this.turnAccentOpp.beginFill(0xef5350);
      this.turnAccentOpp.drawRect(0, 0, accentW, statusH);
      this.turnAccentOpp.endFill();
      this.turnAccentOpp.beginFill(0xef5350, 0.08);
      this.turnAccentOpp.drawRect(accentW, 0, w * 0.15, statusH);
      this.turnAccentOpp.endFill();
    } else {
      this.turnAccentMy.beginFill(0x42a5f5);
      this.turnAccentMy.drawRect(0, h - statusH, accentW, statusH);
      this.turnAccentMy.endFill();
      this.turnAccentMy.beginFill(0x42a5f5, 0.08);
      this.turnAccentMy.drawRect(accentW, h - statusH, w * 0.15, statusH);
      this.turnAccentMy.endFill();
    }

    // --- ステータスバー内容 ---
    const px = L.statusPadX + accentW + 2;
    const cyOpp = statusH / 2;
    const cyMy = h - statusH / 2;
    const fs = L.fontSmall;
    const vOff = fs * 0.55;

    // 相手ステータス: [名前] [HP x/4] [うちけし×N]
    const colName = px;
    const colHp = px + Math.max(55, w * 0.12);
    const colUchi = px + Math.max(120, w * 0.28);

    this.oppNameText.style.fontSize = fs;
    this.oppNameText.x = colName;
    this.oppNameText.y = cyOpp - vOff;

    this.oppHpLabel.style.fontSize = fs;
    this.oppHpLabel.x = colHp;
    this.oppHpLabel.y = cyOpp - vOff;

    this.oppUchikeshiLabel.style.fontSize = Math.round(fs * 0.85);
    this.oppUchikeshiLabel.x = colUchi;
    this.oppUchikeshiLabel.y = cyOpp - fs * 0.45;

    // 自分ステータス: [名前] [HP x/4] [うちけし×N] [あとN回] ... [ターン終了]
    this.myNameText.style.fontSize = fs;
    this.myNameText.x = colName;
    this.myNameText.y = cyMy - vOff;

    this.myHpLabel.style.fontSize = fs;
    this.myHpLabel.x = colHp;
    this.myHpLabel.y = cyMy - vOff;

    this.myUchikeshiLabel.style.fontSize = Math.round(fs * 0.85);
    this.myUchikeshiLabel.x = colUchi;
    this.myUchikeshiLabel.y = cyMy - fs * 0.45;

    this.playCountText.style.fontSize = fs;
    this.playCountText.x = px + Math.max(200, w * 0.46);
    this.playCountText.y = cyMy - vOff;

    // ターン終了ボタン（ゲームエリア右側に配置）
    const btnW = Math.max(L.buttonW, 70);
    const btnH = Math.max(L.buttonH + 4, 36);
    this.endTurnBtn.resize(btnW, btnH);
    this.endTurnBtn.x = w - btnW - L.statusPadX;
    this.endTurnBtn.y = L.myHandY - btnH / 2;

    // --- ターン表示（中央ゾーン） ---
    const turnColor = isMyTurn ? 0x42a5f5 : 0xef5350;
    const turnDark = isMyTurn ? 0x1565c0 : 0xc62828;
    const turnBgW = Math.min(w * 0.5, 240);
    const turnBgH = Math.max(18, L.fontSmall * 1.5);
    const turnBgY = L.centerY - L.pileH / 2 - turnBgH - 3;

    // シャドウ
    this.boardBg.beginFill(0x000000, 0.1);
    this.boardBg.drawRoundedRect(cx - turnBgW / 2 + 1, turnBgY + 2, turnBgW, turnBgH, turnBgH / 2);
    this.boardBg.endFill();
    // 本体
    this.boardBg.beginFill(turnColor, 0.92);
    this.boardBg.drawRoundedRect(cx - turnBgW / 2, turnBgY, turnBgW, turnBgH, turnBgH / 2);
    this.boardBg.endFill();
    // 上部ハイライト
    this.boardBg.beginFill(0xffffff, 0.15);
    this.boardBg.drawRoundedRect(cx - turnBgW / 2 + 2, turnBgY, turnBgW - 4, turnBgH * 0.5, turnBgH / 2);
    this.boardBg.endFill();
    // 下ボーダー
    this.boardBg.lineStyle(1, turnDark, 0.3);
    this.boardBg.drawRoundedRect(cx - turnBgW / 2, turnBgY, turnBgW, turnBgH, turnBgH / 2);

    this.turnText.style.fontSize = Math.round(L.fontSmall * 0.85);
    this.turnText.x = cx;
    this.turnText.y = turnBgY + turnBgH / 2;

    // --- 行配置 ---
    this.opponentHandRow.x = cx;
    this.opponentHandRow.y = L.oppHandY;
    this.opponentFieldRow.x = cx;
    this.opponentFieldRow.y = L.oppFieldY;
    this.centerRow.x = 0;
    this.centerRow.y = 0;
    this.myFieldRow.x = cx;
    this.myFieldRow.y = L.myFieldY;
    this.myHandRow.x = cx;
    this.myHandRow.y = L.myHandY;

    // --- 中央パイル ---
    const pileGap = Math.max(14, w * 0.04);
    const totalPW = L.pileW * 2 + pileGap;
    const pilesX = cx - totalPW / 2;
    const pileY = L.centerY - L.pileH / 2;

    this.deckPile.x = pilesX;
    this.deckPile.y = pileY;
    this.deckCountLabel.style.fontSize = L.fontTiny;
    this.deckCountLabel.x = pilesX + L.pileW / 2;
    this.deckCountLabel.y = pileY + L.pileH / 2;

    const gx = pilesX + L.pileW + pileGap;
    this.graveyardPile.x = gx;
    this.graveyardPile.y = pileY;
    this.graveyardCountLabel.style.fontSize = L.fontTiny;
    this.graveyardCountLabel.x = gx + L.pileW / 2;
    this.graveyardCountLabel.y = pileY + L.pileH / 2;

    // 共有うちけしの書 — パイルの下
    this.sharedBookLabel.style.fontSize = L.fontTiny;
    this.sharedBookLabel.x = cx;
    this.sharedBookLabel.y = pileY + L.pileH + L.fontTiny * 0.8;

    // --- フィールドスロット ---
    const oppFieldCount = this.gm.store.opponentPlayer?.field.length ?? 0;
    const myFieldCount = this.gm.store.myPlayer?.field.length ?? 0;
    this.drawFieldSlots(this.oppSlotGfx, L.oppFieldY, oppFieldCount, L.fieldCardW, L.fieldCardH, 3, w);
    this.drawFieldSlots(this.mySlotGfx, L.myFieldY, myFieldCount, L.fieldCardW, L.fieldCardH, 3, w);

    // --- カード情報バー ---
    const infoBarH = L.fontSmall + L.fontTiny + 10;
    const infoBarY = L.myHandY - L.cardH / 2 - infoBarH - 4;
    this.cardInfoBg.clear();
    this.cardInfoBg.beginFill(0x2a1a30, 0.88);
    this.cardInfoBg.drawRoundedRect(w * 0.03, infoBarY, w * 0.94, infoBarH, 6);
    this.cardInfoBg.endFill();

    this.cardInfoName.style.fontSize = Math.round(L.fontSmall * 0.9);
    this.cardInfoName.x = w * 0.05;
    this.cardInfoName.y = infoBarY + 3;

    this.cardInfoDesc.style.fontSize = L.fontTiny;
    this.cardInfoDesc.style.wordWrap = true;
    this.cardInfoDesc.style.wordWrapWidth = w * 0.7;
    this.cardInfoDesc.x = w * 0.05;
    this.cardInfoDesc.y = infoBarY + L.fontSmall * 0.9 + 5;

    this.cardInfoHint.style.fontSize = L.fontTiny;
    this.cardInfoHint.x = w * 0.95;
    this.cardInfoHint.y = infoBarY + infoBarH / 2;

    // --- カウンター待ちバナー ---
    const bannerW = Math.min(w * 0.65, 280);
    const bannerH = Math.max(22, L.fontSmall * 2);
    this.counterBanner.clear();
    // シャドウ
    this.counterBanner.beginFill(0x000000, 0.12);
    this.counterBanner.drawRoundedRect(1, 2, bannerW, bannerH, bannerH / 2);
    this.counterBanner.endFill();
    // 本体
    this.counterBanner.beginFill(0x6a1b9a, 0.9);
    this.counterBanner.drawRoundedRect(0, 0, bannerW, bannerH, bannerH / 2);
    this.counterBanner.endFill();
    // ハイライト
    this.counterBanner.beginFill(0xffffff, 0.1);
    this.counterBanner.drawRoundedRect(2, 0, bannerW - 4, bannerH * 0.45, bannerH / 2);
    this.counterBanner.endFill();
    // パイルの下に配置（手札の邪魔にならない位置）
    this.counterBanner.x = cx - bannerW / 2;
    this.counterBanner.y = L.centerY + L.pileH / 2 + L.fontTiny * 2 + 4;
    this.counterBannerText.style.fontSize = Math.round(L.fontSmall * 0.9);
    this.counterBannerText.x = cx;
    this.counterBannerText.y = this.counterBanner.y + bannerH / 2;
  }

  // ===== インタラクション =====

  private onHandCardTap(card: Card): void {
    if (!this.gm.store.canPlayCard) return;
    if (this.selectedHandCardId === card.id) {
      // 2回目タップ: ターゲットが必要なカードか判定
      const effect = card.type === 'magic' ? (card as MagicCard).effect : undefined;
      const targetInfo = effect ? TARGET_EFFECTS[effect] : undefined;

      if (targetInfo) {
        this.showTargetModal(card, targetInfo);
      } else {
        this.gm.playCard(card.id);
        this.selectedHandCardId = null;
        this.renderState();
      }
    } else {
      this.selectedHandCardId = card.id;
      this.renderState();
    }
  }

  private onEndTurn(): void {
    const me = this.gm.store.myPlayer;
    if (!me) return;
    if (me.hand.length > 5) {
      this.showDiscardModal(me);
    } else {
      this.gm.endTurn();
    }
  }

  // ===== モーダル =====

  /** ターゲット選択モーダル（イデヨン、オワカーレ、ヨミガエール、カラスのおつかい） */
  private showTargetModal(
    playCard: Card,
    info: { source: TargetSource; title: string }
  ): void {
    const state = this.gm.store.getState();
    if (!state) return;

    // ターゲット候補を取得
    let candidates: Card[] = [];
    switch (info.source) {
      case 'myHandMonsters': {
        const me = this.gm.store.myPlayer;
        candidates = (me?.hand ?? []).filter(
          (c) => c.type === 'monster' && c.id !== playCard.id
        );
        break;
      }
      case 'opponentFieldMonsters':
        candidates = this.gm.store.opponentPlayer?.field ?? [];
        break;
      case 'graveyardMonsters':
        candidates = (state.graveyard ?? []).filter((c) => c.type === 'monster');
        break;
      case 'graveyardAll':
        candidates = state.graveyard ?? [];
        break;
    }

    if (candidates.length === 0) {
      // ターゲットがない場合はそのまま送信（サーバー側でエラーハンドリング）
      this.gm.playCard(playCard.id);
      this.selectedHandCardId = null;
      this.renderState();
      return;
    }

    this.clearModal();
    const L = this.layout;
    const cw = L.modalCardW;
    const ch = L.modalCardH;
    const cols = Math.min(candidates.length, Math.max(3, Math.floor(L.modalMaxW / (cw + 6))));
    const rows = Math.ceil(candidates.length / cols);
    const gap = Math.max(4, cw * 0.08);
    const gridH = rows * (ch + gap);
    const mw = Math.min(L.screenW * 0.92, Math.max(cols * (cw + gap) + 60, 260));
    const mh = Math.min(L.screenH * 0.82, gridH + 130);

    const modal = new Modal(`${playCard.name} - ${info.title}`, L.screenW, L.screenH, mw, mh);
    let selectedTargetId: string | null = null;
    const cardSprites: CardSprite[] = [];
    const cc = new Container();

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const cs = new CardSprite(c, true, cw, ch, Math.round(cw * 0.08));
      cs.x = (i % cols) * (cw + gap);
      cs.y = Math.floor(i / cols) * (ch + gap);
      cs.selectable = true;
      cs.on('pointertap', () => {
        if (selectedTargetId === c.id) {
          selectedTargetId = null;
          cs.selected = false;
        } else {
          // 他のカードの選択を解除
          cardSprites.forEach((s) => (s.selected = false));
          selectedTargetId = c.id;
          cs.selected = true;
        }
      });
      cardSprites.push(cs);
      cc.addChild(cs);
    }

    const gridW = cols > 0 ? (cols - 1) * (cw + gap) + cw : 0;
    cc.x = Math.max(0, (modal.contentWidth - gridW) / 2);
    modal.content.addChild(cc);

    const btnW = Math.min(110, mw * 0.4);
    modal.addButtonRow([
      {
        text: '決定',
        onClick: () => {
          if (selectedTargetId) {
            this.gm.playCard(playCard.id, selectedTargetId);
            this.selectedHandCardId = null;
            this.clearModal();
            this.renderState();
          }
        },
        color: COLORS.BUTTON_PRIMARY,
      },
      {
        text: 'キャンセル',
        onClick: () => {
          this.clearModal();
        },
        color: COLORS.BUTTON_DISABLED,
      },
    ], gridH + 10);

    this.currentModal = modal;
    this.container.addChild(modal);
  }

  private showUchikeshiModal(data: unknown): void {
    this.clearModal();
    const L = this.layout;
    const d = data as { card: Card; playerId: string };

    const mw = Math.min(L.screenW * 0.88, 380);
    const mh = Math.min(L.screenH * 0.38, 200);
    const modal = new Modal('うちけしの書を使いますか？', L.screenW, L.screenH, mw, mh);
    modal.addText(`「${d.card.name}」が使われました`, 0, 0);

    const by = Math.max(45, mh * 0.28);
    modal.addButtonRow([
      { text: 'うちけし！', onClick: () => { this.gm.useUchikeshi(true); this.clearModal(); }, color: COLORS.UCHIKESHI },
      { text: 'しない', onClick: () => { this.gm.useUchikeshi(false); this.clearModal(); }, color: COLORS.BUTTON_DISABLED },
    ], by);

    this.currentModal = modal;
    this.container.addChild(modal);
  }

  private showUchikeshiBackModal(data: unknown): void {
    this.clearModal();
    const L = this.layout;
    const mw = Math.min(L.screenW * 0.88, 380);
    const mh = Math.min(L.screenH * 0.38, 220);
    const modal = new Modal('うちけし返し？', L.screenW, L.screenH, mw, mh);
    modal.addText('うちけしの書 x2 を消費して効果を通す？', 0, 0);

    const by = Math.max(50, mh * 0.28);
    modal.addButtonRow([
      { text: 'うちけし返し！', onClick: () => { this.gm.useUchikeshi(false, true); this.clearModal(); }, color: COLORS.BUTTON_DANGER },
      { text: 'あきらめる', onClick: () => { this.gm.useUchikeshi(false, false); this.clearModal(); }, color: COLORS.BUTTON_DISABLED },
    ], by);

    this.currentModal = modal;
    this.container.addChild(modal);
  }

  private showSelectionModal(state: GameState): void {
    this.clearModal();
    const L = this.layout;
    const pe = state.pendingEffect;
    if (!pe) return;

    let selectableCards: Card[] = [];
    if (pe.revealOpponentHand) {
      selectableCards = this.gm.store.opponentPlayer?.hand ?? [];
    } else if (pe.revealDeck && state.deck) {
      selectableCards = state.deck;
    } else if (pe.revealAllCards) {
      selectableCards = getAllCards().filter((c: Card) => c.id !== 'hirameki-suishou');
    } else {
      selectableCards = this.gm.store.myPlayer?.hand ?? [];
    }

    const cw = L.modalCardW;
    const ch = L.modalCardH;
    const cols = Math.min(selectableCards.length, Math.max(3, Math.floor(L.modalMaxW / (cw + 6))));
    const rows = Math.ceil(selectableCards.length / cols);
    const gap = Math.max(4, cw * 0.08);
    const gridH = rows * (ch + gap);
    const mw = Math.min(L.screenW * 0.92, Math.max(cols * (cw + gap) + 60, 260));
    const mh = Math.min(L.screenH * 0.82, gridH + 130);

    const modal = new Modal(`${pe.card?.name ?? ''} -- カードを選択`, L.screenW, L.screenH, mw, mh);
    const selectedIds: Set<string> = new Set();
    const cc = new Container();

    for (let i = 0; i < selectableCards.length; i++) {
      const c = selectableCards[i];
      const cs = new CardSprite(c, true, cw, ch, Math.round(cw * 0.08));
      cs.x = (i % cols) * (cw + gap);
      cs.y = Math.floor(i / cols) * (ch + gap);
      cs.selectable = true;
      cs.on('pointertap', () => {
        if (selectedIds.has(c.id)) { selectedIds.delete(c.id); cs.selected = false; }
        else { selectedIds.add(c.id); cs.selected = true; }
      });
      cc.addChild(cs);
    }

    const gridW = cols > 0 ? (cols - 1) * (cw + gap) + cw : 0;
    cc.x = Math.max(0, (modal.contentWidth - gridW) / 2);
    modal.content.addChild(cc);

    const btn = new Button('決定', Math.min(110, mw * 0.4), L.buttonH, COLORS.BUTTON_PRIMARY);
    btn.x = Math.max(0, (modal.contentWidth - Math.min(110, mw * 0.4)) / 2);
    btn.y = gridH + 10;
    btn.on('pointertap', () => {
      if (selectedIds.size > 0) { this.gm.selectCards(Array.from(selectedIds)); this.clearModal(); }
    });
    modal.content.addChild(btn);

    this.currentModal = modal;
    this.container.addChild(modal);
  }

  private showDiscardModal(me: PlayerState): void {
    this.clearModal();
    const L = this.layout;
    const dc = me.hand.length - 5;
    const cw = L.modalCardW;
    const ch = L.modalCardH;
    const gap = Math.max(4, cw * 0.08);
    const cols = Math.min(me.hand.length, Math.max(3, Math.floor(L.modalMaxW / (cw + gap))));
    const rows = Math.ceil(me.hand.length / cols);
    const gridH = rows * (ch + gap);
    const mw = Math.min(L.screenW * 0.92, Math.max(cols * (cw + gap) + 60, 260));
    const mh = Math.min(L.screenH * 0.82, gridH + 130);

    const modal = new Modal(`${dc}枚捨ててください`, L.screenW, L.screenH, mw, mh);
    const selectedIds: Set<string> = new Set();
    const cc = new Container();

    for (let i = 0; i < me.hand.length; i++) {
      const c = me.hand[i];
      const cs = new CardSprite(c, true, cw, ch, Math.round(cw * 0.08));
      cs.x = (i % cols) * (cw + gap);
      cs.y = Math.floor(i / cols) * (ch + gap);
      cs.selectable = true;
      cs.on('pointertap', () => {
        if (selectedIds.has(c.id)) { selectedIds.delete(c.id); cs.selected = false; }
        else if (selectedIds.size < dc) { selectedIds.add(c.id); cs.selected = true; }
      });
      cc.addChild(cs);
    }

    const gridW = cols > 0 ? (cols - 1) * (cw + gap) + cw : 0;
    cc.x = Math.max(0, (modal.contentWidth - gridW) / 2);
    modal.content.addChild(cc);

    const btn = new Button('捨てる', Math.min(110, mw * 0.4), L.buttonH, COLORS.BUTTON_DANGER);
    btn.x = Math.max(0, (modal.contentWidth - Math.min(110, mw * 0.4)) / 2);
    btn.y = gridH + 10;
    btn.on('pointertap', () => {
      if (selectedIds.size === dc) { this.gm.endTurn(Array.from(selectedIds)); this.clearModal(); }
    });
    modal.content.addChild(btn);

    this.currentModal = modal;
    this.container.addChild(modal);
  }

  private clearModal(): void {
    if (this.currentModal) {
      this.container.removeChild(this.currentModal);
      this.currentModal.destroy({ children: true });
      this.currentModal = null;
    }
  }

  private onGameEnded(data: unknown): void {
    const d = data as { winner: string; winnerName: string };
    this.switchScene('result', {
      isWin: d?.winner === this.myPlayerId,
      winner: d?.winner,
      winnerName: d?.winnerName,
      playerId: this.myPlayerId,
    });
  }

  onResize(): void {
    this.layout = responsive(this.app.screen.width, this.app.screen.height);
    this.renderState();
  }

  destroy(): void {
    this.gm.disconnect();
    super.destroy();
  }
}
