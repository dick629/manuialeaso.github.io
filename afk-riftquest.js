/* ============================================================================
 * afk-riftquest.js — 次元裂縫任務線「吞噬天空的光」（6 章）＋伊娃支線「伊娃的水」（3 章）
 *   設計：claude/story-design.md 第三節 b、claude/story-fix-1118.md 第 2～8 項（Ping 11-18 20:02 同意；獎勵依現在的裂縫材料重排；21:31「開始製作 然後上線」）
 *
 *   開放：完成二次轉生，而且進過次元裂縫一次（afkDimRift.ever）。
 *   任務道具只在「次元裂縫開著」時掉（野外），或在裂縫副本裡打倒指定頭目時掉。
 *   吞噬天空的光：
 *     1 次元裂隙（長老會議廳）：裂縫中一般怪 ×50；野外不回村撐過 10 分鐘 ×1
 *     2 迷幻森林之母：裂縫中精靈墓穴一般怪 ×40；深淵之主 ×3
 *     3 希蓮恩：裂縫中日出之國東、西、北、城墎各 1 顆種子；四張地圖一般怪 ×60
 *     4 半身的席琳（席琳神殿，看過第三階層真相後出現）：裂縫中傲慢之塔 91～100 一般怪 ×40；墮光天使 阿納金（任一形態）×5
 *     5 奧拉奇里亞：四條龍各 1 次（裂縫中的巢穴或四龍副本・裂縫）；交付時隊伍裡要有龍騎士
 *     6 無名的說書人：深淵的大王烏賊 ×1、星蝕者 艾斯崔亞 ×1
 *   伊娃的水（完成吞噬天空的光第 3 章後，海音 琉米埃爾）：
 *     1 裂縫中伊娃王國 ×40；映照者 米菈 ×1
 *     2 裂縫中傲慢之塔頂的四位精靈王各 1 次
 *     3 裂縫中伊娃王國 ×30；墮光天使 阿納金（任一形態）×1
 *   經典模式沒有；外掛開關 riftquest。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.AFK_TOGGLES && W.AFK_TOGGLES.register) W.AFK_TOGGLES.register({ id: 'riftquest', name: '劇情「吞噬天空的光」「伊娃的水」', desc: '次元裂縫任務線 6 章＋伊娃支線 3 章', group: '劇情', def: true });
  if (W.AFK_TOGGLES && W.AFK_TOGGLES.enabled && !W.AFK_TOGGLES.enabled('riftquest')) return;
  var L = W.__afkLore; if (!L) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var QC = function (p) { return (typeof questCls === 'function') ? questCls(p) : (p && p.cls); };
  var esc = L.esc, sys = L.sys;
  var classic = function (p) { return !!(p && p.classicMode); };
  var IMG = 'assets/icons/items/';
  var HALF_ID = 'npc_afk_halfsherine', HALF_N = '半身的席琳';
  var riftOn = function () { try { return !!(W.__afkDimRiftOn && W.__afkDimRiftOn()); } catch (e) { return false; } };
  var opened = function (p) { var r = p && p.afkDimRift; return !!(r && (r.ever || r.on)); };
  var TAIL = '（次元裂縫開著時才會掉）';

  var Q = {
    ero: { id: 'afk_rq_ero', n: '縫隙侵蝕結晶', img: IMG + '原石碎片.png', d: '裂縫的光落在怪物身上凝成的結晶，握在手裡會發燙。' },
    stay: { id: 'afk_rq_stay', n: '被拆開的光', img: IMG + '原石碎片.png', d: '在裂縫的光底下站了很久的人，身上會剝落這樣的光。' },
    root: { id: 'afk_rq_root', n: '枯萎的根脈', img: IMG + '原石碎片.png', d: '精靈墓穴底下的根，裡面的以太被抽得一乾二淨。' },
    heart: { id: 'afk_rq_heart', n: '被吸乾的樹心', img: IMG + '原石碎片.png', d: '深淵之主守著的樹心，摸起來像一塊冷掉的炭。' },
    seed: { id: 'afk_rq_seed', n: '沉睡的世界之樹種子', img: IMG + '原石碎片.png', d: '藏在日出之國的種子。它在異國長大，不認得天上的光。' },
    charm: { id: 'afk_rq_charm', n: '種子的守護符', img: IMG + '古代的卷軸.png', d: '日出之國的妖怪們貼在種子旁邊的符。' },
    plume: { id: 'afk_rq_plume', n: '沉默的光羽', img: IMG + '原石碎片.png', d: '傲慢之塔頂端落下的羽毛，摸不到溫度，也聽不到聲音。' },
    oracle: { id: 'afk_rq_oracle', n: '傳不下去的神諭', img: IMG + '古代的卷軸.png', d: '墮光天使倒下時留下的話，只寫到一半。' },
    assent: { id: 'afk_rq_assent', n: '龍的同意', img: IMG + '原石碎片.png', d: '一片自己脫落的龍鱗。龍不會把鱗交給敵人。' },
    log: { id: 'afk_rq_log', n: '沉船的航海日誌', img: IMG + '古老的交易文件.png', d: '墓船船長的日誌，最後一頁寫著：「天空裂開的那天，我們往另一邊划。」' },
    page: { id: 'afk_rq_page', n: '墜星的一頁', img: IMG + '古代的卷軸.png', d: '從天上掉下來的一頁故事，筆跡和說書人的很像。' },
    evaw: { id: 'afk_rq_evaw', n: '混了光的水', img: IMG + '原石碎片.png', d: '伊娃王國的水，底下沉著一層金色的光。' },
    refl: { id: 'afk_rq_refl', n: '看不見自己的倒影', img: IMG + '原石碎片.png', d: '倒影迴廊最深處的鏡片，照得出每一個人，唯獨照不出拿著它的人。' },
    oath: { id: 'afk_rq_oath', n: '精靈王的證言', img: IMG + '古代的卷軸.png', d: '四位精靈王各寫了一行字，說的是同一件事。' },
    tear: { id: 'afk_rq_tear', n: '伊娃的眼淚', img: IMG + '原石碎片.png', d: '水之女神第一次為自己流的眼淚。' },
    word: { id: 'afk_rq_word', n: '被截斷的神諭', img: IMG + '古代的卷軸.png', d: '從墮光天使身上取回的神諭，伊娃要親眼看看上面寫了什麼。' }
  };
  var DRAGONS = ['安塔瑞斯', '法利昂', '巴拉卡斯', '林德拜爾'];
  var SUN = { sunrise_east: '東之地', sunrise_west: '西之地', sunrise_north: '北之地', sunrise_castle: '城墎' };
  var KINGS = ['土精靈王', '水精靈王', '風精靈王', '火精靈王'];
  // 掉落規則：maps＝裂縫開著時在這些地圖打倒一般怪；field＝裂縫開著時任一野外一般怪；names＝打倒這些名字的怪（含副本）；uniq＝每個名字／地圖只算一次
  var RULE = {
    afk_rq_ero: { field: true },
    afk_rq_root: { maps: ['elf_grave'] },
    afk_rq_heart: { names: ['深淵之主'], rift: true },
    afk_rq_seed: { maps: Object.keys(SUN), uniqMap: true, anyMob: true },
    afk_rq_charm: { maps: Object.keys(SUN) },
    afk_rq_plume: { maps: ['pride_91_100'] },
    afk_rq_oracle: { names: ['墮光天使 阿納金'], boss: true },
    afk_rq_assent: { dragon: true },
    afk_rq_log: { names: ['深淵的大王烏賊'], boss: true },
    afk_rq_page: { names: ['星蝕者 艾斯崔亞'], boss: true },
    afk_rq_evaw: { maps: ['eva_kingdom'] },
    afk_rq_refl: { names: ['映照者 米菈'], boss: true },
    afk_rq_oath: { names: KINGS, uniq: true, rift: true },
    afk_rq_tear: { maps: ['eva_kingdom'] },
    afk_rq_word: { names: ['墮光天使 阿納金'], boss: true }
  };
  var req = function (q, need, extra) { return Object.assign({ need: need, mobs: [] }, q, { d: q.d + (extra || '') }); };

  // ── 吞噬天空的光 ──
  var line = L.defineLine({
    id: 'riftq', name: '吞噬天空的光', own: HALF_ID, hostIds: ['npc_afk_gt_rift', 'npc_mother', 'npc_shenien', HALF_ID, 'npc_orachilia', 'npc_afk_storyteller'], hostN: '次元裂隙',
    intro: '天上的縫從兩道變成了三道。光從縫裡落下來，落在哪裡，哪裡就開始被拆開。（完成二次轉生、進過次元裂縫一次後接取；任務道具只在次元裂縫裡取得）',
    outro: '說書人笑了，笑得很久：「我說過我只是個講故事的人。好吧——我叫格蘭肯。下一段故事，要從一把砸毀過巨人之都的錘子說起。」',
    chapters: [
      { lv: 80, title: '縫隙的第一道裂紋', map: '次元裂縫中任一野外（一般怪）＋不回村撐過 10 分鐘・接取：長老會議廳 次元裂隙',
        story: '次元裂隙：「我說過，裂痕的另一頭有人在往這邊看。現在，她伸手了。」我是從下面被撕開的；天上那幾道，是從上面割開的——很乾淨、很筆直，像一道切口。去外面待一會兒，別急著回村子。親身感覺一下，她要對這個世界做什麼。',
        reqs: [req(Q.ero, 50, TAIL), req(Q.stay, 1, '（次元裂縫開著時，在村莊以外連續撐過 10 分鐘取得；回村、倒下或關掉裂縫會重算）')],
        first: [['afk_rift_shard', 100], ['afk_dim_crystal', 500], ['afk_star_dust', 300]] },
      { lv: 80, title: '世界之樹在流血', map: '次元裂縫中的精靈墓穴（一般怪）＋深淵之主・接取：妖精森林 迷幻森林之母',
        story: '迷幻森林之母：「我們向她祈禱了幾千年，她回應我們的方式，是拿走這棵樹。」樹的以太正被抽向天空。根脈上張著一層光龍的結界——奧拉奇里亞聽了神諭，替那道光守著樹根，她以為自己在保護它。根還連著每一座村子，只要根還在，村子就還是安全的。',
        reqs: [req(Q.root, 40, TAIL), req(Q.heart, 3, TAIL)],
        first: [['afk_dim_xcrystal', 100], ['afk_rd_water', 3], ['afk_rd_sand', 10]] },
      { lv: 80, title: '流落異國的種子', map: '次元裂縫中的日出之國 東之地、西之地、北之地、城墎（一般怪）・接取：希培利亞村莊 希蓮恩',
        story: '希蓮恩：「河童說，交給牠們種子的是一個水色頭髮的女人，眼睛很悲傷。」當年被偷運出國的世界之樹種子，是席琳託付給異國的妖怪們藏起來的。在異國長大的分身不認得天上的光，所以吸不走——那是她留給這個世界的後路。',
        reqs: [req(Q.seed, 4, '（東之地、西之地、北之地、城墎各一顆）' + TAIL), req(Q.charm, 60, TAIL)],
        first: [['afk_fate_unlock', 1], ['afk_rd_mirror', 20], ['afk_split_dust', 300]] },
      { lv: 80, title: '沉默的天使', map: '次元裂縫中的傲慢之塔 91～100 樓（一般怪）＋墮光天使 阿納金（任一形態）・接取：席琳神殿 半身的席琳',
        story: '半身的席琳：「是他牽著我的手走上那座塔的。他的手在發抖。」阿納金的號角，是天上向人間傳話用的。亞丁的祭司們開始吵架了：一派說光沒有錯，另一派第一次在祈禱時睜開眼睛。打倒他，讓神諭傳不下來。',
        reqs: [req(Q.plume, 40, TAIL), req(Q.oracle, 5, '（墮光天使 阿納金任一形態，每次打倒得到一份）')],
        first: [['afk_rd_pick', 2], ['afk_rd_feather', 20], ['afk_time_mirror', 2]] },
      { lv: 80, title: '第二次諸神之戰', map: '次元裂縫中的四龍巢穴或四龍副本・裂縫（四條龍各一次）・接取：燃柳村 奧拉奇里亞（交付時隊伍裡要有龍騎士）',
        story: '奧拉奇里亞：「我替那道光守了樹根，守到樹快死了，才知道自己守的是誰。」她撤掉了根脈上的結界。「上一次，我求母親住手。這一次，我們一起叫另一位住手。」去請四條龍點頭；龍不會把鱗交給敵人。',
        reqs: [req(Q.assent, 4, '（安塔瑞斯、法利昂、巴拉卡斯、林德拜爾各一片）')],
        first: [['afk_fate_unlock', 2], ['afk_dim_xcrystal', 200], ['afk_rd_scale', 10]],
        onDone: function () { var t = ['<span class="afk-lore" style="color:#fcd34d">普洛凱爾：「龍騎士守了這棵樹幾百年，原來是在等今天。」</span>', '<span class="afk-lore" style="color:#cbd5e1">天空裂開了。一道光筆直地落向四龍——奧拉奇里亞張開翅膀擋在前面。光散去的時候，她已經不在了。</span>', '<span class="afk-lore" style="color:#cbd5e1">裂縫的另一邊有星星，不是你認得的任何一顆。</span>']; t.forEach(function (h, i) { setTimeout(function () { sys(h); }, 800 + i * 900); }); } },
      { lv: 80, title: '說書人的笑', map: '漂流的墓船 深淵的大王烏賊＋星墜的祭壇 星蝕者 艾斯崔亞・接取：席琳神殿 無名的說書人',
        story: '說書人：「人類改寫過一次神話，我笑了。這一次改寫的是神自己，我笑不出來。」他說故事散落在兩個地方：一艘往天空另一邊划的船，和一顆從天上掉下來的星。把那兩頁帶回來，他就把結局講給你聽。',
        reqs: [req(Q.log, 1), req(Q.page, 1)],
        first: [['afk_fate_unlock', 1], ['afk_star_core', 15], ['afk_merge_dust', 10]],
        onDone: function () { var t = ['<span class="afk-lore" style="color:#a5f3fc">半身的席琳把手伸進水裡，撈起一片燒焦的龍鱗。「妳替我擋過一次光。這一次，換我。」</span>', '<span class="afk-lore" style="color:#fcd34d">奧拉奇里亞睜開眼睛。燃柳村的天空，下了第一場雨。</span>']; t.forEach(function (h, i) { setTimeout(function () { sys(h); }, 2200 + i * 900); }); } }
    ]
  });

  // ── 伊娃的水 ──
  var eva = L.defineLine({
    id: 'evaq', name: '伊娃的水', hostIds: ['npc_lumiel'], hostN: '琉米埃爾',
    intro: '「女神最近不太說話了。」受伊娃眷顧的鍛者琉米埃爾說，海音的水井裡，開始浮起不該有的光。（完成「吞噬天空的光」第 3 章後接取；任務道具只在次元裂縫裡取得）',
    outro: '伊娃：「我替她管了幾千年的水，管到忘了水是誰的。」水色頭髮的女人站在她身後，沒有說話，只是把她扶了起來。',
    chapters: [
      { lv: 80, title: '水之權柄', map: '次元裂縫中的伊娃王國（一般怪）＋倒影迴廊 映照者 米菈・接取：海音 琉米埃爾',
        story: '琉米埃爾：「女神把水之權柄握得很緊，可是水不聽她的。」伊娃王國的水底沉著一層金光——伊娃握著的，是從席琳手裡拿走的權柄。倒影迴廊最深處有一面鏡子，照得出每一個人，唯獨照不出拿著它的人。帶回來給女神看。',
        reqs: [req(Q.evaw, 40, TAIL), req(Q.refl, 1, '（倒影迴廊 映照者 米菈）')],
        first: [['afk_rd_neptune', 30], ['afk_rd_water', 5]] },
      { lv: 80, title: '女神的劍', map: '次元裂縫中的傲慢之塔頂 土、水、風、火精靈王（各一次）・接取：海音 琉米埃爾',
        story: '伊娃：「如果我是傀儡，那就讓我親手斬斷線。」她要去死亡之海，殺掉剩下的那一半席琳，證明自己不是誰的手。帕格里奧、瑪普勒、莎哈攔在海邊，說書人也來了。四位精靈王寫下證言：水之權柄是被一道光從席琳手裡切下來，再放進伊娃掌心的。',
        reqs: [req(Q.oath, 4, '（土、水、風、火精靈王各一份）' + TAIL)],
        first: [['afk_fate_unlock', 1], ['afk_dim_xcrystal', 200]] },
      { lv: 80, title: '水回到水裡', map: '次元裂縫中的伊娃王國（一般怪）＋墮光天使 阿納金（任一形態）・接取：海音 琉米埃爾',
        story: '伊娃：「把神諭拿來，我要親眼看。」神諭上寫著她的名字，寫在「可以捨棄」那一欄。她把權柄還給了水，轉身對著天空舉起劍——那道光比劍快。伊娃王國下了很久的雨，雨水是黑的，跟夢裡一樣。',
        reqs: [req(Q.tear, 30, TAIL), req(Q.word, 1, '（墮光天使 阿納金任一形態）')],
        first: [['afk_time_mirror', 3], ['afk_merge_dust', 10], ['afk_fate_unlock', 1]],
        onDone: function () { var t = ['<span class="afk-lore" style="color:#a5f3fc">半身的席琳在雨裡蹲下來，捧起一掌黑色的水：「妹妹，該醒了。」</span>', '<span class="afk-lore" style="color:#cbd5e1">海音的水井裡，光沉下去了。</span>']; t.forEach(function (h, i) { setTimeout(function () { sys(h); }, 1500 + i * 900); }); } }
    ]
  });

  var keyR = function (i, p) { return L.keyOf(line, i, QC(p || P() || {}) || ''); };
  var keyE = function (i, p) { return L.keyOf(eva, i, QC(p || P() || {}) || ''); };
  var idxOf = function (key) { var m = /^afkL_(riftq|evaq)_(\d+)_/.exec(String(key || '')); return m ? { l: m[1], i: Number(m[2]) - 1 } : null; };
  var have = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var st = function (p) { p.afkRiftQ = p.afkRiftQ && typeof p.afkRiftQ === 'object' ? p.afkRiftQ : {}; return p.afkRiftQ; };
  var halfOn = function (p) { return !!(p && p.afkTruth); };
  var baseCls = function (a) { var c = a && (a._awkSw || a.cls); try { var b = W.__afkAwkMerc && W.__afkAwkMerc.baseOf(c); if (b) return b; } catch (e) {} return a === P() ? QC(a) : c; };
  var hasDK = function (p) { if (baseCls(p) === 'dragon') return true; return (p.allies || []).some(function (a) { return a && baseCls(a) === 'dragon'; }); };

  var gate = function (x, p) {
    if (classic(p)) return '經典模式沒有這條劇情。';
    if (Math.floor(p.rebirth || 0) < 2) return '要完成二次轉生。';
    if (!opened(p)) return '先進一次次元裂縫（席琳神殿 裂縫的守門人）。';
    if (x.l === 'riftq' && x.i === 3 && !halfOn(p)) return '半身的席琳還沒有醒來。（要先在終焉第三階層看過真相）';
    if (x.l === 'evaq' && x.i === 0 && trialQStateFor(p, keyR(2, p)) !== 2) return '琉米埃爾：「女神不見外人。」（要先完成「吞噬天空的光」第 3 章）';
    return '';
  };
  if (typeof W.trialQAccept === 'function') {
    var oAcc = W.trialQAccept;
    W.trialQAccept = function (key) {
      var x = idxOf(key), p = P();
      if (x && p) { var why = gate(x, p); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; } }
      return oAcc.apply(this, arguments);
    };
  }
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var x = idxOf(key), p = P();
      if (x && p && x.l === 'riftq' && x.i === 4 && trialQState(key) === 1 && !hasDK(p)) { sys('<span class="text-amber-300">奧拉奇里亞：「這件事，要有龍騎士在場見證。」（你本人或出戰的傭兵要有龍騎士）</span>'); return; }
      return oDone.apply(this, arguments);
    };
  }

  // ── 掉落 ──
  var NEED = {};
  [line, eva].forEach(function (ln) { ln.chapters.forEach(function (c, i) { c.reqs.forEach(function (r) { NEED[r.id] = { need: r.need, i: i, ln: ln }; }); }); });
  var needOf = function (id) { return (NEED[id] || {}).need || 0; };
  var activeFor = function (id, p) { var x = NEED[id]; if (!x) return false; return trialQStateFor(p, L.keyOf(x.ln, x.i, QC(p))) === 1 && have(id) < x.need; };
  var giveOne = function (p, id, why) {
    try { gainItem(id, 1, true, true); } catch (e) { return; }
    var d = DB.items[id] || {}, ln = NEED[id].ln;
    sys('<span style="color:#67e8f9">✦ ' + esc(ln.name) + '：取得 ' + esc(d.n || id) + '（' + Math.min(have(id), needOf(id)) + '／' + needOf(id) + '）' + (why ? '・' + esc(why) : '') + '</span>');
  };
  var inTown = function () { var id = (typeof mapState !== 'undefined' && mapState) ? mapState.current : ''; return !!(id && ((DB.towns && DB.towns[id]) || /^town_/.test(id))); };
  var dragonOf = function (n) { n = String(n || ''); for (var j = 0; j < DRAGONS.length; j++) if (n.indexOf(DRAGONS[j]) >= 0) return DRAGONS[j]; return ''; };
  function onKill(m, map) {
    var p = P(); if (!p || !m || classic(p)) return;
    var on = riftOn(), n = m.n || '', s = st(p);
    Object.keys(RULE).forEach(function (id) {
      if (!activeFor(id, p)) return;
      var r = RULE[id], hit = false, why = '';
      if (r.field && on && !m.rd && !m.boss && !inTown()) hit = true;
      if (r.maps && on && r.maps.indexOf(map) >= 0 && (r.anyMob || !m.boss)) {
        if (r.uniqMap) { s.sun = s.sun || {}; if (!s.sun[map]) { s.sun[map] = 1; hit = true; why = SUN[map] || ''; } }
        else hit = true;
      }
      if (r.names) {
        var nm = r.names.filter(function (x) { return n === x || n.indexOf(x) >= 0; })[0];
        var ok = nm && (!r.boss || m.boss || m.rdBoss) && (!r.rift || on || m.rd);
        if (ok) { if (r.uniq) { s.kings = s.kings || {}; if (!s.kings[nm]) { s.kings[nm] = 1; hit = true; why = nm; } } else hit = true; }
      }
      if (r.dragon && (m.boss || m.rdBoss) && (on || m.rd)) { var dg = dragonOf(n); s.dragons = s.dragons || {}; if (dg && !s.dragons[dg]) { s.dragons[dg] = 1; hit = true; why = dg; } }
      if (hit) giveOne(p, id, why);
    });
    // 種子集滿、四王、龍的計數跟手上對不起來時（掉了、交過）重算
    try { if (s.sun && Object.keys(s.sun).length > have('afk_rq_seed') && activeFor('afk_rq_seed', p)) s.sun = {}; if (s.kings && Object.keys(s.kings).length > have('afk_rq_oath') && activeFor('afk_rq_oath', p)) s.kings = {}; if (s.dragons && Object.keys(s.dragons).length > have('afk_rq_assent') && activeFor('afk_rq_assent', p)) s.dragons = {}; } catch (e) {}
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = null, map = '';
      try { m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null; map = mapState.current; } catch (e) {}
      var snap = m ? { n: m.n, boss: !!m.boss, rd: !!m._rd, rdBoss: !!m._rdBoss, dead: !!m._dead } : null;
      var r = oKill.apply(this, arguments);
      try { if (snap && !snap.dead) onKill(snap, map); } catch (e) { console.warn('[AFK-riftquest] kill', e); }
      return r;
    };
  }
  // 第 1 章：次元裂縫開著、在村莊以外連續撐過 10 分鐘（離線、木人場不算）
  setInterval(function () {
    try {
      var p = P(); if (!p || !activeFor('afk_rq_stay', p)) return;
      var s = st(p), off = typeof W.__afkOfflineNow === 'function' && W.__afkOfflineNow(), trn = !!(W.__afkTrainIn && W.__afkTrainIn());
      if (!riftOn() || inTown() || p.dead || off || trn) { s.stay = 0; return; }
      s.stay = (s.stay || 0) + 1;
      if (s.stay >= 600) { s.stay = 0; giveOne(p, 'afk_rq_stay', '撐過 10 分鐘'); }
    } catch (e) {}
  }, 1000);

  // ── 半身的席琳（席琳神殿；看過第三階層的真相才會出現）──
  // 11-19：GPT 交件的人物圖（assets/npc/afk_half_sherine，待機 6 格）
  try { if (typeof NPC_SPR !== 'undefined' && !NPC_SPR.half_sherine) NPC_SPR.half_sherine = { g: 'afk_half_sherine', f: 6, shadow: false }; } catch (e) {}
  L.addNpc('town_sherine', { id: HALF_ID, n: HALF_N, title: '劇情', type: 'quest', classicHide: true,
    d: '水影凝成的女人，只有半邊身子。她說自己是還醒著的那一半。' }, 'half_sherine', [44, 40]);
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        if (npcId === HALF_ID) { var div = document.getElementById('interaction-content'), p = P(); if (div && p && !halfOn(p)) div.innerHTML = '<div class="text-sm text-slate-400">水面晃了一下，什麼也沒有。</div>'; }
      } catch (e) {}
      return r;
    };
  }

  W.AFK_RIFTQ = { line: line, eva: eva, keyR: keyR, keyE: keyE, gate: gate, rule: RULE, onKill: onKill, hasDK: hasDK, halfOn: halfOn };
  console.log('[AFK-riftquest] 已啟用：「吞噬天空的光」6 章＋「伊娃的水」3 章');
})();
