/* ============================================================================
 * afk-matprice.js — 材料賣價重算（玩家 2026-10-27：材料不能都賣 30 元；依怪物等級、稀缺性、需求量計價，最低 500）
 *
 * 只改「賣給商人」的價格（核心 getSellPrice），不動物品定價 d.p，所以：收購 NPC、黑市、古物委託的分級、
 * 工坊工錢（依成品定價）全部照舊；商店有在賣的材料（布料）不碰，免得買來轉賣賺錢。
 *
 * 材料＝沒有使用效果的素材類物品（etc／mat／gem、沒有 eff 的 misc），排除裝備、藥水、卷軸、技能書、卡片、
 * 任務道具、娃娃、遺物、不可販賣品。
 *
 * 賣價 ＝ max(500, 等級值 × 頭目 × 稀缺 × 需求)，取到十位：
 *   等級值：來源怪物最高等級 lv → lv × 10（Lv50＝500、Lv80＝800、Lv99＝990）；沒有怪會掉的（只能製作／兌換／程式發放）照原本賣價
 *   頭目：有頭目會掉 ×2
 *   稀缺：來源裡最低掉落率 r（%）→ clamp(√(1 ÷ r), 1, 5)（≥1%＝1、0.1%＝3.2、≤0.04%＝5）
 *   需求：被幾條配方用到 n、總需求量 c → 1 + min(1, 0.1n) + min(0.5, c ÷ 200)（最多 ×2.5）
 * 上限約 25,000；原本賣價比算出來的高就維持原本（定價本來就高的不會變便宜）。
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'matprice', name: '材料賣價重算', desc: '材料賣給商人的價格依掉落怪物等級、稀缺性、配方需求量重算（最低 500）；關掉照原版賣價', group: '遊戲玩法' });
  if (__T && !__T.enabled('matprice')) { console.log('[AFK] 外掛開關「材料賣價重算」已關閉'); return; }
  var W = window;
  if (typeof W.getSellPrice !== 'function' || typeof DB === 'undefined' || !DB.items) { console.warn('[AFK-matprice] 找不到 getSellPrice，略過'); return; }
  if (W.getSellPrice.__afkMatPrice) return;
  var MIN = 500;
  var cache = null;
  var isMat = function (d) {
    if (!d || d.noSell || d.questItem || d.card || d.doll || d.relic || d.eff || d.ttmiAction || d.afkZomg) return false;
    if (['wpn', 'arm', 'acc', 'pot', 'scroll', 'skillbk', 'book', 'quest'].indexOf(d.type) >= 0) return false;
    return d.type === 'etc' || d.type === 'mat' || d.type === 'gem' || d.type === 'misc' || d.type === undefined;
  };
  var build = function () {
    var src = Object.create(null), dem = Object.create(null), shop = Object.create(null), byName = Object.create(null);
    try { Object.keys(DB.mobs).forEach(function (k) { var m = DB.mobs[k]; if (m && m.n && !byName[m.n]) byName[m.n] = m; }); } catch (e) {}
    try {
      Object.keys(MOB_DROPS).forEach(function (mn) {
        var mob = byName[mn]; if (!mob) return;
        (MOB_DROPS[mn] || []).forEach(function (e) { if (!e || !e[0]) return; var s = src[e[0]] || (src[e[0]] = { lv: 0, boss: false, rate: Infinity }); s.lv = Math.max(s.lv, mob.lv || 1); if (mob.boss) s.boss = true; var r = Number(e[1]); if (isFinite(r) && r > 0) s.rate = Math.min(s.rate, r); });
      });
    } catch (e) {}
    try { Object.keys(CRAFT_RECIPES).forEach(function (k) { (CRAFT_RECIPES[k] || []).forEach(function (r) { (r.req || []).forEach(function (q) { if (!q || q.id === 'gold') return; var d = dem[q.id] || (dem[q.id] = [0, 0]); d[0]++; d[1] += Number(q.cnt) || 1; }); }); }); } catch (e) {}
    try { Object.keys(SHOP_LISTS).forEach(function (k) { (SHOP_LISTS[k] || []).forEach(function (it) { shop[typeof it === 'string' ? it : (it && it.id)] = 1; }); }); } catch (e) {}
    try { if (W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.shopStock) W.AFK_TTMI_ITEMS.shopStock().forEach(function (id) { shop[id] = 1; }); } catch (e) {}
    cache = { src: src, dem: dem, shop: shop, price: Object.create(null) };
  };
  var calc = function (id) {
    if (!cache) build();
    if (cache.price[id] != null) return cache.price[id];
    var d = DB.items[id], v = 0;
    if (isMat(d) && !cache.shop[id]) {
      var s = cache.src[id], dm = cache.dem[id] || [0, 0];
      if (s) {
        var base = s.lv * 10 * (s.boss ? 2 : 1);
        var sc = isFinite(s.rate) ? Math.max(1, Math.min(5, Math.sqrt(1 / s.rate))) : 1;
        var demand = 1 + Math.min(1, 0.1 * dm[0]) + Math.min(0.5, dm[1] / 200);
        v = Math.max(MIN, Math.round(base * sc * demand / 10) * 10);
      } else if ((d.p || 0) > 0) v = MIN;   // 只能製作／兌換的材料：至少 500
    }
    cache.price[id] = v; return v;
  };
  var o = W.getSellPrice;
  W.getSellPrice = function (item) {
    var r = o.apply(this, arguments);
    try { if (item && item.id) { var v = calc(item.id); if (v > r) return v; } } catch (e) {}
    return r;
  };
  W.getSellPrice.__afkMatPrice = true;
  W.AFK_MATPRICE = { calc: calc, isMat: isMat, invalidate: function () { cache = null; }, min: MIN };
  console.log('[AFK-matprice] 已啟用：材料賣價依等級／稀缺／需求重算，最低 ' + MIN);
})();
