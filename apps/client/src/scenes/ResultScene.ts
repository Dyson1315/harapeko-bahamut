import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene, SceneSwitcher, SceneData } from './BaseScene';
import { Button } from '../ui/Button';
import { COLORS, FONT, responsive } from '../utils/constants';

/**
 * リザルト画面
 * 勝敗表示 + タイトルに戻るボタン
 * 勝利時は明るい演出、敗北時は控えめな演出
 */
export class ResultScene extends BaseScene {
  private resultText: Text;
  private subText: Text;
  private backBtn: Button;
  private bgGfx: Graphics;
  private decorGfx: Graphics;
  private isWin: boolean;

  constructor(app: Application, switchScene: SceneSwitcher, data?: SceneData) {
    super(app, switchScene);

    this.isWin = data?.isWin === true;
    const winnerName = (data?.winnerName as string) ?? '';

    // 背景
    this.bgGfx = new Graphics();
    this.container.addChild(this.bgGfx);

    // 装飾
    this.decorGfx = new Graphics();
    this.container.addChild(this.decorGfx);

    // 勝敗テキスト
    const titleStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 52,
      fill: this.isWin ? 0xffd54f : 0x90a4ae,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.15,
      dropShadowDistance: 2,
    });
    this.resultText = new Text(this.isWin ? 'WIN!' : 'LOSE...', titleStyle);
    this.resultText.anchor.set(0.5);
    this.container.addChild(this.resultText);

    // 勝者名
    const subStyle = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 18,
      fill: COLORS.TEXT_SECONDARY,
    });
    this.subText = new Text(winnerName ? `勝者: ${winnerName}` : '', subStyle);
    this.subText.anchor.set(0.5);
    this.container.addChild(this.subText);

    // タイトルへ戻るボタン
    this.backBtn = new Button('タイトルにもどる', 200, 48, COLORS.BUTTON_PRIMARY);
    this.backBtn.pivot.set(100, 24);
    this.backBtn.on('pointertap', () => {
      this.switchScene('title');
    });
    this.container.addChild(this.backBtn);

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

    // 装飾 (勝利時のみ)
    this.decorGfx.clear();
    if (this.isWin) {
      // 紙吹雪的なランダム丸
      const colors = [COLORS.HIGHLIGHT, COLORS.BUTTON_PRIMARY, COLORS.MAGIC_CARD, COLORS.UCHIKESHI, COLORS.LIFE_FULL];
      const seed = 42;
      for (let i = 0; i < 20; i++) {
        const sx = ((seed * (i + 1) * 7) % 1000) / 1000;
        const sy = ((seed * (i + 1) * 13) % 1000) / 1000;
        const sr = ((seed * (i + 1) * 3) % 100) / 100;
        this.decorGfx.beginFill(colors[i % colors.length], 0.12 + sr * 0.08);
        this.decorGfx.drawCircle(
          sx * w,
          sy * h,
          vmin * 0.01 + sr * vmin * 0.03
        );
        this.decorGfx.endFill();
      }
    }

    // テキストサイズ
    const resultSize = Math.max(32, Math.min(60, vmin * 0.1));
    this.resultText.style.fontSize = resultSize;
    this.resultText.x = w / 2;
    this.resultText.y = h * 0.35;

    const subSize = Math.max(14, Math.min(20, vmin * 0.032));
    this.subText.style.fontSize = subSize;
    this.subText.x = w / 2;
    this.subText.y = h * 0.35 + resultSize * 1.1;

    // ボタン
    const btnW = Math.max(160, Math.min(220, w * 0.35));
    const btnH = L.buttonH;
    this.backBtn.resize(btnW, btnH);
    this.backBtn.pivot.set(btnW / 2, btnH / 2);
    this.backBtn.x = w / 2;
    this.backBtn.y = h * 0.58;
  }
}
