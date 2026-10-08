# 担当種別付きワークフローJSON — 実装・検証記録

## 対象と変換

既存の `APP_DATA[app].workflow` は `nodes`（id/displayId/x/y/kind/title/description）と `wires`（id/from/to）を保持する。UI・データフローのアプリ別データは同じ `APP_DATA` の別フィールドにある。

`workflow-json.js` で正規化JSONを検証・変換する。ノードの `name/task` は `title/description`、`connections` は `wires` に対応する。元の定義とノード・接続の全項目を保持し、書き出し時に表示用の座標やkindを混ぜず、編集内容を反映する。

DFSで循環の戻り辺を検出し、配置計算からのみ除く。残る依存の最大段数を上から下に配置し、同じ段のノードは横に並べる。表示用配線には戻り辺・自己接続・同じ端点の複数条件も残す。描画領域は取込ノードの位置に合わせて拡張する。接続条件は配線のツールチップとノード詳細で確認できる。

roleの色・形とplannedの点線枠は担当種別を持つワークフローノードだけに適用する。既存のkind装飾、APP_DATA、UI／データフロー生成関数は変更していない。JSON操作ボタンはワークフロータブに追加した。

簡易版は従来のlocalStorageキーを維持。seikyu_kappoの詳細版は別キー `workflow-editor:seikyu_kappo:workflow:detailed` に保存し、表示選択も保持する。不正な取込は検証が完了する前に状態・保存先を変更しない。

## 検証結果（2026-10-08）

- `node --test tests/workflow-json.test.cjs tests/workflow-state.test.cjs`：13テスト成功、終了コード0。
- 公開サンプルの15ノード・22接続、4種類のrole、planned 1件を確認。取込→書き出し→再取込と、実際のindex.htmlの取込ハンドラ→書き出しBlob→再取込で全JSON項目・配列順・接続条件が一致。
- 不正構文、version・型・列挙値、重複ID、存在しない接続先、サイズ・件数・深さ上限、非有限数を日本語で拒否。実取込ハンドラの失敗時にメモリ・保存先・簡易版選択が保持されることを確認。
- 簡易版の編集保持、詳細版の座標・kind・全項目保存、アプリ切替、再起動、選択中の版のリセットを確認。ノード編集・追加・削除後の書き出しも検証。
- ファイル読込、1MB超過の拒否、遅い読込が新しい貼り付けを上書きしないことを確認。
- 変更前commit `0065dccf89ad831fc695da3054f382882b055316` と比較し、APP_DATA全体、UI／データフロー生成関数、kind装飾CSSが一致。
- 作業中に更新された指定公開サンプルを最終段階で再同期し、同梱定義との全項目一致を確認（終了コード0）。
- `python3 -m http.server` でローカル配信を実施。変換スクリプトのHTTP 200応答を確認。
- 最終のブラウザ表示確認はユーザーの後続指示で省略。画面描画、実際のOSファイル選択・ダウンロード、表示の重なりは未検証。Nodeの状態テストはDOMのイベント登録を最小限の代替オブジェクトで扱い、描画は実行しない。

指定された公開サンプル以外のseikyu_kappoのファイルは読んでいない。data/・output/・logs/、秘密情報、KV、functions/api/mcp.js、wrangler.jsoncは対象外。依存・CDNを追加せず、push・デプロイは実施しない。

## 手動の往復確認手順（未実施）

以下は今後ブラウザ確認が許可された場合の手順。今回の作業では実行していない。

1. `python3 -m http.server 8000` で配信し、`http://localhost:8000/index.html` を開く。
2. seikyu_kappoを選び、簡易版の4ノードを確認。詳細版を選び、15ノード・22配線、4色の凡例、計画中1ノードの点線枠を確認する。
3. 閲覧モードでノードを選び、task/input/output/verify/impl/refs/learningと接続条件を確認する。スクロールして図全体の重なりや配線の切れを確認する。
4. JSON書き出しでA.jsonを保存。JSON取込でA.jsonを選び、書き出したB.jsonを以下で比較する。
5. B.jsonの内容を貼り付けて再取込し、書き出したC.jsonも同じ方法で比較する。
6. 不正構文や存在しない接続先のJSONを取り込もうとして、日本語エラーが出て元の図が保持されることを確認する。
7. 簡易版へ戻して編集保持を確認し、aikensyu／web-service-ginleafの3タブが従来どおり表示されることを確認する。

```bash
node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); assert.deepEqual(JSON.parse(fs.readFileSync("A.json","utf8")),JSON.parse(fs.readFileSync("B.json","utf8"))); console.log("一致");'
```
