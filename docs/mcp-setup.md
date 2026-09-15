# MCPエンドポイント設定

`/api/mcp` は、AIエージェントがワークフロー図のノード配列を読み書きするための、Cloudflare Pages Functions上のMCPエンドポイントです。`read_diagram` と `write_diagram` の2つのツールをJSON-RPC経由で提供します。

## 実際にデプロイする際の手順

1. KVネームスペースを作成する。（完了済み。下記「現在の状態」参照）

   ```sh
   wrangler kv namespace create WORKFLOW_KV
   ```

2. コマンドの出力に含まれるIDを、`wrangler.jsonc` の `kv_namespaces` に反映する。（完了済み）

3. MCPアクセス用トークンをCloudflareのシークレットとして登録する。**Pagesプロジェクトなので `wrangler secret put` ではなく `wrangler pages secret put` を使う**（`wrangler secret put` はWorkers用のコマンドでPagesではエラーになる）。

   ```sh
   wrangler pages secret put MCP_ACCESS_TOKEN --project-name=workflow-diagram-editor
   ```

4. Pagesへデプロイする。

   ```sh
   wrangler pages deploy . --project-name=workflow-diagram-editor --branch=main
   ```

## 現在の状態

- KVネームスペース `WORKFLOW_KV` は作成済み・`wrangler.jsonc` に反映済み
- MCPアクセストークンは `wrangler pages secret put` で設定済み
- `https://main.workflow-diagram-editor.pages.dev` にデプロイ済み（commit `33a8773`時点）
- MCPエンドポイント(`/api/mcp`)は設定完了。利用するAIエージェント側には、設定済みのトークン値を`Authorization: Bearer <token>`ヘッダで渡す
