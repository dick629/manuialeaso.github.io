/* ============================================================================
 * afk-heartbeat.js — 旅人頻道（心跳聊天，玩家 2026-10-27 指定）
 *
 * 走路模式從世界對話框的頻道選單切換旅人，沿用同一個對話框。
 *   本機服務提供旅人身分、頻道、寄賣與討伐。更換共用資料夾時會連到該資料庫。
 */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'heartbeat', name: '旅人頻道（真人聊天）', desc: '在對話框切換到旅人頻道，可與其他玩家交談或切換隱身。', group: '遊戲介面' });
  var on = function () { return !T || T.enabled('heartbeat'); };

  var K = { id: 'afk_hb_id', join: 'afk_hb_join', seen: 'afk_hb_seen' };
  var BEAT_MS = 5 * 60 * 1000, FEED_MS = 30000;   // 11-19：15 → 30 秒（D1 每日讀取額度）
  var CLS = { royal: ['王族', '#e8c48a'], knight: ['騎士', '#e57f6c'], elf: ['妖精', '#9bc48a'], mage: ['法師', '#8fb4e8'], dark: ['黑暗妖精', '#b59be0'], dragon: ['龍騎士', '#e09a5b'], illusion: ['幻術士', '#d38fc4'], warrior: ['戰士', '#c9b28a'] };
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var api = function () { return W.LineageSite.traveler; };
  var ident = function () { try { var o = JSON.parse(get(K.id) || 'null'); return o && o.uid && o.token ? o : null; } catch (e) { return null; } };
  // 玩家 2026-10-27：由網頁直接統整，不用自己加入——有伺服器就自動連上；玩家可以選「隱身」（K.join='0'）不出現在名冊
  var joined = function () { return get(K.join) !== '0' && !!api(); };
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
  var issuing = null;
  // Web Storage changes can reach another renderer after the Web Lock is released.
  // Publish the first join transactionally for overlapping tabs. Saved identities still take precedence.
  var firstJoinStore;
  async function firstJoin(update) {
    try {
      if (!firstJoinStore) firstJoinStore = new Promise(function (resolve, reject) {
        var open = indexedDB.open('giran-traveler-first-join', 1);
        open.onupgradeneeded = function () { open.result.createObjectStore('join'); };
        open.onerror = function () { reject(open.error); };
        open.onsuccess = function () {
          var db = open.result;
          db.onversionchange = function () { db.close(); firstJoinStore = null; };
          resolve(db);
        };
      });
      var db = await firstJoinStore;
      return await new Promise(function (resolve, reject) {
        var tx = db.transaction('join', 'readwrite'), store = tx.objectStore('join');
        var request = store.get('initial'), result;
        request.onsuccess = function () { result = update(request.result, store); };
        tx.oncomplete = function () { resolve(result); };
        tx.onabort = function () { reject(tx.error); };
      });
    } catch (_) { firstJoinStore = null; return null; }
  }
  function ensureId() {
    var id = ident(); if (id) return Promise.resolve(id);
    var started = Date.now();
    function recent(row) { return row && row.at >= started - 1000 ? row.id : null; }
    async function create() {
      var current = ident();
      if (current) return current;
      current = await firstJoin(recent);
      if (!current) {
        var reply = await req('POST', '/hello', {});
        var candidate = {uid:reply.uid, token:reply.token};
        current = await firstJoin(function (row, store) {
          var existing = recent(row);
          if (existing) return existing;
          store.put({at:Date.now(), id:candidate}, 'initial');
          return candidate;
        }) || candidate;
      }
      localStorage.setItem(K.id, JSON.stringify(current));
      return current;
    }
    if (!issuing) issuing = (navigator.locks ? navigator.locks.request('giran-traveler-identity', create) : create()).finally(function () { issuing = null; });
    return issuing;
  }
  function beat() {
    if (!on() || !joined()) return Promise.resolve();
    var m = me(), sent; if (!m) return Promise.resolve();
    return ensureId().then(function (id) {
      sent = id;
      return req('POST', '/beat', { uid: id.uid, token: id.token, name: m.name, cls: m.cls, lv: m.lv });
    }).then(function (d) {
      st.online = d.online; st.roster = d.roster || []; st.err = '';
      var seen = Number(get(K.seen) || 0); if (d.lastId > seen && !st.open) dot(true);
      paint();
    }).catch(async function (e) {
      if (e.status === 401 && sent && ident()?.uid === sent.uid) {
        await firstJoin(function (row, store) {
          if (row?.id.uid === sent.uid) store.delete('initial');
        });
        if (ident()?.uid === sent.uid) set(K.id, null);
      }
      st.err = e.message; paint();
    });
  }
  function feed() {
    if (!api() || !joined()) return Promise.resolve();
    return req('GET', '/feed?after=' + st.lastId).then(function (d) {
      (d.messages || []).forEach(function (m) { if (m.id > st.lastId) { st.msgs.push(m); st.lastId = m.id; } });
      if (st.msgs.length > 200) st.msgs = st.msgs.slice(-200);
      if (d.online != null) st.online = d.online;
      set(K.seen, String(st.lastId)); dot(false); st.err = ''; paint();
    }).catch(function (e) { st.err = e.message; paint(); });
  }
  function say(text) {
    var id = ident(); if (!id || st.sending) return;
    st.sending = true; paint();
    req('POST', '/say', { uid: id.uid, token: id.token, text: text }).then(function () {
      var inp = document.getElementById('afk-hb-input'); if(inp && inp.value.trim()===text)inp.value='';
      return feed().then(function(){var log=document.getElementById('afk-hb-log');if(log)log.scrollTop=log.scrollHeight;});
    }).catch(function (e) {
      if (e.status === 409) return beat().then(function () { st.err = '已重新連線，請再送一次。'; paint(); });
      st.err = e.message; paint();
    }).then(function () { st.sending = false; paint(); });
  }
  function startBeat() { clearInterval(st.beatT); st.beatT = 0; if (joined()) { beat(); st.beatT = setInterval(beat, BEAT_MS); } }
  function updateFeed() {
    clearInterval(st.feedT); st.feedT=0;
    if(!st.open || !joined())return;
    feed();
    st.feedT=setInterval(function(){if(!document.hidden)feed();},FEED_MS);
  }
  function join() {
    set(K.join, '1'); st.err = '';
    startBeat(); updateFeed(); paint();
  }
  function leave() {
    var id = ident(); set(K.join, '0'); clearInterval(st.beatT); st.beatT = 0;
    if (id && api()) req('POST', '/leave', { uid: id.uid, token: id.token }).catch(function () {});
    st.roster = []; updateFeed(); paint();
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
      '#afk-hb-modal #afk-hb-main{flex:1;min-height:0;display:flex;flex-direction:column}',   // 11-27：少了這層，訊息列表會撐出視窗底部
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
  function bindChannel(m) {
    m.addEventListener('click', function (e) {
      if ((m.id==='afk-hb-modal' && e.target===m) || e.target.id==='afk-hb-x') { close(); return; }
      var t = e.target.closest('[data-hb]'); if (!t || t.disabled) return;
      var act = t.getAttribute('data-hb');
      if (act === 'join') join();
      else if (act === 'leave') leave();
      else if (act === 'diag') { if (typeof W.__afkDiagReport !== 'function') return; if (!confirm('把這個角色目前的狀態摘要（等級、裝備強化、面板數值、所在地圖、最近打怪的命中與傷害）存到本機旅人資料庫，供你查問題。確定送出？')) return; t.disabled = true; W.__afkDiagReport().then(function (r) { st.err = ''; alert(r || '已送出，謝謝！'); }).catch(function (er) { st.err = '回報失敗：' + (er && er.message || er); paint(); }).then(function () { t.disabled = false; }); }
      else if (act === 'send') { var inp = document.getElementById('afk-hb-input'); var v = inp && inp.value.trim(); if (v) say(v); }
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'afk-hb-input' && !e.isComposing) { e.preventDefault(); var v = e.target.value.trim(); if (v) say(v); } });
  }
  function surface() {
    var inline=document.getElementById('ga-traveler');
    if(inline){
      if(!inline.querySelector('#afk-hb-main')){
        css();
        inline.innerHTML='<div class="ga-traveler-presence"><span id="afk-hb-count"></span><button type="button" data-roster aria-expanded="false">名冊</button></div><div id="afk-hb-main"></div>';
        inline.querySelector('[data-roster]').onclick=function(e){var shown=inline.classList.toggle('show-roster');e.currentTarget.setAttribute('aria-expanded',String(shown));};
        bindChannel(inline);
      }
      return inline;
    }
    var m=document.getElementById('afk-hb-modal'); if(m)return m;
    css();m=document.createElement('div');m.id='afk-hb-modal';
    m.innerHTML='<div class="afk-hb-box" role="dialog" aria-label="旅人頻道"><div class="afk-hb-head"><b>旅人頻道</b><span id="afk-hb-count"></span><button type="button" id="afk-hb-x" aria-label="關閉旅人頻道">×</button></div><div id="afk-hb-main"></div></div>';
    document.body.appendChild(m);bindChannel(m);return m;
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
    if (!joined()) {
      main.innerHTML = '<div class="afk-hb-note">'
        + '<p>你目前是<b>隱身</b>：不會出現在旅人名冊，也不能說話。</p>'
        + '<p>回到頻道後，每 <b>5 分鐘</b>會送一次心跳：<b>角色名、職業、等級</b>（不送裝備、地圖或存檔）。</p>'
        + '<p style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="go" data-hb="join"' + (P() ? '' : ' disabled') + '>回到頻道</button>' + '</p>'
        + (P() ? '' : '<p>請先進入遊戲（選好角色）。</p>') + '</div>' + err;
      return;
    }
    if (!main.querySelector('#afk-hb-input')) {
      main.innerHTML='<div class="afk-hb-body"><div class="afk-hb-log" id="afk-hb-log" role="log" aria-label="旅人訊息"></div><div class="afk-hb-side"><h5>在線旅人</h5><div data-hb-people></div></div></div>'
        + '<div class="afk-hb-err" hidden></div><div class="afk-hb-foot"><input id="afk-hb-input" maxlength="80" aria-label="旅人訊息" autocomplete="off" placeholder="對旅人們說…"><button type="button" class="go" data-hb="send">送出</button>'
        + '<button type="button" class="sub" data-hb="leave" title="不出現在名冊、不送心跳">隱身</button>'
        + (typeof W.__afkDiagReport==='function'?'<button type="button" class="sub" data-hb="diag" title="儲存角色狀態到本機資料庫">回報狀態</button>':'')+'</div>';
    }
    var log=main.querySelector('#afk-hb-log'),last=String(st.lastId);
    var bottom=log.scrollHeight-log.scrollTop-log.clientHeight<20;
    if(log.dataset.last!==last){
      var top=log.scrollTop;
      log.innerHTML=st.msgs.length?st.msgs.map(msgHTML).join(''):'<div class="afk-hb-empty">還沒有人說話，打個招呼吧。</div>';
      log.dataset.last=last;log.scrollTop=bottom?log.scrollHeight:top;
    }
    if(scroll)log.scrollTop=log.scrollHeight;
    var people=main.querySelector('[data-hb-people]'),roster=JSON.stringify(st.roster);
    if(people.dataset.roster!==roster){
      people.dataset.roster=roster;
      people.innerHTML=st.roster.map(function(r){var c=CLS[r.cls]||['','#ddd8d2'];return '<div class="afk-hb-who"><span style="color:'+c[1]+'">'+esc(r.name)+'</span><em>Lv'+esc(r.lv)+'</em></div>';}).join('')||'<div class="afk-hb-who">等待心跳</div>';
    }
    var error=main.querySelector('.afk-hb-err');error.hidden=!st.err;error.textContent=st.err||'';
    main.querySelector('[data-hb="send"]').disabled=st.sending || !ident();
  }
  function open() {
    if (!on()) return;
    if(W.GiranPanels?.traveler && !W.GiranPanels.traveler.active()){W.GiranPanels.traveler.show();return;}
    if(st.open)return;
    var m=surface(), inline=m.id==='ga-traveler';
    if(!inline)m.classList.add('open');
    st.open=true;dot(false);paint(true);
    if(joined())beat();
    updateFeed();
    st.layer = (!inline && W.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(hide) : null;
    var inp = document.getElementById('afk-hb-input'); if(inp&&!inline)inp.focus();
  }
  function hide() { st.open = false; st.layer = null; clearInterval(st.feedT); st.feedT = 0; var m = document.getElementById('afk-hb-modal'); if (m) m.classList.remove('open'); }
  function close() { if(W.GiranPanels?.traveler?.active()){W.GiranPanels.traveler.back();return;} if (st.layer && W.AFK_UI) AFK_UI.closeLayer(st.layer); else hide(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open && !document.getElementById('ga-traveler')) { e.preventDefault(); close(); } });

  var boot = function () { btn(); if (joined()) setTimeout(startBeat, 10000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  W.AFK_HEARTBEAT = { open: open, close: close, hide: hide, beat: beat, feed: feed, state: st, api: api, ident: ident, ensureId: ensureId };   // 寄賣攤、存檔轉移碼共用同一個旅人身分（afk-trade、afk-fullsave）
})();
