/* Consistent typography and bounded dialogs. No battle timer or save writes. */
(function () {
    'use strict';
    var T = window.AFK_TOGGLES;
    if (T) T.register({ id: 'readability', name: '文字與對話框整理', desc: '統一說明字級、加大操作區，讓長說明與對話框在手機和平板內完整捲動。', group: '遊戲介面' });
    function apply() { if (document.body) document.body.classList.toggle('afk-readable', !T || T.enabled('readability')); }
    apply();
    if (T && T.set) {
        var oldSet = T.set;
        T.set = function (id) { var v = oldSet.apply(this, arguments); if (id === 'readability') apply(); return v; };
    }
    // Reuse native stat values; change only their labels and the relic's
    // acquisition route. The native "noEnhance" flag still blocks scrolls.
    if (typeof window.buildItemDescHTML === 'function') {
        var oldDescription = window.buildItemDescHTML;
        window.buildItemDescHTML = function (item) {
            var html = oldDescription.apply(this, arguments);
            if (T && !T.enabled('readability')) return html;
            var d = item && typeof DB !== 'undefined' && DB.items[item.id];
            if (d && (d.relic || d.relicBase || d.gmOnly)) {
                var route = d.gmOnly ? 'GM 測試道具，固定終階，不可強化。'
                    : !window.__afkRelicPlus ? '遺物合成已停用；已持有的合成階段仍會保留。'
                    : d.relicAsc != null && typeof window.__afkRelicNoUp === 'function' && window.__afkRelicNoUp(item.id) ? '昇華支配已達終階。'
                    : d.relicEvo != null ? '已達至高的支配。'
                    : '請至燃柳村找哈瑪大師合成；一般強化卷軸不適用。';
                html = html.replace(/<span class="text-rose-300 font-bold">無法強化<\/span>/g, '<span class="text-amber-300">' + route + '</span>');
            }
            return html.split(/(<[^>]*>)/g).map(function (part) {
                if (part.charAt(0) === '<') return part;
                return part.replace(/HP恢復/g, '生命自然恢復').replace(/MP恢復/g, '魔力自然恢復')
                    .replace(/防禦\(AC\):/g, '防禦：').replace(/魔防\(MR\):/g, '魔法防禦：')
                    .replace(/迴避\(ER\)/g, '遠距迴避').replace(/([\u3400-\u9fff])([+−-])(?=\d)/g, '$1 $2');
            }).join('');
        };
    }
    // 說明文字去掉重複數值時，「最大 HP +50」會剩下「最大」，套裝【…】段落也會被誤刪 → 套裝段落原樣保留、先拿掉「最大」前綴
    if (typeof window.tooltipItemDescription === 'function' && !window.tooltipItemDescription.__afkFix) {
        var oldTip = window.tooltipItemDescription;
        var fixTip = function (d, itemId) {
            if (!d || typeof d.d !== 'string' || !d.d) return oldTip.apply(this, arguments);
            var raw = d.d, cut = raw.indexOf('【'), head = cut >= 0 ? raw.slice(0, cut) : raw, tail = cut >= 0 ? raw.slice(cut) : '';
            head = head.replace(/最大\s*(?=[HM]P\s*[+＋])/g, '');
            if (d.ac) head = head.replace(new RegExp('(^|[、，；;。\\s])AC\\s*' + Math.abs(Number(d.ac)) + '(?!\\d)', 'g'), '$1AC +' + Math.abs(Number(d.ac)));
            var out = oldTip.call(this, Object.assign({}, d, { d: head }), itemId);
            return (out + tail).trim();
        };
        fixTip.__afkFix = true;
        window.tooltipItemDescription = fixTip;
        try { (0, eval)('tooltipItemDescription = window.tooltipItemDescription'); } catch (e) {}
    }
    var s = document.createElement('style'); s.id = 'afk-readability-style';
    s.textContent = `
body.afk-readable{--afk-text:14px;--afk-caption:13px;--afk-title:17px}
body.afk-readable :is(#m-wiki-modal,#m-dex-modal,#item-modal,#poly-modal,#town-interaction-container,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#afk-card-ascension-modal,#ttmi-rift-supplies,#afk-ps-overlay,#afk-toggles-overlay){font-size:var(--afk-text);line-height:1.65;overflow-wrap:break-word}
body.afk-readable :is(.m-wiki-desc,.m-wiki-kv,.m-wiki-tbl,.m-wiki-stbl,.m-dex-drop,.afk-ca-dialog,.ttmi-rift-dialog,#modal-item-desc){font-size:var(--afk-text)!important;line-height:1.7}
body.afk-readable :is(.m-wiki-note,.m-wiki-msg,.m-wiki-cnt,.m-npc-town,.m-npc-tag,.m-dex-hint,.afk-ca-tier small,.afk-ca-dialog p,.afk-ca-dialog span,.afk-ca-panel p,.afk-guide-relic small){font-size:var(--afk-caption)!important;line-height:1.65}
body.afk-readable :is(.m-wiki-name,.m-wiki-sub,.afk-ca-panel h3,.afk-ca-dialog h3,.afk-ca-dialog header strong,.ttmi-rift-dialog header strong,#modal-item-name){font-size:var(--afk-title)!important;line-height:1.5}
body.afk-readable :is(#card-book,#equip-book,#misc-book,#relic-book,#collection-panel) h2{font-size:19px!important;line-height:1.5}
body.afk-readable :is(#m-wiki-modal,#m-dex-modal,#poly-modal,#item-modal,#afk-card-ascension-modal,#ttmi-rift-supplies,#afk-ps-overlay,#afk-toggles-overlay) button{font-family:inherit;font-size:14px;line-height:1.5;min-height:40px}
body.afk-readable :is(#m-wiki-modal,#m-dex-modal,#poly-modal,#afk-card-ascension-modal,#ttmi-rift-supplies,#afk-ps-overlay,#afk-toggles-overlay) :is(input:not([type=checkbox]):not([type=radio]),select){font-family:inherit;font-size:16px!important;min-height:40px;max-width:100%;box-sizing:border-box}
body.afk-readable :is(button,a,input,select,summary):focus-visible{outline:2px solid #7dd3fc;outline-offset:3px}
body.afk-readable #m-wiki-body{min-height:0;overscroll-behavior:contain}
body.afk-readable :is(.m-wiki-card,.m-wiki-note,.m-wiki-tblwrap,.m-wiki-stbl-wrap,.m-wiki-sub){flex-shrink:0;min-width:0}
body.afk-readable :is(.m-wiki-tblwrap,.m-wiki-stbl-wrap){max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}
body.afk-readable :is(.m-wiki-tbl,.m-wiki-stbl) :is(th,td){padding:9px 10px;vertical-align:top}
body.afk-readable .m-wiki-tbl td{white-space:normal}
body.afk-readable .afk-guide-relic .m-wiki-tbl :is(th,td):first-child{min-width:7.5em;white-space:nowrap}
body.afk-readable :is(#m-wiki-close,#m-dex-close){min-width:40px;flex-shrink:0}
body.afk-readable :is(#m-wiki-clear,#m-dex-clear){min-height:28px;width:28px;height:28px}
body.afk-readable .afk-ca-overlay{box-sizing:border-box;padding:calc(var(--orig-bar-h,0px) + 12px) 12px calc(12px + env(safe-area-inset-bottom,0px));align-items:center}
body.afk-readable .afk-ca-dialog{box-sizing:border-box;display:flex;flex-direction:column;max-height:100%;width:min(680px,100%);padding:0;overflow:hidden}
body.afk-readable .afk-ca-dialog header{flex:none;padding:14px 16px;border-bottom:1px solid #334155;background:#111b2d}
body.afk-readable #afk-card-ascension-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 16px}
body.afk-readable .afk-ca-form{line-height:1.65;min-height:48px;gap:3px}
body.afk-readable .afk-ca-search{width:100%}
body.afk-readable .afk-ca-actions button{padding:8px 12px}
body.afk-readable :is(#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#poly-modal){box-sizing:border-box;padding-top:calc(var(--orig-bar-h,0px) + 12px);padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}
body.afk-readable :is(#card-book,#equip-book,#misc-book,#relic-book,#collection-panel,#poly-modal)>div{max-height:100%;min-height:0}
body.afk-readable #poly-modal>.panel{box-sizing:border-box;width:min(560px,calc(100vw - 24px));max-width:calc(100vw - 24px);overflow:hidden}
body.afk-readable #poly-modal>.panel>:not(#poly-modal-list){flex-shrink:0}
body.afk-readable #poly-modal-list{min-height:0;overscroll-behavior:contain}
/* 2026-11-11 19:39 手機：上面的說明、搜尋、分頁佔掉大半，只剩下面一小塊能滑，按在上面滑沒反應；改成整個面板一起捲，變身格子畫面外的先不排版 */
@media (max-width:760px){
body #poly-modal>.panel{overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
body #poly-modal-list{overflow:visible!important;max-height:none!important;flex:none!important;min-height:auto!important}
body #poly-modal>.panel>button.btn.mt-4{position:sticky;bottom:0;z-index:2}
}
#poly-modal-list .afk-ca-tile{content-visibility:auto;contain-intrinsic-size:auto 110px}
/* 2026-11-12 手機巡檢：村莊地圖只有約 130px 高，名牌太大會疊成一排；手機上名牌縮小、職稱藏起來（點了還是同一個 NPC） */
@media (max-width:760px){
#town-npc-map .town-npc .tn-label{padding:1px 5px;border-radius:5px;font-size:11px;line-height:1.15}
#town-npc-map .town-npc .tn-label .tn-name{font-size:11px}
#town-npc-map .town-npc .tn-label .tn-title{display:none}
}
/* 2026-11-12 手機巡檢：選角畫面左上「介面」「電台」蓋到第一張角色卡的「擔任傭兵」、右下「存檔與修復」蓋到能力表；上下各留出按鈕的位置 */
@media (max-width:760px){
#load-select-panel:not(.hidden){padding-top:calc(44px + env(safe-area-inset-top))!important;padding-bottom:calc(64px + env(safe-area-inset-bottom))!important;box-sizing:border-box}
}
/* iPhone 瀏海、底部橫條：浮動的「介面」「電台」「存檔與修復」避開安全區 */
#afk-toggles-entry,#afk-radio-btn{margin-top:env(safe-area-inset-top)}
#merge-recovery-entry{margin-bottom:env(safe-area-inset-bottom)}
/* Native dialogs must remain above the mobile log sheet (9500) and navigation
   (9600); confirmations keep their own higher layer. Do not close the log or
   change its scroll position merely because the user inspects an item. */
body.afk-readable :is(#item-modal,#poly-modal,#town-interaction-container,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel):not(.hidden){z-index:9700!important}
/* The fixed app stage is itself a stacking context. Raise it only while a
   native dialog is open, so a child z-index can actually clear the log sheet. */
body.afk-readable.m-mobile #app-stage:has(:is(#item-modal,#poly-modal,#town-interaction-container,#card-book,#equip-book,#misc-book,#relic-book,#collection-panel):not(.hidden)){z-index:9700}
body.afk-readable:not(.m-mobile) #item-modal:not(.hidden){position:fixed;top:calc(50% + var(--orig-bar-h,0px)/2);max-width:calc(100vw - 24px);max-height:calc(100dvh - var(--orig-bar-h,0px) - 24px);align-items:stretch}
body.afk-readable:not(.m-mobile) #item-modal>div{min-width:0;max-height:inherit;overflow-y:auto;overscroll-behavior:contain;width:min(420px,calc(100vw - 24px))}
body.afk-readable:not(.m-mobile) #item-modal>#modal-compare{width:320px;flex-shrink:1}
body.afk-readable #modal-item-name{align-items:flex-start;gap:10px}
body.afk-readable #modal-item-name>:first-child{min-width:0}
body.afk-readable #item-modal>.panel:not(#modal-compare)>*{flex-shrink:0}
body.afk-readable :is(#modal-item-desc,#modal-actions){flex:0 0 auto!important}
body.afk-readable #modal-actions button{white-space:normal;min-height:44px}
@media(max-width:900px){
 body.afk-readable:not(.m-mobile) #item-modal:not(.hidden){flex-direction:column-reverse;gap:10px;overflow-y:auto;overscroll-behavior:contain}
 body.afk-readable:not(.m-mobile) #item-modal>div,body.afk-readable:not(.m-mobile) #item-modal>#modal-compare{width:min(520px,calc(100vw - 24px));max-height:none;flex-shrink:0}
 body.afk-readable :is(.m-wiki-tbl,.m-wiki-stbl) :is(th,td){padding:8px}
}
@media(max-width:768px),(max-height:520px) and (pointer:coarse){
 body.afk-readable .afk-ca-dialog header,body.afk-readable #afk-card-ascension-body{padding:12px}
 body.afk-readable :is(#m-wiki-body,#m-dex-results){padding:10px}
 body.afk-readable .afk-guide-page{gap:6px;font-size:13px}
}
`;
    document.head.appendChild(s);
    // Only new top-level overlays are observed; battle subtree updates are not.
    var dialogs = { 'm-wiki-modal': '冒險小百科', 'm-dex-modal': '怪物與掉落查詢', 'item-modal': '物品說明', 'poly-modal': '選擇變身', 'afk-toggles-overlay': '外掛開關', 'afk-alert-card': '提示', 'afk-confirm-card': '確認' };
    function label(node) {
        if (!node || node.nodeType !== 1) return;
        if (dialogs[node.id]) { node.setAttribute('role','dialog'); node.setAttribute('aria-modal','true'); node.setAttribute('aria-label',dialogs[node.id]); }
    }
    Object.keys(dialogs).forEach(function (id) { label(document.getElementById(id)); });
    if (document.body && window.MutationObserver) new MutationObserver(function (list) { list.forEach(function (record) { record.addedNodes.forEach(label); }); }).observe(document.body,{childList:true});
    // Keep keyboard navigation within the dialog that currently owns focus.
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || T && !T.enabled('readability')) return;
        var d = document.activeElement && document.activeElement.closest('[role="dialog"]'); if (!d) return;
        var list = Array.from(d.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(function (el) { return el.getClientRects().length > 0; });
        if (!list.length) return;
        if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length-1].focus(); }
        else if (!e.shiftKey && document.activeElement === list[list.length-1]) { e.preventDefault(); list[0].focus(); }
    });
})();
