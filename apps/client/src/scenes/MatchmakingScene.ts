import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { BaseScene, SceneSwitcher, SceneData } from './BaseScene';
import { Button } from '../ui/Button';
import { COLORS, FONT, responsive } from '../utils/constants';
import { MatchmakingClient } from '../network/MatchmakingClient';

/**
 * マッチメイキング画面
 * 対戦相手を待つ画面。マッチ成立でバトルシーンへ遷移。
 */
export class MatchmakingScene extends BaseScene {
  private bgGfx: Graphics;
  private statusText: Text;
  private dotCount = 0;
  private dotTimer: ReturnType<typeof setInterval>;
  private cancelBtn: Button;
  private spinnerGfx: Graphics;
  private spinAngle = 0;
  private mmClient: MatchmakingClient | null = null;
  private playerId: string;
  private playerName: string;

  constructor(app: Application, switchScene: SceneSwitcher, data?: SceneData) {
    super(app, switchScene);

    this.playerId = (data?.playerId as string) ?? `player-${Date.now()}`;
    this.playerName = (data?.playerName as string) ?? 'プレイヤー';

    // 背景
    this.bgGfx = new Graphics();
    this.container.addChild(this.bgGfx);

    // スピナー
    this.spinnerGfx = new Graphics();
    this.container.addChild(this.spinnerGfx);

    // ステータステキスト
    const style = new TextStyle({
      fontFamily: FONT.FAMILY,
      fontSize: 22,
      fill: COLORS.TEXT_PRIMARY,
      fontWeight: 'bold',
    });
    this.statusText = new Text('たいせんあいてをさがしています', style);
    this.statusText.anchor.set(0.5);
    this.container.addChild(this.statusText);

    // キャンセルボタン
    this.cancelBtn = new Button('もどる', 140, 44, COLORS.BUTTON_SECONDARY);
    this.cancelBtn.pivot.set(70, 22);
    this.cancelBtn.on('pointertap', () => {
      this.cleanup();
      this.switchScene('title');
    });
    this.container.addChild(this.cancelBtn);

    // ドットアニメーション
    this.dotTimer = setInterval(() => {
      this.dotCount = (this.dotCount + 1) % 4;
      this.statusText.text = 'たいせんあいてをさがしています' + '.'.repeat(this.dotCount);
    }, 500);

    // スピナーアニメーション
    app.ticker.add(this.animateSpinner, this);

    this.onResize();
    this.startMatchmaking(data);
  }

  private startMatchmaking(data?: SceneData): void {
    const mode = (data?.mode as string) ?? 'random';
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}/matchmaking?playerId=${encodeURIComponent(this.playerId)}&playerName=${encodeURIComponent(this.playerName)}&mode=${mode}`;

    this.mmClient = new MatchmakingClient();

    this.mmClient.on('matchFound', (matchData: unknown) => {
      const d = matchData as { roomId: string; players: { id: string; name: string }[] };
      this.cleanup();
      this.switchScene('battle', {
        roomId: d.roomId,
        playerId: this.playerId,
        playerName: this.playerName,
      });
    });

    this.mmClient.on('error', () => {
      this.statusText.text = '接続エラーが発生しました';
    });

    this.mmClient.connect(wsUrl);
  }

  private animateSpinner = (): void => {
    this.spinAngle += 0.05;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const cy = h * 0.33;
    const vmin = Math.min(w, h);
    const r = Math.max(18, vmin * 0.04);
    const dotR = Math.max(3, vmin * 0.007);

    this.spinnerGfx.clear();
    for (let i = 0; i < 8; i++) {
      const angle = this.spinAngle + (i * Math.PI) / 4;
      const alpha = 0.2 + (i / 8) * 0.8;
      this.spinnerGfx.beginFill(COLORS.BUTTON_PRIMARY, alpha);
      this.spinnerGfx.drawCircle(
        cx + Math.cos(angle) * r,
        cy + Math.sin(angle) * r,
        dotR
      );
      this.spinnerGfx.endFill();
    }
  };

  private cleanup(): void {
    clearInterval(this.dotTimer);
    this.app.ticker.remove(this.animateSpinner, this);
    if (this.mmClient) {
      this.mmClient.disconnect();
      this.mmClient = null;
    }
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

    // 装飾的なパステル丸
    const bubbles = [
      { x: w * 0.15, y: h * 0.7, r: vmin * 0.09, c: COLORS.MAGIC_CARD, a: 0.06 },
      { x: w * 0.85, y: h * 0.8, r: vmin * 0.07, c: COLORS.BUTTON_PRIMARY, a: 0.05 },
    ];
    for (const b of bubbles) {
      this.bgGfx.beginFill(b.c, b.a);
      this.bgGfx.drawCircle(b.x, b.y, b.r);
      this.bgGfx.endFill();
    }

    const textSize = Math.max(16, Math.min(24, vmin * 0.04));
    this.statusText.style.fontSize = textSize;
    this.statusText.x = w / 2;
    this.statusText.y = h * 0.48;

    const btnW = Math.max(120, Math.min(180, w * 0.3));
    const btnH = L.buttonH;
    this.cancelBtn.resize(btnW, btnH);
    this.cancelBtn.pivot.set(btnW / 2, btnH / 2);
    this.cancelBtn.x = w / 2;
    this.cancelBtn.y = h * 0.62;
  }

  destroy(): void {
    this.cleanup();
    super.destroy();
  }
}
