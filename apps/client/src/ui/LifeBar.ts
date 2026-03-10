import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT, GAME, ResponsiveLayout } from '../utils/constants';

/**
 * ライフ表示（ハート型）
 * レスポンシブ対応: update() でサイズを再計算
 */
export class LifeBar extends Container {
  private hearts: Graphics[] = [];
  private nameLabel: Text;
  private _life: number = GAME.MAX_LIFE;
  private _maxLife: number = GAME.MAX_LIFE;
  private _heartSize = 8;
  private _heartSpacing = 22;

  constructor(playerName: string, maxLife = GAME.MAX_LIFE) {
    super();
    this._maxLife = maxLife;

    const style = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 14,
      fill: COLORS.TEXT_PRIMARY,
      fontWeight: 'bold',
    });
    this.nameLabel = new Text(playerName, style);
    this.nameLabel.y = 0;
    this.addChild(this.nameLabel);

    for (let i = 0; i < maxLife; i++) {
      const heart = new Graphics();
      this.hearts.push(heart);
      this.addChild(heart);
    }

    this.drawHearts();
  }

  set life(v: number) {
    this._life = Math.max(0, Math.min(v, this._maxLife));
    this.drawHearts();
  }

  set playerName(name: string) {
    this.nameLabel.text = name;
  }

  /** レスポンシブレイアウトに合わせてサイズ更新 */
  updateLayout(layout: ResponsiveLayout): void {
    this._heartSize = layout.heartSize;
    this._heartSpacing = layout.heartSize * 2.8;
    this.nameLabel.style.fontSize = layout.fontSmall;
    this.drawHearts();
  }

  private drawHearts(): void {
    const s = this._heartSize;
    const labelH = this.nameLabel.height;
    const heartY = labelH + 4;

    for (let i = 0; i < this.hearts.length; i++) {
      const g = this.hearts[i];
      g.clear();
      g.x = i * this._heartSpacing;
      g.y = heartY;

      const color = i < this._life ? COLORS.LIFE_FULL : COLORS.LIFE_EMPTY;
      const alpha = i < this._life ? 1 : 0.4;
      g.beginFill(color, alpha);
      // 簡易ハート: 2つの円 + 三角形
      g.drawCircle(s * 0.5, 0, s * 0.55);
      g.drawCircle(s * 1.1, 0, s * 0.55);
      g.moveTo(-s * 0.1, s * 0.3);
      g.lineTo(s * 0.8, s * 1.1);
      g.lineTo(s * 1.7, s * 0.3);
      g.closePath();
      g.endFill();
    }
  }
}
