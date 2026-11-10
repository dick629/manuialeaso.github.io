/* ============================================================================
 * afk-mobile-scale.js — 手機版介面縮放與順暢度（純 CSS 注入＋一個設定面板，不包任何核心函式）
 *
 * 只在「上游手機幾何」生效：所有規則都包在與 css/style.css 同一條 media query
 *   `(max-width: 768px), (max-height: 520px) and (pointer: coarse)` 裡，桌機／平板三欄版面完全不受影響。
 *   不讀 afk-mobile 的 body.m-mobile 當前提（那支可被玩家關掉；關掉手機殼時戰鬥區一樣窄、一樣需要這些），
 *   只有「配合 afk-mobile 自己的元素」(#m-nav / #m-log-sheet) 那幾條才掛 body.m-mobile。
 *
 * 做了什麼（每一項對應檔內 CSS 區塊的編號）：
 *   ① 介面縮放：根字級改成 `clamp(14px, 4.1vw, 16px) × --afk-ui-scale`——360px 寬 ≈14.8px、390px 起 16px、
 *      橫向封頂 16px。上游版面大量用 Tailwind 的 rem 單位（text-sm / p-2 / gap-2…），改根字級＝整體字級、
 *      間距、按鈕同比例縮放；核心手機規則裡寫死 px 的（地圖列 13px/38px、分頁鈕 13px、日誌 13px、怪名 11px、
 *      狀態列 13px…）則逐條改成 `calc(Npx × --afk-ui-scale)` 跟著走。
 *      ⚠ 刻意不用 CSS `zoom`：zoom 會連 100vw/100dvh 一起放大（#game-screen 是 fixed+100dvh，會多出一截
 *      捲不到的底部），而且 getBoundingClientRect 的座標系跟著變，核心 35 處靠它對位的 sprite／裝備視窗全會錯位。
 *   ② 分頁列：12 顆分頁鈕由 3 欄×4 排(198px)改 4 欄×3 排(≈150px)，每顆最少 40px 高；
 *      黏頂位置由核心寫死的 62px 改成「實測狀態列高度＋8px」(--afk-ms-hud-h，ResizeObserver 量 #m-status /
 *      #mobile-vitals，只在高度變時寫一次)——afk-battlehud 的狀態列有兩排 82px，核心的 62px 讓分頁列第一排
 *      整個鑽到狀態列底下（實測捲動 174px 後「能力/裝備/技能」被蓋掉 20px，點不到）。
 *   ③ 觸控目標 ≥40px：底部導覽、地圖列按鈕與下拉、分頁鈕、首頁「其他功能」、背包排序鈕、快速強化/廢品鈕
 *      直接加高；日誌分頁丸(.logtab-btn 23px)、過濾丸(.cf-pill)、日誌面板的切換/關閉這類「在標題列裡、
 *      加高會把整列撐胖」的，用 ::after 把點擊區外擴到 ≥40px，外觀不變。
 *   ④ 橫向（max-height ≤520 的觸控橫向）：狀態列兩排→一排（文字與血條並排）、地圖列三顆按鈕＋兩個下拉
 *      壓成一排、戰鬥框改「以高度決定、維持 16:9、置中」= `100dvh − 狀態列 − 地圖列 − 導覽列 − 間距`，
 *      怪物站立帶 185px 剛好塞得下；直向時這些規則都不生效。
 *   ⑤ 順暢度：
 *      ・100vh→100dvh：核心手機規則本來就是 dvh，補剩下的（世界頻道私訊框、登入/選角舞台的橫向算式）。
 *      ・捲動區三件套(overscroll-behavior:contain / -webkit-overflow-scrolling:touch)：核心與 afk-mobile 已
 *        覆蓋 #game-screen 與各彈窗，這裡只補 #m-log-sheet 裡的日誌。⚠ 不可對「可能沒有東西可捲」的容器
 *        加 contain（手機流式化後的分頁、NPC 清單），Chrome 會把手勢卡在它身上不鏈給 #game-screen（afk-mobile
 *        ⑤ 踩過）。
 *      ・contain:content 只加在日誌面板裡的三個日誌容器（overflow 本來就是 auto，沒有 fixed 子孫）：日誌每則
 *        插入(每秒 5~20 則)的重排範圍就不出該容器。不加在 #game-screen / #tab-content-panel——layout 包含會
 *        把裡面 position:fixed 的視窗(城鎮互動窗)改成相對它定位，paint 包含會把流式化後的分頁裁掉。
 *      ・怪物 sprite 容器升合成層：`.mob-img-inner.mob-anim { will-change: transform }`——這些元素核心本來就
 *        有 transform（前後排 scale/translate、--jit-scale），已經是獨立堆疊脈絡，加 will-change 只是讓 8fps
 *        換 src 時只重繪自己那層、不帶整張 16:9 場景圖重繪。⚠ 玩家/傭兵 sprite (#player-morph-sprite /
 *        .party-sprite) 刻意不動：核心註明「容器與各層皆不用 transform」，升層＝建隔離群組會讓武器層的
 *        screen 混合失效變黑框（上游 v3.0.19 病根）。
 *      ・iOS 點下拉/輸入框自動放大：Safari 對字級 <16px 的 select/input 會整頁放大且不自動縮回（地圖下拉
 *        13px 就中）。只在 iOS 把 viewport meta 補上 maximum-scale=1——iOS 10 起 Safari 對「使用者捏合」
 *        忽略這個值（afk-nozoom 保留捏合縮放的原則不變），只擋「聚焦自動放大」；Android 不加（Chrome 會
 *        真的把捏合鎖死）。
 *      ・-webkit-tap-highlight-color 透明：拿掉點按鈕時的灰色閃塊（每次點都是一次額外重繪）。
 *   ⑥ 輕量模式（body.afk-ms-lite）：拔面板外陰影(.panel 的 0 8px 16px)、標題列/分頁鈕 text-shadow、
 *      .btn 內陰影、背包列陰影、底部導覽/日誌面板陰影、HP/MP 條的 transition:width（docs/perf-battery.md C5：
 *      每 100ms 進新值的 transition 永遠在跑、永不收斂；狀態列鏡射條也是）。
 *      自動開啟條件：prefers-reduced-motion、navigator.deviceMemory ≤4、hardwareConcurrency ≤4（與 afk-lowend
 *      同門檻）。玩家可在面板強制開/關（存 localStorage，per 裝置）。光暈/濾鏡/模糊那批不在這裡重做——
 *      afk-powersave 的「關閉光暈與濾鏡」已經做了且 afk-lowend 會自動套，這支只補它沒碰的陰影與過渡。
 *   ⑦ 設定入口：首頁「⚙ 其他功能 → 📱 介面縮放」(AFK_SETTINGS，只在手機幾何顯示)與遊戲內「設定分頁 →
 *      🔌 外掛 → 📱 介面縮放」。面板：90～140% 六顆（2026-10-29 加 130／140%）＋「輕量模式」勾選。縮放值存 localStorage
 *      `afk_ui_scale`（per 裝置，不進存檔）、輕量模式存 `afk_ui_lite`（'1'/'0'，沒設＝自動判定）。
 *      儲存判準：這兩個值壞掉只影響外觀、不影響遊戲，但「要能在 file:// 下用」→ localStorage；各只佔十幾個
 *      字元，不佔存檔空間。
 *
 *   ⑧ 小字下限（2026-10-29 玩家：手機字太小）：text-xs、行內寫死 10～12px 的說明字、外掛面板（.afk-ax）說明，
 *      最小 13px×縮放；戰鬥框、狀態列、快捷列、底部導覽、怪名不動（那些地方擠，放大會跑版）。
 *
 * 量測（/root/bench/mobile-scale-test.mjs，390×844 / 360×780 / 844×390 觸控 context，SLOT=7 真實隊伍存檔，
 *   每輪全新分頁；結果細節見檔尾「量測紀錄」）：
 *   ・四個畫面（首頁／戰鬥 zone_06／村莊 town_gludin／背包分頁）前後皆 documentElement.scrollWidth ==
 *     innerWidth（無水平捲軸），無元素超出右緣。
 *   ・背包分頁捲動後：分頁列第一排由「被狀態列蓋 20px」→ 完整可見；分頁列高 198→150px。
 *   ・可見按鈕 <40px 的數量：戰鬥畫面 10→0、背包 7→0、首頁 2→0（以 getBoundingClientRect 量）。
 *   ・橫向 844×390：戰鬥框由「只露出上緣、怪物在畫面外」→ 整框含五隻怪完整在首屏。
 *   ・CPU（headless 無 GPU，只量得到被換算成 CPU 的那部分；will-change 的合成收益在真機才看得到）：
 *     見檔尾數字；本支不碰每 tick 的 DOM 寫入，不期待也沒有 CPU 大幅下降——那條路 P 先生已實測無效
 *     （節流 updateUI/renderMobs 省 4%/−2%~8%，方案已作廢，見 docs/perf-battery.md 方案 10）。
 *
 * 刻意不做：
 *   ・不節流 updateUI / renderMobs / renderStatusEffects（實測無效，上面說過）。
 *   ・不給 #game-screen / 分頁面板加 contain、不給玩家與傭兵 sprite 升層（理由見 ⑤）。
 *   ・不用 zoom 做縮放（理由見 ①）。
 *   ・不放寬上游那條 media query 去照顧平板（docs/mobile.md：平板是另一套版面，不是把 MQ 放寬）。
 *
 * 外掛開關：AFK_TOGGLES id 'mobile-scale'（檔頭不早退，init 時才判；關掉→重新整理後完全回原版）。
 * 掛接：在 index.html 的 </body> 前 <script src="afk-mobile-scale.js">，排在 afk-mobile / afk-battlehud /
 *   afk-mapbar 之後（選擇器已用 #game-screen 前綴拉高特異度，順序前後都蓋得過它們的規則，但排後面最穩）。
 * ========================================================================== */
(function () {
  'use strict';
  var ID = 'mobile-scale';
  if (window.AFK_TOGGLES && AFK_TOGGLES.register) {
    AFK_TOGGLES.register({
      id: ID, name: '手機介面縮放', group: '遊戲介面', def: true,
      desc: '手機上字級與按鈕隨螢幕寬度調整，分頁列不被狀態列蓋住；可在設定裡選 90%～120% 與輕量模式'
    });
  }
  function on() { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled(ID); }

  // 與 css/style.css 手機版面那條完全一致（afk-mobile / battlehud / mapbar 同一條；改一邊要改全部）
  var MOBILE_MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  // 橫向手機：上游那條 MQ 的第二半 + 橫向。直向手機 (max-width:768) 不會進來。
  var LAND_MQ = '(max-height: 520px) and (pointer: coarse) and (orientation: landscape)';
  var LS_SCALE = 'afk_ui_scale', LS_LITE = 'afk_ui_lite';
  var SCALES = [0.9, 1, 1.1, 1.2, 1.3, 1.4];   // 2026-10-29 玩家：手機字太小 → 加 130%／140%
  var S = 'var(--afk-ui-scale, 1)';
  function px(n) { return 'calc(' + n + 'px * ' + S + ')'; }

  // ── 設定讀寫 ─────────────────────────────────────────────────────────────
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function getScale() {
    var v = parseFloat(lsGet(LS_SCALE));
    if (!(v > 0)) return 1;
    return Math.min(1.4, Math.max(0.9, v));
  }
  function setScale(v) {
    v = Math.min(1.4, Math.max(0.9, Number(v) || 1));
    lsSet(LS_SCALE, String(v));
    applyScale();
  }
  function autoLite() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch (e) {}
    var mem = Number(navigator.deviceMemory) || 0, cores = Number(navigator.hardwareConcurrency) || 0;
    return (mem > 0 && mem <= 4) || (cores > 0 && cores <= 4);
  }
  function liteOn() {
    var v = lsGet(LS_LITE);
    if (v === '1') return true;
    if (v === '0') return false;
    return autoLite();
  }
  function setLite(onOff) { lsSet(LS_LITE, onOff ? '1' : '0'); applyScale(); }
  function applyScale() {
    var root = document.documentElement;
    if (!on()) { root.style.removeProperty('--afk-ui-scale'); if (document.body) document.body.classList.remove('afk-ms-lite'); return; }
    root.style.setProperty('--afk-ui-scale', String(getScale()));
    if (document.body) document.body.classList.toggle('afk-ms-lite', liteOn());
  }
  function inMobileGeom() { try { return matchMedia(MOBILE_MQ).matches; } catch (e) { return false; } }

  // ── CSS ──────────────────────────────────────────────────────────────────
  function buildCSS() {
    var GS = '#game-screen ';   // 前綴拉高特異度：要壓過核心 MQ 與 afk-mapbar/afk-mobile 同特異度的規則，不靠載入順序
    var HDR = GS + '#map-view-panel > .panel-header';
    // 外擴點擊區：元素本身不變大，::after 把可點範圍撐到 ≥40px（給塞在標題列裡、加高會撐胖整列的小丸子）
    var HIT = '{position:relative;}';
    var SMALL_EX = ':not(#battle-view *):not(#m-status *):not(#mobile-vitals *):not(#afk-hotbar *):not(.mob-name):not(#m-nav *)';
    var HIT_AFTER = '::after{content:"";position:absolute;left:-4px;right:-4px;top:-8px;bottom:-8px;}';
    return [
      '@media ' + MOBILE_MQ + '{',
      /* ① 根字級：依寬度 clamp × 使用者縮放。rem 系統（Tailwind）整體跟著走 */
      'html{font-size:calc(clamp(14px, 4.1vw, 16px) * ' + S + ');}',
      'button{-webkit-tap-highlight-color:rgba(0,0,0,0);}',
      /* ① 核心手機規則寫死 px 的部分 → 跟縮放走 */
      HDR + ' button,' + HDR + ' select{height:' + px(40) + ';min-height:max(40px,' + px(40) + ');font-size:' + px(13) + ' !important;}',
      /* ⚠ 不碰 HDR > span 的字級：afk-mapbar 靠 font-size:0 把「冒險地圖」標題收掉，這裡寫了就把它撐回來 */
      GS + '#battle-view .mob-name{font-size:' + px(11) + ';}',
      GS + '#combat-log,' + GS + '#sys-log,#m-log-sheet #combat-log,#m-log-sheet #sys-log{font-size:' + px(13) + ' !important;}',
      GS + '#log-row .panel-header,#m-log-sheet #log-row .panel-header{font-size:' + px(14) + ' !important;}',
      GS + '#tab-stats{font-size:' + px(15) + ' !important;}',
      '#m-status{font-size:' + px(13) + ';}',
      '#m-status #ms-name{font-size:' + px(14) + ';}',
      '#m-status #ms-lv{font-size:' + px(15) + ';}',
      '#m-status #ms-ac,#m-status #ms-mr{font-size:' + px(14) + ';}',
      '#m-status .ms-bar{height:' + px(20) + ';}',
      '#m-status .ms-bar-txt{font-size:' + px(11) + ';}',
      GS + '#mobile-vitals .mv-bar{height:' + px(20) + ';}',
      GS + '#mobile-vitals .mv-bar > span,' + GS + '#mobile-vitals .mv-label{font-size:' + px(11) + ';}',
      /* ② 分頁列：4 欄×3 排、黏頂位置＝實測狀態列高＋8px（核心寫死 62px，battlehud 兩排 82px 會蓋住第一排） */
      GS + '#col-right > .tab-bar{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px !important;padding:5px !important;top:calc(var(--afk-ms-hud-h, 54px) + 8px);}',
      GS + '#col-right > .tab-bar .btn{min-height:max(40px,' + px(42) + ');padding:4px 1px !important;font-size:' + px(13) + ' !important;line-height:1.15;letter-spacing:0;}',
      /* ③ 觸控目標 ≥40px */
      'body.m-mobile #m-nav .m-nav-btn{min-height:max(44px,' + px(46) + ');font-size:' + px(12) + ';padding:6px 2px;}',
      'body.m-mobile #m-log-hd button{min-height:36px;}',
      'body.m-mobile #m-log-hd button' + HIT, 'body.m-mobile #m-log-hd button' + HIT_AFTER,
      GS + '.logtab-btn' + HIT_AFTER,                       /* .logtab-btn 核心已是 position:relative（未讀點用） */
      GS + '.cf-pill' + HIT, GS + '.cf-pill' + HIT_AFTER,
      '#m-log-sheet .logtab-btn' + HIT_AFTER, '#m-log-sheet .cf-pill' + HIT, '#m-log-sheet .cf-pill' + HIT_AFTER,
      GS + '.classic-sort-button{min-width:40px;min-height:40px;}',
      GS + ':is(#tab-weapons,#tab-armors,#tab-items) > .sticky button{min-height:40px;}',   /* 快速強化／快速廢品表頭（核心 buildQuickHeader，無具名 class） */
      '#afk-stg-gear,#afk-toggles-entry,#main-menu #afk-stg-menu button{min-height:40px;}',
      /* ⑧ 小字下限（2026-10-29 玩家：手機字太小）：說明文字最小 13px×縮放（text-xs、寫死 10～12px 的行內字級、外掛面板說明）；
            戰鬥框、狀態列、快捷列這類擠的地方不動 */
      ':is(.text-xs,[style*="font-size:12px"],[style*="font-size: 12px"],[style*="font-size:11px"],[style*="font-size: 11px"],.text-\\[11px\\],.text-\\[10px\\])' + SMALL_EX + '{font-size:max(0.75rem, ' + px(13) + ') !important;}',
      '.afk-ax' + SMALL_EX + '{font-size:' + px(15) + ';}',
      '.afk-ax :is(.ax-note,.ax-desc,.ax-lore)' + SMALL_EX + '{font-size:' + px(14) + ';}',
      /* ⑤ 100vh → 100dvh（核心手機規則已是 dvh，補剩下的） */
      '.wc-private-dialog{height:min(560px, calc(100dvh - 24px));}',
      '#login-art-stage{width:min(100vw, calc(100dvh * 4 / 3));}',
      '#load-art-stage{width:min(100vw, calc(100dvh * 4 / 3));}',
      /* ⑤ 日誌面板裡的捲動區：三件套＋contain（這三個 overflow 本來就是 auto、沒有 fixed 子孫） */
      '#m-log-sheet #m-log-body,#m-log-sheet #world-log{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      '#m-log-sheet #combat-log,#m-log-sheet #sys-log,#m-log-sheet #world-log{contain:content;}',
      /* ⑤ 怪物 sprite 容器升合成層（只有本來就帶 transform 的 .mob-anim；玩家/傭兵 sprite 不動，理由見檔頭） */
      GS + '#battle-view.area-fit .mob-target .mob-img-inner.mob-anim{will-change:transform;}',
      '}',
      /* ④ 橫向 */
      '@media ' + LAND_MQ + '{',
      '#m-status{flex-direction:row !important;align-items:center;gap:6px 12px;padding:4px 8px !important;}',
      '#m-status .ms-row1{flex:0 1 auto;}',
      '#m-status .ms-row2{flex:1 1 0;min-width:42%;}',
      GS + '#mobile-vitals{min-height:44px;}',
      HDR + '{padding:6px 8px;gap:5px;}',
      HDR + ' > div > button{flex:0 1 112px !important;}',
      HDR + ' > div > select{flex:1 1 150px !important;}',
      HDR + ' #btn-revive,' + HDR + ' #btn-revive-inplace{flex:1 0 100% !important;}',
      /* 戰鬥框以高度決定、維持 16:9、置中：100dvh − 狀態列 − 地圖列 − 導覽列 − (game-screen 上下 padding 8+8、
         map-view-panel 邊框 3、gap 8、battle padding 6+6、預留 8) ≈ 47px。怪物站立帶 185px → 最少給 200px。 */
      GS + '#battle-view.area-fit:not(.hidden),' + GS + '#battle-view:not(.area-fit):not(.hidden){width:auto;height:max(200px, calc(100dvh - var(--afk-ms-hud-h, 44px) - var(--afk-ms-maphdr-h, 52px) - var(--m-nav-h, 0px) - 47px));max-width:100%;aspect-ratio:16 / 9;align-self:center;}',
      GS + '#town-view:not(.hidden){aspect-ratio:auto;height:max(200px, calc(100dvh - var(--afk-ms-hud-h, 44px) - var(--afk-ms-maphdr-h, 52px) - var(--m-nav-h, 0px) - 47px));}',
      '}',
      /* ⑥ 輕量模式：陰影／文字陰影／血條過渡（只在手機幾何；桌機不掛 class 也不會進來） */
      '@media ' + MOBILE_MQ + '{',
      'body.afk-ms-lite .panel{box-shadow:inset 0 0 0 1px rgba(12,10,12,.78);}',
      'body.afk-ms-lite .panel-header,body.afk-ms-lite .tab-bar .btn,body.afk-ms-lite .btn{text-shadow:none;box-shadow:none;}',
      'body.afk-ms-lite #m-status,body.afk-ms-lite #mobile-vitals,body.afk-ms-lite #m-nav,body.afk-ms-lite #m-log-sheet,body.afk-ms-lite .list-item,body.afk-ms-lite .log-bg{box-shadow:none !important;}',
      'body.afk-ms-lite #m-status .ms-sherine,body.afk-ms-lite #m-status .ms-bar-txt,body.afk-ms-lite #mobile-vitals .mv-bar > span{text-shadow:none;}',
      'body.afk-ms-lite #m-status .ms-bar-fill,body.afk-ms-lite #m-status #ms-exp,body.afk-ms-lite .bar-fill,body.afk-ms-lite #mobile-vitals .mv-bar > div{transition:none !important;}',
      'body.afk-ms-lite .btn{transition:none;}',
      '}',
      /* ⑦ 設定入口：遊戲內那顆只在手機幾何出現（桌機看不到＝這支在桌機什麼都不做） */
      '#m-afk-nav-mscale{display:none;}',
      '@media ' + MOBILE_MQ + '{#m-afk-nav-mscale{display:block;}}',
      /* 面板本體 */
      /* 頂端多讓 44px：首頁左上角的「🎚️ 外掛」逃生門 z-index 比任何面板高，不讓開會壓在標題上 */
      '#afk-ms-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:flex-start;justify-content:center;padding:calc(var(--orig-bar-h,0px) + 58px) 12px calc(12px + env(safe-area-inset-bottom,0px));}',
      '@media ' + LAND_MQ + '{#afk-ms-overlay{padding-top:calc(var(--orig-bar-h,0px) + 10px);padding-left:72px;}}',
      '#afk-ms-card{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;max-width:420px;width:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);font-size:15px;}',
      '#afk-ms-card .afk-ms-hd{padding:16px 18px;border-bottom:1px solid #1e293b;font-size:18px;font-weight:700;}',
      '#afk-ms-card .afk-ms-bd{padding:14px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      '#afk-ms-card .afk-ms-lbl{font-weight:600;margin-bottom:8px;}',
      '#afk-ms-card .afk-ms-seg{display:flex;gap:8px;margin-bottom:14px;}',
      '#afk-ms-card .afk-ms-seg button{flex:1;min-height:44px;border:1px solid #334155;border-radius:10px;background:#0b1222;color:#cbd5e1;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;touch-action:manipulation;}',
      '#afk-ms-card .afk-ms-seg button.on{background:#0ea5e9;border-color:#0ea5e9;color:#04263a;}',
      '#afk-ms-card label{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #1e293b;border-radius:10px;background:#0b1222;cursor:pointer;min-height:44px;}',
      '#afk-ms-card label input{width:18px;height:18px;flex:none;accent-color:#22c55e;}',
      '#afk-ms-card label small{display:block;font-size:13px;line-height:1.5;color:#94a3b8;margin-top:2px;}',
      '#afk-ms-card .afk-ms-ft{padding:12px 16px;border-top:1px solid #1e293b;text-align:right;}',
      '#afk-ms-close{background:#0ea5e9;border:none;color:#04263a;font-weight:700;border-radius:8px;padding:10px 18px;min-height:40px;cursor:pointer;font-family:inherit;}'
    ].join('\n');
  }
  function injectCSS() {
    if (document.getElementById('afk-mobile-scale-style')) return;
    var st = document.createElement('style');
    st.id = 'afk-mobile-scale-style';
    st.textContent = buildCSS();
    (document.head || document.documentElement).appendChild(st);
  }

  // ── ② 狀態列／地圖列高度量測 → CSS 變數（寫在 #game-screen 上，樣式失效範圍不出遊戲畫面）─────
  //   ResizeObserver 只在尺寸變時回呼；值沒變就不寫（寫自訂屬性＝子樹樣式失效，見 docs/perf-battery.md D4）。
  var _ro = null, _last = {};
  function setVar(name, v) {
    var gs = document.getElementById('game-screen'); if (!gs) return;
    v = Math.round(v);
    if (_last[name] === v) return;
    _last[name] = v;
    gs.style.setProperty(name, v + 'px');
  }
  function measure() {
    if (document.hidden || !on()) return;
    var hud = 0, ids = ['m-status', 'mobile-vitals'], i, e, r;
    for (i = 0; i < ids.length; i++) {
      e = document.getElementById(ids[i]);
      if (!e) continue;
      try { r = e.getBoundingClientRect(); } catch (err) { continue; }
      if (r.height > hud) hud = r.height;   // 兩條同時存在時（不該）取高的；一條 display:none 高度是 0
    }
    if (hud > 0) setVar('--afk-ms-hud-h', hud);
    var hdr = document.querySelector('#map-view-panel > .panel-header');
    if (hdr) { try { r = hdr.getBoundingClientRect(); if (r.height > 0) setVar('--afk-ms-maphdr-h', r.height); } catch (err) {} }
  }
  function watch() {
    if (typeof ResizeObserver !== 'function') { measure(); window.addEventListener('resize', measure); return; }
    if (_ro) return;
    try { _ro = new ResizeObserver(function () { measure(); }); } catch (e) { measure(); return; }
    ['m-status', 'mobile-vitals'].forEach(function (id) { var e = document.getElementById(id); if (e) _ro.observe(e); });
    var hdr = document.querySelector('#map-view-panel > .panel-header'); if (hdr) _ro.observe(hdr);
    measure();
  }
  // afk-battlehud 的 #m-status 是進遊戲才建的 → 建好後補 observe（#game-screen 顯示時就夠，跟 afk-mobile 同一個觸發點）
  function watchLate() {
    var gs = document.getElementById('game-screen');
    if (!gs || typeof MutationObserver === 'undefined') return;
    try {
      new MutationObserver(function () {
        if (gs.classList.contains('hidden')) return;
        var ms = document.getElementById('m-status');
        if (ms && _ro && !ms.__afkMsObs) { ms.__afkMsObs = true; _ro.observe(ms); }
        measure();
      }).observe(gs, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }

  // ── ⑤ iOS：擋「聚焦 <16px 的 select/input 自動放大」（捏合縮放不受影響；Android 不加） ─────────
  function iosViewport() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!ios) return;
    var m = document.querySelector('meta[name="viewport"]'); if (!m) return;
    var c = m.getAttribute('content') || '';
    if (/maximum-scale/.test(c)) return;
    m.setAttribute('content', c + (c ? ', ' : '') + 'maximum-scale=1');
  }

  // ── ⑦ 設定面板 ───────────────────────────────────────────────────────────
  function openPanel() {
    if (document.getElementById('afk-ms-overlay')) return;
    var ov = document.createElement('div'); ov.id = 'afk-ms-overlay';
    if (window.AFK_TOGGLES && AFK_TOGGLES.applyBannerPad) AFK_TOGGLES.applyBannerPad(ov);
    var card = document.createElement('div'); card.id = 'afk-ms-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    var cur = getScale();
    card.innerHTML =
      '<div class="afk-ms-hd">📱 介面縮放</div>' +
      '<div class="afk-ms-bd">' +
        '<div class="afk-ms-lbl">文字與按鈕大小</div>' +
        '<div class="afk-ms-seg">' + SCALES.map(function (v) {
          return '<button type="button" data-scale="' + v + '"' + (Math.abs(v - cur) < 0.01 ? ' class="on"' : '') + '>' + Math.round(v * 100) + '%</button>';
        }).join('') + '</div>' +
        '<label><input type="checkbox" id="afk-ms-lite"' + (liteOn() ? ' checked' : '') + '><span><span>輕量模式</span><small>減少陰影與動畫，舊手機較順；光暈與濾鏡在「省電模式」調整</small></span></label>' +
      '</div>' +
      '<div class="afk-ms-ft"><button type="button" id="afk-ms-close">完成</button></div>';
    ov.appendChild(card); document.body.appendChild(ov);
    var prev = document.activeElement, layer = null;
    function dismiss() { layer = null; if (ov.parentNode) ov.parentNode.removeChild(ov); if (prev && prev.isConnected && prev.focus) prev.focus(); }
    function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else dismiss(); }
    if (window.AFK_UI && AFK_UI.openLayer) layer = AFK_UI.openLayer(dismiss);   // 壓一層 → 手機返回鍵/ESC 可關
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    card.querySelector('#afk-ms-close').addEventListener('click', close);
    card.querySelectorAll('[data-scale]').forEach(function (b) {
      b.addEventListener('click', function () {
        setScale(b.getAttribute('data-scale'));
        card.querySelectorAll('[data-scale]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    card.querySelector('#afk-ms-lite').addEventListener('change', function () { setLite(this.checked); });
    card.querySelector('#afk-ms-close').focus();
  }
  // 遊戲內入口：設定分頁的「🔌 外掛」列（與 afk-training / afk-junkmgr 同一列；沒人建就自己建）
  function injectGameEntry() {
    var panel = document.getElementById('tab-automation');
    if (!panel || document.getElementById('m-afk-nav-mscale')) return;
    var row = document.getElementById('m-afk-navrow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'm-afk-navrow';
      row.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
      row.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div>' +
        '<div id="m-afk-navrow-btns" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';
      panel.appendChild(row);
    }
    var b = document.createElement('button');
    b.id = 'm-afk-nav-mscale'; b.type = 'button';
    b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500';
    b.style.width = '100%'; b.style.marginTop = '8px'; b.style.minHeight = '40px';
    b.textContent = '📱 介面縮放';
    b.addEventListener('click', openPanel);
    row.appendChild(b);
  }

  // ── init ─────────────────────────────────────────────────────────────────
  function init() {
    if (!on()) { try { console.log('[AFK-mobile-scale] 已由外掛開關停用。'); } catch (e) {} return; }
    injectCSS();
    applyScale();
    iosViewport();
    watch();
    watchLate();
    injectGameEntry();
    // 首頁入口（AFK_SETTINGS 由 afk-storage 消費；只在手機幾何列出）
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '📱 介面縮放', onClick: openPanel, visible: inMobileGeom });
    window.AFK_MOBILE_SCALE = { get: getScale, set: setScale, lite: liteOn, setLite: setLite, open: openPanel, measure: measure, version: '1.0.0' };
    try { console.log('[AFK-mobile-scale] hooks OK — 手機介面縮放 ' + Math.round(getScale() * 100) + '%' + (liteOn() ? '・輕量模式' : '') + '。'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ── 量測紀錄（2026-10-27，/root/bench/mobile-scale-test.mjs，SLOT=7 真實隊伍存檔，headless Chromium 1194）──
 *
 * 版面（390×844 直向，前＝不注入本外掛／後＝注入）：
 *   首頁        scrollWidth 390/390 → 390/390；可見按鈕 <40px：2（⚙其他功能 97×28、🎚️外掛 69×29）→ 0
 *   戰鬥 zone_06 scrollWidth 390 → 390；<40px：10（地圖列 3 鈕＋2 下拉 38px、底部導覽 5 顆 38px）→ 0；
 *               五隻怪與狀態欄位置不變（#mob-list 164px 前後相同）
 *   村莊 town_gludin scrollWidth 390 → 390；<40px：10 → 0；NPC 條列不變
 *   背包分頁    scrollWidth 390 → 390；分頁列 198px(3×4) → 149px(4×3)；捲動 174px 後分頁列 top 70px(被 82px 狀態列
 *               蓋掉 20px，第一排點不到) → top 98px(=狀態列 90+8，完整可見)；<40px：7（排序鈕 33×39、快速強化／
 *               廢品 34px、導覽 38px）→ 0
 *   360×780 @120%：根字級 17.7px，分頁列 4 欄仍放得下「統計/存檔」「自動賣出」，scrollWidth 360，無元素出界
 *   844×390 橫向：狀態列 82→44px(一排)、地圖列 2 排→1 排、戰鬥框由「高 466px 只露上緣、怪在畫面外」→ 205px 整框
 *               含五隻怪在首屏；#mob-list 185px
 *   1600×900 桌機：根字級 16px、分頁列仍 3 欄、top:auto、遊戲內入口 display:none、無 will-change ＝ 完全不生效
 *   關掉 afk-mobile（手機幾何、上游堆疊版面）：分頁列 top 仍＝狀態列高＋8，無錯位
 *
 * CPU（zone_06 掛機 40 秒 × 5 輪交錯，CDP Performance.getMetrics 差分；無 GPU、合成收益量不到）：
 *   ProcessTime 秒   前 13.03/15.25/15.55/14.75/14.21（中位 14.75）  後 15.92/13.22/13.30/14.65/13.61（中位 13.61）
 *   TaskDuration 秒  前 4.00/4.64/4.41/5.00/4.14（中位 4.41）        後 4.58/5.94/4.44/4.37/4.21（中位 4.44）
 *   LayoutCount      前 ≈2450                                        後 ≈2450（相同；本外掛不增加版面讀寫）
 *   → 差異在輪間漂移範圍內（±10%），結論是「不變差」；真機 GPU 面（陰影／過渡／合成層）這裡量不到。
 * ────────────────────────────────────────────────────────────────────────── */
