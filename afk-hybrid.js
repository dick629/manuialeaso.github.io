/* ============================================================================
 * afk-hybrid.js — 混傷、屬性段、混合易傷、傳承法術（Ping 11-17 設計：Projects claude/hybrid-damage-design.md、hybrid-damage-decisions.md）
 *
 *   1. 屬性段：拿有屬性的武器打出物理傷害時，多一段屬性傷害＝物理傷害 × 武器屬性階 × 3%（沒有屬性詞綴、武器本身帶屬性＝1 階）。
 *      屬性段吃目標的屬性抗：×（1 − 抗 ÷ 200），最多減 85%；怪物對自己的屬性有 100 抗。屬性段也吃屬性剋制（×1.4／×0.6）。
 *   2. 易傷（Ping 11-17 21:36）：物理／魔法／屬性易傷，命中、技能、遺物、符文、屬性卷軸各類各算一次，合計最多 50%；
 *      寵物撕咬（物理＋魔法各 5%）、元素怪自己的屬性 5% 另計。詳見下方「易傷」段。
 *   3. 妖精的遠距離一般攻擊＝70% 物理＋30% 魔法（兩種易傷都吃、兩種都疊）。
 *   4. 光環：職業進化（選了流派）或覺醒轉職的角色＝混傷角色，傭兵給的幻覺光環「額外傷害」也加魔法傷害、「魔法傷害」也加額外傷害。
 *   5. 傳承法術：流派固定給（下表）；用一般魔法書學，學習等級照書上原本的等級。非本職的攻擊法術效果 75%。
 *      〔幻覺三件組〕＝幻覺：歐吉、幻覺：巫妖、幻覺：鑽石高崙一起學。
 *   6. 血咒派：吸血鬼之吻（含武器觸發）效果 ×2，同時附加一次寒冷戰慄（也 ×2）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var LEGACY = {"魔法騎士": ["火焰武器", "烈炎武器", "★極道落雷", "★火風暴"], "守護騎士": ["聖結界", "靈魂昇華", "鋼鐵防護", "護甲身軀"], "聖騎士": ["全部治癒術", "治癒能量風暴", "聖潔之光", "生命的祝福", "生命之泉"], "血咒騎士": ["★吸血鬼之吻", "魔力奪取"], "王庭近衛": ["聖結界", "大地屏障", "強力加速術"], "風誓劍衛": ["風之疾走", "體能激發", "★龍捲風"], "秘典劍使": ["魔法相消術", "魔法封印", "★雷霆風暴"], "蝕毒影衛": ["附加劇毒", "暗影閃避", "雙重破壞", "★暗影衝擊"], "血怒狂戰士": ["狂暴術", "燃燒鬥志", "雙重破壞"], "龍語連刃": ["雙重破壞", "★會心一擊", "強力加速術"], "鏡心騎士": ["鏡反射", "魔法屏障", "鏡像", "泰坦：魔法", "泰坦：岩石", "疼痛的歡愉"], "征服君主": ["狂暴術", "強力加速術", "亡命之徒", "★烈炎術"], "守誓君主": ["聖結界", "靈魂昇華", "大地屏障", "護甲身軀"], "光輝君主": ["全部治癒術", "治癒能量風暴", "聖潔之光", "生命的祝福", "生命之泉"], "噬血暴君": ["★吸血鬼之吻", "魔力奪取"], "王盾統帥": ["聖結界", "鋼鐵防護", "堅固防護", "反擊屏障"], "森庭領主": ["風之神射", "精準射擊", "生命之泉", "★三重矢", "★精靈之暈"], "王庭咒師": ["魔法相消術", "魔法封印", "★火風暴", "★雷霆風暴"], "夜冠君主": ["附加劇毒", "暗隱術", "雙重破壞", "燃燒鬥志", "★暗影衝擊"], "戰旗暴君": ["狂暴術", "尖刺盔甲", "體魄強健術", "泰坦：岩石"], "龍誓王": ["強力加速術", "屬性防禦", "龍之護鎧", "★流星雨"], "鏡廷之主": ["鏡反射", "鏡像", "魔法屏障", "〔幻覺三件組〕"], "風矢遊俠": ["強力加速術", "迴避提升", "精準目標", "★龍捲風"], "四季詠者": ["★流星雨", "★寒冰尖刺", "★雷霆風暴", "★震裂術"], "靈契使": ["召喚術", "造屍術", "體力回復術", "魔法屏障"], "血月詠者": ["★吸血鬼之吻", "魔力奪取"], "森林盾衛": ["聖結界", "堅固防護", "反擊屏障", "護甲身軀"], "王庭遊俠": ["狂暴術", "強力加速術", "全部治癒術", "精準目標"], "星弦術師": ["★火風暴", "★冰雪暴", "★雷霆風暴", "★究極光裂術"], "暗林獵手": ["附加劇毒", "暗隱術", "暗影閃避", "迴避提升", "★暗影衝擊"], "荒野戰弓": ["狂暴術", "燃燒鬥志", "體魄強健術", "泰坦：子彈"], "龍鱗射手": ["弱化術", "雙重破壞", "★破壞盔甲", "★奪命之雷"], "鏡羽幻射": ["鏡反射", "鏡像", "專注", "魔法屏障"], "奧術賢者": ["能量激發", "烈焰之魂", "屬性之火", "★污濁之水"], "星輝導師": ["生命的祝福", "生命之泉", "大地的祝福", "世界樹的呼喚"], "亡靈召喚師": ["召喚強力屬性精靈", "附加劇毒", "★驚悚死神", "〔幻覺三件組〕"], "血咒術士": ["★吸血鬼之吻", "魔力奪取"], "符甲賢者": ["鋼鐵防護", "堅固防護", "反擊屏障", "護甲身軀", "泰坦：魔法"], "星冠導師": ["屬性防禦", "大地的祝福", "精準目標"], "元素共鳴者": ["召喚強力屬性精靈", "烈炎武器", "屬性之火", "★污濁之水"], "暗蝕咒師": ["附加劇毒", "暗隱術", "暗影閃避", "迴避提升", "★暗影衝擊"], "血焰術士": ["燃燒鬥志", "烈焰之魂", "力量提升"], "龍語法師": ["屬性防禦", "能量激發", "★岩漿之箭", "★奪命之雷"], "幻夢編織者": ["暗隱術", "影之防護", "鏡反射", "鏡像", "〔幻覺三件組〕"], "影刃刺客": ["強力加速術", "狂暴術", "體能激發"], "毒影行者": ["弱化術", "★疾病術", "★毒咒", "★木乃伊的詛咒"], "夜幕守望": ["隱身術", "聖結界", "鏡反射"], "血影祭刃": ["★吸血鬼之吻", "魔力奪取"], "暗誓衛": ["聖結界", "鋼鐵防護", "反擊屏障", "護甲身軀"], "夜幕密使": ["全部治癒術", "魔法屏障", "強力加速術"], "月影獵刃": ["精準射擊", "風之疾走", "強力加速術", "★三重矢", "★精靈之暈"], "秘毒術士": ["魔法相消術", "★疾病術", "★冰錐", "★毒咒"], "血爪狂徒": ["狂暴術", "體力回復術", "尖刺盔甲", "狂暴"], "蝕龍獵手": ["弱化術", "強力加速術", "血之渴望", "★岩牢"], "影鏡殺手": ["鏡反射", "鏡像", "★心靈破壞", "★沉睡之霧"], "泰坦鬥士": ["狂暴術", "體魄強健術", "增幅防禦", "★衝擊之暈"], "不屈戰衛": ["聖結界", "靈魂昇華", "鋼鐵防護", "體力回復術"], "戰吼統領": ["強力加速術", "狂暴術", "祝福魔法武器", "勇猛意志"], "血怒戰神": ["★吸血鬼之吻", "魔力奪取"], "鐵壁破陣者": ["聖結界", "堅固防護", "反擊屏障", "大地屏障"], "戰旗統領": ["強力加速術", "魔法屏障", "全部治癒術", "閃亮之盾"], "獸靈鬥士": ["召喚術", "召喚屬性精靈", "風之疾走"], "符文戰狂": ["火焰武器", "祝福魔法武器", "★烈炎術", "★冰矛圍籬"], "影爪狂徒": ["暗影閃避", "迴避提升", "附加劇毒", "雙重破壞", "★暗影衝擊"], "龍血破軍": ["雙重破壞", "狂暴術", "血之渴望", "★破壞盔甲"], "幻甲巨人": ["鏡反射", "魔法相消術", "魔法屏障", "疼痛的歡愉", "〔幻覺三件組〕"], "鎖鏈獵龍者": ["雙重破壞", "精準射擊", "燃燒鬥志", "★破壞盔甲"], "龍鱗守護者": ["聖結界", "靈魂昇華", "鋼鐵防護", "護甲身軀"], "龍語祭司": ["全部治癒術", "治癒能量風暴", "屬性防禦", "生命的祝福"], "血鱗咒騎": ["★吸血鬼之吻", "魔力奪取"], "龍盾守望": ["聖結界", "堅固防護", "大地屏障", "反擊屏障"], "龍庭旗手": ["強力加速術", "狂暴術", "祝福魔法武器", "勇猛意志"], "翡翠龍使": ["召喚強力屬性精靈", "屬性防禦", "生命之泉", "大地的祝福"], "古語龍巫": ["魔法封印", "★流星雨", "★雷霆風暴", "★冰雪暴"], "暗鱗獵殺者": ["附加劇毒", "暗隱術", "暗影閃避", "迴避提升", "★暗影衝擊"], "龍血狂戰": ["狂暴術", "燃燒鬥志", "體力回復術", "狂暴"], "夢鱗行者": ["鏡反射", "鏡像", "魔法屏障", "〔幻覺三件組〕"], "幻刃術士": ["強力加速術", "狂暴術", "雙重破壞", "★極道落雷"], "鏡域織者": ["聖結界", "絕對屏障", "魔法封印", "鏡反射"], "夢靈塑師": ["召喚術", "召喚強力屬性精靈", "生命之泉"], "血鏡咒師": ["★吸血鬼之吻", "魔力奪取"], "鏡盾騎士": ["聖結界", "靈魂昇華", "堅固防護", "護甲身軀"], "幻廷指揮者": ["強力加速術", "狂暴術", "全部治癒術", "勇猛意志"], "森夢使": ["召喚強力屬性精靈", "生命的祝福", "風之神射", "★三重矢", "★精靈之暈"], "秘夢賢者": ["★火風暴", "★冰雪暴", "★雷霆風暴", "★震裂術"], "夜夢刺客": ["附加劇毒", "暗隱術", "雙重破壞", "★會心一擊", "★暗影衝擊"], "血鏡鬥士": ["狂暴術", "燃燒鬥志", "體力回復術", "護甲身軀"], "龍夢塑形師": ["屬性防禦", "強力加速術", "★流星雨", "★岩漿之箭"]};
  var AWAKEN = {"berserker:iron": ["增幅防禦", "尖刺盔甲", "★衝擊之暈"], "berserker:banner": ["勇猛意志", "閃亮之盾", "精準目標"], "berserker:dragon": ["血之渴望", "龍之護鎧", "★岩漿之箭"], "thunder:wind": ["風之疾走", "風之神射", "暴風神射"], "thunder:sage": ["強力加速術", "魔法屏障", "★極道落雷", "★雷霆風暴"], "thunder:phantom": ["鏡像", "專注", "〔幻覺三件組〕"], "paladin:oath": ["勇猛意志", "閃亮之盾", "王者加護"], "paladin:spirit": ["火焰武器", "烈炎武器", "屬性防禦", "大地屏障"], "paladin:radiant": ["聖結界", "靈魂昇華", "全部治癒術", "★究極光裂術"], "darkknight:steel": ["反擊屏障", "堅固防護", "★衝擊之暈"], "darkknight:curse": ["弱化術", "★吸血鬼之吻", "★疾病術"], "darkknight:drake": ["血之渴望", "★奪命之雷", "★驚悚死神"], "runeblade:rune": ["祝福魔法武器", "★火風暴", "★冰雪暴"], "runeblade:shadow": ["暗影閃避", "迴避提升", "★暗影衝擊"], "runeblade:mirror": ["鏡像", "疼痛的歡愉", "〔幻覺三件組〕"]};
  var TRIO = ['幻覺：歐吉', '幻覺：巫妖', '幻覺：鑽石高崙'];
  var N = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var now = function () { return (typeof state !== 'undefined' && state && N(state.ticks)) || 0; };
  // ── 技能名稱 → 代號 ──
  var BYNAME = null;
  var byName = function () {
    if (BYNAME) return BYNAME; BYNAME = {};
    Object.keys(DB.skills || {}).forEach(function (id) { var s = DB.skills[id]; if (s && s.n && !BYNAME[s.n]) BYNAME[s.n] = id; });
    return BYNAME;
  };
  var expand = function (arr) {
    var out = [], m = byName();
    (arr || []).forEach(function (s) {
      var n = String(s).replace('★', '').trim();
      (n === '〔幻覺三件組〕' ? TRIO : [n]).forEach(function (x) { if (m[x] && out.indexOf(m[x]) < 0) out.push(m[x]); });
    });
    return out;
  };
  // ── 角色的流派 ──
  var TREES = null;
  var tree = function (id) {
    if (!TREES) { TREES = {}; try { (W.LineageClassCatalog.trees || []).forEach(function (t) { TREES[t.id] = t; }); } catch (e) {} }
    return TREES[id] || null;
  };
  var routeKey = function (p) {
    if (!p) return '';
    var r = p.classPath && p.classPath.route; if (r) { var t = tree(r); return t ? 't:' + t.name : ''; }
    var a = p.awkTransfer; if (a && N(a.stage) > 0 && a.route) return 'a:' + p.cls + ':' + a.route;
    return '';
  };
  var CACHE = {};
  var legacy = function (p) {
    var k = routeKey(p); if (!k) return [];
    if (CACHE[k]) return CACHE[k];
    var arr = k.charAt(0) === 't' ? LEGACY[k.slice(2)] : AWAKEN[k.slice(2)];
    return (CACHE[k] = expand(arr));
  };
  var isHybrid = function (p) { return !!routeKey(p); };
  var isBlood = function (p) { var r = p && p.classPath && p.classPath.route, t = r && tree(r); return !!(t && t.category === '血咒派'); };
  var natLv = function (sk) { var ks = ['reqM', 'reqE', 'reqK', 'reqD', 'reqRoy', 'reqDk', 'reqW', 'reqI']; for (var i = 0; i < ks.length; i++) if (sk && sk[ks[i]] != null) return sk[ks[i]]; return 1; };
  // ── 學習：流派的傳承法術也能學 ──
  var oReq = null;
  var isNative = function (p, id) { var sk = DB.skills[id]; if (!sk || !oReq) return true; var pp = P(); if (pp !== p) return true; try { return oReq(sk, id) != null; } catch (e) { return true; } };
  var hookReq = function () {
    if (typeof W.skillReqLv !== 'function' || W.skillReqLv.__afkHybrid || W.__hkHybridReq) return; W.__hkHybridReq = true;
    oReq = W.skillReqLv;
    var f = function (sk, id) {
      var r = oReq.apply(this, arguments);
      if (r != null || W.__afkHybridOff) return r;
      var p = P(); if (!p || !id) return r;
      return legacy(p).indexOf(id) >= 0 ? natLv(sk) : r;
    };
    f.__afkHybrid = true; W.skillReqLv = f;
  };
  // ── 法術傷害：非本職攻擊法術 75%；血咒派吸血鬼之吻 ×2＋寒冷戰慄 ×2 ──
  var avg = function (sk) { if (!sk || !sk.dmgDice) return 1; return sk.dmgDice[0] * (sk.dmgDice[1] + 1) / 2 + N(sk.dmgBase); };
  var hookSpell = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.spellDamage !== 'function' || R.spellDamage.__afkHybrid || R.__hkHybridSp) return; R.__hkHybridSp = true;
    var o = R.spellDamage;
    var f = function (actor, target, amount, skill, extra) {
      var sid = (extra && extra.skillId) || (skill && skill.id) || '', vamp = false;
      if (!W.__afkHybridOff) try {
        if (actor && actor.cls && actor === P()) {
          var sd = DB.skills[sid];
          if (sd && sd.type === 'atk' && legacy(actor).indexOf(sid) >= 0 && !isNative(actor, sid)) amount = amount * 0.75;
          if (isBlood(actor) && (sid === 'sk_vampire' || (skill && skill.n === '吸血鬼之吻'))) { amount = amount * 2; vamp = true; }
        }
      } catch (e) {}
      var v = o.call(this, actor, target, amount, skill, extra);
      if (vamp) {   // 寒冷戰慄放到這一下結算完之後（不打斷遺物系統的這一下）
        var cs = Math.max(1, Math.floor(N(v) * avg(DB.skills.sk_cold_shiver) / avg(DB.skills.sk_vampire)));
        setTimeout(function () {
          try {
            if (!target || target._dead || !(N(target.curHp) > 0)) return;
            var C = W.AFK_CARD_COMBAT; var d = C ? C.damage(actor, target, cs, { kind: 'magic' }) : cs;
            d = Math.max(0, Math.floor(N(d))); if (!d) return;
            target.curHp -= d; actor.hp = Math.min(N(actor.mhp), N(actor.hp) + d);
            target.justHit = 'magic';
            if (target.curHp <= 0 && typeof killMob === 'function') { var i = mapState.mobs.indexOf(target); if (i >= 0) killMob(i); }
          } catch (e) {}
        }, 0);
      }
      return v;
    };
    f.__afkHybrid = true; R.spellDamage = f;
  };
  // ── 易傷（Ping 11-17 21:36 定案）、屬性段 ──
  //   三種易傷：物理（ph）、魔法（mg）、屬性（el.火水風地）。每種＝各類來源各取最高一次相加，合計最多 50%：
  //     hit 命中觸發 5～10%（身上遺物有第二詞綴 +2.5、第三詞綴 +2.5）；skill 技能 5～10%（技能強化 0～3 階：5／6.5／8／10）；
  //     relic 特定遺物 5～10%（+0 5%，每 +3 多 1%）；rune 符文之語 5～10%（★0～3：5／6.67／8.33／10）；scroll 屬性卷軸 5～8%（屬性階 1～5）；
  //     卡片（標籤卡）之後跟卡片系統一起做。
  //   另計（不佔 50%）：寵物撕咬＝每層物理、魔法各 1%，基本上限 5 層（11-18）；元素怪對自己的屬性 5%。現有的脆弱、弱點曝光、遺物火易傷照舊另外算。
  //   持續 5 秒（再次觸發刷新）。
  var VULN = typeof WeakMap === 'function' ? new WeakMap() : null;
  var DUR = 50, CAP = 0.5, PET = 0.05, NAT = 0.05;
  var vs = function (t) { if (!VULN || !t || typeof t !== 'object') return null; var s = VULN.get(t); if (!s) { s = { ph: {}, mg: {}, el: {}, pet: 0, petN: 0 }; VULN.set(t, s); } return s; };
  var put = function (box, src, v) { if (!box) return; var c = box[src], t = now(); if (!c || c[1] <= t || c[0] <= v) box[src] = [v, t + DUR]; else c[1] = t + DUR; };
  var sum = function (box) { var t = now(), n = 0; for (var k in box) if (box[k][1] > t) n += box[k][0]; return Math.min(CAP, n); };
  var elBox = function (s, ele) { return s.el[ele] || (s.el[ele] = {}); };
  // 寵物撕咬（Ping 11-18 04:28）：每咬一次疊 1 層，每層物理、魔法易傷各 +1%，基本上限 5 層，5 秒（咬到就刷新）。
  //   標籤卡「寵物撕咬易傷層數上限 +5」→ 上限 10 層（之後卡片系統設 player._afkPetBiteCap）。
  var petCap = function () { var p = P(); return 5 + Math.max(0, Math.floor(N(p && p._afkPetBiteCap))); };
  var petV = function (s) { return s.pet > now() ? Math.min(s.petN || 0, petCap()) * 0.01 : 0; };
  var V = {
    ph: function (t, s) { s = s || vs(t); return s ? sum(s.ph) + petV(s) : 0; },
    mg: function (t, s) { s = s || vs(t); return s ? sum(s.mg) + petV(s) : 0; },
    el: function (t, ele, s) { s = s || vs(t); return (s ? sum(elBox(s, ele)) : 0) + (t && t.e === ele ? NAT : 0); }
  };
  var RESK = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };
  var ELE4 = { fire: 1, water: 1, wind: 1, earth: 1 };
  var wpnEle = function (a) {
    var inst = a && a.eq && a.eq.wpn; if (!inst) return null;
    var base = DB.items[inst.id]; if (!base) return null;
    var ele = null, tier = 0;
    try { ele = typeof getWpnEle === 'function' ? getWpnEle(inst, base, a) : base.ele; } catch (e) { ele = base.ele; }
    if (!ELE4[ele]) return null;
    try { var af = typeof getAttrAffix === 'function' ? getAttrAffix(inst.attr) : null; tier = af && af.ele === ele ? N(af.tier) : 0; } catch (e) {}
    return { ele: ele, tier: Math.max(1, tier), scroll: tier };
  };
  var resOf = function (t, ele) { return Math.max(-50, (t.e === ele ? 100 : 0) + N(t[RESK[ele]]) + N(t.d && t.d[RESK[ele]])); };
  // 身上的裝備（每 tick 快取）
  var EQK = ['wpn', 'shield', 'armor', 'helm', 'cloak', 'gloves', 'boots', 'shin', 'tshirt', 'ring1', 'ring2', 'ring3', 'ring4', 'ear1', 'ear2', 'amulet', 'belt'];
  var GEAR = typeof WeakMap === 'function' ? new WeakMap() : null;
  // 特定遺物（Ping 11-17 21:37：清單照提案全部）：鈍器→物理；說明有破甲→物理；有削魔／封印→魔法；自帶屬性或說明有灼熱／冰凍／抗性下降→該屬性（推不出屬性→魔法）
  var RLC = null;
  var relicKind = function (bid) {
    if (!RLC) {
      RLC = {};
      Object.keys(DB.items).forEach(function (id) {
        var d = DB.items[id]; if (!d || !d.relic || !d.n || d.gmOnly || d.bossRelicKey || id.indexOf('~') >= 0 || !/^(wpn|arm|acc)$/.test(d.type)) return;
        var t = (d.d || '') + ' ' + (d.relicRole || ''), k = null, tags = [];
        try { tags = d.type === 'wpn' && typeof getWeaponTags === 'function' ? getWeaponTags(id) || [] : []; } catch (e) {}
        var de = ELE4[d.e] ? d.e : ELE4[d.ele] ? d.ele : null;
        var nameEle = /火|焰|熔|灼|炎|爆/.test(d.n) ? 'fire' : /水|雪|冰|海|凜/.test(d.n) ? 'water' : /風|鷹|雷/.test(d.n) ? 'wind' : /地|岩|石|蟻|土/.test(d.n) ? 'earth' : null;
        if (tags.some(function (x) { return /鈍器/.test(x); })) k = 'ph';
        else if (/破甲|AC\s*[+＋]|防禦.{0,4}降|盔甲破壞|破壞盔甲|物理.{0,4}易傷|脆弱|碎甲/.test(t)) k = 'ph';
        else if (/魔防\s*[−\-－]|魔防.{0,4}降|魔法.{0,4}易傷|魔法.{0,4}弱點|削弱魔|封印/.test(t)) k = 'mg';
        else if (d.type === 'wpn' && de) k = 'el:' + de;
        else if (/抗性\s*[−\-－]|抗性.{0,4}降|屬性.{0,4}易傷|弱點|灼熱|凍結|冰凍|雷擊|侵蝕/.test(t)) k = (de || nameEle) ? 'el:' + (de || nameEle) : 'mg';
        if (k) RLC[id] = k;
      });
    }
    return RLC[bid] || null;
  };
  var baseId = function (id) { return String(id || '').split('~')[0]; };
  var gearOf = function (a) {
    if (!a || !a.eq) return null;
    var c = GEAR && GEAR.get(a), t = now(); if (c && c.t === t) return c;
    c = { t: t, fx2: false, fx3: false, rel: {} };
    EQK.forEach(function (k) {
      var it = a.eq[k]; if (!it || !it.id) return; var d = DB.items[it.id]; if (!d || !d.relic) return;
      if (d.relicFx) c.fx2 = true; if (d.relicFx3) c.fx3 = true;
      var rk = relicKind(baseId(it.id)); if (!rk) return;
      var v = 0.05 + Math.min(5, Math.floor(N(it.en) / 3)) / 100;
      if (!c.rel[rk] || c.rel[rk] < v) c.rel[rk] = v;
    });
    if (GEAR) GEAR.set(a, c);
    return c;
  };
  var hitVal = function (a) { var g = gearOf(a); return 0.05 + (g && g.fx2 ? 0.025 : 0) + (g && g.fx3 ? 0.025 : 0); };
  var skillVal = function (a) { var st = 0; try { st = W.__afkSkillUp && W.__afkSkillUp.stageOf ? N(W.__afkSkillUp.stageOf(a)) : N(a && a.afkSkillUp); } catch (e) {} return [0.05, 0.065, 0.08, 0.10][Math.max(0, Math.min(3, st))]; };
  var RUNE_PH = ['shatter', 'skyfall', 'kingsway'], RUNE_MG = ['thunder', 'judgment', 'zenith'], RUNE_EL = ['regicide', 'dragonslay', 'dreamhunt'];
  var runeVal = function (a, list) {
    var R = W.__afkRuneFx; if (!R || !R.Wd) return 0; var best = 0;
    list.forEach(function (id) { try { if (R.Wd(a, id) > 0) { var st = Math.round((N(R.WK(a, id)) - 1) / 0.1); best = Math.max(best, 0.05 + Math.max(0, Math.min(3, st)) * 0.05 / 3); } } catch (e) {} });
    return best;
  };
  // 打出傷害的人給目標上易傷（命中、遺物、符文、屬性卷軸；技能另外在施放時給）
  var applyOnHit = function (a, t, s, pf, mf, we) {
    var hv = hitVal(a);
    if (pf > 0) put(s.mg, 'hit', hv);
    if (mf > 0) put(s.ph, 'hit', hv);
    if (we) {
      put(elBox(s, we.ele), 'hit', hv);
      if (we.scroll > 0) put(elBox(s, we.ele), 'scroll', 0.05 + (Math.min(5, we.scroll) - 1) * 0.0075);
    }
    var g = gearOf(a);
    if (g) for (var rk in g.rel) { if (rk === 'ph') put(s.ph, 'relic', g.rel[rk]); else if (rk === 'mg') put(s.mg, 'relic', g.rel[rk]); else put(elBox(s, rk.slice(3)), 'relic', g.rel[rk]); }
    var rp = runeVal(a, RUNE_PH), rm = runeVal(a, RUNE_MG), re = we ? runeVal(a, RUNE_EL) : 0;
    if (rp) put(s.ph, 'rune', rp); if (rm) put(s.mg, 'rune', rm); if (re) put(elBox(s, we.ele), 'rune', re);
    if (a.buffs && N(a.buffs.sk_dark_double) > 0) put(s.ph, 'skill', skillVal(a));   // 雙重破壞期間：物理易傷
  };
  // 技能：弱化術、魔法相消術→魔法；破壞盔甲→物理；屬性攻擊魔法→該屬性
  var SK_MG = { sk_weaken: 1, sk_cancel: 1 }, SK_PH = { sk_dark_armorbreak: 1 };
  var skId = function (sk) { if (typeof sk === 'string') return sk; if (!sk) return ''; if (sk.id && DB.skills[sk.id] === sk) return sk.id; var m = byName(); return (sk.n && m[sk.n]) || ''; };
  var onSkill = function (a, sk) {
    if (W.__afkHybridOff || !a) return;
    var id = skId(sk), d = DB.skills[id]; if (!d) return;
    var el = d.type === 'atk' && ELE4[d.ele] ? d.ele : null;
    if (!SK_MG[id] && !SK_PH[id] && !el) return;
    var t = null; try { t = mapState.mobs[mapState.targetIdx]; } catch (e) {}
    if (!t || t._dead || !(N(t.curHp) > 0)) return;
    var s = vs(t); if (!s) return; var v = skillVal(a);
    if (SK_MG[id]) put(s.mg, 'skill', v); if (SK_PH[id]) put(s.ph, 'skill', v); if (el) put(elBox(s, el), 'skill', v);
  };
  var hookSkills = function () {
    var wrap = function (name, ai, si) {
      var o = W[name]; if (typeof o !== 'function' || o.__afkHyV) return;
      var f = function () { var r = o.apply(this, arguments); try { if (r !== false && r != null && r !== 0) onSkill(ai < 0 ? P() : arguments[ai], arguments[si]); } catch (e) {} return r; };
      f.__afkHyV = true; W[name] = f; try { (0, eval)(name + ' = window.' + name); } catch (e) {}
    };
    wrap('castSkill', -1, 0); ['allyCastMagic', 'allyCastNonDamage', 'allyCastPhysicalSkill', 'allyCastCrush', 'allyCastFixedStatus'].forEach(function (n) { wrap(n, 0, 1); });
  };
  // 寵物撕咬：物理、魔法各 5%（另計）
  var hookPet = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.companionDamage !== 'function' || R.__hkHybridPet) return; R.__hkHybridPet = true;
    var o = R.companionDamage;
    R.companionDamage = function (owner, pet, target, dmg, extra) {
      try { if (!W.__afkHybridOff && extra && extra.kind === 'pet' && target && !target._isAlly) { var s = vs(target); if (s) { if (!(s.pet > now())) s.petN = 0; s.petN = Math.min(petCap(), (s.petN || 0) + 1); s.pet = now() + DUR; } } } catch (e) {}
      return o.apply(this, arguments);
    };
  };
  var stat = { seg: 0, segN: 0 };
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkHybrid || C.__hkHybrid) return;   // 只包一次（11-17 修：之前 load 後會被重複包好幾層）
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      if (!W.__afkHybridOff) try {
        if (amount > 0 && actor && target && !target._isAlly && target !== P() && !(target.cls && target.eq)) {
          var kind = opt && opt.kind, phys = kind === 'melee' || kind === 'ranged' || kind === 'phys', mag = kind === 'magic' || kind === 'mag';
          if (phys || mag) {
            var s = vs(target);
            var pf = phys ? 1 : 0, mf = mag ? 1 : 0;
            if (phys && kind === 'ranged' && actor.cls === 'elf') { pf = 0.7; mf = 0.3; }   // 妖精遠攻：70 物理／30 魔法
            var mult = pf * (1 + V.ph(target, s)) + mf * (1 + V.mg(target, s));
            var add = 0, we = phys && actor.eq ? wpnEle(actor) : null;
            if (we) {
              var red = Math.min(0.85, resOf(target, we.ele) / 200);
              var cm = typeof elementCounterMult === 'function' ? elementCounterMult(we.ele, target.e) : 1;
              add = amount * pf * we.tier * 0.03 * (1 - red) * cm * (1 + V.el(target, we.ele, s));
              if (add > 0) { stat.seg += add; stat.segN++; }
            }
            if (s && actor.eq) applyOnHit(actor, target, s, pf, mf, we);
            else if (s) { if (pf > 0) put(s.mg, 'hit', 0.05); if (mf > 0) put(s.ph, 'hit', 0.05); }
            amount = amount * mult + add;
          }
        }
      } catch (e) {}
      return o.call(this, actor, target, amount, opt);
    };
    f.__afkHybrid = true; C.damage = f; C.__hkHybrid = true;
  };
  // ── 光環：混傷角色兩邊都吃 ──
  var hookAura = function () {
    if (typeof W.teamIlluAura !== 'function' || W.teamIlluAura.__afkHybrid || W.__hkHybridAura) return; W.__hkHybridAura = true;
    var o = W.teamIlluAura;
    var f = function (forWho, forMinion) {
      var r = o.apply(this, arguments);
      if (!W.__afkHybridOff) try { if (r && !forMinion && forWho && isHybrid(forWho)) { var ed = N(r.ed), md = N(r.md); r = Object.assign({}, r, { ed: ed + md, md: md + ed }); } } catch (e) {}
      return r;
    };
    f.__afkHybrid = true; W.teamIlluAura = f;
  };
  // ── 施放：精靈屬性魔法（要選屬性）給別職業用時，施放當下暫時當成該屬性 ──
  var hookCast = function () {
    if (typeof W.castSkillInner !== 'function' || W.castSkillInner.__afkHybrid || W.__hkHybridCast) return; W.__hkHybridCast = true;
    var o = W.castSkillInner;
    var f = function (id) {
      var p = P(), sk = DB.skills[id];
      if (W.__afkHybridOff || !p || !sk || !(sk.reqEle || sk.reqEleAny) || p.cls === 'elf' || legacy(p).indexOf(id) < 0) return o.apply(this, arguments);
      var keep = p.elfEle; p.elfEle = sk.reqEle || keep || 'fire';
      try { return o.apply(this, arguments); } finally { p.elfEle = keep; }
    };
    f.__afkHybrid = true; W.castSkillInner = f;
  };
  // ── 傳承法術：屬性魔法（精靈的火／水／風／地魔法）不是妖精也能學、能勾自動施放（Ping 11-18 15:44）──
  //   施放時 hookCast 已經會暫時當成該屬性；這裡補「學」跟「自動施法清單」兩處的屬性檢查。妖精本人照舊要屬性相符。
  var eleLegacy = function (p, id) { var sk = DB.skills[id]; return !!(p && sk && (sk.reqEle || sk.reqEleAny) && p.cls !== 'elf' && legacy(p).indexOf(id) >= 0); };
  var hookLearn = function () {
    if (typeof W.useItem !== 'function' || W.useItem.__afkHyLearn) return;
    var o = W.useItem;
    var f = function (u) {
      var p = P(), it = null, d = null;
      if (!W.__afkHybridOff && p) try { it = (p.inv || []).find(function (x) { return x && (x.uid === u || String(x.uid) === String(u)); }); d = it && DB.items[it.id]; } catch (e) {}
      if (!d || d.type !== 'skillbk' || !eleLegacy(p, d.sk)) return o.apply(this, arguments);
      var sk = DB.skills[d.sk], keep = p.elfEle; p.elfEle = sk.reqEle || keep || 'fire';
      try { return o.apply(this, arguments); } finally { p.elfEle = keep; }
    };
    f.__afkHyLearn = true; W.useItem = f; try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  };
  var hookSelects = function () {
    if (typeof W.renderSkillSelects !== 'function' || W.renderSkillSelects.__afkHyEle) return;
    var o = W.renderSkillSelects;
    var f = function () {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (p && !W.__afkHybridOff) legacy(p).forEach(function (id) {
          if (!eleLegacy(p, id) || (p.skills || []).indexOf(id) < 0) return;
          var need = W.skillReqLv(DB.skills[id], id); if (need == null || N(p.lv) < need) return;
          document.querySelectorAll('option[value="' + id + '"]').forEach(function (op) { op.disabled = false; op.classList.remove('text-slate-500'); });
          var cb = document.getElementById('auto-sk-' + id); if (cb) { cb.disabled = false; if (cb.dataset && cb.dataset.unavail) cb.dataset.unavail = '0'; }
        });
      } catch (e) {}
      return r;
    };
    f.__afkHyEle = true; W.renderSkillSelects = f; try { (0, eval)('renderSkillSelects = window.renderSkillSelects'); } catch (e) {}
  };
  // ── 技能書加一頁「傳承」：這個流派全部的傳承法術（已學、未學、要幾級）──
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hookBook = function () {
    if (typeof W.renderClassicSkillBook !== 'function' || W.renderClassicSkillBook.__afkHyBook) return;
    var o = W.renderClassicSkillBook;
    var f = function (sDiv) {
      var p = P(), st = typeof classicSkillBookState !== 'undefined' ? classicSkillBookState : null;
      var ids = (p && !W.__afkHybridOff) ? legacy(p) : [];
      if (!ids.length || !st) { if (st && st.mode === 'legacy') st.mode = 'general'; return o.apply(this, arguments); }
      var leg = st.mode === 'legacy';
      if (leg) st.mode = 'general';
      var r;
      try { r = o.apply(this, arguments); } finally { if (leg) st.mode = 'legacy'; }
      try {
        var win = sDiv && sDiv.querySelector('.classic-skill-window'); if (!win) return r;
        var bar = win.querySelector('.classic-skill-mode');
        if (bar) {
          if (leg) bar.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
          var b = document.createElement('button'); b.type = 'button'; b.textContent = '傳承'; if (leg) b.className = 'active';
          b.setAttribute('onclick', "classicSkillChooseMode('legacy')"); bar.appendChild(b);
        }
        if (!leg) return r;
        win.setAttribute('data-skill-mode', 'legacy');
        var hd = win.querySelector('.classic-skill-heading'); if (hd) hd.textContent = '傳承法術';
        var strip = win.querySelector('.classic-skill-tier-strip'); if (strip) strip.style.visibility = 'hidden';
        var cells = ids.map(function (id) {
          var sk = DB.skills[id], learned = (p.skills || []).indexOf(id) >= 0, need = W.skillReqLv(sk, id);
          var usable = learned && need != null && N(p.lv) >= need;
          var dim = learned ? (usable ? '' : ' classic-skill-unavailable') : ' classic-skill-unlearned';
          var status = !learned ? ('未學習・Lv' + (need == null ? '?' : need)) : (usable ? '已學習' : '需要 Lv' + need);
          var img = '<img src="' + (typeof getIconUrl === 'function' ? getIconUrl(sk, true) : '') + '" onerror="this.style.display=\'none\';" alt="' + esc(sk.n) + '">'
            + '<span class="classic-skill-name">' + esc(sk.n) + '</span><span class="classic-skill-status">' + status + '</span>';
          var tip = ' data-tip-skill="' + id + '" title="' + esc(sk.n) + (learned ? '' : '（用一般魔法書學，Lv' + need + '）') + '"';
          if (usable && sk.type === 'manual') return '<button class="classic-skill-cell tip-host' + dim + '"' + tip + ' onclick="manualCast(\'' + id + '\')">' + img + '</button>';
          return '<div class="classic-skill-cell tip-host' + dim + '"' + tip + '>' + img + (!learned ? '<span class="classic-skill-lock">◆</span>' : '') + '</div>';
        });
        var per = typeof CLASSIC_PAGE_CELLS === 'number' ? CLASSIC_PAGE_CELLS : 16;
        while (cells.length < per || cells.length % 4) cells.push('<div class="classic-skill-cell classic-skill-empty"></div>');
        var grid = win.querySelector('.classic-skill-grid'); if (grid) grid.innerHTML = cells.join('');
      } catch (e) {}
      return r;
    };
    f.__afkHyBook = true; W.renderClassicSkillBook = f; try { (0, eval)('renderClassicSkillBook = window.renderClassicSkillBook'); } catch (e) {}
  };
  var hookAll = function () { hookReq(); hookSpell(); hookDmg(); hookAura(); hookCast(); hookSkills(); hookPet(); hookLearn(); hookSelects(); hookBook(); };
  hookAll(); W.addEventListener('load', function () { hookAll(); setTimeout(hookAll, 3000); });
  W.LineageHybrid = { LEGACY: LEGACY, AWAKEN: AWAKEN, legacy: legacy, isHybrid: isHybrid, isBlood: isBlood, routeKey: routeKey, stat: stat,
    V: V, relicKind: relicKind, gearOf: gearOf,
    addVuln: function (t, k, src, v) { if (W.__afkHybridOff || !(v > 0)) return; var s = vs(t); if (!s) return; if (k === 'ph') put(s.ph, src, v); else if (k === 'mg') put(s.mg, src, v); else if (ELE4[k]) put(elBox(s, k), src, v); },
    vuln: function (t) { var s = vs(t); return s ? { ph: V.ph(t, s), mg: V.mg(t, s), el: { fire: V.el(t, 'fire', s), water: V.el(t, 'water', s), wind: V.el(t, 'wind', s), earth: V.el(t, 'earth', s) } } : null; } };
})();
