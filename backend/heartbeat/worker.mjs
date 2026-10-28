// 放置天堂・旅人頻道（心跳聊天）後端 —— Cloudflare Worker + D1
//
// 只做三件事：
//   1. 心跳：玩家「加入旅人頻道」後，每 5 分鐘回報一次「名稱／職業／等級」，10 分鐘內有回報的算在線
//   2. 聊天：每則最多 80 字，同一人 5 秒內只能說一句、一小時最多 60 句；訊息保留 3 天、最多 2,000 則
//   3. 名冊：回傳最近 10 分鐘在線的旅人（最多 50 位）
// 身分：第一次加入時發一組 uid＋token（token 只存雜湊），不需要註冊或登入。
// 部署步驟見同資料夾 README.md。
const CLASSES = new Set(['royal', 'knight', 'elf', 'mage', 'dark', 'dragon', 'illusion', 'warrior']);
const ONLINE_MS = 10 * 60 * 1000;
const KEEP_MS = 3 * 24 * 3600 * 1000;
const KEEP_N = 2000;
const SAY_GAP_MS = 5000, SAY_PER_HOUR = 60, HELLO_PER_HOUR = 10;

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clean = (v, max, label) => {
  if (typeof v !== 'string') fail(400, label + '格式不正確。');
  const t = v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').trim();
  if (!t) fail(400, label + '不能是空的。');
  if ([...t].length > max) fail(400, label + '最多 ' + max + ' 字。');
  return t;
};
const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('');
const one = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];

function allowOrigin(origin, env) {
  if (!origin) return '';
  const list = String(env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*') || list.includes(origin)) return origin;
  try { const u = new URL(origin); if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return origin; } catch (e) {}
  return '';
}
const json = (data, status, origin) => new Response(status === 204 ? null : JSON.stringify(data), {
  status: status || 200,
  headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    origin ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' } : {})
});
async function body(req) {
  if (!(req.headers.get('content-type') || '').startsWith('application/json')) fail(415, '請使用 JSON。');
  const text = await req.text();
  if (text.length > 2000) fail(413, '內容太長。');
  try { const o = JSON.parse(text); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; return o; } catch (e) { fail(400, 'JSON 格式不正確。'); }
}
async function auth(env, b) {
  if (typeof b.uid !== 'string' || typeof b.token !== 'string' || b.uid.length > 64 || b.token.length > 128) fail(401, '身分不正確，請重新加入。');
  const row = await one(env, 'SELECT uid, token_hash, banned FROM travelers WHERE uid=?', b.uid);
  if (!row || row.token_hash !== await sha(b.token)) fail(401, '身分不正確，請重新加入。');
  if (row.banned) fail(403, '這個身分已被停用。');
  return row;
}
async function roster(env, now) {
  const rows = await all(env, 'SELECT name, cls, lv, last_seen FROM travelers WHERE banned=0 AND last_seen>? ORDER BY last_seen DESC LIMIT 50', now - ONLINE_MS);
  const count = (await one(env, 'SELECT COUNT(*) AS n FROM travelers WHERE banned=0 AND last_seen>?', now - ONLINE_MS)).n;
  const last = (await one(env, 'SELECT MAX(id) AS id FROM messages')).id || 0;
  return { online: count, roster: rows.map(r => ({ name: r.name, cls: r.cls, lv: r.lv, ago: Math.max(0, Math.round((now - r.last_seen) / 1000)) })), lastId: last, serverTime: now };
}

export async function handle(req, env) {
  const url = new URL(req.url), origin = allowOrigin(req.headers.get('origin'), env), now = Date.now();
  if (req.method === 'OPTIONS') return json({}, 204, origin);
  try {
    if (req.headers.get('origin') && !origin) fail(403, '這個網站沒有被允許連線。');
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/hello' && req.method === 'POST') {
      const ip = await sha('ip:' + (req.headers.get('cf-connecting-ip') || 'local'));
      const n = (await one(env, 'SELECT COUNT(*) AS n FROM travelers WHERE ip_hash=? AND created_at>?', ip, now - 3600000)).n;
      if (n >= HELLO_PER_HOUR) fail(429, '加入太頻繁，請一小時後再試。');
      const uid = crypto.randomUUID(), token = crypto.randomUUID() + crypto.randomUUID();
      await run(env, 'INSERT INTO travelers (uid, token_hash, ip_hash, name, cls, lv, created_at, last_seen, banned) VALUES (?,?,?,?,?,?,?,?,0)', uid, await sha(token), ip, '旅人', 'knight', 1, now, 0);
      return json({ uid, token }, 200, origin);
    }
    if (path === '/beat' && req.method === 'POST') {
      const b = await body(req); await auth(env, b);
      const name = clean(b.name, 12, '名稱');
      if (!CLASSES.has(b.cls)) fail(400, '職業不正確。');
      const lv = Math.floor(Number(b.lv)); if (!(lv >= 1 && lv <= 999)) fail(400, '等級不正確。');
      await run(env, 'UPDATE travelers SET name=?, cls=?, lv=?, last_seen=? WHERE uid=?', name, b.cls, lv, now, b.uid);
      return json(await roster(env, now), 200, origin);
    }
    if (path === '/leave' && req.method === 'POST') {
      const b = await body(req); await auth(env, b);
      await run(env, 'UPDATE travelers SET last_seen=0 WHERE uid=?', b.uid);
      return json({ ok: true }, 200, origin);
    }
    if (path === '/feed' && req.method === 'GET') {
      const after = Math.max(0, Math.floor(Number(url.searchParams.get('after')) || 0));
      const rows = after
        ? await all(env, 'SELECT id, name, cls, lv, text, at FROM messages WHERE id>? AND at>? ORDER BY id ASC LIMIT 50', after, now - KEEP_MS)
        : (await all(env, 'SELECT id, name, cls, lv, text, at FROM messages WHERE at>? ORDER BY id DESC LIMIT 30', now - KEEP_MS)).reverse();
      const count = (await one(env, 'SELECT COUNT(*) AS n FROM travelers WHERE banned=0 AND last_seen>?', now - ONLINE_MS)).n;
      return json({ messages: rows, online: count, serverTime: now }, 200, origin);
    }
    if (path === '/say' && req.method === 'POST') {
      const b = await body(req); await auth(env, b);
      const text = clean(b.text, 80, '訊息');
      const me = await one(env, 'SELECT name, cls, lv, last_seen FROM travelers WHERE uid=?', b.uid);
      if (!me.last_seen || me.last_seen < now - ONLINE_MS) fail(409, '請先加入旅人頻道（心跳過期）。');
      const prev = await one(env, 'SELECT MAX(at) AS at FROM messages WHERE uid=?', b.uid);
      if (prev && prev.at && now - prev.at < SAY_GAP_MS) fail(429, '說話太快了，請等 5 秒。');
      const hour = (await one(env, 'SELECT COUNT(*) AS n FROM messages WHERE uid=? AND at>?', b.uid, now - 3600000)).n;
      if (hour >= SAY_PER_HOUR) fail(429, '這一小時說太多了，休息一下吧。');
      await run(env, 'INSERT INTO messages (uid, name, cls, lv, text, at) VALUES (?,?,?,?,?,?)', b.uid, me.name, me.cls, me.lv, text, now);
      if (Math.random() < 0.05) {
        await run(env, 'DELETE FROM messages WHERE at<?', now - KEEP_MS);
        await run(env, 'DELETE FROM messages WHERE id <= (SELECT MAX(id) FROM messages) - ?', KEEP_N);
      }
      const last = (await one(env, 'SELECT MAX(id) AS id FROM messages')).id || 0;
      return json({ ok: true, lastId: last }, 200, origin);
    }
    fail(404, '找不到這個功能。');
  } catch (e) {
    return json({ error: e.status ? e.message : '伺服器發生錯誤。' }, e.status || 500, origin);
  }
}

export default { fetch: (req, env) => handle(req, env) };
