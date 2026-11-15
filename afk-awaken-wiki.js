/* afk-awaken-wiki.js — 小百科「職業覺醒」分頁（Ping 11-15 17:08：小百科沒有寫職業覺醒）
 *   內容全部讀 afk-awaken／afk-awaken-ext／afk-awaken-transfer 的資料，數字改了這裡自動跟上。
 * ========================================================================== */
(function (W) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var card = function (t, body) { return '<div class="m-wiki-card"><div class="m-wiki-name">' + esc(t) + '</div>' + body + '</div>'; };
  var li = function (x) { return '<div class="m-wiki-desc" style="margin-top:4px;">・' + x + '</div>'; };
  var BASE_N = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };
  var WEAPONS = { berserker: '雙手鈍器、雙手矛、單手鈍器、雙斧（拿這些也能帶盾）', thunder: '單手劍、單手矛、雙手矛', paladin: '單手劍、雙手劍', darkknight: '單手劍、雙手劍', runeblade: '單手劍（任何單手劍都算符石劍）' };
  var ORDER = ['berserker', 'thunder', 'paladin', 'darkknight', 'runeblade'];

  W.__afkAwakenWiki = function (H) {
    var A = W.__afkAwaken, E = W.__afkAwakenExt, T = W.__afkAwakenTransfer; if (!A) return '<div class="m-wiki-note">還沒開放。</div>';
    var tbl = (H && H.tbl) || function (head, rows) { return '<table class="m-wiki-tbl"><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; };
    var CLS = A.CLS, cls = ORDER.filter(function (c) { return CLS[c]; });
    var h = '<div class="m-wiki-note">五個本職可以覺醒成全新的職業。覺醒之後等於一個新職業，要從 Lv1 重新練起，有自己的技能、精通、技藝、技能強化、覺醒進化與覺醒轉職。</div>';

    h += card('怎麼覺醒',
      li('到席琳神殿找「<b>覺醒導師 伊瑟拉</b>」，交出<b>本職 0 轉 Lv100 的角色魂魄 5 顆</b>（魂魄在扎爾那裡封存，魂魄簿共用）。') +
      li('要在村莊或席琳神殿、角色沒有死亡、而且先解除所有傭兵僱用。') +
      li('覺醒後回到 <b>Lv1、0 轉</b>；本職的技能、魔法、職業進化、融合轉職、大絕、職業精通都會拿掉，天賦與巔峰也跟著重新累積。這是永久的，不能變回本職。') +
      li('本職的裝備照樣能穿，另外多了覺醒職業的武器（見下表）。臂甲、盾都能用。') +
      li('覺醒職業有自己的八方向戰鬥動畫與立繪；在戰場上一律顯示覺醒職業的樣子（變身的能力照樣有效）。') +
      li('覺醒職業的昏迷技能對王不會昏迷，改成<b>王受到的傷害 ×1.65，持續 3 秒</b>（同一隻王每 12 秒最多一次）。') +
      li('覺醒職業當傭兵時，技能、精通、技藝、技能強化、覺醒進化、覺醒轉職全部有效。'));

    h += card('五個覺醒職業', tbl(['本職', '覺醒職業', '主要能力', '另外能拿的武器'], cls.map(function (c) { return [esc(BASE_N[CLS[c].base] || CLS[c].base), '<b>' + esc(CLS[c].n) + '</b>', esc(CLS[c].main || ''), esc(WEAPONS[c] || '')]; }))
      + li('魔劍士的 LFE（生命）＝體質＋等級÷5，很多技能的傷害跟它有關。雷神拿矛時鎖鏈閃光多打 1 隻。'));

    h += card('技能與技能書', li('每個覺醒職業的技能（效果、學習等級、技能書怎麼取得）在「<b>職業魔法</b>」分頁，選上面的職業就看得到。') + li('一般：覺醒導師用金幣買。英雄：Lv50～80 的王 2%。傳說：Lv80 以上的王 1%（Lv80 學）。神話：次元裂縫難度的副本（次元裂縫的多人副本、單人副本的次元裂縫難度），覺醒職業掉自己職業的書（Lv90 學）。')
      + li('覺醒導師「神話法術書」分頁：覺醒職業 神話法術書碎片 ×100 → 失去光芒的覺醒職業 神話法術書 ×1；失去光芒的法術書 ×10＋神話技能秘笈（或傳說技能秘笈）×1 → 自己職業的一本神話（或傳說）法術書。')
      + li('碎片、傳說技能秘笈：單人副本（夢域鏡難度）的王各 0.1%。失去光芒的法術書 0.01%、神話技能秘笈 0.1%：單人副本（次元裂縫難度）的王、次元裂縫的多人副本王。'));

    h += card('職業精通、技藝精通', li('職業精通（Lv50 打飛龍後，威頓村 漢，四選一）看「<b>職業專精</b>」分頁；技藝精通（1 轉後，燃柳村 奧拉奇里亞，二選一）看「<b>轉生技藝</b>」分頁。兩個分頁上面都可以選覺醒職業。'));
    // 技能強化
    if (E && E.SIGS) h += card('技能強化（席琳神殿 薇爾娜「技能強化」）', li('薇爾娜的三階段強化對覺醒技能也有效。每個覺醒職業另有 3 個招牌技能，每階段傷害再 +15%／+30%／+50%，第三階段招牌主動技能冷卻 −20%。')
      + tbl(['職業', '招牌技能'], cls.map(function (c) { var s = E.SIGS[c] || []; return [esc(CLS[c].n), esc(s.slice(3).join('、'))]; })));
    // 覺醒進化
    var routeTbl = function (R, donor) {
      return [].concat.apply([], cls.map(function (c) { var rs = R[c] || {}; return Object.keys(rs).map(function (k) { var r = rs[k];
        return [esc(CLS[c].n), '<b>' + esc(r.n) + '</b>（' + esc(r.d || '') + '）' + (donor && r.donor ? '<br>融合：' + esc(BASE_N[r.donor] || r.donor) : ''),
          (r.s || []).map(function (s, i) { return '第' + '一二三'.charAt(i) + '段：' + esc(s.p || '') + '<br>　大絕「' + esc(s.u || '') + '」'; }).join('<br>')]; }); }));
    };
    if (E && E.ROUTES) h += card('覺醒進化（覺醒導師「覺醒進化」分頁）',
      li('每個覺醒職業兩條流派選一條，分三段；每段一個被動＋一招大絕（戰鬥中自動施放，冷卻 60 秒）。') +
      li('條件：第一段 Lv50、第二段 1 轉、第三段 2 轉。每段交本職 0 轉、1 轉、2 轉 Lv100 魂魄各 1 顆。') +
      li('跟「覺醒轉職」只能二選一，選定後永久固定。') + tbl(['職業', '流派', '三段的被動與大絕'], routeTbl(E.ROUTES, false)));
    if (T && T.ROUTES) h += card('覺醒轉職（覺醒導師「覺醒轉職」分頁）',
      li('每個覺醒職業 3 條融合流派，分三段；每段一個被動＋一招大絕。') +
      li('條件同覺醒進化（Lv50／1 轉／2 轉）。每段交本職 0 轉、1 轉、2 轉 Lv100 魂魄各 1 顆，再加 1 顆這個覺醒職業的 Lv100 魂魄（第一段 0 轉、第二段 1 轉、第三段 2 轉）。') +
      li('覺醒職業可以封魂，但它的魂魄只能拿來做覺醒轉職。跟「覺醒進化」只能二選一。') + tbl(['職業', '流派', '三段的被動與大絕'], routeTbl(T.ROUTES, true)));
    return h;
  };
})(window);
