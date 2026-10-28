/* ==========================================================================
 * afk-polys-item.js — 道具專用變身型態（玩家 2026-10-26：補齊缺少的變身型態）
 *
 * 天堂透視鏡有一批變身卷軸、變身道具，指定的型態本作沒有（狂暴將軍、甘特、布魯迪卡、丹特斯、海露拜、
 * 黃金史雷佛、紅色海音警衛、曼波兔、黑貓、南瓜稻草人…），或是同一型態的不同等級速度（死亡騎士 75／80 級速度）。
 * 這裡補上這些型態：只能透過對應的道具變身，不進變形卷軸的隨機池，也不算進變身收集冊。
 *
 * 速度：照天堂透視鏡「速度表」（8.1C 近戰／遠攻／魔法特化、變身速度表）；
 *   透視鏡沒有列速度的活動、寵物造型型態，比照活動變身（攻擊 60／分、移動 90、施法 58、硬直 0.69 秒）。
 * 外觀：assets/morphanim/<名稱>{,2,F}（scripts/forge-style.py item 由原作怪物動畫匯入，部分換主題色），
 *   同一型態的不同等級速度共用同一套外觀。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof POLY_TIERS === 'undefined' || typeof window.findPolyForm !== 'function') { console.warn('[AFK-polys-item] 找不到變身表，略過'); return; }
  var COLS = [['單手劍'], ['單手鈍器', '雙手鈍器'], ['弓', '十字弓'], ['單手矛', '雙手矛'], ['魔杖'], ['匕首'], ['雙手劍'], ['雙刀'], ['鋼爪', '奇古獸'], ['鎖鏈劍'], ['雙斧']];
  var form = function (n, lv, atk, walk, castDir, stunSec, look) {
    var apm = {};
    atk.forEach(function (v, i) { if (v > 0) COLS[i].forEach(function (f) { apm[f] = v; }); });
    return { n: n, lv: lv, apm: apm, wlk: Math.max(6, Math.round(1440 / (walk || 90))), cast: castDir > 0 ? Math.round(600 / castDir * 10) / 10 : 12, stun: Math.max(1, Math.round(stunSec * 10)), itemOnly: true, c: 'text-teal-300', look: look || n };
  };
  // 透視鏡速度表（11 欄：單手劍、斧頭、弓、矛、魔杖、匕首、雙手劍、雙刀、鋼爪、鎖鏈劍、雙斧）
  var K55 = [110, 90, 0, 96, 110, 111, 90, 110, 110, 96, 110], K75 = [110, 96, 0, 103, 110, 120, 96, 110, 110, 103, 110];
  var K80 = [120, 103, 0, 111, 120, 131, 103, 120, 120, 111, 120], K82 = [122, 105, 0, 113, 122, 133, 105, 122, 122, 113, 122];
  var bow = function (v) { return [0, 0, v, 0, 0, 0, 0, 0, 0, 0, 0]; };
  var M55 = [103, 85, 0, 90, 103, 103, 85, 103, 103, 90, 103], M75 = [103, 90, 0, 97, 103, 112, 90, 103, 103, 97, 103];
  var EV = [60, 55, 55, 57, 60, 62, 55, 60, 60, 57, 60];
  var LIST = [
    form('狂暴將軍', 52, K55, 90, 80, 0.33), form('狂暴將軍(Lv65)', 65, K55, 90, 80, 0.25, '狂暴將軍'),
    form('狂暴將軍(Lv75)', 75, K75, 90, 85, 0.21, '狂暴將軍'), form('狂暴將軍(Lv80)', 80, K80, 90, 85, 0.21, '狂暴將軍'),
    form('死亡騎士(Lv65)', 65, K55, 90, 80, 0.25, '死亡騎士'), form('死亡騎士(Lv75)', 75, K75, 90, 85, 0.21, '死亡騎士'), form('死亡騎士(Lv80)', 80, K80, 90, 85, 0.21, '死亡騎士'),
    form('黑暗精靈(Lv55)', 55, bow(80), 90, 80, 0.33, '黑暗精靈'), form('黑暗精靈(Lv75)', 75, bow(84), 90, 85, 0.21, '黑暗精靈'), form('黑暗精靈(Lv80)', 80, bow(90), 90, 85, 0.21, '黑暗精靈'),
    form('黑暗法師(Lv75)', 75, M75, 90, 90, 0.24, '黑暗法師'),
    form('甘特', 80, K80, 90, 85, 0.21), form('布魯迪卡', 80, K80, 90, 85, 0.21),
    form('丹特斯', 75, K75, 90, 85, 0.21), form('海露拜', 75, bow(84), 90, 85, 0.21),
    form('黃金史雷佛', 65, K55, 90, 80, 0.25), form('紅色海音警衛', 82, K82, 90, 85, 0.21),
    form('銀光刺客', 60, K55, 90, 80, 0.29), form('黃金刺客', 65, K55, 90, 80, 0.25),
    form('老虎', 80, K80, 90, 85, 0.21),
    form('火焰弓箭手', 55, bow(80), 90, 80, 0.33), form('黑法師', 55, M55, 90, 84, 0.38), form('魔女', 52, M55, 90, 84, 0.38),
    form('少女賽尼斯', 52, M55, 90, 84, 0.38), form('黑翼賽尼斯', 75, M75, 90, 90, 0.24),
    form('死神', 55, K55, 90, 80, 0.33), form('德雷克', 55, K55, 90, 80, 0.33), form('亞丁近衛隊', 55, K55, 90, 80, 0.33),
    form('哈維', 30, EV, 90, 58, 0.69), form('土精靈王', 45, EV, 90, 58, 0.69), form('艾庫阿茲特', 45, EV, 90, 58, 0.69),
    form('曼波兔', 15, EV, 90, 58, 0.69), form('胡蘿蔔曼波兔', 15, EV, 90, 58, 0.69), form('黑貓', 15, EV, 90, 58, 0.69), form('招財貓', 15, EV, 90, 58, 0.69),
    form('南瓜稻草人', 15, EV, 90, 58, 0.69), form('淘氣小孩', 15, EV, 90, 58, 0.69),
    form('高等柯利', 30, EV, 90, 58, 0.69), form('高等浣熊', 30, EV, 90, 58, 0.69), form('高等熊', 30, EV, 90, 58, 0.69), form('熊貓', 30, EV, 90, 58, 0.69)
  ];
  window.__afkItemPolyForms = LIST;
  var BY = Object.create(null); LIST.forEach(function (f) { BY[f.n] = f; });
  var oFind = window.findPolyForm;
  window.findPolyForm = function (name) { var r = oFind.apply(this, arguments); if (r) return r; var f = BY[name]; return f ? { form: f, color: f.c } : null; };
  // 裝備變身（核心補丁 45）：穿著帶 ttmiEquipPoly 的裝備時變身；套裝變身、武器變身優先
  window.__afkEquipPoly = function (p) {
    if (!p || !p.eq || p._setPoly) return;
    for (var k in p.eq) {
      var it = p.eq[k], d = it && DB.items[it.id];
      if (!d || !d.ttmiEquipPoly) continue;
      var r = window.findPolyForm(d.ttmiEquipPoly);
      if (r && typeof makePolyState === 'function') { p._setPoly = makePolyState(r.form, r.color); p._setPoly.equipPoly = it.id; return; }
    }
  };
  // 外觀：自己的資料夾，或同一型態共用
  try {
    LIST.forEach(function (f) {
      var look = f.look;
      if (look === f.n || !MORPH_BATTLE_ANIM.has(look)) { MORPH_BATTLE_ANIM.add(look); MORPH_ANIM_3DIR.add(look); }
      if (look !== f.n) MORPH_BATTLE_ALIAS[f.n] = (typeof MORPH_BATTLE_ALIAS[look] === 'string' ? MORPH_BATTLE_ALIAS[look] : look);
      else MORPH_BATTLE_ALIAS[f.n] = f.n;
    });
    ['黑暗精靈(Lv55)', '黑暗精靈(Lv75)', '黑暗精靈(Lv80)', '海露拜', '火焰弓箭手'].forEach(function (n) { RANGED_POLY_FORMS.add(n); });
  } catch (e) {}
  console.log('[AFK-polys-item] 已登錄道具專用變身 ' + LIST.length + ' 種');
})();
