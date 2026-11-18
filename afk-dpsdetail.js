/* ============================================================================
 * afk-dpsdetail.js — 統計頁「DPS 統計」每一列可以點開看傷害細項（Ping 11-18 21:54：開關鈕版本）
 *
 *   每一列左邊一個 ▸，點開＝那個人的傷害來源（普通攻擊、各技能、魔擊、遺物特效、藝能…）每秒多少、占他自己的幾 %。
 *   細項用木人場同一套記錄（afk-training 的 __afkBrkField）：第一次點開時才開始記，全部收起就停（平常不多花效能）。
 *   換地圖、按「重置」會一起歸零。
 *   需要 afk-training。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var F = function () { return W.__afkBrkField || null; };
  var open = {};   // 展開中的列（'你'、傭兵名字、'召喚'、'夥伴'）
  var anyOpen = function () { return Object.keys(open).some(function (k) { return open[k]; }); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { n = Math.round(Number(n) || 0); return n.toLocaleString(); };

  // DPS 統計列的順序跟核心一樣：玩家、每個傭兵、召喚（有輸出才有）、夥伴（有輸出才有）
  var keysOfRows = function (n) {
    var out = ['你']; (player.allies || []).forEach(function (a) { if (a) out.push(String(a._allyName || a.n || a.name || a.nick || '傭兵')); });
    return out;
  };
  var match = function (key, who) {
    if (key === '召喚') return /^召喚物/.test(who);
    if (key === '夥伴') return /^寵物/.test(who);
    return who === key;
  };
  var detailHtml = function (key) {
    var f = F(); if (!f) return '';
    var rows = f.rows(), secs = Math.max(1, (Date.now() - f.since()) / 1000), list = [], tot = 0;
    Object.keys(rows).forEach(function (k) { var r = rows[k]; if (!(r.dmg > 0) || !match(key, r.who)) return; tot += r.dmg; var hit = list.filter(function (x) { return x.what === r.what; })[0]; if (hit) { hit.dmg += r.dmg; hit.hits += r.hits; } else list.push({ what: r.what, dmg: r.dmg, hits: r.hits }); });
    if (!(tot > 0)) return '<div class="text-slate-500 text-xs pl-6 py-1">記錄中…打一陣子就會出現。</div>';
    list.sort(function (a, b) { return b.dmg - a.dmg; });
    return '<div class="flex flex-col gap-0.5 pl-6 pr-1 py-1">' + list.map(function (x) {
      var pc = x.dmg / tot * 100;
      return '<div class="flex items-center gap-2 text-xs" title="' + esc(x.what) + '：共 ' + fmt(x.dmg) + '、' + x.hits + ' 下，平均每下 ' + fmt(x.hits ? x.dmg / x.hits : 0) + '">'
        + '<span class="shrink-0 text-slate-300" style="width:118px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.what) + '</span>'
        + '<div class="flex-1 bg-slate-900 rounded h-2 overflow-hidden"><div style="width:' + Math.max(1, Math.round(pc)) + '%;height:100%;background:#64748b;"></div></div>'
        + '<span class="shrink-0 text-right text-slate-200" style="width:84px;">' + fmt(x.dmg / secs) + ' <small class="text-slate-500">' + pc.toFixed(1) + '%</small></span></div>';
    }).join('') + '</div>';
  };
  var otherHtml = function () {
    var f = F(); if (!f) return '';
    var rows = f.rows(), secs = Math.max(1, (Date.now() - f.since()) / 1000), dot = 0, oth = 0;
    Object.keys(rows).forEach(function (k) { var r = rows[k]; if (!(r.dmg > 0)) return; if (r.who === '全隊') dot += r.dmg; else if (r.who === '其他') oth += r.dmg; });
    var mins = (Date.now() - f.since()) / 60000;
    return '<div class="text-slate-500 text-xs mt-1">細項從點開時開始記（已記 ' + mins.toFixed(1) + ' 分鐘）；全部收起就停止，換地圖或重置會歸零。'
      + (dot > 0 ? '　持續傷害（毒、灼燒、流血）' + fmt(dot / secs) + '／秒' : '') + (oth > 0 ? '　其他 ' + fmt(oth / secs) + '／秒' : '') + '</div>';
  };

  var decorate = function () {
    var el = document.getElementById('tab-audit'); if (!el || el.classList.contains('hidden')) return;
    if (typeof _auditView !== 'undefined' && _auditView === 'drops') return;
    var box = el.firstElementChild; if (!box) return;
    var sec = null; Array.prototype.forEach.call(box.children, function (k) { if (!sec && k.id !== 'afk-healstat' && k.textContent && k.textContent.indexOf('DPS 統計') >= 0) sec = k; });
    if (!sec) return;
    var wrap = sec.querySelector('.flex.flex-col'); if (!wrap) return;
    var keys = keysOfRows(), rowEls = Array.prototype.slice.call(wrap.children);
    rowEls.forEach(function (rowEl, i) {
      var label = rowEl.querySelector('span'), name = label ? label.textContent : '';
      var key = i < keys.length ? keys[i] : (name === '召喚' ? '召喚' : name === '夥伴' ? '夥伴' : null);
      if (!key) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'afk-dpsd-btn'; b.setAttribute('data-dpsd', key);
      b.setAttribute('aria-expanded', open[key] ? 'true' : 'false'); b.title = open[key] ? '收起細項' : '看傷害細項';
      b.textContent = open[key] ? '▾' : '▸';
      b.style.cssText = 'width:18px;flex:0 0 18px;color:#94a3b8;font-size:12px;line-height:1;background:none;border:0;padding:0;cursor:pointer;';
      rowEl.insertBefore(b, rowEl.firstChild);
      if (open[key]) { var d = document.createElement('div'); d.className = 'afk-dpsd-detail'; d.innerHTML = detailHtml(key); rowEl.parentNode.insertBefore(d, rowEl.nextSibling); }
    });
    if (anyOpen()) { var n = document.createElement('div'); n.className = 'afk-dpsd-note'; n.innerHTML = otherHtml(); wrap.parentNode.appendChild(n); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-dpsd]'); if (!b) return;
    var k = b.getAttribute('data-dpsd'), f = F(); if (!f) return;
    open[k] = !open[k];
    if (anyOpen()) f.start(); else f.stop();
    try { renderAuditTab(); } catch (e2) {}
  });

  var hook = function () {
    if (typeof W.renderAuditTab === 'function' && !W.renderAuditTab.__afkDpsd) {
      var o = W.renderAuditTab;
      var f = function () { var r = o.apply(this, arguments); try { decorate(); } catch (e) {} return r; };
      f.__afkDpsd = true; W.renderAuditTab = f; try { (0, eval)('renderAuditTab = window.renderAuditTab'); } catch (e) {}
    }
    if (typeof W._dpsReset === 'function' && !W._dpsReset.__afkDpsd) {   // 換地圖、重置
      var o2 = W._dpsReset;
      var g = function () { var r = o2.apply(this, arguments); try { var f2 = F(); if (f2) f2.reset(); } catch (e) {} return r; };
      g.__afkDpsd = true; W._dpsReset = g; try { (0, eval)('_dpsReset = window._dpsReset'); } catch (e) {}
    }
  };
  hook(); W.addEventListener('load', function () { setTimeout(hook, 1500); });
  W.__afkDpsDetail = { open: open, decorate: decorate };
})();
