import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene, SceneSwitcher } from './BaseScene';
import { Button } from '../ui/Button';
import { COLORS, FONT, responsive } from '../utils/constants';

/**
 * タイトル画面
 * ゲームタイトル + マッチング開始ボタン
 * ポップ・かわいいスタイルで装飾
 */
export class TitleScene extends BaseScene {
  private titleText: Text;
  private subtitleText: Text;
  private randomBtn: Button;
  private bgGfx: Graphics;
  private decorGfx: Graphics;

  constructor(app: Application, switchScene: SceneSwitcher) {
    super(app, switchScene);

    // 背景
    this.bgGfx = new Graphics();
    this.container.addChild(this.bgGfx);

    // デコレーション
    this.decorGfx = new Graphics();
    this.container.addChild(this.decorGfx);

    // タイトル
    const titleStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 48,
      fill: COLORS.TEXT_PRIMARY,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: COLORS.BUTTON_PRIMARY,
      dropShadowAlpha: 0.3,
      dropShadowDistance: 2,
      dropShadowBlur: 8,
    });
    this.titleText = new Text('はらぺこバハムート', titleStyle);
    this.titleText.anchor.set(0.5);
    this.container.addChild(this.titleText);

    // サブタイトル
    const subStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 16,
      fill: COLORS.TEXT_SECONDARY,
    });
    this.subtitleText = new Text('オンライン対戦カードゲーム', subStyle);
    this.subtitleText.anchor.set(0.5);
    this.container.addChild(this.subtitleText);

    // ボタン
    this.randomBtn = new Button('あそぶ！', 220, 56, COLORS.BUTTON_PRIMARY);
    this.randomBtn.pivot.set(110, 28);
    this.randomBtn.on('pointertap', () => {
      this.switchScene('matchmaking', { mode: 'random' });
    });
    this.container.addChild(this.randomBtn);

    this.onResize();
  }

  onResize(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const L = responsive(w, h);
    const vmin = Math.min(w, h);

    // 背景
    this.bgGfx.clear();
    this.bgGfx.beginFill(COLORS.BACKGROUND);
    this.bgGfx.drawRect(0, 0, w, h);
    this.bgGfx.endFill();

    // 装飾: パステル色の丸泡
    this.decorGfx.clear();
    const bubbles = [
      { x: w * 0.12, y: h * 0.15, r: vmin * 0.1, c: COLORS.MONSTER_CARD, a: 0.1 },
      { x: w * 0.88, y: h * 0.25, r: vmin * 0.13, c: COLORS.MAGIC_CARD, a: 0.08 },
      { x: w * 0.75, y: h * 0.82, r: vmin * 0.08, c: COLORS.UCHIKESHI, a: 0.1 },
      { x: w * 0.2, y: h * 0.78, r: vmin * 0.11, c: COLORS.BUTTON_PRIMARY, a: 0.07 },
      { x: w * 0.5, y: h * 0.1, r: vmin * 0.06, c: COLORS.LIFE_FULL, a: 0.06 },
      { x: w * 0.65, y: h * 0.6, r: vmin * 0.07, c: COLORS.HIGHLIGHT, a: 0.05 },
    ];
    for (const b of bubbles) {
      this.decorGfx.beginFill(b.c, b.a);
      this.decorGfx.drawCircle(b.x, b.y, b.r);
      this.decorGfx.endFill();
    }

    // タイトルテキストのレスポンシブフォントサイズ
    const titleSize = Math.max(24, Math.min(48, vmin * 0.08));
    this.titleText.style.fontSize = titleSize;
    this.titleText.x = w / 2;
    this.titleText.y = h * 0.35;

    const subSize = Math.max(12, Math.min(18, vmin * 0.03));
    this.subtitleText.style.fontSize = subSize;
    this.subtitleText.x = w / 2;
    this.subtitleText.y = h * 0.35 + titleSize * 1.1;

    // ボタンのレスポンシブサイズ
    const btnW = Math.max(160, Math.min(240, w * 0.4));
    const btnH = Math.max(48, L.buttonH);
    this.randomBtn.resize(btnW, btnH);
    this.randomBtn.pivot.set(btnW / 2, btnH / 2);
    this.randomBtn.x = w / 2;
    this.randomBtn.y = h * 0.58;
  }
}
