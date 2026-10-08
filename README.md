# ワークフロー図エディタ

複数アプリ(aikensyu / web-service-ginleaf / seikyu_kappo 等)を横断して見られる開発支援ツールです。アプリを選ぶと「アプリのUI」「データフロー」「ワークフロー」の3タブを切り替えて見られます。ワークフロータブでは編集モードに入り、ノードの追加・編集・ドラッグ移動ができます（ブラウザの`localStorage`に保存）。

単体のワークフロー図エディタ（旧トップページ）は `single.html` に残しています。

## ローカルで開く

`index.html` をブラウザで直接開くか、プロジェクトディレクトリで次のコマンドを実行します。

```bash
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000> を開いてください。

## 担当種別付きワークフローJSON

ワークフロータブの **JSON取込** から、JSONファイルを選択するか内容を貼り付けます。検証後に選択中のワークフローを置き換え、依存順に自動配置します。循環・自己接続も保持し、戻り配線は破線で表示します。不正なJSON・重複ID・存在しない接続先などは日本語エラーで拒否し、現在の図と保存値を維持します。

対応形式は `version: 1`, `name`, `title`, `nodes`, `connections` を持つ正規化JSONです。各ノードには `id`, `name`, `role`, `status`, `task`, `input`, `output`, `verify`, `impl`, `refs`, `learning` が必要です。接続は `{from, to, on}`。`input/output/impl/refs` と `learning.cases/fix_notes/manual` は文字列の配列、`verify` は `{check, impl?, gap?}` の配列です。

| role | 担当種別 | 色 |
| --- | --- | --- |
| calculator | 電卓 | 青 |
| sorter | 仕分け | 緑 |
| judge | 判断 | 橙 |
| human | 人 | 赤 |

`status: planned` は点線枠、`implemented` は実線枠です。担当種別は既存の `kind: chat/agent` と独立しています。閲覧モードでノードを選ぶと、入力・出力・検証・実装・参照・学習情報と接続条件を確認できます。

**JSON書き出し** は取込済みの図と詳細版で有効です。元の全項目（拡張項目を含む）と配列順を保持し、編集した名前・作業・担当種別・状態やノード削除を反映します。表示用の座標・kindは正規化JSONに含めません。往復一致はJSON内容の一致で、空白やオブジェクトのキー順は対象外です。上限は1MB・200ノード・1,000接続・文字列10,000文字・入れ子100階層、数値は有限値です。

`seikyu_kappo` では「請求書整理の表示」から **簡易版（4ノード）／詳細版（15ノード・22接続）** を選べます。簡易版の編集と詳細版は別々に保存されます。JSON取込は詳細版を置き換え、リセットは選択中の版を既定値へ戻します。公開用の設計図だけを [workflow/seikyu-kappo.js](workflow/seikyu-kappo.js) に同梱しています。

## 検証

依存追加なしで、Node.js 18以降の標準テスト機能を使えます。

```bash
node --test tests/workflow-json.test.cjs tests/workflow-state.test.cjs
```

取込・書き出しBlob・再取込の全項目一致、不正入力時の状態保持、循環と依存順、簡易版／詳細版の保存・再起動、既存データ・kind装飾の維持を検証します。画面描画はテスト対象外です。今回のブラウザ表示確認はユーザー指示により省略しました。確認結果と手動の往復確認手順は [docs/workflow-json-import.md](docs/workflow-json-import.md) にあります。
