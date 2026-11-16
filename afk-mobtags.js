/* ============================================================================
 * afk-mobtags.js — 怪物標籤（Ping 11-17：全部怪物貼標籤，之後用 RO 的方式「對某標籤增加傷害」）
 *
 *   標籤由怪物資料自動判斷（種族、體型、頭目旗標、名字），每隻怪可以有好幾個：
 *     頭目、神族、人形、不死、狼人、龍族、惡魔、動物、昆蟲、植物、元素、無生物、大型、小型
 *   對標籤增加傷害（RO 方式）：
 *     ‧裝備、遺物、卡片的資料寫 vsTag: { undead: 20 }（＝對不死 +20%），穿在身上就生效；不同來源相加
 *     ‧其他系統也可以掛：W.LineageMobTags.bonus.push(function (actor, target, tags) { return 百分比; })
 *     ‧算在打到怪物的最後一步（AFK_CARD_COMBAT.damage 之後），真實傷害也吃
 *   目前還沒有任何裝備帶 vsTag：這次只做標籤本身，哪些東西要加、加多少之後再定。
 *   查詢：W.LineageMobTags.of(怪物) → ['boss','god',…]；name(key) → 中文；isGod(怪物)；has(怪物, key)
 *   顯示：怪物／掉落查詢的怪物卡多一行「標籤」。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var TAGS = {
    boss: { n: '頭目' }, god: { n: '神族' }, human: { n: '人形' }, undead: { n: '不死' }, wolf: { n: '狼人' },
    dragon: { n: '龍族' }, demon: { n: '惡魔' }, beast: { n: '動物' }, insect: { n: '昆蟲' }, plant: { n: '植物' },
    element: { n: '元素' }, construct: { n: '無生物' }, large: { n: '大型' }, small: { n: '小型' }
  };
  var RACE = {
    god: ['神族'],
    human: ['人類', '人形', '亞人', '黑騎士', '強盜', '法師', '玩家', '妖魔', '食人妖精', '侏儒', '哥布林', '黑暗妖精', '黑暗精靈', '精靈', '歐吉', '拉斯塔巴德', '長老', '長者',
      '蜥蜴人', '邪惡蜥蜴', '歐姆', '思克巴', '蛇女', '人魚', '牛人', '鼠人', '巨人', '亞力安', '喀瑪', '提卡爾', '底比斯', '黑暗棲林者', '梅杜莎', '哈維', '潘', '安普', '多羅'],
    undead: ['不死', '殭屍', '吸血鬼', '巫妖', '死神', '幻影', '鬼火', '靈魂', '墳墓守護者'],
    wolf: ['狼人'],
    dragon: ['龍', '飛龍', '龍龜'],
    demon: ['惡魔', '魔族', '地獄犬', '異界生物', '眼魔', '妖怪', '裂縫'],
    beast: ['動物', '野獸', '魔狼', '格利芬', '奇美拉', '螃蟹', '鯊魚', '寄居蟹', '鮟鱇', '獨角獸', '不死鳥', '雪怪', '海星', '水生物', '卡司特', '阿西塔基奧', '變形怪'],
    insect: ['昆蟲', '蜘蛛', '毒蠍', '螞蟻', '蜈蚣'],
    plant: ['植物', '蘑菇', '爆彈花', '安特'],
    element: ['元素', '四色', '地靈'],
    construct: ['高崙', '星之守衛', '寶箱', '魔法生物', '史萊姆']
  };
  var BY = {}; Object.keys(RACE).forEach(function (k) { RACE[k].forEach(function (r) { (BY[r] = BY[r] || []).push(k); }); });
  var GOD_NAME = /女神|殷海薩|瑪普勒|帕格里奧|沙哈|葛蘭肯|伊娃|終焉的席琳|席琳伴身|席琳幻影|死亡女神/;
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var of = function (m) {
    if (!m || typeof m !== 'object') return [];
    if (cache && cache.has(m)) return cache.get(m);
    var out = [], add = function (k) { if (out.indexOf(k) < 0) out.push(k); };
    var race = String(m.race || ''), n = String(m.n || '');
    if (m.boss) add('boss');
    (BY[race] || []).forEach(add);
    if (m.un) add('undead');
    if (m.isWolf || /狼人/.test(n)) add('wolf');
    if (m._afkDragonStage) add('dragon');
    if (race === '神族' || (m.boss && GOD_NAME.test(n))) add('god');
    if (m.s === 'L') add('large'); else if (m.s === 'S') add('small');
    if (cache) cache.set(m, out);
    return out;
  };
  var has = function (m, k) { return of(m).indexOf(k) >= 0; };
  var name = function (k) { return (TAGS[k] && TAGS[k].n) || k; };
  // ── 對標籤增加傷害 ──
  var bonus = [];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var gearPct = function (actor, tags) {
    var s = 0, eq = actor && actor.eq; if (!eq || typeof DB === 'undefined') return 0;
    Object.keys(eq).forEach(function (k) { var it = eq[k], d = it && DB.items[it.id], v = d && d.vsTag; if (!v) return; tags.forEach(function (t) { s += Number(v[t]) || 0; }); });
    return s;
  };
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkTags) return;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        if (!(v > 0) || !actor || !actor.cls || !target || target._isAlly) return v;
        var tags = of(target); if (!tags.length) return v;
        var pct = gearPct(actor, tags);
        for (var i = 0; i < bonus.length; i++) { try { pct += Number(bonus[i](actor, target, tags)) || 0; } catch (e) {} }
        if (pct) v = Math.max(0, Math.floor(v * (1 + pct / 100)));
      } catch (e) {}
      return v;
    };
    f.__afkTags = true; C.damage = f;
  };
  hook(); W.addEventListener('load', function () { hook(); setTimeout(hook, 3000); });
  W.LineageMobTags = { TAGS: TAGS, RACE: RACE, of: of, has: has, name: name, isGod: function (m) { return has(m, 'god'); }, bonus: bonus, names: function (m) { return of(m).map(name); } };
})();
