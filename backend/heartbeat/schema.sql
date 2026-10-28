-- 放置天堂・旅人頻道（心跳聊天）D1 資料表
CREATE TABLE IF NOT EXISTS travelers (
  uid TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  cls TEXT NOT NULL,
  lv INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS travelers_seen ON travelers (last_seen);
CREATE INDEX IF NOT EXISTS travelers_ip ON travelers (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  cls TEXT NOT NULL,
  lv INTEGER NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_at ON messages (at);
CREATE INDEX IF NOT EXISTS messages_uid ON messages (uid, at);
