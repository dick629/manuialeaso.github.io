/* ============================================================================
 * afk-echorelic.js — 原作者 v3.9（2026-11-11）新增的 100 件遺物，融合進本版（Ping 11-20 20:03）
 *
 *   ‧物品代號、名稱、能力、特效完全照原作者（relic_echo_<怪物 id>，「怪物名＋的＋原型裝備名」），
 *     原作者版的存檔可以直接搬進來，同一件數值一致。
 *   ‧掉落：該怪物 0.0001%（跟本版遺物同一條路 MOB_DROPS，吃一樣的遺物掉落加成）；本來就掉本版遺物的怪＝兩種遺物各自判定。
 *   ‧可以在哈瑪大師合成 +1～+15（飾品 +10）、昇華支配 +1～+5、進化至高的支配——規則跟本版遺物完全相同（afk-relicplus 只看 relic 旗標）。
 *   ‧列入遺物收集冊；黑市遺物自選買得到；時空裂痕結算池不放（noRiftRelic）。
 *   能力公式（原作者）：怪物強度 power＝等級＋頭目 12＋HP、攻擊壓力、AC、MR、DR 的對數加權；
 *     武器 大小傷 +power/20、命中 +power/12、額外傷害 +power/8（魔杖類再加 MP、魔攻）；
 *     防具 AC +power/15、DR +power/35、MR +power/10、HP +5×power/10；飾品 AC、DR、MR、HP、額外傷害／命中；
 *     專屬特效依 effectKey（攻擊施法、異常、中毒、受傷回血、反彈、物理減傷、火焰無效…）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs) return;
  // 原作者 RELIC_EQUIPMENT_VARIANTS（[怪物 id, 原型裝備 id, 特效]）
  var ROWS = [
    ["skel_spear","wpn_4","slow"], // 骷髏槍兵 → 矛
    ["ant_giant_white","arm_108","mend"], // 巨大白螞蟻 → 塔盾
    ["tomb_guardian","arm_108","spines"], // 墳墓守護者 → 塔盾
    ["sanct_cursed_fighter","wpn_dual_spike","disease"], // 受詛咒的黑暗妖精鬥士 → 尖刺雙刀
    ["sanct_cursed_mage","amr_darkmage_robe","spirit"], // 受詛咒的黑暗妖精法師 → 黑法師長袍
    ["sanct_cursed_knight","wpn_sword_rasta","silence"], // 受詛咒的黑暗妖精騎士 → 拉斯塔巴德長劍
    ["sanct_scavenger","wpn_claw_steel","poison"], // 食腐獸 → 鋼鐵鋼爪
    ["sanct_tethys","arm_stone_glove","bastion"], // 特提斯 → 石製手套
    ["iv_armor","amr_plate","spines"], // 象牙塔活鎧甲 → 金屬盔甲
    ["demon_assassin","wpn_dagger_rasta","poison"], // 魔族暗殺團 → 拉斯塔巴德短劍
    ["ant_kama_nan","glv_fire_spirit","emberguard"], // 喀瑪南 → 火靈手套
    ["flame_baless","wpn_powerless_baless","flame"], // 炎魔的巴列斯 → 失去魔力的巴列斯魔杖
    ["ant_kama_flame","glv_water_spirit","coldguard"], // 喀瑪焰 → 水靈手套
    ["thebes_anus","blt_thebes_osiris","rebirth"], // 底比斯 阿努斯 → 底比斯歐西里斯腰帶
    ["pride_small_phantom","shd_illu_book","mirror"], // 小幻象眼魔 → 幻術士法書
    ["sanct_wyvern","clk_pride_wind","stormguard"], // 翼龍 → 風屬性斗篷
    ["de_elder_captain","wpn_dual_spike","stun"], // 拉斯塔巴德近衛隊隊長 → 尖刺雙刀
    ["death_priest_baphomet","amr_priest","rebirth"], // 死亡的司祭(巴風特) → 神官法袍
    ["chaos_priest_beast","wpn_hate_claw","disease"], // 混沌的司祭(野獸) → 恨之鋼爪
    ["iv_deathsword","wpn_dark_sword","vampire"], // 象牙塔死亡之劍 → 黑暗之劍
    ["iv_chimera","amr_centipede","purify"], // 象牙塔奇美拉 → 金屬蜈蚣皮盔甲
    ["iv_elder","acc_125","spirit"], // 象牙塔長者 → 長老項鍊
    ["iv_lightball","rng_wind","mirror"], // 象牙塔閃電球 → 風靈戒指
    ["abyss_water","glv_water_spirit","coldguard"], // 深淵水靈 → 水靈手套
    ["abyss_fire","glv_fire_spirit","emberguard"], // 深淵火靈 → 火靈手套
    ["abyss_wind","glv_wind_spirit","stormguard"], // 深淵風靈 → 風靈手套
    ["pride_iris_mob","arm_99","mirror"], // 艾莉絲 → 力量手套
    ["pride_terror_zombie_king","arm_99","purify"], // 恐怖的殭屍王 → 力量手套
    ["iv_lamia","acc_131","purify"], // 象牙塔蛇女 → 靈魂腰帶
    ["thebes_anus_b","blt_thebes_osiris","rebirth"], // 底比斯 阿努斯(黑) → 底比斯歐西里斯腰帶
    ["pride_marcus_vampire","wpn_chain_bloodthirst","vampire"], // 馬昆斯吸血鬼 → 嗜血者鎖鏈劍
    ["tomb_guardian_giant","arm_108","spines"], // 巨大墳墓守護者 → 塔盾
    ["iv_blackelder","wpn_witchwand","thunder"], // 象牙塔黑長者 → 巫術魔法杖
    ["flame_avatar","wpn_demon_axe","fireball"], // 炎魔的分身 → 惡魔斧頭
    ["iv_reaper","glv_reaper","spirit"], // 象牙塔死神 → 死神之手
    ["iv_blackmage","acc_demonbane","spirit"], // 象牙塔黑魔法師 → 滅魔戒指
    ["iv_shadow","clk_dark","mirror"], // 象牙塔影魔 → 黑暗斗篷
    ["thebes_bas","blt_thebes_osiris","mirror"], // 底比斯 巴斯 → 底比斯歐西里斯腰帶
    ["pride_mummy_king_mob","rng_earth","rebirth"], // 木乃伊王 → 地靈戒指
    ["iv_flameslave","shd_priest_book","flameguard"], // 象牙塔炎魔的奴隸 → 神官魔法書
    ["iv_spirit","amr_robe","spirit"], // 象牙塔惡靈 → 綿質長袍
    ["iv_imp","wpn_demon_axe","flame"], // 象牙塔小惡魔 → 惡魔斧頭
    ["iv_baless","wpn_powerless_baless","fireball"], // 象牙塔巴列斯之影 → 失去魔力的巴列斯魔杖
    ["thebes_bas_r","blt_thebes_osiris","mirror"], // 底比斯 巴斯(紅) → 底比斯歐西里斯腰帶
    ["pride_earth_king","rng_earth","bastion"], // 土精靈王 → 地靈戒指
    ["pride_water_king","rng_water","coldguard"], // 水精靈王 → 水靈戒指
    ["pride_fire_king","rng_fire","emberguard"], // 火精靈王 → 火靈戒指
    ["pride_wind_king","rng_wind","stormguard"], // 風精靈王 → 風靈戒指
    ["iv_hatin","wpn_demon_sword","thunder"], // 哈汀之影 → 惡魔之劍
    ["pride_vander_mob","wpn_siruge","stun"], // 騎士范德 → 瑟魯基之劍
    ["pride_phantom_boss","wpn_crystal_dagger","stone"], // 不幸的幻象眼魔 → 水晶短劍
    ["pride_jenis","acc_138","purify"], // 扭曲的潔尼斯女王 → 守護皮帶
    ["pride_vampire_boss","arm_87","rebirth"], // 恐怖的吸血鬼 → 保護者斗篷
    ["iv_wing","clk_pride_wind","stormguard"], // 象牙塔翼魔 → 風屬性斗篷
    ["flame_demon","wpn_hate_claw","fireball"], // 炎魔的惡魔 → 恨之鋼爪
    ["de_king_slayer","wpn_assassin_mark","poison"], // 暗殺軍王史雷佛 → 暗殺軍王之痕
    ["iv_baphomet","wpn_powerless_baphomet","earthquake"], // 象牙塔巴風特之影 → 失去魔力的巴風特魔杖
    ["ant_earth_wild_dragon","armguard_dragonscale","bastion"], // 大地荒龍 → 龍鱗臂甲
    ["ant_kama_nan_king","glv_fire_spirit","emberguard"], // 喀瑪南王 → 火靈手套
    ["ant_kama_flame_king","glv_water_spirit","coldguard"], // 喀瑪焰王 → 水靈手套
    ["pride_zombie_king","blt_mr","rebirth"], // 死亡的殭屍王 → 抗魔皮帶
    ["iv_flameshadow","clk_pride_fire","emberguard"], // 象牙塔炎魔之影 → 火屬性斗篷
    ["iv_demonshadow","wpn_demon_dual","fireball"], // 象牙塔惡魔之影 → 惡魔雙刀
    ["de_king_baranka","wpn_baranka_claw","broken"], // 魔獸軍王巴蘭卡 → 魔獸軍王之爪
    ["flameshadow_guard_baphomet","shd_priest_book","mend"], // 火焰之影親衛隊(巴風特) → 神官魔法書
    ["pride_mummy_king","rng_earth","rebirth"], // 不死的木乃伊王 → 地靈戒指
    ["pride_panther_boss","wpn_claw_abyss","stun"], // 地獄的黑豹 → 暗黑鋼爪
    ["pride_iris_boss","arm_99","mirror"], // 冷酷的艾莉絲 → 力量手套
    ["de_king_laia","amr_laia_robe","coldguard"], // 法令軍王蕾雅 → 蕾雅長袍
    ["abyss_lord","acc_abyss_ring","spirit"], // 深淵之主 → 深淵戒指
    ["fallen_boss","blt_mr","rebirth"], // 墮落 → 抗魔皮帶
    ["phoenix","wpn_redflame_bow","fireball"], // 不死鳥 → 赤焰之弓
    ["ant_kama_king","wpn_qigu_obsidian","earthquake"], // 喀瑪王 → 黑曜石奇古獸
    ["giant_ancient","wpn_greatsword","stun"], // 古代巨人 → 巨劍
    ["ant_queen","wpn_ancient_elf_xbow","poison"], // 巨蟻女皇 → 古代妖精弩槍
    ["ice_demon","wpn_crystal_dagger","freeze"], // 冰魔 → 水晶短劍
    ["death_boss","wpn_iron_axehead","vampire"], // 死亡 → 鐵斧頭
    ["thebes_anubis","blt_thebes_osiris","rebirth"], // 底比斯 阿努比斯 → 底比斯歐西里斯腰帶
    ["thebes_horus","amu_int","stormguard"], // 底比斯 賀洛斯 → 智力項鍊
    ["de_king_heruby","shd_priest_book","mend"], // 冥法軍王海露拜 → 神官魔法書
    ["chaos_boss","wpn_chaos_thorn","disease"], // 混沌 → 混沌之刺
    ["nm_034","wpn_2hsword","flame"], // 惡魔 → 雙手劍
    ["ice_queen","glv_crystal","coldguard"], // 冰之女王 → 水晶手套
    ["pride_vander_boss","wpn_siruge","stun"], // 闇黑的騎士范德 → 瑟魯基之劍
    ["de_elder_kina","amr_laia_robe","mirror"], // 長老．琪娜 → 蕾雅長袍
    ["pride_lich_boss","clk_silver_light","spirit"], // 不滅的巫妖 → 銀光斗篷
    ["pride_reaper_boss","wpn_dual_abyss","vampire"], // 邪惡的鐮刀死神 → 暗黑雙刀
    ["de_elder_adiel","glv_dark","purify"], // 長老．艾迪爾 → 黑暗手套
    ["de_elder_batas","wpn_dual_spike","broken"], // 長老．巴塔斯 → 尖刺雙刀
    ["de_elder_balos","wpn_red_crystalwand","thunder"], // 長老．巴洛斯 → 紅水晶魔杖
    ["de_elder_taimas","wpn_blood_2hsword","vampire"], // 長老．泰瑪斯 → 血色巨劍
    ["lindvior","clk_pride_wind","stormguard"], // 林德拜爾 → 風屬性斗篷
    ["de_elder_andis","wpn_official_blade","silence"], // 長老．安迪斯 → 武官之刃
    ["de_elder_ramas","wpn_claw_dark","poison"], // 長老．拉曼斯 → 黑暗鋼爪
    ["fafurion","acc_131","coldguard"], // 法利昂 → 靈魂腰帶
    ["antaras","amr_plate","bastion"], // 安塔瑞斯 → 金屬盔甲
    ["valakas","wpn_qigu_resonance","firestorm"], // 巴拉卡斯 → 共鳴奇古獸
    ["ant_antharas_mad","wpn_claw_abyss","collapse"], // 被侵蝕的瘋狂安塔瑞斯 → 暗黑鋼爪
    ["de_elder_balud","wpn_red_crystalwand","firestorm"], // 長老．巴陸德 → 紅水晶魔杖
    ["sanct_giltas","wpn_official_blade","collapse"], // 吉爾塔斯 → 武官之刃
  ];
  var KEYS = [];
  (function () {
    const positive = value => Number.isFinite(value) ? Math.max(0, value) : 0;
    const meanRoll = dice => Array.isArray(dice) ? positive(dice[0]) * (positive(dice[1]) + 1) / 2 : 0;
    function powerOf(mob) {
        const lv = Math.max(1, positive(mob.lv));
        let pressure = (meanRoll(mob.dmg) + positive(mob.db)) / Math.max(0.5, positive(mob.atkSpd));
        for (const key of ['mag', 'mag2', 'mag3']) {
            const skill = mob[key];
            if (!skill) continue;
            const hit = (meanRoll(skill.dmg) + positive(skill.db)) * Math.max(1, positive(skill.times));
            const dot = positive(skill.d) * Math.max(1, positive(skill.dur) / Math.max(1, positive(skill.tick)));
            pressure += (hit + dot) / Math.max(1, positive(skill.cd) / 10);
        }
        // 等級與頭目分帶為主，血量、攻擊壓力與防禦補足同級差異。
        // 僅轉成固定能力預算；不修改怪物、觸發機率、冷卻或職業限制。
        return Math.round(lv + (mob.boss ? 12 : 0)
            + 2 * Math.log2(1 + positive(mob.hp) / (50 + lv * 10))
            + 3 * Math.log2(1 + pressure / 10)
            + positive(-mob.ac) / 40 + positive(mob.mr) / 75 + positive(mob.dr) / 10);
    }
    // 每件新增遺物都有獨立特殊效果；沿用既有觸發通道，不增加戰鬥輪詢或遞迴施法。
    // 原裝備的 eff／共鳴／雙擊等保留；procSkill2 是既有第二施法槽，適用一般武器與奇古獸。
    const spellEffects = {
        fireball: 'sk_fireball', flame: 'sk_blaze', thunder: 'sk_thunder',
        earthquake: 'sk_earthquake', vampire: 'sk_vampire',
        firestorm: 'sk_fire_storm', collapse: 'sk_earth_collapse'
    };
    const statusEffects = {
        stun: 'sk_relic_stun', freeze: 'sk_relic_freeze', slow: 'sk_relic_slow',
        silence: 'sk_relic_silence', stone: 'sk_relic_stone', broken: 'sk_relic_broken', disease: 'sk_disease'
    };
    function specialEffect(key, power) {
        const tier = Math.min(5, Math.max(1, Math.floor(power / 30)));
        if (spellEffects[key]) return { procSkill2: { skId: spellEffects[key],
            rate: key === 'firestorm' || key === 'collapse' ? 3 + Math.floor(tier / 2) : 4 + tier } };
        if (statusEffects[key]) return { procStatusSkill: { skId: statusEffects[key],
            rate: key === 'disease' ? 4 + tier : 1 + Math.floor(power / 55) } };
        switch (key) {
            case 'poison': return { procPoison: { rate: 8 + tier * 2, dmg: [6 + tier * 4, 1], dur: 6, tick: 1 } };
            case 'mend': return { onDmgHeal: power < 80 ? 'sk_heal1' : 'sk_heal_mid', onDmgHealCd: Math.max(5, 9 - tier) };
            case 'spines': return { thorns: 4 + tier * 3, physDrGated: 8 + tier * 2 };
            case 'bastion': return { physDrGated: 10 + tier * 3, thorns: tier * 2 };
            case 'mirror': return { dmgReflect: 2 + tier };
            case 'purify': return { statusHealHp: 10 + tier * 8 };
            case 'spirit': return { dotMpRefund: 10 + tier * 3 };
            case 'flameguard': return { fireNullify: true };
            case 'emberguard': return { fireNullify: true, thorns: tier * 2 };
            case 'coldguard': return { statusHealHp: 10 + tier * 6, dmgReflect: 2 + tier };
            case 'stormguard': return { dmgReflect: 2 + tier, dotMpRefund: 10 + tier * 2 };
            case 'rebirth': return { statusHealHp: 15 + tier * 10, dotMpRefund: 10 + tier * 2 };
            default: throw new Error('Unknown relic special effect: ' + key);
        }
    }

    ROWS.forEach(function (row) {
      var mobId = row[0], baseId = row[1], effectKey = row[2];
      var mob = DB.mobs[mobId], base = DB.items[baseId], id = 'relic_echo_' + mobId;
      if (!mob || !base || base.relic || base.legend || ['wpn', 'arm', 'acc'].indexOf(base.type) < 0 || base.isArrow || base.slot === 'petwpn' || base.slot === 'petarm') return;
      if (DB.items[id]) { KEYS.push(id); return; }
      var power = powerOf(mob), item = JSON.parse(JSON.stringify(base));
      Object.assign(item, {
        n: mob.n + '的' + base.n, img: getIconUrl(base),
        relic: true, noEnhance: true, gachaWeight: 0, p: 10000, noRiftRelic: true,
        relicBaseId: baseId, relicSourceId: mobId, relicPower: power, relicEffectKey: effectKey, relicEcho: 1,
        d: '【遺物】' + mob.n + '遺留的' + base.n + '，在戰鬥中凝聚了超越原型的力量。'
      });
      delete item._spdFam;
      var add = function (key, amount) { var v = Number(item[key]) || 0; if (amount > 0 && v >= 0) item[key] = v + amount; };
      if (base.type === 'wpn') {
        add('dmgS', Math.ceil(power / 20)); add('dmgL', Math.ceil(power / 20));
        add('hit', Math.ceil(power / 12)); add('dmgBonus', Math.ceil(power / 8));
        if (base.qigu || base.isWand || base.extraMp || /杖|水晶球/.test(base.n)) { add('extraMp', Math.ceil(power / 20)); add('mdmg', Math.floor(power / 40)); }
      } else if (base.type === 'arm') {
        add('ac', Math.ceil(power / 15)); add('dr', Math.floor(power / 35));
        add('mr', Math.ceil(power / 10)); add('mhp', 5 * Math.ceil(power / 10));
      } else {
        add('ac', Math.floor(power / 30)); add('dr', Math.floor(power / 40));
        add('mr', Math.ceil(power / 10)); add('mhp', 5 * Math.ceil(power / 10));
        add('extraDmg', Math.floor(power / 25)); add('extraHit', Math.floor(power / 25));
      }
      var fx; try { fx = specialEffect(effectKey, power); } catch (e) { return; }
      Object.keys(fx).forEach(function (k) { if (base[k] === undefined) item[k] = fx[k]; });
      DB.items[id] = item; KEYS.push(id);
      try { if (typeof ITEM_WEIGHTS !== 'undefined') ITEM_WEIGHTS[item.n] = ITEM_WEIGHTS[base.n] || 0; } catch (e) {}
      try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[baseId] && !WEAPON_TAGS[id]) WEAPON_TAGS[id] = WEAPON_TAGS[baseId].slice(); } catch (e) {}
    });
  })();
  // 遺物收集冊（索引在載入時就建好了，補進去）
  var addBook = function () {
    try {
      if (typeof RELIC_CAT_ITEMS === 'undefined' || typeof equipCatKey !== 'function') return;
      KEYS.forEach(function (k) { var ck = equipCatKey(k, DB.items[k]); if (!ck || !RELIC_CAT_ITEMS[ck] || RELIC_CAT_ITEMS[ck].indexOf(k) >= 0) return; RELIC_CAT_ITEMS[ck].push(k); RELIC_ITEM_CAT[k] = ck; });
    } catch (e) {}
  };
  // 掉落：MOB_DROPS[怪物名稱]，0.0001%
  var addDrops = function () {
    if (typeof MOB_DROPS === 'undefined') return;
    KEYS.forEach(function (id) { var mob = DB.mobs[DB.items[id].relicSourceId]; if (!mob) return; var l = MOB_DROPS[mob.n] = MOB_DROPS[mob.n] || []; if (!l.some(function (x) { return x[0] === id; })) l.push([id, 0.0001]); });
  };
  addBook(); addDrops();
  W.addEventListener('load', function () { addBook(); addDrops(); setTimeout(addDrops, 0); setTimeout(addDrops, 700); });
  W.__afkEchoRelic = { KEYS: KEYS };
})();
