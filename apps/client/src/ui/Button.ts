import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT } from '../utils/constants';

/**
 * ボタンコンポーネント
 * 立体感のあるポップなデザイン
 */
export class Button extends Container {
  private bg: Graphics;
  private highlight: Graphics;
  private hlMask: Graphics;
  private label: Text;
  private _disabled = false;
  private _color: number;
  private _w: number;
  private _h: number;
  private _radius: number;
  private _pressed = false;

  constructor(text: string, width = 160, height = 44, color: number = COLORS.BUTTON_PRIMARY) {
    super();
    this._color = color;
    this._w = Math.max(width, 44);
    this._h = Math.max(height, 44);
    this._radius = Math.round(this._h * 0.26);

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.hlMask = new Graphics();
    this.addChild(this.hlMask);

    this.highlight = new Graphics();
    this.highlight.mask = this.hlMask;
    this.addChild(this.highlight);

    const fontSize = Math.max(12, Math.round(this._h * 0.34));
    const style = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize,
      fill: 0xffffff,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.25,
      dropShadowDistance: 1,
      dropShadowBlur: 2,
    });
    this.label = new Text(text, style);
    this.label.anchor.set(0.5);
    this.label.x = this._w / 2;
    this.label.y = this._h / 2;
    this.addChild(this.label);

    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointerover', this.onOver, this);
    this.on('pointerout', this.onOut, this);
    this.on('pointerdown', this.onDown, this);
    this.on('pointerup', this.onUp, this);
    this.on('pointerupoutside', this.onUp, this);

    this.drawBg(this._color, false);
  }

  private darken(c: number, f: number): number {
    const r = Math.round(((c >> 16) & 0xff) * f);
    const g = Math.round(((c >> 8) & 0xff) * f);
    const b = Math.round((c & 0xff) * f);
    return (r << 16) | (g << 8) | b;
  }

  private lighten(c: number, f: number): number {
    const r = Math.min(255, Math.round(((c >> 16) & 0xff) + (255 - ((c >> 16) & 0xff)) * f));
    const g = Math.min(255, Math.round(((c >> 8) & 0xff) + (255 - ((c >> 8) & 0xff)) * f));
    const b = Math.min(255, Math.round((c & 0xff) + (255 - (c & 0xff)) * f));
    return (r << 16) | (g << 8) | b;
  }

  private drawBg(fill: number, pressed: boolean): void {
    const w = this._w;
    const h = this._h;
    const r = this._radius;
    const disabled = this._disabled;
    const bottomH = pressed ? 1 : 3;
    const topY = pressed ? 2 : 0;
    const bodyH = h - bottomH;

    this.bg.clear();
    this.highlight.clear();
    this.hlMask.clear();

    if (disabled) {
      this.bg.beginFill(0xcccccc, 0.6);
      this.bg.drawRoundedRect(0, 0, w, h, r);
      this.bg.endFill();
      this.label.y = h / 2;
      return;
    }

    // ボトムエッジ（立体感）
    this.bg.beginFill(this.darken(fill, 0.6));
    this.bg.drawRoundedRect(0, bottomH, w, h, r);
    this.bg.endFill();

    // 本体
    this.bg.beginFill(fill);
    this.bg.drawRoundedRect(0, topY, w, bodyH, r);
    this.bg.endFill();

    // 枠線
    this.bg.lineStyle(1, this.darken(fill, 0.75), 0.25);
    this.bg.drawRoundedRect(0, topY, w, bodyH, r);

    // ハイライト（角丸マスク内）
    this.hlMask.beginFill(0xffffff);
    this.hlMask.drawRoundedRect(0, topY, w, bodyH, r);
    this.hlMask.endFill();

    this.highlight.beginFill(0xffffff, 0.18);
    this.highlight.drawRoundedRect(1, topY, w - 2, bodyH * 0.45, r);
    this.highlight.endFill();

    // テキスト位置
    this.label.y = topY + bodyH / 2;
  }

  resize(width: number, height: number): void {
    this._w = Math.max(width, 44);
    this._h = Math.max(height, 44);
    this._radius = Math.round(this._h * 0.26);
    this.label.x = this._w / 2;
    const fontSize = Math.max(12, Math.round(this._h * 0.34));
    this.label.style.fontSize = fontSize;
    this.drawBg(this._disabled ? COLORS.BUTTON_DISABLED : this._color, false);
  }

  set disabled(v: boolean) {
    this._disabled = v;
    this.eventMode = v ? 'none' : 'static';
    this.cursor = v ? 'default' : 'pointer';
    this.alpha = v ? 0.55 : 1;
    this.drawBg(v ? COLORS.BUTTON_DISABLED : this._color, false);
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set text(t: string) {
    this.label.text = t;
  }

  private onOver(): void {
    if (!this._disabled && !this._pressed) {
      this.drawBg(this.lighten(this._color, 0.15), false);
    }
  }
  private onOut(): void {
    if (!this._disabled) {
      this._pressed = false;
      this.drawBg(this._color, false);
    }
  }
  private onDown(): void {
    if (!this._disabled) {
      this._pressed = true;
      this.drawBg(this.darken(this._color, 0.88), true);
    }
  }
  private onUp(): void {
    if (!this._disabled) {
      this._pressed = false;
      this.drawBg(this._color, false);
    }
  }
}
