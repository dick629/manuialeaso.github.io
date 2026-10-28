// 旅人頻道（心跳聊天）後端測試：用 node:sqlite 模擬 Cloudflare D1，直接呼叫 worker 的 handle()
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const { handle } = await import(path.join(root, 'backend/heartbeat/worker.mjs'));

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(path.join(root, 'backend/heartbeat/schema.sql'), 'utf8'));
const D1 = {
  prepare(sql) {
    let args = [];
    const st = db.prepare(sql);
    const o = {
      bind(...a) { args = a; return o; },
      async first() { return st.get(...args) ?? null; },
      async run() { return st.run(...args); },
      async all() { return { results: st.all(...args) }; }
    };
    return o;
  }
};
const env = { DB: D1, ALLOW_ORIGINS: 'https://manuialeaso.github.io' };
const ORIGIN = 'https://manuialeaso.github.io';
const call = async (method, p, body, origin = ORIGIN, ip = '1.2.3.4') => {
  const headers = { 'cf-connecting-ip': ip };
  if (origin) headers.origin = origin;
  if (body) headers['content-type'] = 'application/json';
  const res = await handle(new Request('https://hb.example' + p, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, data: res.status === 204 ? {} : await res.json(), cors: res.headers.get('access-control-allow-origin') };
};

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };

// 跨站限制
ok((await call('POST', '/hello', {}, 'https://evil.example')).status === 403, '未允許的網站被擋');
ok((await call('OPTIONS', '/beat', null)).cors === ORIGIN, 'CORS 預檢回傳允許的網址');
ok((await call('POST', '/hello', {}, 'http://localhost:8000')).status === 200, 'localhost 允許');

// 加入＋心跳
const a = (await call('POST', '/hello', {})).data, b = (await call('POST', '/hello', {}, ORIGIN, '5.6.7.8')).data;
ok(a.uid && a.token, '發身分');
let r = await call('POST', '/beat', { uid: a.uid, token: a.token, name: 'PLM', cls: 'royal', lv: 150 });
ok(r.status === 200 && r.data.online === 1 && r.data.roster[0].name === 'PLM', '心跳後在線 1 人');
ok((await call('POST', '/beat', { uid: a.uid, token: 'bad', name: 'PLM', cls: 'royal', lv: 150 })).status === 401, 'token 錯誤被擋');
ok((await call('POST', '/beat', { uid: b.uid, token: b.token, name: '', cls: 'royal', lv: 1 })).status === 400, '空名稱被擋');
ok((await call('POST', '/beat', { uid: b.uid, token: b.token, name: 'X', cls: 'ninja', lv: 1 })).status === 400, '未知職業被擋');
ok((await call('POST', '/beat', { uid: b.uid, token: b.token, name: '一二三四五六七八九十十一十二十三', cls: 'mage', lv: 1 })).status === 400, '名稱超過 12 字被擋');

// 聊天
ok((await call('POST', '/say', { uid: b.uid, token: b.token, text: 'hi' })).status === 409, '沒心跳不能說話');
r = await call('POST', '/say', { uid: a.uid, token: a.token, text: '  大家好\u0000  ' });
ok(r.status === 200 && r.data.lastId === 1, '說話成功');
ok((await call('POST', '/say', { uid: a.uid, token: a.token, text: '再一句' })).status === 429, '5 秒內不能連發');
ok((await call('POST', '/say', { uid: a.uid, token: a.token, text: 'x'.repeat(81) })).status === 400, '超過 80 字被擋');
const f = await call('GET', '/feed?after=0', null);
ok(f.status === 200 && f.data.messages.length === 1 && f.data.messages[0].text === '大家好' && f.data.messages[0].name === 'PLM', '讀到訊息（控制字元已清掉）');
ok((await call('GET', '/feed?after=1', null)).data.messages.length === 0, 'after 之後沒有新訊息');

// 加入頻率限制（同 IP 一小時 10 次）
let last;
for (let i = 0; i < 12; i++) last = await call('POST', '/hello', {}, ORIGIN, '9.9.9.9');
ok(last.status === 429, '同 IP 加入太頻繁被擋');

// 離開
ok((await call('POST', '/leave', { uid: a.uid, token: a.token })).status === 200, '離開');
r = await call('POST', '/beat', { uid: b.uid, token: b.token, name: 'B', cls: 'elf', lv: 30 });
ok(r.data.online === 1 && r.data.roster[0].name === 'B', '離開後名冊剩下另一人');

console.log('✅ 旅人頻道後端：' + pass + ' 項通過');
