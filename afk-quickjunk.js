/* ==========================================================================
 * afk-quickjunk.js — 快速廢品：依部位與強化值批次勾選（玩家 2026-10-26）
 *
 * 武器／防具分頁按「🗑️ 快速廢品」後，表頭多一列條件：
 *   部位：全部、全部防具、全部飾品、單一部位（頭盔、盔甲、斗篷…／單手劍、弓…）
 *   強化：不限、+0 以下、+1 以下 … +15 以下
 *   保護：遺物、祝福／屬性／遠古（預設勾選＝不會被選到）
 *   「勾選符合」把符合條件的加進勾選；「只勾符合」清掉其他、只留符合的。最後照原本按「確認」標成廢品。
 * 道具分頁（2026-10-27）：依種類勾選——卡片、材料、藥水、增益道具、卷軸、技能書、任務物品、其他。
 * 條件記在角色上（player.qjFilter），下次打開沿用。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof window.buildQuickHeader !== 'function' || typeof quickJunk === 'undefined') { console.warn('[AFK-quickjunk] 找不到快速廢品，略過'); return; }
  var CATS = (typeof EQUIP_CATEGORIES !== 'undefined') ? EQUIP_CATEGORIES : [];
  var GROUP_OPTS = {
    wpn: [['all', '全部武器']].concat(CATS.filter(function (c) { return c.group === '武器'; }).map(function (c) { return ['cat:' + c.key, c.name]; })),
    arm: [['all', '全部防具＋飾品'], ['g:防具', '全部防具'], ['g:飾品', '全部飾品']].concat(CATS.filter(function (c) { return c.group !== '武器' && c.key !== 'pet' && c.key !== 'doll'; }).map(function (c) { return ['cat:' + c.key, c.name]; }))
  };
  // 道具分頁（玩家 2026-10-27）：依種類勾選——卡片、材料、藥水、增益道具、卷軸、技能書、任務物品、其他
  var ICAT = [['card', '卡片'], ['mat', '材料'], ['pot', '藥水'], ['buff', '增益道具'], ['scroll', '卷軸'], ['book', '技能書'], ['quest', '任務物品'], ['other', '其他']];
  GROUP_OPTS.item = [['all', '全部道具']].concat(ICAT.map(function (c) { return ['ic:' + c[0], c[1]]; }));
  var itemCat = function (d, id) {
    var n = String(d.n || ''), e = String(d.eff || ''), t = d.type; id = String(id || '');
    if (d.card || /pcard|card/.test(e) || /(白金|金|銀|銅)?卡(片)?$|卡碎片/.test(n)) return 'card';
    if (t === 'quest' || d.quest || d.questItem || /^quest_/.test(id) || /戒指$|鑰匙|日記|支配符|護身符|圖騰|爪子|的角$|徽印|軍團印記|水晶球/.test(n)) return 'quest';
    if (/^(mat_|new_item_)/.test(id) && !/藥水|卷軸/.test(n)) return 'mat';
    if (d.ttmiBuff || d.ttmiAction === 'buff' || d.ttmiHaste || /料理|餅乾|蛋糕|加速|勇敢|慎重|強化藥水|經驗/.test(n) && t !== 'scroll') return 'buff';
    if (t === 'pot' || d.ttmiAction === 'heal' || /藥水|體力恢復劑|汁$|妙藥/.test(n)) return 'pot';
    if (t === 'scroll' || /卷軸|捲軸|傳送符/.test(n)) return 'scroll';
    if (t === 'skillbk' || t === 'book' || /魔法書|技能書|記憶水晶|精靈水晶|之書$/.test(n)) return 'book';
    if (t === 'etc' || t === 'mat' || t === 'gem' || d.ttmiJunk || /之骨|之皮|之牙|之角|之心|之血|碎片|礦石|寶石|結晶|金屬|皮革|木材|布料|鱗|羽毛|氣息|鑽石|魔石|米索莉|粉末|灰燼|之核|精靈玉/.test(n)) return 'mat';
    return 'other';
  };
  var GROUP_OF = {}; CATS.forEach(function (c) { GROUP_OF[c.key] = c.group; });
  var filt = function (type) {
    var p = player; p.qjFilter = p.qjFilter || {};
    var f = p.qjFilter[type] || (p.qjFilter[type] = { part: 'all', en: -1, relic: true, rare: true });
    // 2026-10-27：保護詞綴拆細（玩家：可以選遠古裡的不朽、永恆…，也能選祝福的等級）。舊的「保護祝福／屬性／遠古」一鍵對應全部勾或全部不勾
    if (!f.keep) { var all = f.rare !== false; f.keep = {}; KEEP.forEach(function (k) { f.keep[k[0]] = all; }); }
    KEEP.forEach(function (k) { if (f.keep[k[0]] === undefined) f.keep[k[0]] = true; });   // 後來加的詞綴預設保護
    return f;
  };
  var KEEP = [['anc', '遠古', 'c-ancient'], ['eternal', '永恆', 'c-eternal'], ['immortal', '不朽', 'c-immortal'], ['primordial', '太初', 'c-primordial'], ['anc2', '覺醒的（遠古系二階）', 'c-ancient'], ['anc3', '創世的（遠古系三階）', 'c-ancient'],
    ['bless1', '祝福的', 'c-blessed'], ['bless2', '昇華的祝福', ''], ['bless3', '至高的祝福', ''], ['attr', '屬性', ''],
    // 2026-10-27：龍紋賦予的詞綴也能選（龍紋師 艾格尼絲）
    ['will', '不屈者意志', 'text-rose-300'], ['dmark', '龍的印記', 'text-amber-300'], ['dscar', '龍的傷痕', 'text-amber-300'], ['tree', '神樹者的讚禮', 'text-green-300'], ['dres', '闇龍的抵抗者', 'text-violet-300']];
  var kept = function (f, i) {
    var k = f.keep || {};
    if (i.anc && k[i.anc === true ? 'anc' : i.anc] !== false && k[i.anc === true ? 'anc' : i.anc] !== undefined) return true;
    if (i.anc && i.ancLv > 1 && k['anc' + Math.min(3, Number(i.ancLv) || 1)]) return true;
    if (i.bless === true && k['bless' + Math.max(1, Math.min(3, Number(i.blessLv) || 1))]) return true;
    if (i.attr && k.attr) return true;
    if ((i.will && k.will) || (i.dmark && k.dmark) || (i.dscar && k.dscar) || (i.tree && k.tree) || (i.dres && k.dres)) return true;
    return false;
  };
  var catOf = function (i, d) { try { return equipCatKey(i.id, d); } catch (e) { return ''; } };
  var match = function (type, i) {
    var d = DB.items[i.id], f = filt(type);
    if (!_qjCanSelect(d, i, type)) return false;
    if (type === 'item') return f.part === 'all' || f.part === 'ic:' + itemCat(d, i.id);
    if (f.en >= 0 && (Number(i.en) || 0) > f.en) return false;
    if (f.relic && (d.relic || (typeof isRelic === 'function' && isRelic(d)))) return false;
    if (kept(f, i)) return false;
    if (f.part === 'all') return true;
    var ck = catOf(i, d);
    if (f.part.indexOf('g:') === 0) return GROUP_OF[ck] === f.part.slice(2);
    if (f.part.indexOf('cat:') === 0) return ck === f.part.slice(4);
    return true;
  };
  window.qjFilterSet = function (type, key, val) {
    var f = filt(type);
    if (key === 'en') f.en = Number(val); else if (key === 'part') f.part = String(val); else if (key.indexOf('keep:') === 0) { f.keep[key.slice(5)] = !!val; keepOpen[type] = true; window.qjFilterApply(type, true); return; }   // 改保護＝立刻重勾（玩家 2026-10-27：勾了保護卻沒反應） else f[key] = !!val;
    var n = _qjEligibleItems(type).filter(function (i) { return match(type, i); }).length;
    var el = document.getElementById('qjf-count-' + type); if (el) el.textContent = '符合 ' + n + ' 件';
  };
  window.qjFilterApply = function (type, only) {
    var st = quickJunk[type]; if (!st || !st.active) return;
    if (only) st.sel = {};
    var n = 0;
    _qjEligibleItems(type).forEach(function (i) { if (match(type, i)) { if (!st.sel[i.uid]) n++; st.sel[i.uid] = true; } });
    try { logSys('<span class="text-amber-300">快速廢品：依條件勾選 ' + n + ' 件' + (only ? '（只留符合的）' : '') + '，按「確認」才會標成廢品。</span>'); } catch (e) {}
    renderTabs(true);
  };
  var keepOpen = {};
  var keepSum = function (f) { var on = KEEP.filter(function (k) { return f.keep[k[0]]; }); return on.length === KEEP.length ? '全部' : on.length ? on.map(function (k) { return k[1]; }).join('、') : '不保護'; };
  var oHdr = window.buildQuickHeader;
  window.buildQuickHeader = function (type) {
    var hdr = oHdr.apply(this, arguments);
    try {
      if ((type !== 'wpn' && type !== 'arm' && type !== 'item') || !quickJunk[type] || !quickJunk[type].active || (quickEnh && quickEnh[type] && quickEnh[type].active)) return hdr;
      var f = filt(type), opts = GROUP_OPTS[type] || [['all', '全部']];
      var n = _qjEligibleItems(type).filter(function (i) { return match(type, i); }).length;
      var enOpts = '<option value="-1"' + (f.en < 0 ? ' selected' : '') + '>強化不限</option>';
      for (var k = 0; k <= 15; k++) enOpts += '<option value="' + k + '"' + (f.en === k ? ' selected' : '') + '>+' + k + ' 以下</option>';
      var sel = 'class="bg-slate-900 border border-slate-600 rounded px-1 py-1 text-xs text-slate-100"';
      var row = document.createElement('div');
      row.className = 'mt-1 flex flex-wrap items-center gap-1 bg-slate-900/70 border border-amber-900/60 rounded p-1 text-xs text-slate-200';
      var partSel = '<select ' + sel + ' onchange="qjFilterSet(\'' + type + '\',\'part\',this.value)">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (f.part === o[0] ? ' selected' : '') + '>' + o[1] + (type === 'item' && o[0] !== 'all' ? '（' + _qjEligibleItems(type).filter(function (i) { return 'ic:' + itemCat(DB.items[i.id], i.id) === o[0]; }).length + '）' : '') + '</option>'; }).join('') + '</select>';
      var btns = '<span id="qjf-count-' + type + '" class="text-amber-300 ml-auto whitespace-nowrap">符合 ' + n + ' 件</span>'
        + '<button onclick="qjFilterApply(\'' + type + '\',false)" class="btn border-amber-600 bg-amber-800 hover:bg-amber-700 px-2 py-1 text-xs font-bold text-amber-100 rounded">勾選符合</button>'
        + '<button onclick="qjFilterApply(\'' + type + '\',true)" class="btn border-amber-700 bg-amber-900 hover:bg-amber-800 px-2 py-1 text-xs font-bold text-amber-100 rounded">只勾符合</button>';
      if (type === 'item') { if (f.part !== 'all' && f.part.indexOf('ic:') !== 0) f.part = 'all'; row.innerHTML = partSel + btns; hdr.appendChild(row); return hdr; }
      row.innerHTML = partSel
        + '<select ' + sel + ' onchange="qjFilterSet(\'' + type + '\',\'en\',this.value)">' + enOpts + '</select>'
        + '<label class="flex items-center gap-1 whitespace-nowrap"><input type="checkbox"' + (f.relic ? ' checked' : '') + ' onchange="qjFilterSet(\'' + type + '\',\'relic\',this.checked)">保護遺物</label>'
        + '<details class="relative" style="max-width:100%;min-width:0"' + (keepOpen[type] ? ' open' : '') + ' ontoggle="window.__qjKeepToggle(\'' + type + '\',this.open)"><summary class="cursor-pointer select-none bg-slate-800 border border-slate-600 rounded px-2 py-1 whitespace-nowrap" style="overflow:hidden;text-overflow:ellipsis;max-width:100%">保護詞綴：<span id="qjf-keepsum-' + type + '">' + keepSum(f) + '</span> ▾</summary>'
        + '<div class="mt-1 p-2 bg-slate-900 border border-amber-800 rounded shadow-lg grid gap-1" style="grid-template-columns:repeat(2,minmax(0,max-content));column-gap:14px;max-width:100%">'
        + KEEP.map(function (k) { return '<label class="flex items-center gap-1 whitespace-nowrap"><input type="checkbox"' + (f.keep[k[0]] ? ' checked' : '') + ' onchange="qjFilterSet(\'' + type + '\',\'keep:' + k[0] + '\',this.checked)"><span class="' + k[2] + '"' + (k[0] === 'bless2' ? ' style="color:#fbbf24"' : k[0] === 'bless3' ? ' style="color:#fde047"' : '') + '>' + k[1] + '</span></label>'; }).join('')
        + '<div class="col-span-2 text-slate-400" style="grid-column:1/-1;white-space:normal">打勾＝有這個詞綴的不會被勾成廢品；改了會立刻重新勾選（只勾符合的）</div></div></details>'
        + btns;
      hdr.appendChild(row);
    } catch (e) {}
    return hdr;
  };
  window.__qjKeepToggle = function (type, open) { keepOpen[type] = !!open; };
  window.__afkQuickJunk = { match: match, filt: filt, itemCat: itemCat, itemCats: ICAT };
  console.log('[AFK-quickjunk] 已啟用：快速廢品依部位／強化值勾選');
})();
