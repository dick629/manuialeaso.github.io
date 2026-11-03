/* ============================================================================
 * afk-craftui.js — NPC 製作配方的材料一眼看清楚（玩家 2026-11-02 19:15）
 *
 *   所有走核心 craftReqHtml 的配方（通用製作、惡魔王武器、神聖執行團、滅魔裝備…）材料改成「材料卡」：
 *     圖示＋名稱＋「持有／需要」；夠了綠色 ✓、可以從其他材料自動合成黃色、不夠紅色並寫「還差 N」；
 *     上鎖的另外註明；金幣用千分位。最後加一個總結：材料齊全／可以合成補齊／還缺幾種。
 *   滑到（點）材料卡會跳出那個道具的說明（核心的 tip-host）。
 *   只改顯示，不改任何配方與扣除規則。外掛開關 craftui（預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'craftui', name: '製作配方的材料卡', group: '介面', desc: 'NPC 製作的材料改成有圖示的材料卡，持有／需要、還差幾個、可不可以合成一眼看得到' });
  var on = function () { return !T || T.enabled('craftui'); };
  // 黑市商品說明卡被其他面板蓋住（玩家 2026-11-03 04:25 回報）：說明卡一律疊在最上層
  try { var tz = document.createElement('style'); tz.id = 'afk-tipz-css'; tz.textContent = '#pandora-tooltip,.game-tooltip,.afk-tip-layer{z-index:2147483000!important}'; document.head.appendChild(tz); } catch (e) {}
  if (typeof W.craftReqHtml !== 'function') return;
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { n = Number(n) || 0; return n.toLocaleString(); };
  var css = function () {
    if (document.getElementById('afk-craftui-css')) return;
    var st = document.createElement('style'); st.id = 'afk-craftui-css';
    st.textContent = '.afk-cr{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;margin-top:2px}'
      + '.afk-cr-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border-radius:6px;border:1px solid #475569;background:#0f172a;font-size:13px;line-height:1.25;max-width:100%}'
      + '.afk-cr-chip img{width:26px;height:26px;object-fit:contain;image-rendering:pixelated;flex:none;background:#1e293b;border-radius:4px}'
      + '.afk-cr-chip .gi{width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none}'
      + '.afk-cr-chip .tx{display:flex;flex-direction:column;min-width:0}.afk-cr-chip .nm{color:#e2e8f0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:12em}'
      + '.afk-cr-chip .ct{font-variant-numeric:tabular-nums;font-size:12px;color:#94a3b8}.afk-cr-chip .ct b{font-size:13px}'
      + '.afk-cr-chip.ok{border-color:#15803d}.afk-cr-chip.ok .ct b{color:#4ade80}'
      + '.afk-cr-chip.can{border-color:#b45309}.afk-cr-chip.can .ct b{color:#fbbf24}'
      + '.afk-cr-chip.no{border-color:#b91c1c}.afk-cr-chip.no .ct b{color:#f87171}'
      + '.afk-cr-chip .x{font-size:11.5px;margin-left:2px}.afk-cr-chip.ok .x{color:#4ade80}.afk-cr-chip.can .x{color:#fbbf24}.afk-cr-chip.no .x{color:#f87171}.afk-cr-chip .lk{color:#94a3b8;font-size:11px}'
      + '.afk-cr-sum{align-self:center;font-size:12.5px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap}'
      + '.afk-cr-sum.ok{background:rgba(22,163,74,.18);color:#86efac}.afk-cr-sum.can{background:rgba(217,119,6,.18);color:#fcd34d}.afk-cr-sum.no{background:rgba(220,38,38,.18);color:#fca5a5}'
      + '@media (max-width:640px){.afk-cr{gap:4px}.afk-cr-chip{flex:1 1 calc(50% - 4px);min-width:0;padding:3px 6px 3px 3px}.afk-cr-chip .nm{max-width:none;white-space:normal;font-size:12.5px}.afk-cr-chip img,.afk-cr-chip .gi{width:22px;height:22px}.afk-cr-sum{flex:1 1 100%;text-align:center}}';
    document.head.appendChild(st);
  };
  var safe = function (fn, d) { try { return fn(); } catch (e) { return d; } };
  var chip = function (req) {
    var need = Number(req.cnt) || 1;
    if (req.id === 'gold') {
      var g = Number((typeof player !== 'undefined' && player && player.gold) || 0), okG = g >= need;
      return { st: okG ? 'ok' : 'no', html: '<span class="afk-cr-chip ' + (okG ? 'ok' : 'no') + '"><span class="gi">💰</span><span class="tx"><span class="nm">金幣</span><span class="ct"><b>' + fmt(g) + '</b>／' + fmt(need) + (okG ? '<span class="x">✓</span>' : '<span class="x">還差 ' + fmt(need - g) + '</span>') + '</span></span></span>' };
    }
    var d = DB.items[req.id] || { n: req.id };
    var has = safe(function () { return invCountId(req.id); }, 0);
    var st = has >= need ? 'ok' : (safe(function () { return materialObtainable(req.id, need); }, false) ? 'can' : 'no');
    var lk = has < need ? safe(function () { return lockedCountId(req.id); }, 0) : 0;
    var img = safe(function () { return getIconUrl(d); }, '');
    var x = st === 'ok' ? '✓' : st === 'can' ? '可合成' : '還差 ' + fmt(need - has);
    return { st: st, html: '<span class="afk-cr-chip ' + st + ' tip-host" data-tip-id="' + esc(req.id) + '" title="' + esc(d.n) + '">'
      + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<span class="gi">📦</span>')
      + '<span class="tx"><span class="nm">' + esc(d.n) + '</span><span class="ct"><b>' + fmt(has) + '</b>／' + fmt(need) + '<span class="x">' + x + '</span>'
      + (lk > 0 ? '<span class="lk">（另有 ' + fmt(lk) + ' 個上鎖不計）</span>' : '') + '</span></span></span>' };
  };
  var oReq = W.craftReqHtml;
  W.craftReqHtml = function (reqArr) {
    if (!on() || !Array.isArray(reqArr)) return oReq.apply(this, arguments);
    try {
      css();
      try { if (typeof RECIPE_BY_RESULT !== 'undefined' && !RECIPE_BY_RESULT && typeof buildRecipeIndex === 'function') buildRecipeIndex(); } catch (e) {}
      var cs = reqArr.map(chip), no = cs.filter(function (c) { return c.st === 'no'; }).length, can = cs.filter(function (c) { return c.st === 'can'; }).length;
      var sum = no ? '<span class="afk-cr-sum no">還缺 ' + no + ' 種材料</span>' : can ? '<span class="afk-cr-sum can">可以自動合成補齊</span>' : '<span class="afk-cr-sum ok">材料齊全</span>';
      return '<span class="afk-cr">' + cs.map(function (c) { return c.html; }).join('') + sum + '</span>';
    } catch (e) { return oReq.apply(this, arguments); }
  };
  try { (0, eval)('craftReqHtml = window.craftReqHtml'); } catch (e) {}
  W.__afkCraftUi = { on: on, chip: chip };
})();
