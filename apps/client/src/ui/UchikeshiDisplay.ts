import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT, ResponsiveLayout } from '../utils/constants';

/**
 * うちけしの書の所持数表示
 * 本のアイコン + カウント表示
 */
export class UchikeshiDisplay extends Container {
  private iconGfx: Graphics;
  private countLabel: Text;
  private titleLabel: Text;
  private _count = 0;

  constructor(label = 'うちけし') {
    super();

    const titleStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 11,
      fill: COLORS.TEXT_SECONDARY,
    });
    this.titleLabel = new Text(label, titleStyle);
    this.titleLabel.y = 0;
    this.addChild(this.titleLabel);

    this.iconGfx = new Graphics();
    this.addChild(this.iconGfx);

    const countStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 16,
      fill: COLORS.UCHIKESHI,
      fontWeight: 'bold',
    });
    this.countLabel = new Text('x0', countStyle);
    this.addChild(this.countLabel);

    this.layoutElements();
  }

  set count(v: number) {
    this._count = v;
    this.countLabel.text = `x${v}`;
    this.drawIcon();
  }

  /** レスポンシブレイアウトに合わせてサイズ更新 */
  updateLayout(layout: ResponsiveLayout): void {
    this.titleLabel.style.fontSize = layout.fontTiny;
    this.countLabel.style.fontSize = layout.fontMedium;
    this.layoutElements();
  }

  private layoutElements(): void {
    const labelH = this.titleLabel.height;
    this.iconGfx.y = labelH + 4;
    this.iconGfx.x = 0;
    this.countLabel.x = 20;
    this.countLabel.y = labelH + 2;
    this.drawIcon();
  }

  private drawIcon(): void {
    const g = this.iconGfx;
    g.clear();

    // 本のアイコン
    const color = this._count > 0 ? COLORS.UCHIKESHI : COLORS.BUTTON_DISABLED;
    g.beginFill(color, this._count > 0 ? 1 : 0.4);
    g.drawRoundedRect(0, 0, 14, 16, 2);
    g.endFill();
    // 背表紙
    g.beginFill(0xffffff, 0.3);
    g.drawRect(2, 1, 2, 14);
    g.endFill();
  }
}
