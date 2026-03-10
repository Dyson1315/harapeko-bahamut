# はらぺこバハムート - システム設計書

## 1. システムアーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                     クライアント                          │
│  PixiJS v7 + TypeScript + Vite                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐         │
│  │SceneManager│ │UIComponents│ │WebSocketClient│         │
│  │  (Title/   │ │(CardSprite,│ │ (接続管理,     │        │
│  │   Battle/  │ │ LifeBar,   │ │  メッセージ送受)│        │
│  │   Result)  │ │ Dialog等)  │ │               │        │
│  └──────────┘  └──────────┘  └───────┬───────┘         │
│                                       │ WebSocket       │
└───────────────────────────────────────┼─────────────────┘
                                        │
                                        │ wss://
                                        │
┌───────────────────────────────────────┼─────────────────┐
│              Cloudflare Workers                          │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │  Hono (HTTP Router / WebSocket Upgrade)  │            │
│  │  GET /matchmaking → MatchmakingQueue DO  │            │
│  │  GET /ws/:roomId  → GameRoom DO          │            │
│  └──────┬────────────────────┬──────────────┘            │
│         │                    │                           │
│  ┌──────▼──────┐   ┌────────▼────────┐                  │
│  │MatchmakingQ │   │   GameRoom DO    │                  │
│  │  Durable    │   │   Durable Object │                  │
│  │  Object     │   │                  │                  │
│  │             │   │  ┌────────────┐  │                  │
│  │ ・キュー管理 │   │  │ GameEngine │  │                  │
│  │ ・マッチング │   │  │  ├CardMgr  │  │                  │
│  │ ・ルーム割当 │   │  │  ├Effects  │  │                  │
│  │             │   │  │  ├PlayerMgr│  │                  │
│  └─────────────┘   │  │  └UchikeshiMgr│ │               │
│                     │  └────────────┘  │                  │
│                     └──────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### 技術スタック

| レイヤ | 技術 | 備考 |
|--------|------|------|
| クライアント描画 | PixiJS v7.4 | Canvas/WebGL 2Dレンダリング |
| クライアントビルド | Vite 6 + TypeScript 5 | HMR対応の開発環境 |
| サーバーFW | Hono v3 | 軽量Webフレームワーク |
| ランタイム | Cloudflare Workers | エッジコンピューティング |
| 状態管理 | Durable Objects | ゲームルーム永続化 |
| 通信 | WebSocket | リアルタイム双方向通信 |
| モノレポ | pnpm workspaces | apps/client, apps/server |

---

## 2. ディレクトリ構成

```
harapeko-bahamut/
├── package.json                    # ルートpackage.json (workspaces設定)
├── pnpm-workspace.yaml             # pnpm workspaces定義
├── tsconfig.json                   # ルートTypeScript設定
├── docs/
│   └── design.md                   # 本設計書
│
├── apps/
│   ├── client/                     # クライアント
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts                     # アプリケーションエントリ (PixiJS Application初期化)
│   │       │
│   │       ├── types/                      # 共有型定義
│   │       │   ├── card.ts                 # カード関連型
│   │       │   ├── game.ts                 # ゲーム状態型
│   │       │   └── messages.ts             # WebSocketメッセージ型
│   │       │
│   │       ├── data/                       # 静的データ定義
│   │       │   └── cards.ts                # 全16枚カード定義マスタ
│   │       │
│   │       ├── scenes/                     # PixiJSシーン (画面単位)
│   │       │   ├── BaseScene.ts            # シーン基底クラス
│   │       │   ├── TitleScene.ts           # タイトル画面
│   │       │   ├── MatchmakingScene.ts     # マッチメイキング待機画面
│   │       │   ├── BattleScene.ts          # バトル画面 (メインゲーム)
│   │       │   └── ResultScene.ts          # リザルト画面
│   │       │
│   │       ├── ui/                         # PixiJS UIコンポーネント
│   │       │   ├── Button.ts               # 汎用ボタン
│   │       │   ├── Label.ts                # テキストラベル
│   │       │   ├── Dialog.ts               # モーダルダイアログ基底
│   │       │   ├── CardSprite.ts           # カード1枚の表示コンポーネント
│   │       │   ├── CardHand.ts             # 手札エリア
│   │       │   ├── CardField.ts            # フィールドエリア
│   │       │   ├── LifeBar.ts              # ライフ表示
│   │       │   ├── UchikeshiChips.ts       # うちけしの書チップ表示
│   │       │   ├── DeckPile.ts             # 山札表示
│   │       │   ├── GraveyardPile.ts        # 捨て札表示
│   │       │   ├── TurnIndicator.ts        # ターン/フェーズ表示
│   │       │   ├── ActionLog.ts            # アクションログ
│   │       │   ├── PlayerInfoPanel.ts      # プレイヤー情報パネル
│   │       │   ├── CardSelectionModal.ts   # カード選択モーダル
│   │       │   ├── UchikeshiDialog.ts      # うちけし確認ダイアログ
│   │       │   ├── UchikeshiBackDialog.ts  # うちけし返しダイアログ
│   │       │   ├── WaitingOverlay.ts       # 相手操作待ちオーバーレイ
│   │       │   ├── GameEndModal.ts         # ゲーム終了モーダル
│   │       │   └── EffectAnimation.ts      # カード効果アニメーション
│   │       │
│   │       ├── game/                       # ゲームロジック (クライアント側)
│   │       │   ├── GameManager.ts          # ゲーム状態管理 + WebSocket連携
│   │       │   ├── GameStateStore.ts       # ゲーム状態のローカルストア
│   │       │   └── AnimationController.ts  # アニメーション制御
│   │       │
│   │       ├── network/                    # 通信レイヤ
│   │       │   ├── WebSocketClient.ts      # WebSocket接続管理
│   │       │   └── MatchmakingClient.ts    # マッチメイキング用WebSocket
│   │       │
│   │       └── utils/                      # ユーティリティ
│   │           ├── constants.ts            # 色定義, サイズ定数
│   │           └── layout.ts               # レスポンシブレイアウト計算
│   │
│   └── server/                     # サーバー
│       ├── package.json
│       ├── wrangler.toml           # Cloudflare Workers設定
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Honoルーター定義
│           ├── env.d.ts            # Cloudflare型定義
│           ├── types/
│           │   └── game.ts         # サーバー側ゲーム型定義
│           ├── data/
│           │   └── cards.ts        # カードマスタデータ (全16枚)
│           ├── game/
│           │   ├── game_engine.ts     # ゲームエンジン
│           │   ├── card_manager.ts    # カードプレイ/効果解決
│           │   ├── effects.ts         # 個別カード効果実装
│           │   ├── player_manager.ts  # プレイヤー管理
│           │   └── uchikeshi_manager.ts # うちけし管理
│           └── durable_objects/
│               ├── game_room.ts       # ゲームルームDO
│               └── matchmaking_queue.ts # マッチメイキングDO
```

---

## 3. サーバー設計

### 3.1 Honoルーター (`apps/server/src/index.ts`)

```typescript
// エンドポイント一覧
GET /                    // ヘルスチェック
GET /matchmaking         // マッチメイキング用WebSocket (→MatchmakingQueue DO)
GET /ws/:roomId          // ゲーム用WebSocket (→GameRoom DO)
GET /api/matchmaking/status  // マッチメイキング状況REST API
```

CORS設定は全リクエストに `Access-Control-Allow-Origin: *` を適用。

### 3.2 Durable Objects

#### GameRoom DO (`durable_objects/game_room.ts`)

責務:
- WebSocket接続の受付と管理 (`connections: Map<string, WebSocket>`)
- GameEngineのインスタンス保持
- クライアントからのメッセージをGameEngineに委譲
- ゲーム状態変更後の全プレイヤーへのブロードキャスト
- 再接続処理 (30秒タイムアウト)
- ハートビート送受信 (25秒間隔ping)
- 再戦リクエスト管理

状態のサニタイズ:
GameStateをクライアントに送信する際、相手の手札情報を隠蔽する。各プレイヤーには自分の手札のみ開示し、相手の`hand`は空配列、`handCount`で枚数のみ通知する。ただし`あくまの吹き矢`や`ひらめき水晶`等の効果発動中は例外として相手の手札/山札を開示する。

WebSocketメッセージのハンドリング:

| メッセージ type | 処理 |
|---|---|
| `join` | プレイヤー追加。2人揃ったらゲーム開始 |
| `playCard` | GameEngine.playCard() → うちけしフェーズ or 効果解決 |
| `useUchikeshi` | GameEngine.useUchikeshi() → うちけし返し or 効果解決/無効化 |
| `selectCards` | GameEngine.completeCardSelection() → 効果解決 |
| `endTurn` | GameEngine.endTurn() → 手札上限処理 → 次のターン |
| `rematchRequest` | 再戦管理。両者同意で新ゲーム開始 |
| `pong` | ハートビート応答 |

#### MatchmakingQueue DO (`durable_objects/matchmaking_queue.ts`)

責務:
- ランダムマッチのキュー管理
- 2人マッチング成立時にルームID生成と両プレイヤーへ通知
- ハートビート管理

### 3.3 GameEngine (`game/game_engine.ts`)

ゲームロジックの中核。以下のサブマネージャーを保持:

| マネージャー | 責務 |
|---|---|
| CardManager | カードプレイのバリデーション、効果解決、手札選択処理 |
| Effects | 各カード効果の個別実装 (16種の効果関数) |
| PlayerManager | プレイヤー追加/削除、ライフ/プレイ回数管理 |
| UchikeshiManager | うちけし/うちけし返しのフロー管理 |

### 3.4 カード効果一覧 (`game/effects.ts`)

| effect識別子 | カード名 | 処理概要 |
|---|---|---|
| `directDamage` | そらとぶナイフ | 相手に2ダメージ (はねかえし考慮) |
| `destroyMonster` | オワカーレ | 相手の場のまもの1体を捨て札に |
| `summonFromHand` | イデヨン | 手札からまもの1体を場に出す |
| `summonFromGraveyard` | ヨミガエール | 捨て札からまもの1体を場に出す |
| `swapBahamuts` | イレカエール | 全領域でこどもゴブリンとはらぺこバハムートを入替 |
| `drawDiscardPlay` | 黒ネコのしっぽ | 2ドロー → 2捨て → +1プレイ追加 |
| `drawDiscard` | 銀ネコのしっぽ | 3ドロー → 2捨て |
| `retrieveFromGraveyard` | カラスのおつかい | 捨て札から1枚手札に |
| `searchDeck` | ようせいのメガネ | 山札全公開→1枚手札に→シャッフル |
| `handDiscard` | あくまの吹き矢 | 相手手札公開→1枚選んで捨てさせる |
| `stealNamedCard` | ひらめき水晶 | カード名宣言→相手手札にあれば奪取 |
| `additionalPlays` | ほしふる砂時計 | +2プレイ追加 |
| `gainUchikeshi` | 魔女のおとどけもの | 共有ストックからうちけし1獲得 |
| `summonMonster` | (まもの共通) | まものカードを場に出す |

---

## 4. クライアント設計 (PixiJS)

### 4.1 アプリケーション初期化 (`src/main.ts`)

- `Application`初期化後、`switchScene`でシーン遷移を管理
- 解像度: `window.devicePixelRatio`に対応
- 背景色: `0x1a0a2e` (深紫)
- リサイズ対応: `resizeTo: window` + シーンの`onResize()`呼び出し

### 4.2 シーン構成

#### BaseScene (`scenes/BaseScene.ts`)

```typescript
abstract class BaseScene {
  container: Container;
  protected app: Application;
  protected switchScene: (name: SceneName, data?: any) => void;

  abstract onResize(): void;
  destroy(): void;
}
```

#### TitleScene

- タイトルロゴ表示 (テキスト "はらぺこバハムート")
- 「オンライン対戦」ボタン → MatchmakingScene遷移
- 背景アニメーション

#### MatchmakingScene

- WebSocket接続 (`/matchmaking`) → マッチ待機
- 「待機中...」アニメーション
- キャンセルボタン
- マッチ成立時 → BattleScene遷移 (`roomId`, `playerId`をデータとして渡す)

#### BattleScene (メインゲーム画面)

- GameManager のインスタンスを保持
- WebSocket接続(`/ws/:roomId`)とメッセージハンドリング
- ゲーム状態受信 → UIコンポーネント更新
- ユーザー操作 → WebSocket送信

#### ResultScene

- 勝敗表示
- 「再戦」ボタン → rematchRequest送信
- 「タイトルに戻る」ボタン → TitleScene遷移

### 4.3 画面レイアウト (BattleScene)

```
┌─────────────────────────────────────────────┐
│  [相手名]  ♥♥♥♥  📜×2   [ターン: 3]         │  ← 相手情報バー
├─────────────────────────────────────────────┤
│                                             │
│     ┌───┐  ┌───┐                            │  ← 相手のフィールド
│     │まも│  │まも│   (相手の場のまもの)        │
│     └───┘  └───┘                            │
│                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← 中央境界線
│                                             │
│     ┌───┐  ┌───┐                            │  ← 自分のフィールド
│     │まも│  │まも│   (自分の場のまもの)        │
│     └───┘  └───┘                            │
│                                             │
│  ┌────┐                      ┌────┐┌────┐   │
│  │山札│  [アクションログ]     │捨札││共有│   │  ← 中央エリア
│  │ 6  │                      │ 3  ││📜2│   │
│  └────┘                      └────┘└────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  [自分名]  ♥♥♥♥  📜×2                       │  ← 自分情報バー
├─────────────────────────────────────────────┤
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                  │  ← 手札エリア
│  │C1│ │C2│ │C3│ │C4│ │C5│   [ターン終了]    │
│  └──┘ └──┘ └──┘ └──┘ └──┘                  │
└─────────────────────────────────────────────┘
```

### 4.4 UIコンポーネント設計

#### CardSprite

- `Container` を継承
- カード背景矩形 (まもの=黄, 魔法=青)
- カード名テキスト、種別ラベル
- タップ/クリックイベント
- 選択状態の視覚表現 (光彩/枠線)

#### CardHand

- 手札カード群を水平に等間隔配置
- カード枚数に応じてオーバーラップ
- カードタップで選択 → playCardメッセージ送信

#### CardField

- 場のまものカード (最大2体) を配置
- ダメージ値のラベル表示

#### LifeBar

- ハートアイコン4つの表示
- ライフ減少時のアニメーション

#### Dialog / CardSelectionModal

- 半透明背景オーバーレイ
- カード一覧からの選択UI (1枚 or 2枚選択)
- 確定ボタン
- 用途: 黒ネコ/銀ネコの捨てカード選択、ようせいのメガネの山札選択、あくまの吹き矢の相手手札選択、ひらめき水晶のカード名選択、手札上限時の捨てカード選択

#### UchikeshiDialog / UchikeshiBackDialog

- 「うちけしの書を使いますか?」確認UI
- 使う/使わないボタン
- うちけし返し: 残り2つ以上必要であることの表示

### 4.5 状態管理 (`game/GameStateStore.ts`)

ReactのContextの代わりに、EventEmitter パターンでゲーム状態を管理する。

```typescript
class GameStateStore {
  private state: GameState | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  updateState(newState: GameState): void;
  getState(): GameState | null;

  on(event: 'stateChanged' | 'gameStarted' | 'gameEnded' | ..., callback): void;
  off(event, callback): void;
  emit(event, data?): void;

  get myPlayer(): PlayerState | null;
  get opponentPlayer(): PlayerState | null;
  get isMyTurn(): boolean;
  get canPlayCard(): boolean;
}
```

### 4.6 GameManager (`game/GameManager.ts`)

- WebSocketClientの保持
- GameStateStoreの保持
- サーバーメッセージ受信 → GameStateStore更新 → UIリフレッシュ
- ユーザー操作のAPI:
  - `playCard(cardId, targetId?)`
  - `useUchikeshi(counter, uchikeshiBack?)`
  - `endTurn(discardCards?)`
  - `selectCards(selectedCards)`
  - `requestRematch()`

### 4.7 AnimationController (`game/AnimationController.ts`)

- カードプレイアニメーション (手札→場 移動)
- ダメージアニメーション (数値ポップ + 画面シェイク)
- カード破壊アニメーション (フェードアウト)
- ドローアニメーション (山札→手札)
- PixiJSの`Ticker`でフレーム単位の更新

---

## 5. 共有型定義

### 5.1 カード型 (`types/card.ts`)

```typescript
export type CardType = 'monster' | 'magic';

export interface Card {
  id: string;        // 例: "harapeko-bahamut"
  name: string;      // 例: "はらぺこバハムート"
  type: CardType;
  description: string;
}

export interface MonsterCard extends Card {
  type: 'monster';
  damage?: number;              // ターン開始時ダメージ
  canOnlyBeSummoned?: boolean;  // true: 魔法効果でのみ召喚可
}

export interface MagicCard extends Card {
  type: 'magic';
  effect: string;  // effects.tsの関数識別子
}
```

### 5.2 ゲーム状態型 (`types/game.ts`)

```typescript
export type GamePhase =
  | 'waiting'   // プレイヤー待ち
  | 'starting'  // ゲーム開始処理
  | 'draw'      // ドローフェーズ
  | 'main'      // メインフェーズ
  | 'counter'   // うちけし確認
  | 'end'       // ターン終了処理
  | 'finished'; // ゲーム終了

export interface PlayerState {
  id: string;
  name: string;
  life: number;           // 初期値: 4
  hand: Card[];           // 自分の手札 (相手には非公開)
  handCount: number;      // 手札枚数 (相手用)
  field: MonsterCard[];   // 場のまもの
  uchikeshi: number;      // うちけしの書残数 (初期値: 2)
  playedCount: number;    // 今ターンのプレイ済み枚数
  canPlay: number;        // 今ターンのプレイ可能枚数
}

export interface PendingEffect {
  playerId: string;
  card: Card;
  targetId?: string;
  awaitingCounter?: boolean;
  requiresSelection?: boolean;
  selectionCount?: number;
  revealOpponentHand?: boolean;
  revealDeck?: boolean;
  revealAllCards?: boolean;
}

export interface GameState {
  roomId: string;
  players: Record<string, PlayerState>;
  currentTurn: string | null;
  phase: GamePhase;
  turnCount: number;
  deckCount: number;         // 山札残り枚数
  deck?: Card[];             // 山札 (ようせいのメガネ時のみ)
  graveyard: Card[];         // 捨て札 (公開情報)
  sharedUchikeshi: number;   // 共有うちけしストック (初期値: 2)
  gameStarted: boolean;
  gameOver: boolean;
  winner: string | null;
  pendingEffect?: PendingEffect;
}
```

### 5.3 メッセージ型 (`types/messages.ts`)

```typescript
// サーバー→クライアント
export type WSMessage =
  | { type: 'gameState'; data: GameState }
  | { type: 'gameStarted'; data: GameState }
  | { type: 'gameEnded'; data: { winner: string; winnerName: string } }
  | { type: 'uchikeshiPrompt'; data: { card: Card; playerId: string } }
  | { type: 'uchikeshiBackPrompt'; data: { card: Card } }
  | { type: 'waitingForCounter'; data: { card: Card; opponentId: string } }
  | { type: 'waitingForUchikeshiBack'; data: { card: Card; originalPlayerId: string } }
  | { type: 'playerJoined'; data: { playerName: string } }
  | { type: 'playerDisconnected'; data: {} }
  | { type: 'playerReconnected'; data: { playerName: string } }
  | { type: 'rematchRequested'; data: { fromPlayerId: string; fromPlayerName: string } }
  | { type: 'rematchStarted'; data: {} }
  | { type: 'error'; data: { message: string } }
  | { type: 'ping'; data: { timestamp: number } };

// クライアント→サーバー
export type PlayerAction =
  | { type: 'playCard'; cardId: string; targetId?: string }
  | { type: 'useUchikeshi'; counter: boolean; uchikeshiBack?: boolean }
  | { type: 'endTurn'; discardCards?: string[] }
  | { type: 'selectCards'; selectedCards: string[] }
  | { type: 'rematchRequest' }
  | { type: 'pong'; data: { timestamp: number; originalTimestamp: number } };

// マッチメイキング用
export type MatchmakingWSMessage =
  | { type: 'matchmakingJoined'; data: { mode: string; position: number; estimatedWaitTime: number } }
  | { type: 'matchFound'; data: { roomId: string; opponent: { id: string; name: string }; mode: string } }
  | { type: 'gameReady'; data: { roomId: string; playerId: string } }
  | { type: 'matchmakingLeft'; data: { playerId: string } }
  | { type: 'matchError'; data: { message: string } };
```

---

## 6. ゲームフロー

### 6.1 画面遷移

```
TitleScene
  │
  │ 「オンライン対戦」タップ
  ▼
MatchmakingScene
  │
  │ マッチ成立 (matchFound → gameReady)
  ▼
BattleScene
  │
  │ ゲーム終了 (gameEnded)
  ▼
ResultScene
  │
  ├── 「再戦」→ BattleScene (rematchStarted)
  └── 「タイトルへ」→ TitleScene
```

### 6.2 ターン進行フロー

```
ターン開始
  │
  ├── 場のまもののダメージ処理
  │   └── はらぺこバハムート: 4ダメージ
  │   └── こどもゴブリン: 1ダメージ (はねかえしバハムートで反射)
  │
  ├── 勝敗判定 → ライフ0なら終了
  │
  ├── ドローフェーズ (先攻1ターン目はスキップ)
  │   └── 山札から1枚引く (山札0枚なら捨て札シャッフルして補充)
  │
  ├── メインフェーズ (プレイ可能枚数まで)
  │   │
  │   ├── カードプレイ
  │   │   │
  │   │   ├── うちけしフェーズ (相手に確認)
  │   │   │   ├── うちけし使用 → うちけし返しフェーズ
  │   │   │   │   ├── うちけし返し使用 (2枚消費) → 効果解決
  │   │   │   │   └── うちけし返し不使用 → 効果無効化
  │   │   │   └── うちけし不使用 → 効果解決
  │   │   │
  │   │   └── 効果解決
  │   │       ├── 即時効果: そらとぶナイフ, オワカーレ等
  │   │       └── 選択効果: → CardSelectionModal表示 → selectCards送信
  │   │
  │   └── ターン終了ボタン / プレイ上限到達
  │
  └── ターン終了処理
      ├── 手札上限チェック (5枚超過なら捨て選択)
      └── 次のプレイヤーのターンへ
```

### 6.3 うちけしフロー (詳細)

```
プレイヤーA: カードプレイ
  │
  ▼
サーバー: pendingEffect設定, phase='counter'
  │
  ├── → プレイヤーB: "uchikeshiPrompt" (うちけしの書を使う?)
  └── → プレイヤーA: "waitingForCounter" (相手の応答待ち)

プレイヤーB の選択:
  │
  ├── 「使わない」→ 効果解決
  │
  └── 「使う」(うちけしの書 -1, 共有ストック +1)
      │
      ├── → プレイヤーA: "uchikeshiBackPrompt" (うちけし返しする?)
      └── → プレイヤーB: "waitingForUchikeshiBack"

      プレイヤーA の選択:
        ├── 「うちけし返し」(うちけしの書 -2, 共有ストック +2) → 効果解決
        └── 「受け入れる」→ 効果無効化 (カードは捨て札へ)
```

### 6.4 カード選択フロー

一部のカード効果は、プレイ後に追加選択が必要:

| カード | 選択内容 | selectionCount |
|--------|----------|---------------|
| 黒ネコのしっぽ | 2ドロー後、手札から2枚捨て選択 | 2 |
| 銀ネコのしっぽ | 3ドロー後、手札から2枚捨て選択 | 2 |
| ようせいのメガネ | 山札全公開、1枚選択 | 1 |
| あくまの吹き矢 | 相手手札公開、1枚選択して捨て | 1 |
| ひらめき水晶 | 全カード一覧から1枚宣言 | 1 |

フロー:
1. 効果の第1段階実行 (ドロー等)
2. `pendingEffect.requiresSelection = true` に設定
3. クライアントにgameState送信 (revealOpponentHand/revealDeck等のフラグ付き)
4. クライアントがCardSelectionModal表示
5. ユーザーが選択 → `selectCards`メッセージ送信
6. サーバーで`completeCardSelection`実行 → 効果の第2段階完了

---

## 7. 実装タスク分割

### Phase 1: 基盤構築

| # | タスク | 依存 |
|---|--------|------|
| 1-1 | プロジェクトセットアップ (package.json, tsconfig, vite.config, wrangler.toml) | なし |
| 1-2 | 共有型定義の作成 (`types/card.ts`, `game.ts`, `messages.ts`) | なし |
| 1-3 | カードマスタデータ作成 (`data/cards.ts`) | 1-2 |

### Phase 2: サーバー実装

| # | タスク | 依存 |
|---|--------|------|
| 2-1 | `env.d.ts`, `index.ts` (Honoルーター) | 1-1 |
| 2-2 | `player_manager.ts` | 1-2 |
| 2-3 | `effects.ts` (全14効果) | 1-3 |
| 2-4 | `card_manager.ts` | 2-3 |
| 2-5 | `uchikeshi_manager.ts` | 1-2 |
| 2-6 | `game_engine.ts` | 2-2, 2-4, 2-5 |
| 2-7 | `game_room.ts` DO | 2-6 |
| 2-8 | `matchmaking_queue.ts` DO | 2-1 |

### Phase 3: クライアント基盤

| # | タスク | 依存 |
|---|--------|------|
| 3-1 | `main.ts`, `BaseScene.ts` | 1-1 |
| 3-2 | `WebSocketClient.ts`, `MatchmakingClient.ts` | 1-2 |
| 3-3 | `GameStateStore.ts` (EventEmitter) | 1-2 |
| 3-4 | `GameManager.ts` | 3-2, 3-3 |
| 3-5 | `utils/constants.ts`, `layout.ts` | なし |

### Phase 4: クライアントUI

| # | タスク | 依存 |
|---|--------|------|
| 4-1 | `Button.ts`, `Label.ts`, `Dialog.ts` | 3-1 |
| 4-2 | `CardSprite.ts` | 4-1 |
| 4-3 | `CardHand.ts`, `CardField.ts` | 4-2 |
| 4-4 | `LifeBar.ts`, `UchikeshiChips.ts` | 4-1 |
| 4-5 | `DeckPile.ts`, `GraveyardPile.ts` | 4-1 |
| 4-6 | `PlayerInfoPanel.ts`, `TurnIndicator.ts` | 4-4, 4-5 |
| 4-7 | `ActionLog.ts` | 4-1 |

### Phase 5: シーン/モーダル

| # | タスク | 依存 |
|---|--------|------|
| 5-1 | `TitleScene.ts` | 4-1 |
| 5-2 | `MatchmakingScene.ts` | 5-1, 3-2 |
| 5-3 | `BattleScene.ts` | 4-3~4-7, 3-4 |
| 5-4 | `CardSelectionModal.ts` | 4-2 |
| 5-5 | `UchikeshiDialog.ts`, `UchikeshiBackDialog.ts` | 4-1 |
| 5-6 | `WaitingOverlay.ts`, `GameEndModal.ts` | 4-1 |
| 5-7 | `ResultScene.ts` | 5-6 |

### Phase 6: アニメーション/演出

| # | タスク | 依存 |
|---|--------|------|
| 6-1 | `AnimationController.ts` | 5-3 |
| 6-2 | `EffectAnimation.ts` | 6-1 |

### 依存関係

```
Phase 1 (型定義/データ)
  ↓
Phase 2 (サーバー)  ←→  Phase 3 (クライアント基盤)
  ↓                        ↓
  ↓                   Phase 4 (UIコンポーネント)
  ↓                        ↓
  └──────────────→   Phase 5 (シーン/モーダル)
                           ↓
                     Phase 6 (アニメーション)
```

Phase 2 と Phase 3-4 は並行作業が可能。
