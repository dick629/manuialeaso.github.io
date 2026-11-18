/* ============================================================================
 * afk-riftrules.js — 次元裂縫、夢域鏡的王與小怪新規則（Ping 11-17 04:19「上線」）
 *
 *   次元裂縫（含 GD、無盡的裂縫）／夢域鏡（削弱版）：
 *     ‧王的魔法屏障：出場帶最大 HP 15%／10% 的護盾；1 分鐘內沒打死再補一次（只補一次）
 *     ‧王的死亡傷害：王倒下時全隊扣最大 HP 10%／5%；出場 30 秒內打死改 15%／8%
 *     ‧王的近戰、遠程、魔法減傷：先減 5%／3% 再算其他
 *     ‧70 等以上地區的小怪：出場帶 10%／5% 護盾；死亡時全隊扣最大 HP 5%／3%
 *   死亡傷害直接扣最大 HP 的百分比（不吃減傷），最少留 1 HP，不會因此倒下。
 *   王的法術爆擊：afk-enemyx 本來就讓敵人的法術也會爆擊（夢域鏡 50%、×2.5；次元裂縫 70%、×3），這裡不再重複擲。
 *   無盡的裂縫另外的規則（面板再壓 25%、光環與王的傷害 ×2）在 afk-dimrift。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var tk = function () { return (typeof state !== 'undefined' && state && state.ticks) || 0; };
  var rift = function () { try { return typeof W.__afkDimRiftOn === 'function' && !!W.__afkDimRiftOn(); } catch (e) { return false; } };
  var dream = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on && W.__afkDreamHell.on()); } catch (e) { return false; } };
  var CFG = {
    rift: { barrier: 0.15, death: 0.10, deathFast: 0.15, bossDr: 0.05, mobDeath: 0.05, mobShield: 0.10 },
    dream: { barrier: 0.10, death: 0.05, deathFast: 0.08, bossDr: 0.03, mobDeath: 0.03, mobShield: 0.05 }
  };
  // 11-17（Ping）：女神單人試煉（次元突破者）不套屏障／護盾／反噬
  var soloFb = function () { try { var F = W.__afkFinalBoss; return !!(F && F.mode && (F.mode() === 'solo' || F.mode() === 'practice') && typeof state !== 'undefined' && state._afkFinalSpawned); } catch (e) { return false; } };
  var mode = function () { var p = P(); if (!p || p.classicMode || soloFb()) return null; return rift() ? CFG.rift : dream() ? CFG.dream : null; };
  var enemy = function (m) { return !!(m && m.curHp != null && !m._isAlly && !m._allyName && m.race !== '建築' && m.race !== '血盟' && !m._dummy && !m.afkRaid); };   // 多人討伐的吞噬者不套
  var inTown = function () { try { return typeof mapState !== 'undefined' && /^town_/.test(String(mapState.current || '')); } catch (e) { return true; } };
  var log = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'enemy'); } catch (e) {} };
  // 地區等級：那張地圖一般怪的最高等級
  var LVC = {};
  var mapLv = function () {
    var k = String((typeof mapState !== 'undefined' && mapState.current) || ''); if (LVC[k] != null) return LVC[k];
    var pool = (typeof DB !== 'undefined' && DB.maps && DB.maps[k]) || [], mx = 0;
    pool.forEach(function (id) { var m = DB.mobs[id]; if (m && !m.boss) mx = Math.max(mx, N(m.lv)); });
    return (LVC[k] = mx);
  };
  var members = function () { var p = P(), out = []; if (!p) return out; if (!p.dead && p.hp > 0) out.push(p); (p.allies || []).forEach(function (a) { if (a && !a._downed && N(a.curHp) > 0) out.push(a); }); return out; };
  var hurtAll = function (pct) {
    var p = P(); members().forEach(function (x) {
      var mx = x === p ? N(p.mhp) : N(x.mhp), dmg = Math.floor(mx * pct);
      if (!(dmg > 0)) return;
      if (x === p) p.hp = Math.max(1, N(p.hp) - dmg); else x.curHp = Math.max(1, N(x.curHp) - dmg);
    });
  };
  var shieldOf = function (m) { return N(m._rrShield); };
  // ── 11-17（Ping）：戰鬥記錄「造成 0 點傷害」寫出原因（護盾吸收、免疫、幽影、沉眠之海）──
  //   擋下傷害的地方呼叫 __afkZeroMark(原因)；同一瞬間緊接著的「造成 0 點…傷害」記錄後面加上「（被擋下：原因）」。
  var ZW = { why: '', at: 0 };
  var zeroMark = W.__afkZeroMark = function (why) { ZW.why = String(why || ''); ZW.at = Date.now(); };
  var ZRX = /造成\s*((?:<[^>]*>)*)\s*0\s*((?:<\/[^>]*>)*)\s*點(魔法)?傷害/;
  if (typeof W.logCombat === 'function' && !W.logCombat.__afkZero) {
    var oLC = W.logCombat;
    var fLC = function (msg) {
      try {
        if (ZW.why && typeof msg === 'string' && Date.now() - ZW.at <= 30 && ZRX.test(msg)) {
          var a = Array.prototype.slice.call(arguments);
          a[0] = msg.replace(ZRX, function (all) { return all + '<span style="color:#93c5fd">（被擋下：' + ZW.why.replace(/[<>&]/g, '') + '）</span>'; });
          return oLC.apply(this, a);
        }
      } catch (e) {}
      return oLC.apply(this, arguments);
    };
    fLC.__afkZero = true; W.logCombat = fLC;
    try { (0, eval)('logCombat = window.logCombat'); } catch (e) {}
  }
  // ── 出場與 1 分鐘補盾 ──
  var scan = function () {
    var c = mode(); if (!c || inTown()) return;
    var t = tk(), L = (typeof mapState !== 'undefined' && mapState.mobs) || [], lv = null;
    for (var i = 0; i < L.length; i++) {
      var m = L[i]; if (!enemy(m) || m._dead || m.curHp <= 0) continue;
      if (!m._rrBorn) {
        m._rrBorn = t || 1;
        if (m.boss) { m._rrShield = m._rrShieldMax = Math.floor(N(m.hp) * c.barrier); m._rrBar = 1; log('<span class="font-bold" style="color:#93c5fd">【魔法屏障】</span>' + (m.n || '王') + ' 張開了屏障（' + Math.round(c.barrier * 100) + '% 最大 HP）。'); }
        else { if (lv === null) lv = mapLv(); if (lv >= 70) m._rrShield = m._rrShieldMax = Math.floor(N(m.hp) * c.mobShield); }
      } else if (m.boss && m._rrBar === 1 && t - m._rrBorn >= 600) {
        m._rrBar = 2; m._rrShield = m._rrShieldMax = shieldOf(m) + Math.floor(N(m.hp) * c.barrier);
        log('<span class="font-bold" style="color:#93c5fd">【魔法屏障】</span>' + (m.n || '王') + ' 再次張開屏障。');
      }
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); try { if (tk() !== t0) scan(); } catch (e) {} return r; };
  }
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function () { var r = oSpawn.apply(this, arguments); try { scan(); } catch (e) {} return r; };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  // ── 打到怪：王先減 5%／3%，再被護盾吸收 ──
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.damage.__afkRR || C.__hkRR) return;   // 只包一次（11-17 修：之前 load 後會被重複包好幾層）
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        var c = mode(); if (!c || !(v > 0) || !enemy(target)) return v;
        try { onHit(actor, target, opt); } catch (e) {}
        if (target.boss && !(opt && opt.kind === 'true')) v = Math.max(1, Math.floor(v * (1 - c.bossDr)));
        var s = shieldOf(target);
        if (s > 0) {
          // 11-17（Ping）：碎盾易傷（打盾 ×(1+%)，最多 +50%）、穿透易傷（一半打盾、一半打血）
          var bk = SV.brk(target), pen = SV.pen(target), toS = pen ? v * 0.5 : v, hpPart = v - toS, mul = 1 + bk;
          var a = Math.min(s, toS * mul); target._rrShield = s - a;
          v = Math.floor(hpPart + Math.max(0, toS - a / mul)); if (!(v > 0)) zeroMark('護盾吸收 ' + Math.floor(a).toLocaleString());
          if (target._rrShield <= 0) { if (target.boss) log('<span style="color:#93c5fd">' + (target.n || '王') + ' 的屏障破了。</span>'); }
          else if (tk() >= (target._rrAbsLog || 0)) { target._rrAbsLog = tk() + 50; log('<span style="color:#93c5fd">【' + (target.boss ? '魔法屏障' : '護盾') + '】' + (target.n || '怪物') + ' 的護盾吸收了傷害（還剩 ' + Math.ceil(target._rrShield).toLocaleString() + '）。</span>'); }   // 11-17：0 點傷害的原因要看得到（每 5 秒最多一行）
        }
      } catch (e) {}
      return v;
    };
    f.__afkRR = true; C.damage = f; C.__hkRR = true;
  };
  hookDmg(); W.addEventListener('load', function () { hookDmg(); setTimeout(hookDmg, 2000); });
  // ── 倒下時的傷害 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = null; try { m = mapState.mobs[idx]; } catch (e) {}
      var r = oKill.apply(this, arguments);
      try {
        var c = mode();
        if (c && enemy(m) && (m._dead || N(m.curHp) <= 0) && !m._rrDeathDone && !inTown()) {
          m._rrDeathDone = 1;
          if (m.boss) {
            var fast = m._rrBorn && tk() - m._rrBorn <= 300, pct = fast ? c.deathFast : c.death;
            hurtAll(pct);
            log('<span class="font-bold" style="color:#fca5a5">【臨終的反噬】</span>' + (m.n || '王') + ' 倒下時反噬全隊：最大 HP −' + Math.round(pct * 100) + '%' + (fast ? '（30 秒內擊倒）' : '') + '。');
          } else if (mapLv() >= 70) hurtAll(c.mobDeath);
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('killMob = window.killMob'); } catch (e) {}
  }
  // ── 11-17（Ping）：碎盾易傷、穿透易傷的來源 ──
  //   碎盾易傷：魔法相消術、破壞盔甲、粉碎能量、究極光裂術、弱化術命中（各 +20%，8 秒）；鈍器遺物一般攻擊命中 20% 機率（+20%，8 秒）。
  //            不同來源相加、同一來源只算一次，最多 +50%。
  //   穿透易傷：三重矢、奪命之雷、會心一擊命中；精準目標增益期間全隊命中；帶穿透或貫穿特效的遺物武器一般攻擊命中 → 5 秒。
  //   你、傭兵施放都算；寵物的弱化／疾病技能成功給碎盾、技能追加的攻擊給穿透（11-18）。
  var BRK_SK = { sk_cancel: 1, sk_dark_armorbreak: 1, sk_illu_crush: 1, sk_disintegrate: 1, sk_weaken: 1 };
  var PEN_SK = { sk_elf_triple: 1, sk_dragon_deathlightning: 1, sk_dark_crit: 1 };
  var SV = {
    brk: function (m) { var o = m && m._svBrk, t = tk(), n = 0; if (!o) return 0; for (var k in o) if (o[k] > t) n += 0.20; return Math.min(0.5, n); },
    pen: function (m) { return !!(m && (m._svPen || 0) > tk()); },
    addBrk: function (m, src) { if (!m || m._dead) return; (m._svBrk = m._svBrk || {})[src] = tk() + 80; },
    addPen: function (m) { if (!m || m._dead) return; m._svPen = tk() + 50; }
  };
  var skKey = function (sk) { if (typeof sk === 'string') return sk; if (!sk || typeof DB === 'undefined') return ''; if (sk.id && DB.skills[sk.id] === sk) return sk.id; for (var k in BRK_SK) if (DB.skills[k] === sk) return k; for (var j in PEN_SK) if (DB.skills[j] === sk) return j; return ''; };
  var curTarget = function () { try { var m = mapState.mobs[mapState.targetIdx]; return m && !m._dead && m.curHp > 0 ? m : null; } catch (e) { return null; } };
  var onCast = function (sk) { var k = skKey(sk); if (!k || !(BRK_SK[k] || PEN_SK[k])) return; var m = curTarget(); if (!m) return; if (BRK_SK[k]) SV.addBrk(m, k); if (PEN_SK[k]) SV.addPen(m); };
  var wrapCast = function (name, idx) {
    var o = W[name]; if (typeof o !== 'function' || o.__afkSV) return;
    var f = function () { var r = o.apply(this, arguments); try { if (r !== false && r != null && r !== 0) onCast(arguments[idx]); } catch (e) {} return r; };
    f.__afkSV = true; W[name] = f; try { (0, eval)(name + ' = window.' + name); } catch (e) {}
  };
  wrapCast('castSkill', 0); ['allyCastMagic', 'allyCastNonDamage', 'allyCastPhysicalSkill', 'allyCastCrush', 'allyCastFixedStatus'].forEach(function (n) { wrapCast(n, 1); });
  var party = function (a) { var p = P(); return !!(a && p && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var preciseOn = function () { var p = P(); if (!p) return false; if (p.buffs && (p.buffs.sk_royal_precise || 0) > 0) return true; return (p.allies || []).some(function (a) { return a && a.buffs && (a.buffs.sk_royal_precise || 0) > 0; }); };
  var wpnOf = function (a) { var w = a && a.eq && (a.eq.wpn || a.eq.weapon); return w && typeof DB !== 'undefined' ? DB.items[w.id] && { id: w.id, d: DB.items[w.id] } : null; };
  var bluntRelic = function (w) { if (!w || !w.d.relic) return false; try { return (getWeaponTags(w.id) || []).some(function (t) { return /鈍器/.test(t); }); } catch (e) { return false; } };
  var penRelic = function (w) { return !!(w && w.d.relic && (w.d.eff === 'pierce' || w.d.alsoPierce || w.d.ignHardSkin)); };
  var petSrc = function () { try { return typeof _combatSrc !== 'undefined' && _combatSrc === 'pet'; } catch (e) { return false; } };
  var petCasting = false;
  var onHit = function (actor, target, opt) {
    if (!enemy(target) || !party(actor)) return;
    if (preciseOn()) SV.addPen(target);
    if (petSrc()) { if (petCasting) SV.addPen(target); return; }   // 寵物：技能追加的攻擊（撕咬、勾爪等）→ 穿透；不吃主人的武器
    var k = opt && opt.kind; if (k !== 'melee' && k !== 'ranged') return;
    var w = wpnOf(actor); if (!w) return;
    if (penRelic(w)) SV.addPen(target);
    if (bluntRelic(w) && Math.random() < 0.20) SV.addBrk(target, 'blunt');
  };
  // 11-18（Ping）：寵物也會觸發——弱化術、疾病類技能成功 → 碎盾（寵物來源 +20%，8 秒）；技能追加的攻擊 → 穿透 5 秒
  if (typeof W.petCastSkill === 'function' && !W.petCastSkill.__afkSV) {
    var oPet = W.petCastSkill;
    var fPet = function (p, d, target) {
      var st = target && target.st, w0 = st ? Number(st.weaken) || 0 : 0, d0 = st ? Number(st.disease) || 0 : 0, r;
      petCasting = true;
      try { r = oPet.apply(this, arguments); } finally { petCasting = false; }
      try { var s1 = target && target.st; if (s1 && enemy(target) && ((Number(s1.weaken) || 0) > w0 || (Number(s1.disease) || 0) > d0)) SV.addBrk(target, 'pet'); } catch (e) {}
      return r;
    };
    fPet.__afkSV = true; W.petCastSkill = fPet; try { (0, eval)('petCastSkill = window.petCastSkill'); } catch (e) {}
  }
  W.__afkShieldVuln = { SV: SV, BRK_SK: BRK_SK, PEN_SK: PEN_SK, onHit: onHit };

  // ── 11-17（Ping）：怪物血條下方顯示護盾（藍條＋剩餘量），被打時數字往下掉 ──
  var fmtK = function (n) { n = Math.ceil(n); return n >= 1e8 ? (Math.round(n / 1e7) / 10) + '億' : n >= 1e4 ? (Math.round(n / 1e3) / 10) + '萬' : n.toLocaleString(); };
  var paintShields = function () {
    if (typeof state !== 'undefined' && state.ff) return;
    var L = (typeof mapState !== 'undefined' && mapState.mobs) || [];
    for (var i = 0; i < L.length; i++) {
      var m = L[i]; if (!m || !m.uid) continue;
      var el = document.querySelector('.mob-target[data-uid="' + m.uid + '"]'); if (!el) continue;
      var box = el.querySelector('.afk-rr-sh'), s = shieldOf(m);
      if (!(s > 0) || m._dead) { if (box) box.remove(); continue; }
      var mx = Math.max(s, N(m._rrShieldMax) || s), w = Math.max(2, Math.round(s / mx * 100));
      if (!box) {
        var bar = el.querySelector('.mob-hp-bar'); if (!bar) continue;
        box = document.createElement('div'); box.className = 'afk-rr-sh';
        box.style.cssText = 'display:flex;flex-direction:column;align-items:center;margin:-2px 0 2px;pointer-events:none';
        box.innerHTML = '<div style="width:50px;height:3px;background:#1e293b;border-radius:2px;overflow:hidden"><div class="afk-rr-shf" style="height:100%;background:#60a5fa"></div></div><div class="afk-rr-sht" style="font-size:10px;line-height:12px;color:#93c5fd;font-weight:700;text-shadow:0 0 3px #000"></div>';
        bar.parentNode.insertBefore(box, bar.nextSibling);
      }
      box.querySelector('.afk-rr-shf').style.width = w + '%';
      var bk = SV.brk(m), t = '🛡 ' + fmtK(s) + (bk > 0 ? ' 碎盾+' + Math.round(bk * 100) + '%' : '') + (SV.pen(m) ? ' 穿透' : ''), tx = box.querySelector('.afk-rr-sht');
      if (tx.textContent !== t) { tx.textContent = t; box.title = '護盾還剩 ' + Math.ceil(s).toLocaleString() + '／' + Math.ceil(mx).toLocaleString() + '（打掉護盾前，傷害都被它吸收）'; }
    }
  };
  if (typeof W._renderMobsImpl === 'function') {
    var oRM = W._renderMobsImpl;
    W._renderMobsImpl = function () { var r = oRM.apply(this, arguments); try { paintShields(); } catch (e) {} return r; };
    try { (0, eval)('_renderMobsImpl = window._renderMobsImpl'); } catch (e) {}
  }
  setInterval(function () { try { if (mode()) paintShields(); } catch (e) {} }, 500);   // 傷害不一定會重畫怪物，半秒補一次數字
  W.__afkRiftRules = { CFG: CFG, mode: mode, mapLv: mapLv };
  try { console.log('[AFK-riftrules] 已啟用：次元裂縫／夢域鏡的王屏障、死亡反噬、王減傷、70 等以上小怪'); } catch (e) {}
})();
