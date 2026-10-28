/* ============================================================================
 * afk-heartbeat.js — 旅人頻道（心跳聊天，玩家 2026-10-27 指定）
 *
 * 真人玩家之間的聊天，跟世界頻道（NPC 閒聊）分開：世界頻道標題旁多一顆「💬 旅人」專屬按鈕，
 * 打開是獨立的聊天視窗（字體 14px、遊戲原生的炭灰面板＋銅邊）。
 *   ‧由網頁直接統整（玩家 2026-10-27）：網站設好伺服器（DEFAULT_API）後，所有玩家進遊戲就自動連上，不用註冊或設定；
 *     每 5 分鐘送一次心跳：角色名、職業、等級（不送裝備、地圖、存檔）。不想出現在名冊可以按「隱身」
 *   ‧10 分鐘內有心跳的算在線；視窗打開時每 15 秒抓新訊息，關著時只靠心跳順便看有沒有新訊息（按鈕亮點）
 *   ‧每則最多 80 字；同一人 5 秒一句、一小時 60 句（伺服器把關）
 * 後端：backend/heartbeat（Cloudflare Worker＋D1，免費額度夠用）。部署後把網址寫進下方 DEFAULT_API（「伺服器設定」只給管理者測試用，網址帶 ?hbadmin 才看得到）。
 * 沒設定伺服器時只顯示說明，不會連任何地方。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'heartbeat', name: '旅人頻道（真人聊天）', desc: '世界頻道旁的「💬 旅人」按鈕：跟其他真人玩家聊天；要自己加入才會連線', group: '遊戲介面' });
  var on = function () { return !T || T.enabled('heartbeat'); };

  var DEFAULT_API = '';   // 部署好 Worker 後可以把網址寫在這裡（所有人預設連這台）；也可以在視窗裡另外設定
  var K = { api: 'afk_hb_api', id: 'afk_hb_id', join: 'afk_hb_join', seen: 'afk_hb_seen' };
  var BEAT_MS = 5 * 60 * 1000, FEED_MS = 15000;
  var CLS = { royal: ['王族', '#e8c48a'], knight: ['騎士', '#e57f6c'], elf: ['妖精', '#9bc48a'], mage: ['法師', '#8fb4e8'], dark: ['黑暗妖精', '#b59be0'], dragon: ['龍騎士', '#e09a5b'], illusion: ['幻術士', '#d38fc4'], warrior: ['戰士', '#c9b28a'] };
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var api = function () { var u = get(K.api) || DEFAULT_API || ''; return u.replace(/\/+$/, ''); };
  var ident = function () { try { var o = JSON.parse(get(K.id) || 'null'); return o && o.uid && o.token ? o : null; } catch (e) { return null; } };
  // 玩家 2026-10-27：由網頁直接統整，不用自己加入——有伺服器就自動連上；玩家可以選「隱身」（K.join='0'）不出現在名冊
  var joined = function () { return get(K.join) !== '0' && !!api(); };
  var admin = function () { try { return /[?&]hbadmin\b/.test(location.search) || !!get(K.api); } catch (e) { return false; } };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var me = function () { var p = P(); return p ? { name: String(p.name || '旅人').slice(0, 12), cls: CLS[p.cls] ? p.cls : 'knight', lv: Math.max(1, Math.min(999, Math.floor(Number(p.lv) || 1))) } : null; };

  var st = { online: null, roster: [], msgs: [], lastId: 0, err: '', open: false, feedT: 0, beatT: 0, layer: null, sending: false };

  function req(method, path, body) {
    var u = api(); if (!u) return Promise.reject(new Error('尚未設定伺服器'));
    var o = { method: method, headers: {} };
    if (body) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(u + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || ('連線失敗（' + r.status + '）')); e.status = r.status; throw e; } return d; });
    });
  }
  function ensureId() {
    var id = ident(); if (id) return Promise.resolve(id);
    return req('POST', '/hello', {}).then(function (d) { set(K.id, JSON.stringify({ uid: d.uid, token: d.token })); return ident(); });
  }
  function beat() {
    if (!on() || !joined()) return Promise.resolve();
    var m = me(); if (!m) return Promise.resolve();
    return ensureId().then(function (id) {
      return req('POST', '/beat', { uid: id.uid, token: id.token, name: m.name, cls: m.cls, lv: m.lv });
    }).then(function (d) {
      st.online = d.online; st.roster = d.roster || []; st.err = '';
      var seen = Number(get(K.seen) || 0); if (d.lastId > seen && !st.open) dot(true);
      paint();
    }).catch(function (e) {
      if (e.status === 401) set(K.id, null);   // 身分失效 → 下次重新領
      st.err = e.message; paint();
    });
  }
  function feed() {
    if (!api()) return Promise.resolve();
    return req('GET', '/feed?after=' + st.lastId).then(function (d) {
      (d.messages || []).forEach(function (m) { if (m.id > st.lastId) { st.msgs.push(m); st.lastId = m.id; } });
      if (st.msgs.length > 200) st.msgs = st.msgs.slice(-200);
      if (d.online != null) st.online = d.online;
      set(K.seen, String(st.lastId)); dot(false); st.err = ''; paint(true);
    }).catch(function (e) { st.err = e.message; paint(); });
  }
  function say(text) {
    var id = ident(); if (!id || st.sending) return;
    st.sending = true; paint();
    req('POST', '/say', { uid: id.uid, token: id.token, text: text }).then(function () {
      var inp = document.getElementById('afk-hb-input'); if (inp) inp.value = '';
      return feed();
    }).catch(function (e) {
      if (e.status === 409) return beat().then(function () { st.err = '已重新連線，請再送一次。'; paint(); });
      st.err = e.message; paint();
    }).then(function () { st.sending = false; paint(); });
  }
  function startBeat() { clearInterval(st.beatT); st.beatT = 0; if (joined()) { beat(); st.beatT = setInterval(beat, BEAT_MS); } }
  function join() {
    set(K.join, '1'); st.err = '';
    startBeat(); setTimeout(feed, 800); paint();
  }
  function leave() {
    var id = ident(); set(K.join, '0'); clearInterval(st.beatT); st.beatT = 0;
    if (id && api()) req('POST', '/leave', { uid: id.uid, token: id.token }).catch(function () {});
    st.roster = []; paint();
  }

  // ── 介面 ──
  function css() {
    if (document.getElementById('afk-hb-css')) return;
    var PANEL = 'linear-gradient(180deg,var(--lineage-panel,#302f39) 0%,#2a2933 55%,var(--lineage-panel-deep,#24232b) 100%)';
    var s = document.createElement('style'); s.id = 'afk-hb-css';
    s.textContent = [
      '#afk-hb-btn{position:relative;margin-left:8px;padding:2px 10px;font-size:13px;font-weight:700;border-radius:.25rem;border:1px solid #765036;background:linear-gradient(180deg,#332c2c 0%,#211e22 55%,#17161a 100%);color:#f1ede8;cursor:pointer;white-space:nowrap;line-height:1.6}',
      '#afk-hb-btn:hover{border-color:#a97a50}',
      '#afk-hb-btn i{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:#e8c48a;box-shadow:0 0 6px #e8c48a;display:none}#afk-hb-btn.unread i{display:block}',
      '#afk-hb-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9650;background:rgba(8,6,8,.72);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}',
      '#afk-hb-modal.open{display:flex}',
      '.afk-hb-box{width:min(720px,100%);height:min(560px,100%);display:flex;flex-direction:column;background:' + PANEL + ';border:2px solid #765036;border-radius:.35rem;box-shadow:inset 0 0 0 1px rgba(12,10,12,.78),inset 0 1px rgba(220,177,116,.14),0 10px 26px rgba(0,0,0,.7);color:#ddd8d2;font-size:14px;line-height:1.6}',
      '.afk-hb-head{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #805839;background:linear-gradient(180deg,#302a29 0%,#211e22 48%,#17161b 100%)}',
      '.afk-hb-head b{color:#e8c48a;font-size:15.5px;letter-spacing:.06em;text-shadow:1px 1px 0 #000}',
      '.afk-hb-head span{color:#b3aa9e;font-size:12.5px}',
      '.afk-hb-head button{margin-left:auto;min-width:36px;min-height:32px;border:1px solid #765036;border-radius:.25rem;background:linear-gradient(180deg,#332c2c,#17161a);color:#f1ede8;cursor:pointer}',
      '.afk-hb-body{flex:1;min-height:0;display:flex}',
      '.afk-hb-log{flex:1;min-width:0;overflow-y:auto;padding:8px 12px;overscroll-behavior:contain}',
      '.afk-hb-msg{padding:2px 0;word-break:break-word}.afk-hb-msg time{color:#7d756b;font-size:11.5px;margin-right:6px;font-variant-numeric:tabular-nums}',
      '.afk-hb-msg .n{font-weight:700;margin-right:4px}.afk-hb-msg .lv{color:#8f867b;font-size:11.5px;margin-right:6px}',
      '.afk-hb-side{flex:0 0 170px;border-left:1px solid #3d2a20;overflow-y:auto;padding:8px 10px;background:rgba(0,0,0,.12)}',
      '.afk-hb-side h5{margin:0 0 6px;color:#e8c48a;font-size:12.5px;letter-spacing:.06em}',
      '.afk-hb-who{display:flex;gap:6px;align-items:baseline;font-size:12.5px;padding:1px 0}.afk-hb-who em{font-style:normal;color:#8f867b;font-size:11px;margin-left:auto}',
      '.afk-hb-foot{display:flex;gap:6px;padding:8px 10px;border-top:1px solid #3d2a20;align-items:center;flex-wrap:wrap}',
      '.afk-hb-foot input{flex:1;min-width:0;font-size:14px;padding:6px 10px;border-radius:.25rem;border:1px solid #765036;background:#17161b;color:#ece6dc;outline:none}',
      '.afk-hb-foot input:focus{border-color:#a97a50}',
      '.afk-hb-box button.go{min-height:34px;padding:4px 14px;font-size:13.5px;font-weight:700;border-radius:.25rem;border:1px solid #765036;background:linear-gradient(180deg,#704b34 0%,#3f2c26 58%,#231b1c 100%);color:#fff3df;cursor:pointer}',
      '.afk-hb-box button.sub{min-height:30px;padding:2px 10px;font-size:12.5px;border-radius:.25rem;border:1px solid #4e3526;background:#1b181c;color:#b3aa9e;cursor:pointer}',
      '.afk-hb-box button[disabled]{opacity:.45;cursor:not-allowed}',
      '.afk-hb-note{padding:14px 16px;color:#b3aa9e;font-size:13.5px;line-height:1.8;overflow-y:auto}.afk-hb-note b{color:#e8c48a}.afk-hb-note code{color:#ece6dc;background:#17161b;padding:0 4px;border-radius:3px}',
      '.afk-hb-note input{width:100%;box-sizing:border-box;margin:6px 0;font-size:13.5px;padding:6px 10px;border-radius:.25rem;border:1px solid #765036;background:#17161b;color:#ece6dc}',
      '.afk-hb-err{color:#e57f6c;font-size:12.5px;padding:0 12px 6px}',
      '.afk-hb-empty{color:#7d756b;text-align:center;padding:30px 0}',
      '@media (max-width:600px){.afk-hb-side{display:none}.afk-hb-box{height:100%}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function dot(onoff) { var b = document.getElementById('afk-hb-btn'); if (b) b.classList.toggle('unread', !!onoff); }
  function btn() {
    if (!on() || document.getElementById('afk-hb-btn')) return;
    var head = document.querySelector('#syslog-panel .panel-header'); if (!head) return;
    css();
    var b = document.createElement('button'); b.id = 'afk-hb-btn'; b.type = 'button'; b.title = '旅人頻道：跟其他真人玩家聊天';
    b.innerHTML = '💬 旅人<i></i>';
    b.addEventListener('click', open);
    var first = head.querySelector('span'); if (first && first.nextSibling) head.insertBefore(b, first.nextSibling); else head.appendChild(b);
  }
  function modal() {
    var m = document.getElementById('afk-hb-modal'); if (m) return m;
    css();
    m = document.createElement('div'); m.id = 'afk-hb-modal';
    m.innerHTML = '<div class="afk-hb-box" role="dialog" aria-modal="true" aria-label="旅人頻道"><div class="afk-hb-head"><b>💬 旅人頻道</b><span id="afk-hb-count"></span><button type="button" id="afk-hb-x" aria-label="關閉旅人頻道">✕</button></div><div id="afk-hb-main" style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.id === 'afk-hb-x') { close(); return; }
      var t = e.target.closest('[data-hb]'); if (!t || t.disabled) return;
      var act = t.getAttribute('data-hb');
      if (act === 'join') join();
      else if (act === 'leave') leave();
      else if (act === 'send') { var inp = document.getElementById('afk-hb-input'); var v = inp && inp.value.trim(); if (v) say(v); }
      else if (act === 'cfg') { st.cfg = !st.cfg; paint(); }
      else if (act === 'save') { var u = (document.getElementById('afk-hb-url') || {}).value || ''; u = u.trim(); if (u && !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)/.test(u)) { st.err = '網址要以 https:// 開頭。'; paint(); return; } set(K.api, u || null); set(K.id, null); st.cfg = false; st.msgs = []; st.lastId = 0; st.err = ''; startBeat(); if (u) feed(); paint(); }
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'afk-hb-input' && !e.isComposing) { e.preventDefault(); var v = e.target.value.trim(); if (v) say(v); } });
    return m;
  }
  function msgHTML(x) {
    var c = CLS[x.cls] || ['', '#ddd8d2'], d = new Date(x.at), tm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return '<div class="afk-hb-msg"><time>' + tm + '</time><span class="n" style="color:' + c[1] + '">' + esc(x.name) + '</span><span class="lv">' + esc(c[0]) + ' Lv' + esc(x.lv) + '</span>' + esc(x.text) + '</div>';
  }
  function paint(scroll) {
    var cnt = document.getElementById('afk-hb-count');
    if (cnt) cnt.textContent = st.online != null ? '（近 10 分鐘在線 ' + st.online + ' 人）' : '';
    var main = document.getElementById('afk-hb-main'); if (!main || !st.open) return;
    var err = st.err ? '<div class="afk-hb-err">' + esc(st.err) + '</div>' : '';
    if (!api() && !st.cfg) {
      main.innerHTML = '<div class="afk-hb-note">'
        + '<p>旅人頻道是<b>真人玩家</b>之間的聊天（世界頻道那邊是 NPC 閒聊）。</p>'
        + '<p><b>還沒開通</b>：網站的旅人伺服器架好之後，所有玩家打開遊戲就會<b>自動連上</b>，不需要註冊或任何設定。</p>'
        + (admin() ? '<p style="display:flex;gap:6px"><button type="button" class="sub" data-hb="cfg">伺服器設定（管理用）</button></p>' : '') + '</div>' + err;
      return;
    }
    if (st.cfg) {
      main.innerHTML = '<div class="afk-hb-note">'
        + '<p>管理用：旅人伺服器是免費的 Cloudflare Worker＋D1，步驟寫在 <code>backend/heartbeat/README.md</code>。正式上線請把網址寫進 afk-heartbeat.js 的 DEFAULT_API，所有玩家就會自動連上；這裡填的只對這台瀏覽器有效（測試用）。</p>'
        + '<p>部署好之後，把 Worker 的網址貼在這裡：</p>'
        + '<input id="afk-hb-url" type="url" placeholder="https://lineage-heartbeat.你的帳號.workers.dev" value="' + esc(get(K.api) || DEFAULT_API) + '">'
        + '<p style="display:flex;gap:6px"><button type="button" class="go" data-hb="save">儲存</button>' + (api() ? '<button type="button" class="sub" data-hb="cfg">取消</button>' : '') + '</p>'
        + '<p style="font-size:12.5px">網址只存在這台瀏覽器。換網址會重新領一個旅人身分。</p></div>' + err;
      return;
    }
    if (!joined()) {
      main.innerHTML = '<div class="afk-hb-note">'
        + '<p>你目前是<b>隱身</b>：不會出現在旅人名冊，也不能說話。</p>'
        + '<p>回到頻道後，每 <b>5 分鐘</b>會送一次心跳：<b>角色名、職業、等級</b>（不送裝備、地圖或存檔）。</p>'
        + '<p style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="go" data-hb="join"' + (P() ? '' : ' disabled') + '>回到頻道</button>' + (admin() ? '<button type="button" class="sub" data-hb="cfg">伺服器設定（管理用）</button>' : '') + '</p>'
        + (P() ? '' : '<p>請先進入遊戲（選好角色）。</p>') + '</div>' + err;
      return;
    }
    var keep = document.getElementById('afk-hb-input'), draft = keep ? keep.value : '', focus = keep && document.activeElement === keep;
    var log = document.getElementById('afk-hb-log'), atBottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    main.innerHTML = '<div class="afk-hb-body"><div class="afk-hb-log" id="afk-hb-log">'
      + (st.msgs.length ? st.msgs.map(msgHTML).join('') : '<div class="afk-hb-empty">還沒有人說話，打個招呼吧。</div>') + '</div>'
      + '<div class="afk-hb-side"><h5>在線旅人</h5>' + (st.roster.length ? st.roster.map(function (r) { var c = CLS[r.cls] || ['', '#ddd8d2']; return '<div class="afk-hb-who"><span style="color:' + c[1] + '">' + esc(r.name) + '</span><em>Lv' + esc(r.lv) + '</em></div>'; }).join('') : '<div class="afk-hb-who" style="color:#7d756b">（等待心跳）</div>') + '</div></div>'
      + err
      + '<div class="afk-hb-foot"><input id="afk-hb-input" maxlength="80" autocomplete="off" placeholder="對旅人們說…（Enter 送出，最多 80 字）"><button type="button" class="go" data-hb="send"' + (st.sending ? ' disabled' : '') + '>送出</button>'
      + '<button type="button" class="sub" data-hb="leave" title="不出現在名冊、不送心跳">隱身</button>' + (admin() ? '<button type="button" class="sub" data-hb="cfg">伺服器設定</button>' : '') + '</div>';
    var inp = document.getElementById('afk-hb-input'); if (inp) { inp.value = draft; if (focus) inp.focus(); }
    var lg = document.getElementById('afk-hb-log'); if (lg && (scroll || atBottom)) lg.scrollTop = lg.scrollHeight;
  }
  function open() {
    if (!on()) return;
    var m = modal(); m.classList.add('open'); st.open = true; dot(false); paint(true);
    if (joined()) { feed(); clearInterval(st.feedT); st.feedT = setInterval(function () { if (!document.hidden) feed(); }, FEED_MS); }
    st.layer = (W.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(hide) : null;
    var inp = document.getElementById('afk-hb-input'); if (inp) inp.focus();
  }
  function hide() { st.open = false; st.layer = null; clearInterval(st.feedT); st.feedT = 0; var m = document.getElementById('afk-hb-modal'); if (m) m.classList.remove('open'); }
  function close() { if (st.layer && W.AFK_UI) AFK_UI.closeLayer(st.layer); else hide(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open) { e.preventDefault(); close(); } });

  var boot = function () { btn(); if (joined()) setTimeout(startBeat, 10000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  W.AFK_HEARTBEAT = { open: open, close: close, beat: beat, feed: feed, state: st, api: api };
})();
