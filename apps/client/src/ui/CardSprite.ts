import { Container, Graphics, Sprite, Texture, Text, TextStyle } from 'pixi.js';
import { Card } from '../types/card';
import { COLORS, FONT } from '../utils/constants';
import { getCardImagePath } from '../data/cardAssets';

/**
 * カード1枚のスプライト
 */
export class CardSprite extends Container {
  readonly cardData: Card | null;
  private shadow: Graphics;
  private bg: Graphics;
  private cardImage: Sprite | null = null;
  private maskGfx: Graphics | null = null;
  private faceUp: boolean;
  private _selected = false;
  private _hoverable = false;
  private _selectable = false;
  private baseY = 0;
  private cardW: number;
  private cardH: number;
  private radius: number;
  private hoverOffset: number;

  constructor(
    card: Card | null,
    faceUp: boolean,
    width: number,
    height: number,
    radius?: number
  ) {
    super();
    this.cardData = card;
    this.faceUp = faceUp;
    this.cardW = width;
    this.cardH = height;
    this.radius = radius ?? Math.round(width * 0.1);
    this.hoverOffset = Math.max(6, height * 0.08);

    this.shadow = new Graphics();
    this.addChild(this.shadow);

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.eventMode = 'static';
    this.cursor = 'default';

    this.on('pointerover', this.onPointerOver, this);
    this.on('pointerout', this.onPointerOut, this);

    this.draw();
  }

  private draw(): void {
    const w = this.cardW;
    const h = this.cardH;
    const r = this.radius;

    this.bg.clear();
    this.shadow.clear();

    // 古い画像・マスクを除去
    if (this.cardImage) {
      this.removeChild(this.cardImage);
      this.cardImage.destroy();
      this.cardImage = null;
    }
    if (this.maskGfx) {
      this.removeChild(this.maskGfx);
      this.maskGfx.destroy();
      this.maskGfx = null;
    }

    // シャドウ（全カード共通）
    this.shadow.beginFill(0x000000, 0.06);
    this.shadow.drawRoundedRect(1, 2, w + 1, h + 1, r + 1);
    this.shadow.endFill();
    this.shadow.beginFill(0x000000, 0.1);
    this.shadow.drawRoundedRect(1, 1, w, h + 1, r);
    this.shadow.endFill();

    if (!this.faceUp || !this.cardData) {
      // ---- 裏面 ----
      // 外枠
      this.bg.lineStyle(1.5, 0x7b1fa2, 0.6);
      this.bg.beginFill(COLORS.CARD_BACK);
      this.bg.drawRoundedRect(0, 0, w, h, r);
      this.bg.endFill();

      // 内側フレーム
      const ins = Math.max(3, Math.min(w, h) * 0.08);
      this.bg.lineStyle(0.8, 0xce93d8, 0.35);
      this.bg.drawRoundedRect(ins, ins, w - ins * 2, h - ins * 2, r * 0.5);

      // 中央ダイヤモンド
      const cx = w / 2;
      const cy = h / 2;
      const dw = Math.min(w, h) * 0.2;
      const dh = dw * 1.4;
      this.bg.lineStyle(1, 0xce93d8, 0.4);
      this.bg.beginFill(0xe1bee7, 0.2);
      this.bg.moveTo(cx, cy - dh);
      this.bg.lineTo(cx + dw, cy);
      this.bg.lineTo(cx, cy + dh);
      this.bg.lineTo(cx - dw, cy);
      this.bg.closePath();
      this.bg.endFill();

      // 四隅ドット
      const dr = Math.max(1.5, Math.min(w, h) * 0.025);
      const di = ins + dr + 2;
      this.bg.lineStyle(0);
      this.bg.beginFill(0xce93d8, 0.25);
      this.bg.drawCircle(di, di, dr);
      this.bg.drawCircle(w - di, di, dr);
      this.bg.drawCircle(di, h - di, dr);
      this.bg.drawCircle(w - di, h - di, dr);
      this.bg.endFill();
      return;
    }

    // ---- 表面 ----
    const imgPath = getCardImagePath(this.cardData.id);
    if (imgPath) {
      // 角丸マスク
      const mask = new Graphics();
      mask.beginFill(0xffffff);
      mask.drawRoundedRect(0, 0, w, h, r);
      mask.endFill();
      this.addChild(mask);
      this.maskGfx = mask;

      const texture = Texture.from(imgPath);
      this.cardImage = new Sprite(texture);
      this.cardImage.width = w;
      this.cardImage.height = h;
      this.cardImage.mask = mask;
      this.addChild(this.cardImage);

      // 枠線（画像の上に描画するため別Graphics）
      const border = new Graphics();
      if (this._selected) {
        border.lineStyle(2.5, COLORS.SELECTED, 0.9);
        border.drawRoundedRect(-1, -1, w + 2, h + 2, r + 1);
        border.lineStyle(1.5, COLORS.HIGHLIGHT, 0.5);
        border.drawRoundedRect(-3, -3, w + 6, h + 6, r + 3);
      } else {
        border.lineStyle(1, 0x00000, 0.12);
        border.drawRoundedRect(0, 0, w, h, r);
      }
      this.addChild(border);
    } else {
      // フォールバック: テキストカード
      this.bg.beginFill(COLORS.CARD_BODY);
      this.bg.drawRoundedRect(0, 0, w, h, r);
      this.bg.endFill();

      // カードタイプ帯
      const barColor = this.cardData.type === 'monster' ? COLORS.MONSTER_CARD : COLORS.MAGIC_CARD;
      const barH = Math.max(16, h * 0.18);

      // 帯マスク（角丸内にフィット）
      const barMask = new Graphics();
      barMask.beginFill(0xffffff);
      barMask.drawRoundedRect(0, 0, w, h, r);
      barMask.endFill();
      this.addChild(barMask);

      const bar = new Graphics();
      bar.beginFill(barColor, 0.35);
      bar.drawRect(0, 0, w, barH);
      bar.endFill();
      // 帯下部の薄いライン
      bar.lineStyle(0.5, barColor, 0.3);
      bar.moveTo(0, barH);
      bar.lineTo(w, barH);
      bar.mask = barMask;
      this.addChild(bar);

      const fontSize = Math.max(7, Math.round(h * 0.075));
      const nameText = new Text(this.cardData.name, new TextStyle({
        fontFamily: FONT.FAMILY,
        fontSize,
        fill: COLORS.TEXT_PRIMARY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: w - 10,
      }));
      nameText.x = 5;
      nameText.y = barH + 4;
      this.addChild(nameText);

      // 枠線
      if (this._selected) {
        this.bg.lineStyle(2.5, COLORS.SELECTED, 0.9);
        this.bg.drawRoundedRect(-1, -1, w + 2, h + 2, r + 1);
        this.bg.lineStyle(1.5, COLORS.HIGHLIGHT, 0.5);
        this.bg.drawRoundedRect(-3, -3, w + 6, h + 6, r + 3);
      } else {
        this.bg.lineStyle(1, COLORS.CARD_BORDER, 0.6);
        this.bg.drawRoundedRect(0, 0, w, h, r);
      }
    }
  }

  get selected(): boolean { return this._selected; }
  set selected(v: boolean) {
    if (this._selected === v) return;
    this._selected = v;
    this.draw();
    this.y = this._selected ? this.baseY - this.hoverOffset : this.baseY;
  }

  set hoverable(v: boolean) {
    this._hoverable = v;
    this.cursor = v ? 'pointer' : 'default';
  }

  get hoverable(): boolean { return this._hoverable; }

  set selectable(v: boolean) {
    this._selectable = v;
    this.cursor = v ? 'pointer' : 'default';
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.baseY = y;
    this.y = this._selected ? y - this.hoverOffset : y;
  }

  private onPointerOver(): void {
    if ((this._hoverable || this._selectable) && !this._selected) {
      this.y = this.baseY - this.hoverOffset * 0.6;
      this.scale.set(1.04);
    }
  }

  private onPointerOut(): void {
    if ((this._hoverable || this._selectable) && !this._selected) {
      this.y = this.baseY;
      this.scale.set(1);
    }
  }
}
