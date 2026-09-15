# MCPエンドポイント設定

`/api/mcp` は、AIエージェントがワークフロー図のノード配列を読み書きするための、Cloudflare Pages Functions上のMCPエンドポイントです。`read_diagram` と `write_diagram` の2つのツールをJSON-RPC経由で提供します。

## 実際にデプロイする際の手順

以下はユーザーが手動で実行するコマンドです。この作業では実行していません。

1. KVネームスペースを作成する。

   ```sh
   wrangler kv namespace create WORKFLOW_KV
   ```

2. コマンドの出力に含まれるIDを、`wrangler.jsonc` の `REPLACE_WITH_REAL_KV_ID` に反映する。

3. MCPアクセス用トークンをCloudflareのシークレットとして登録する。

   ```sh
   wrangler secret put MCP_ACCESS_TOKEN
   ```

4. Pagesへデプロイする。

   ```sh
   wrangler pages deploy .
   ```

## 現在の状態

今回はコードの雛形のみで、MCPエンドポイントは既存の画面や図データ保存処理にはまだ接続されていません。KVネームスペースの実体作成、シークレット設定、デプロイも未実施です。
