/* ============================================================================
 * afk-clanfix.js — 血盟資料讀不出來時自動救回（玩家 2026-11-02 22:15 回報手機出現「血盟資料無法讀取。」）
 *
 *   血盟資料（fb5_clan_state_v1）是所有角色共用的一份大字串（含 NPC 血盟名冊，可能好幾百 KB）。
 *   字串一旦壞掉（解壓失敗、被截斷），整個血盟頁、城堡、血盟增益都會失效。
 *   這裡在核心讀取失敗時：
 *     1. 先從字串裡把「你的血盟」（modes：名稱、盟主、陣營、城堡、護衛）、成員貢獻（members）、血盟經驗（xp）挖出來；
 *     2. 挖不到就用備份（每次正常讀到時，最多每分鐘備份一次這三樣，存在 fb5_clan_core_bak，很小）；
 *     3. NPC 血盟名冊壞了就重建（遊戲會自己再生成），其他照救回的資料寫回去。
 *   救回後系統訊息會說一聲；什麼都救不回才維持原本的錯誤。
 *   不改任何血盟規則。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof W._clanReadStateResult !== 'function' || typeof W._clanWriteState !== 'function' || typeof W._clanDefaultState !== 'function') return;
  var KEY = (typeof CLAN_STATE_KEY === 'string' && CLAN_STATE_KEY) ? CLAN_STATE_KEY : 'fb5_clan_state_v1', BAK = 'fb5_clan_core_bak';
  var lsGet = function (k) { try { return typeof _lsGet === 'function' ? _lsGet(k) : localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (typeof _lsSet === 'function') return _lsSet(k, v); localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  var payloadOf = function () {
    var raw = lsGet(KEY); if (raw == null) return { raw: null, text: null };
    var text = raw;
    try { if (raw.slice(0, 4) === 'LZ1:') text = LZString.decompressFromUTF16(raw.slice(4)); } catch (e) { text = null; }
    if (typeof text === 'string' && typeof _saveUnwrap === 'function') { try { var u = _saveUnwrap(text); if (u && u.payload != null) text = u.payload; } catch (e) {} }
    return { raw: raw, text: typeof text === 'string' ? text : null };
  };
  // 從（可能被截斷的）JSON 文字裡把某個欄位的物件挖出來
  var dig = function (text, field) {
    var i = text.indexOf('"' + field + '":'); if (i < 0) return undefined;
    var j = i + field.length + 3; while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== '{') { var m = /^-?\d+(\.\d+)?/.exec(text.slice(j)); return m ? Number(m[0]) : undefined; }
    var depth = 0, inStr = false, esc = false;
    for (var k = j; k < text.length; k++) {
      var c = text[k];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(j, k + 1)); } catch (e) { return undefined; } } }
    }
    return undefined;
  };
  var readBak = function () { try { var s = lsGet(BAK); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  var lastBak = 0, lastBakStr = '';
  var backup = function (st) {
    if (!st || Date.now() - lastBak < 60000) return;
    lastBak = Date.now();
    try { var s = JSON.stringify({ xp: st.xp || 0, modes: st.modes || {}, members: st.members || {}, at: Date.now() }); if (s !== lastBakStr && (st.modes && (st.modes.normal || st.modes.classic))) { lsSet(BAK, s); lastBakStr = s; } } catch (e) {}
  };
  var tried = false;
  var salvage = function () {
    var pl = payloadOf(), got = null, src = '';
    if (pl.text) {
      var modes = dig(pl.text, 'modes'), members = dig(pl.text, 'members'), xp = dig(pl.text, 'xp');
      if (modes && typeof modes === 'object' && (modes.normal || modes.classic)) { got = { modes: modes, members: members && typeof members === 'object' ? members : {}, xp: typeof xp === 'number' ? xp : 0 }; src = 'text'; }
    }
    if (!got) { var b = readBak(); if (b && b.modes && (b.modes.normal || b.modes.classic)) { got = b; src = 'backup'; } }
    if (!got) return null;
    var st = _clanDefaultState();
    st.xp = Math.max(0, Number(got.xp) || 0); st.modes = { normal: got.modes.normal || null, classic: got.modes.classic || null }; st.members = got.members || {};
    var ok = false; try { ok = _clanWriteState(st) !== false; } catch (e) { ok = false; }
    if (!ok) return null;
    W.__afkClanFix.last = { at: Date.now(), src: src };
    setTimeout(function () { try { if (typeof logSys === 'function') logSys('<span class="text-amber-300">血盟資料讀取失敗，已從' + (src === 'backup' ? '備份' : '原本的資料') + '救回你的血盟；其他 NPC 血盟名冊重新產生。</span>'); } catch (e) {} }, 0);
    return true;
  };
  var o = W._clanReadStateResult;
  W._clanReadStateResult = function () {
    var r = o.apply(this, arguments);
    try {
      if (r && r.ok) {
        // 壓縮字串壞到解不開時，核心會當成「沒有資料」回傳空的血盟——這種情況也從備份救
        var emptyModes = !(r.state && r.state.modes && (r.state.modes.normal || r.state.modes.classic));
        if (emptyModes && !tried) { var pl = payloadOf(); if (pl.raw && pl.raw.slice(0, 4) === 'LZ1:' && !pl.text) { tried = true; if (salvage()) { var r3 = o.apply(this, arguments); tried = false; if (r3 && r3.ok) return r3; } } }
        backup(r.state); return r;
      }
      if (!tried && r && /無法讀取/.test(String(r.error || ''))) {
        tried = true;
        if (salvage()) { var r2 = o.apply(this, arguments); if (r2 && r2.ok) { tried = false; return r2; } }
      }
    } catch (e) { console.warn('[AFK-clanfix]', e); }
    return r;
  };
  try { (0, eval)('_clanReadStateResult = window._clanReadStateResult'); } catch (e) {}
  W.__afkClanFix = { dig: dig, salvage: salvage, backup: backup, payloadOf: payloadOf, BAK: BAK, last: null };
})();
