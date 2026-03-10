import { Application } from 'pixi.js';
import { SceneName, SceneData, SceneSwitcher, BaseScene } from './scenes/BaseScene';
import { TitleScene } from './scenes/TitleScene';
import { MatchmakingScene } from './scenes/MatchmakingScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { COLORS } from './utils/constants';

/** ゲーム画面のアスペクト比 (4:3) */
const ASPECT_W = 4;
const ASPECT_H = 3;

/**
 * コンテナサイズを計算して適用する
 * PC: 4:3固定枠（パディング付き）
 * モバイル（縦画面）: フルスクリーン
 */
function fitContainer(container: HTMLElement): { width: number; height: number } {
  const maxW = window.innerWidth;
  const maxH = window.innerHeight;
  const isMobile = maxW <= 640 || (maxH > maxW);

  let w: number;
  let h: number;

  if (isMobile) {
    // モバイル: フルスクリーン
    w = maxW;
    h = maxH;
    container.style.borderRadius = '0';
    container.style.boxShadow = 'none';
  } else {
    // PC: 4:3固定枠
    const pad = 32;
    const availW = maxW - pad * 2;
    const availH = maxH - pad * 2;

    if (availW / availH > ASPECT_W / ASPECT_H) {
      h = availH;
      w = Math.floor(h * (ASPECT_W / ASPECT_H));
    } else {
      w = availW;
      h = Math.floor(w * (ASPECT_H / ASPECT_W));
    }
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 0 40px rgba(0,0,0,0.4)';
  }

  container.style.width = `${w}px`;
  container.style.height = `${h}px`;

  return { width: w, height: h };
}

/**
 * アプリケーションのエントリーポイント
 */
class App {
  private app: Application;
  private currentScene: BaseScene | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    const { width, height } = fitContainer(container);

    this.app = new Application({
      width,
      height,
      backgroundColor: COLORS.BACKGROUND,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
  }

  async init(): Promise<void> {
    this.container.appendChild(this.app.view as HTMLCanvasElement);

    // テスト用: グローバルからシーン切替
    (window as any).__switchScene = this.switchScene;

    this.switchScene('title');

    window.addEventListener('resize', () => {
      this.resizeApp();
    });
  }

  private resizeApp(): void {
    const { width, height } = fitContainer(this.container);
    this.app.renderer.resize(width, height);
    if (this.currentScene) {
      this.currentScene.onResize();
    }
  }

  private switchScene: SceneSwitcher = (name: SceneName, data?: SceneData): void => {
    if (this.currentScene) {
      this.currentScene.destroy();
      this.app.stage.removeChildren();
    }

    switch (name) {
      case 'title':
        this.currentScene = new TitleScene(this.app, this.switchScene);
        break;
      case 'matchmaking':
        this.currentScene = new MatchmakingScene(this.app, this.switchScene, data);
        break;
      case 'battle':
        this.currentScene = new BattleScene(this.app, this.switchScene, data);
        break;
      case 'result':
        this.currentScene = new ResultScene(this.app, this.switchScene, data);
        break;
    }

    if (this.currentScene) {
      this.app.stage.addChild(this.currentScene.container);
    }
  };
}

const container = document.getElementById('game-container');
if (container) {
  const app = new App(container);
  app.init().catch(console.error);
}
