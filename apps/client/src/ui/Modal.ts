import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT } from '../utils/constants';
import { Button } from './Button';

/**
 * モーダルダイアログ
 */
export class Modal extends Container {
  private overlay: Graphics;
  private panel: Graphics;
  private titleLabel: Text;
  readonly content: Container;
  private _screenW: number;
  private _screenH: number;
  private panelW: number;
  private panelH: number;
  private _panelX = 0;
  private _panelY = 0;
  private _headerH: number;

  constructor(
    title: string,
    screenW: number,
    screenH: number,
    panelWidth?: number,
    panelHeight?: number
  ) {
    super();
    this._screenW = screenW;
    this._screenH = screenH;
    this.panelW = panelWidth ?? Math.min(screenW * 0.9, 420);
    this.panelH = panelHeight ?? Math.min(screenH * 0.7, 340);

    const fontSize = Math.max(14, Math.min(20, screenW * 0.035));
    this._headerH = Math.max(44, fontSize * 2.6);

    // オーバーレイ
    this.overlay = new Graphics();
    this.drawOverlay();
    this.overlay.eventMode = 'static';
    this.addChild(this.overlay);

    // パネル
    this.panel = new Graphics();
    this.drawPanel();
    this.addChild(this.panel);

    // タイトル
    const style = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize,
      fill: 0xffffff,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: this.panelW - 48,
    });
    this.titleLabel = new Text(title, style);
    this.titleLabel.anchor.set(0.5, 0.5);
    this.titleLabel.x = screenW / 2;
    this.titleLabel.y = this._panelY + this._headerH / 2;
    this.addChild(this.titleLabel);

    // コンテンツコンテナ
    this.content = new Container();
    this.content.x = this._panelX + 24;
    this.content.y = this._panelY + this._headerH + 16;
    this.addChild(this.content);
  }

  private drawOverlay(): void {
    this.overlay.clear();
    this.overlay.beginFill(0x1a1020, 0.55);
    this.overlay.drawRect(0, 0, this._screenW, this._screenH);
    this.overlay.endFill();
  }

  private drawPanel(): void {
    this._panelX = (this._screenW - this.panelW) / 2;
    this._panelY = (this._screenH - this.panelH) / 2;
    const r = 14;
    const pw = this.panelW;
    const ph = this.panelH;
    const px = this._panelX;
    const py = this._panelY;
    const hh = this._headerH;

    this.panel.clear();

    // 多層シャドウ（深いソフトシャドウ）
    this.panel.beginFill(0x000000, 0.04);
    this.panel.drawRoundedRect(px - 4, py - 2, pw + 8, ph + 10, r + 4);
    this.panel.endFill();
    this.panel.beginFill(0x000000, 0.08);
    this.panel.drawRoundedRect(px - 1, py + 2, pw + 2, ph + 6, r + 2);
    this.panel.endFill();
    this.panel.beginFill(0x000000, 0.14);
    this.panel.drawRoundedRect(px + 1, py + 3, pw - 2, ph + 3, r);
    this.panel.endFill();

    // パネル本体（白）
    this.panel.beginFill(0xfefefe);
    this.panel.drawRoundedRect(px, py, pw, ph, r);
    this.panel.endFill();

    // パネル枠線
    this.panel.lineStyle(1, 0xd0c8c0, 0.5);
    this.panel.drawRoundedRect(px, py, pw, ph, r);

    // ヘッダー背景（マスク代わりに上部角丸 + 下部角なしを描画）
    this.panel.lineStyle(0);
    this.panel.beginFill(0x7c4dff, 0.9);
    this.panel.drawRoundedRect(px, py, pw, hh, r);
    this.panel.endFill();
    // 下部の角を四角で埋める
    this.panel.beginFill(0x7c4dff, 0.9);
    this.panel.drawRect(px, py + hh - r, pw, r);
    this.panel.endFill();

    // ヘッダーグラデーション風（上部に明るいオーバーレイ）
    this.panel.beginFill(0xffffff, 0.12);
    this.panel.drawRoundedRect(px, py, pw, hh * 0.5, r);
    this.panel.drawRect(px, py + r, pw, hh * 0.5 - r);
    this.panel.endFill();

    // ヘッダー下ボーダー
    this.panel.lineStyle(1, 0x5c35cc, 0.3);
    this.panel.moveTo(px + 8, py + hh);
    this.panel.lineTo(px + pw - 8, py + hh);

    // コンテンツエリア上部のインナーハイライト
    this.panel.lineStyle(0);
    this.panel.beginFill(0xf8f4ff, 0.5);
    this.panel.drawRect(px + 1, py + hh + 1, pw - 2, 2);
    this.panel.endFill();
  }

  addButton(text: string, x: number, y: number, onClick: () => void, color?: number): Button {
    const btnW = Math.min(140, (this.panelW - 60) / 2);
    const btnH = Math.max(40, 44);
    const btn = new Button(text, btnW, btnH, color);
    btn.x = x;
    btn.y = y;
    btn.on('pointertap', onClick);
    this.content.addChild(btn);
    return btn;
  }

  /** ボタンを横一列に中央揃えで配置 */
  addButtonRow(
    buttons: Array<{ text: string; onClick: () => void; color?: number }>,
    y: number,
    gap = 14
  ): Button[] {
    const btnW = Math.min(140, (this.panelW - 60) / 2);
    const btnH = Math.max(40, 44);
    const totalW = buttons.length * btnW + (buttons.length - 1) * gap;
    const startX = Math.max(0, (this.contentWidth - totalW) / 2);

    return buttons.map((b, i) => {
      const btn = new Button(b.text, btnW, btnH, b.color);
      btn.x = startX + i * (btnW + gap);
      btn.y = y;
      btn.on('pointertap', b.onClick);
      this.content.addChild(btn);
      return btn;
    });
  }

  addText(text: string, x: number, y: number, fontSize?: number): Text {
    const fs = fontSize ?? Math.max(12, Math.min(15, this._screenW * 0.028));
    const style = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: fs,
      fill: COLORS.TEXT_PRIMARY,
      wordWrap: true,
      wordWrapWidth: this.panelW - 64,
      lineHeight: fs * 1.5,
    });
    const t = new Text(text, style);
    t.x = x;
    t.y = y;
    this.content.addChild(t);
    return t;
  }

  resize(screenW: number, screenH: number): void {
    this._screenW = screenW;
    this._screenH = screenH;
    this.panelW = Math.min(this.panelW, screenW * 0.9);
    this.panelH = Math.min(this.panelH, screenH * 0.85);

    this.drawOverlay();
    this.drawPanel();

    this.titleLabel.x = screenW / 2;
    this.titleLabel.y = this._panelY + this._headerH / 2;
    this.titleLabel.style.wordWrapWidth = this.panelW - 48;

    this.content.x = this._panelX + 24;
    this.content.y = this._panelY + this._headerH + 16;
  }

  get contentWidth(): number {
    return this.panelW - 48;
  }

  get contentHeight(): number {
    return this.panelH - this._headerH - 32;
  }
}
