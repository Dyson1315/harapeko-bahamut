import { Application, Container } from 'pixi.js';

/** 利用可能なシーン名 */
export type SceneName = 'title' | 'matchmaking' | 'battle' | 'result';

/** シーン切替に渡すデータ型 */
export type SceneData = Record<string, unknown>;

/** シーン切替関数の型 */
export type SceneSwitcher = (name: SceneName, data?: SceneData) => void;

/**
 * 全シーンの基底クラス
 *
 * PixiJSのContainerをルートとして持ち、
 * リサイズ対応とシーン切替機能を提供する。
 */
export abstract class BaseScene {
  readonly container: Container;
  protected app: Application;
  protected switchScene: SceneSwitcher;

  constructor(app: Application, switchScene: SceneSwitcher) {
    this.app = app;
    this.switchScene = switchScene;
    this.container = new Container();
  }

  /** ウィンドウリサイズ時に呼ばれる。各シーンでレイアウトを再計算する */
  abstract onResize(): void;

  /** シーン破棄時に呼ばれる。リソースのクリーンアップを行う */
  destroy(): void {
    this.container.destroy({ children: true });
  }
}
