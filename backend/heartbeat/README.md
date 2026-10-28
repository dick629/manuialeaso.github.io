# 旅人頻道（心跳聊天）後端

遊戲裡世界頻道旁的「💬 旅人」按鈕，是真人玩家之間的聊天。它需要一台小伺服器；這個資料夾就是那台伺服器的程式，放在 Cloudflare Workers（免費方案）上執行，資料存在 Cloudflare D1（免費方案）。

## 它會收什麼資料

- 加入時：發一組隨機身分（uid＋token），token 只存雜湊；另存「IP 的雜湊」用來限制同一個 IP 一小時最多加入 10 次。
- 心跳（每 5 分鐘）：角色名（最多 12 字）、職業、等級。不收裝備、地圖、存檔。
- 聊天：每則最多 80 字；同一人 5 秒一句、一小時最多 60 句；訊息保留 3 天、最多 2,000 則。

## 部署（約 10 分鐘）

需要：一個 Cloudflare 帳號（免費）、電腦上有 Node.js。

```bash
cd backend/heartbeat
npx wrangler login                                   # 瀏覽器登入 Cloudflare
npx wrangler d1 create lineage-heartbeat             # 建資料庫，畫面會印出 database_id
```

把印出的 `database_id` 貼到 `wrangler.jsonc` 的 `"database_id"`。如果遊戲網址不是 `https://manuialeaso.github.io`，也一起改 `ALLOW_ORIGINS`（多個用逗號隔開）。

```bash
npx wrangler d1 execute lineage-heartbeat --remote --file=schema.sql   # 建資料表
npx wrangler deploy                                                    # 上線
```

`deploy` 完成會印出網址，例如 `https://lineage-heartbeat.你的帳號.workers.dev`。

## 接到遊戲

- 正式上線：把網址填進 `afk-heartbeat.js` 的 `DEFAULT_API`，重新發布網站。之後所有玩家進遊戲就**自動連上**，不需要註冊或設定；不想出現在名冊的玩家可以在視窗裡按「隱身」。
- 先自己測試：遊戲網址後面加 `?hbadmin`，按「💬 旅人」→「伺服器設定（管理用）」→ 貼上網址 →「儲存」（只對這台瀏覽器有效）。

## 管理

```bash
# 停用某個名字的旅人（之後他不能心跳也不能說話）
npx wrangler d1 execute lineage-heartbeat --remote --command "UPDATE travelers SET banned=1 WHERE name='名字'"
# 刪掉某則訊息（id 可從下一行查）
npx wrangler d1 execute lineage-heartbeat --remote --command "SELECT id, name, text FROM messages ORDER BY id DESC LIMIT 20"
npx wrangler d1 execute lineage-heartbeat --remote --command "DELETE FROM messages WHERE id=123"
```

## 免費額度

每位加入的玩家一天約 288 次心跳（寫入）；聊天視窗開著時每 15 秒讀一次新訊息。以 Cloudflare 免費方案的每日請求數與 D1 寫入額度來看，同時幾十到上百人都夠用；實際額度以 Cloudflare 官方公布為準。

## 本機測試

```bash
node scripts/test-heartbeat-worker.mjs   # 用 node:sqlite 模擬 D1，測加入、心跳、聊天、頻率限制、跨站限制
```
