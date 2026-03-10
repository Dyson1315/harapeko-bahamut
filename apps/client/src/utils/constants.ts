/** 色定義 */
export const COLORS = {
  BACKGROUND: 0xfff8f0,
  BOARD_BG: 0xf0e6d6,
  MONSTER_CARD: 0xffb347,
  MAGIC_CARD: 0x77c4ff,
  CARD_BACK: 0xd87bff,
  CARD_BODY: 0xffffff,
  CARD_BORDER: 0xe0d0c0,
  LIFE_FULL: 0xff6b8a,
  LIFE_EMPTY: 0xe0d0c0,
  UCHIKESHI: 0xb388ff,
  BUTTON_PRIMARY: 0xff7eb3,
  BUTTON_SECONDARY: 0x7ec8e3,
  BUTTON_HOVER: 0xff9cc8,
  BUTTON_DISABLED: 0xcccccc,
  BUTTON_DANGER: 0xff6b6b,
  TEXT_PRIMARY: 0x4a3728,
  TEXT_SECONDARY: 0x8a7a6a,
  TEXT_WHITE: 0xffffff,
  FIELD_BG: 0xe8f5e9,
  FIELD_OPPONENT: 0xfce4ec,
  CENTER_BG: 0xfff3e0,
  HIGHLIGHT: 0xffd54f,
  SELECTED: 0xffab40,
  MY_TURN: 0x69f0ae,
  GRAVEYARD: 0xbcaaa4,
  DECK: 0xa5d6a7,
  STATUS_BAR_OPP: 0xe8d5d0,
  STATUS_BAR_MY: 0xd0dde8,
  BOARD_TOP: 0xf5e6e0,
  BOARD_BOTTOM: 0xe0eaf5,
  DIVIDER: 0xd4c4b0,
} as const;

export const GAME = {
  MAX_LIFE: 4,
  INITIAL_HAND_SIZE: 5,
  HAND_LIMIT: 5,
  INITIAL_UCHIKESHI: 2,
  NORMAL_PLAY_COUNT: 2,
  FIRST_TURN_PLAY_COUNT: 1,
} as const;

export const FONT = {
  FAMILY: '"M PLUS Rounded 1c", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
} as const;

const CARD_ASPECT = 3 / 2;

export interface ResponsiveLayout {
  screenW: number;
  screenH: number;
  cardW: number;
  cardH: number;
  cardRadius: number;
  fieldCardW: number;
  fieldCardH: number;
  oppHandCardW: number;
  oppHandCardH: number;
  pileW: number;
  pileH: number;
  statusH: number;
  statusPadX: number;
  oppHandY: number;
  oppFieldY: number;
  centerY: number;
  myFieldY: number;
  myHandY: number;
  handCardGap: number;
  fieldCardGap: number;
  fontTiny: number;
  fontSmall: number;
  fontMedium: number;
  fontLarge: number;
  fontHuge: number;
  heartSize: number;
  buttonH: number;
  buttonW: number;
  modalMaxW: number;
  modalCardW: number;
  modalCardH: number;
  cx: number;
}

/**
 * トータルフィットレイアウト
 *
 * 5つのカード行の高さ比率を決め、totalが画面に収まるよう
 * カードサイズを逆算する。隙間は最小限。
 *
 * 比率: 相手手札(1) : 相手フィールド(1.8) : 中央(1.2) : 自分フィールド(1.8) : 自分手札(3.2)
 */
export function responsive(screenW: number, screenH: number): ResponsiveLayout {
  const statusH = Math.max(24, Math.round(screenH * 0.045));
  const gap = Math.max(2, Math.round(screenH * 0.005));

  // 利用可能な縦幅 = 画面 - ステータスバー×2 - 行間×4
  const avail = screenH - statusH * 2 - gap * 4;

  // 比率 — 中央ゾーンを広めに確保、手札は控えめ
  const R = { oppHand: 1.0, oppField: 2.0, center: 1.4, myField: 2.0, myHand: 2.6 };
  const total = R.oppHand + R.oppField + R.center + R.myField + R.myHand;
  const unit = avail / total;

  // 各行に割り当てる高さ
  const oppHandZH = unit * R.oppHand;
  const oppFieldZH = unit * R.oppField;
  const centerZH = unit * R.center;
  const myFieldZH = unit * R.myField;
  const myHandZH = unit * R.myHand;

  // カードサイズ（行高さの90%、かつ横幅制約）
  const cardH = Math.round(Math.min(myHandZH * 0.92, (screenW / 6.5) * CARD_ASPECT));
  const cardW = Math.round(cardH / CARD_ASPECT);
  const cardRadius = Math.round(cardW * 0.08);

  const fieldCardH = Math.round(Math.min(oppFieldZH * 0.92, cardH * 0.65));
  const fieldCardW = Math.round(fieldCardH / CARD_ASPECT);

  const oppHandCardH = Math.round(Math.min(oppHandZH * 0.92, cardH * 0.4));
  const oppHandCardW = Math.round(oppHandCardH / CARD_ASPECT);

  const pileH = Math.round(centerZH * 0.72);
  const pileW = Math.round(pileH / CARD_ASPECT);

  // Y座標（各行の中心、上から順に積み上げ）
  let y = statusH;
  const oppHandY = y + oppHandZH / 2;
  y += oppHandZH + gap;

  const oppFieldY = y + oppFieldZH / 2;
  y += oppFieldZH + gap;

  const centerY = y + centerZH / 2;
  y += centerZH + gap;

  const myFieldY = y + myFieldZH / 2;
  y += myFieldZH + gap;

  const myHandY = y + myHandZH / 2;

  // その他
  const handCardGap = Math.max(1, cardW * 0.05);
  const fieldCardGap = Math.max(3, fieldCardW * 0.08);

  const vmin = Math.min(screenW, screenH);
  const fb = Math.max(8, vmin * 0.022);

  const modalMaxW = Math.min(screenW * 0.9, 480);
  const modalCardW = Math.max(38, Math.min(modalMaxW / 6, cardW * 0.6));

  return {
    screenW, screenH,
    cardW, cardH, cardRadius,
    fieldCardW, fieldCardH,
    oppHandCardW, oppHandCardH,
    pileW, pileH,
    statusH,
    statusPadX: Math.max(6, screenW * 0.015),
    oppHandY, oppFieldY, centerY, myFieldY, myHandY,
    handCardGap, fieldCardGap,
    fontTiny: Math.round(fb * 0.8),
    fontSmall: Math.round(fb),
    fontMedium: Math.round(fb * 1.3),
    fontLarge: Math.round(fb * 1.7),
    fontHuge: Math.round(fb * 2.5),
    heartSize: Math.max(3, statusH * 0.22),
    buttonH: Math.max(20, Math.round(statusH * 0.8)),
    buttonW: Math.max(60, screenW * 0.11),
    modalMaxW,
    modalCardW,
    modalCardH: modalCardW * CARD_ASPECT,
    cx: screenW / 2,
  };
}
