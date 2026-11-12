// ===== 嵌入式雙頁角色裝備面板 =====
// 🗑️ v3.5.87 整區刪除浮動視窗殘骸（用戶拍板）：本面板自 v3.5.x 起恆為嵌入模式（init 無條件加
//    equipment-window-embedded、全專案無 remove/toggle），原「可拖曳浮動視窗」的拖曳三件套、關閉鈕、
//    側欄清單（renderSidePanel/openEquipmentSidePanel/closeEquipmentSidePanel/plainItemName）、
//    closeEquipmentWindow、fitEquipmentWindowToViewport 非嵌入分支——共約 150 行永不可達死碼全數移除。
// 🗑️ 變身立繪引擎（_startMorphPortrait 三層 8fps 循環）一併移除：css/floating-ui.css 以
//    `.equipment-morph-snapshot{display:none!important}` 無條件隱藏（現行 183×408 純裝備格底圖無立繪區），
//    引擎只是在 display:none 子樹裡空轉探測圖檔＋跑 125ms interval（#17 計時器洩漏）。
//    素材 assets/morphanim/ 仍供戰鬥區變身動畫（js/09 MORPH_ANIM_3DIR）使用，未動；
//    日後若新底圖恢復立繪區，從 git 前版或 v3.5.86 的 js/19 找回 _startMorphPortrait 整組即可。
// 本面板保留：雙頁裝備格(renderSlots·第 2 頁＝席琳遺骸欄) ＋ 負重%(renderStats)。
(function () {
    const PAGE_SLOTS = [
        [
            { k: 'helm',    x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'ear1',    x: 19.4, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'ear2',    x: 80.1, y: 18.01, w: 19.67, h: 8.82 },
            { k: 'amulet',  x: 50.0, y: 33.46, w: 19.67, h: 8.82 },
            { k: 'gloves',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'cloak',   x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'tshirt',  x: 50.0, y: 42.77, w: 19.67, h: 8.82 },
            { k: 'wpn',     x: 19.4, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'shield', alt: 'offwpn', x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'armor',   x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'ring1',   x: 19.4, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'ring2',   x: 80.1, y: 58.46, w: 19.67, h: 8.82 },
            { k: 'belt',    x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'ring3',   x: 19.4, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'ring4',   x: 80.1, y: 67.77, w: 19.67, h: 8.82 },
            { k: 'shin',    x: 50.0, y: 72.67, w: 19.67, h: 8.82 },
            { k: 'boots',   x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'doll',    x: 19.4, y: 80.76, w: 19.67, h: 8.82 },
            { k: 'arrow',   x: 80.1, y: 80.76, w: 19.67, h: 8.82 }
        ],
        [
            { k: 'eye',       x: 19.4, y: 15.81, w: 19.67, h: 8.82 },   // 🐉 v3.7.57 魔眼欄（第二頁空白處·限 1·地龍之魔眼）
            { k: 'rem_eye',   x: 50.0, y: 15.81, w: 19.67, h: 8.82 },
            { k: 'rem_soul',  x: 80.1, y: 15.81, w: 19.67, h: 8.82 }, /* 🔌 加掛版補丁:之魂 */
            { k: 'rem_blood', x: 80.1, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_scale', x: 50.0, y: 52.08, w: 19.67, h: 8.82 },
            { k: 'rem_bone',  x: 19.4, y: 31.50, w: 19.67, h: 8.82 },
            { k: 'rem_fang',  x: 80.1, y: 44.98, w: 19.67, h: 8.82 },
            { k: 'rem_heart', x: 50.0, y: 63.36, w: 19.67, h: 8.82 },
            { k: 'rem_flesh', x: 50.0, y: 81.99, w: 19.67, h: 8.82 },
            { k: 'rem_claw',  x: 19.4, y: 44.98, w: 19.67, h: 8.82 },   /* 🔌 加掛版補丁:轉生欄位 */
            { k: 'holy',     x: 19.4, y: 80.76, w: 19.67, h: 8.82, gate: '__afkHolySlotOn', lbl: '聖物' } /* 🔌 加掛版補丁:聖物格 */,
            { k: 'engrave',  x: 50.0, y: 72.67, w: 19.67, h: 8.82, reb: 1, lbl: '遠征徽記' }, /* 🔌 加掛版補丁:遠征徽記 */   /* 🔌 加掛版補丁:手環兩格 */
            { k: 'bracelet', x: 80.1, y: 58.46, w: 19.67, h: 8.82, reb: 1, lbl: '手環' },
            { k: 'bracelet2', x: 80.1, y: 67.77, w: 19.67, h: 8.82, reb: 1, lbl: '手環' },   /* 🔌 加掛版補丁:密奧聖紋 */
            { k: 'mio',      x: 19.4, y: 67.77, w: 19.67, h: 8.82, gate: '__afkMioSlotOn', lbl: '密奧' },
            { k: 'sigil',    x: 50.0, y: 33.46, w: 19.67, h: 8.82, gate: '__afkSigilSlotOn', lbl: '聖紋' },   /* 🔌 加掛版補丁:守護者格 */
            { k: 'guard', x: 19.4, y: 58.46, w: 19.67, h: 8.82, gate: '__afkGuardSlotOn', lbl: '守護者', click: '__afkGuardSlotClick' }
        ]
    ];

    let page = 0;

    function el(id) { return document.getElementById(id); }

    const EQUIPMENT_TEMPLATE_CLASS = {
        royal: '王族', knight: '騎士', mage: '法師', elf: '妖精',
        dark: '黑妖', illusion: '幻術', dragon: '龍騎', warrior: '戰士'
    };
    function equipmentTemplateUrl() {
        const cls = typeof player !== 'undefined' && player ? EQUIPMENT_TEMPLATE_CLASS[player.cls] : '';
        if (!cls) return 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.webp') + '?v=20260713';
        const avatar = String(player.avatar || '');
        const female = avatar.startsWith('女') || avatar === '公主';   // 👑 v3.6.01 王族性別直接看 avatar：舊制以 bloodPledge 推斷，血盟改版後創角不再自動入盟、陣營又隨盟主而非自己 → 公主未入盟/入王子盟會誤判為男
        return 'public/assets/login/EQ%20UI/' + encodeURIComponent((female ? '女' : '男') + cls + '.webp') + '?v=20260713';
    }
    function syncEquipmentBackground() {
        const background = el('equipment-window-frame')?.querySelector('.equipment-window-bg');
        if (!background) return;
        const src = equipmentTemplateUrl();
        if (background.getAttribute('src') !== src) background.src = src;
    }

    // 🗑️ v3.5.84 移除 18 欄數值（等級/經驗/HP/MP/AC/萬能藥/PK/六維/四屬性抗/ER）：
    //    那批座標是「上一版角色卡版型」留下的百分比，現行底圖（public/assets/login/EQ UI/<性別><職業>.png）
    //    已改成純裝備格版型、上面沒有任何欄位標籤。這些數值在「能力」分頁本來就有完整顯示；
    //    PVP 的真實指標是性向值 alignmentValue，單一顯示點在 js/10 的 PVP 面板，勿在此重複。
    function renderStats() {
        if (typeof player === 'undefined' || !player || !player.d) return;
        const d = player.d;
        const weight = el('equipment-window-weight');
        if (weight) {
            const weightPct = Math.max(0, Math.round(Number(d.weightPct) || 0));
            const loadTier = Math.max(0, Math.min(3, Number(d.loadTier) || 0));
            weight.textContent = `負重 ${weightPct} %`;
            weight.dataset.loadTier = String(loadTier);
            weight.setAttribute('aria-label', `目前負重 ${weightPct}%`);
        }
    }

    function renderSlots() {
        if (typeof player === 'undefined' || !player || !player.eq) return;
        const host = el('equipment-window-slots');
        host.innerHTML = '';
        PAGE_SLOTS[page].forEach(pos => { if (pos.gate && !(typeof window[pos.gate] === 'function' && window[pos.gate](player))) return;   /* 🔌 加掛版補丁:密奧聖紋 */ if (pos.reb && !(typeof window.__afkRebirthSlotOn === 'function' && window.__afkRebirthSlotOn(player))) return;   /* 🔌 加掛版補丁:轉生欄位 */
            const actualKey = pos.alt && player.eq[pos.alt] ? pos.alt : pos.k;
            const item = player.eq[actualKey];
            const data = item && typeof DB !== 'undefined' && DB.items[item.id];
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.dataset.slot = actualKey;
            slot.setAttribute('aria-label', data ? data.n + ((item.en || 0) > 0 ? ' +' + capEn(item.en, data) : '') : (pos.lbl || ({helm:'頭盔',ear1:'耳環',ear2:'耳環',amulet:'項鍊',gloves:'手套',cloak:'斗篷',tshirt:'內衣',wpn:'武器',shield:'盾牌',armor:'盔甲',ring1:'戒指',ring2:'戒指',ring3:'戒指',ring4:'戒指',belt:'腰帶',shin:'脛甲',boots:'長靴',doll:'魔法娃娃',arrow:'箭矢',eye:'魔眼',rem_eye:'席琳之眼',rem_soul:'席琳之魂',rem_blood:'席琳之血',rem_scale:'席琳之鱗',rem_bone:'席琳之骨',rem_fang:'席琳之牙',rem_heart:'席琳之心',rem_flesh:'席琳之肉',rem_claw:'席琳之爪'})[actualKey] || actualKey) + '：尚未裝備');
            slot.className = 'equipment-visual-slot' + (item ? ' is-filled' : ' is-empty');
            slot.style.cssText = `left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%;`;
            if (item && data) {
                const img = document.createElement('img');
                img.src = getIconUrl(data);
                img.alt = data.n || pos.k;
                img.draggable = false;
                img.onerror = function () { this.style.display = 'none'; };
                // 裝備框沿用背包／舊裝備欄的統一圖示光效：祝福金光、遠古紫光、屬性光、遺物與傳說皆由單一判定處理。
                if (typeof getGlowClass === 'function') {
                    const glowClass = getGlowClass(item, data);
                    if (glowClass) img.classList.add(...glowClass.split(/\s+/).filter(Boolean));
                }
                slot.appendChild(img);
                if ((data.type === 'wpn' || data.type === 'arm' || data.type === 'acc') && !data.isArrow) {
                    const equipped = document.createElement('span');
                    equipped.className = 'equipment-slot-equipped';
                    equipped.textContent = 'E';
                    equipped.setAttribute('aria-hidden', 'true');
                    slot.appendChild(equipped);
                }
                if ((Number(item.en) || 0) > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'equipment-slot-enhance';
                    badge.textContent = '+' + capEn(item.en, data);
                    slot.appendChild(badge);
                } else if ((item.cnt || 1) > 1) {
                    const count = document.createElement('span');
                    count.className = 'equipment-slot-count';
                    count.textContent = (item.cnt || 1).toLocaleString();
                    slot.appendChild(count);
                }
                slot.classList.add('tip-host');
                slot.setAttribute('data-tip-uid', item.uid); slot.setAttribute('data-tip-src', 'eq');   // 🖱️ hover 即時顯示已裝備物品完整資訊 tooltip
                slot.onclick = function () {   // 嵌入模式：單擊開物品視窗（原浮動模式的側欄延遲單擊已隨側欄移除）
                    if (typeof openModal !== 'function') return;
                    // 📥 上游 v3.9.28（lostshin 7cb08ef5a，Ping 11-12 移植）：手機上單擊會立刻蓋上物品頁、第二下點不到 → 延 230ms 再開，雙擊才卸得下來
                    //   只有「手指點的」才延遲（剛剛 0.6 秒內有 touchstart）；滑鼠、程式呼叫照舊立刻開
                    if (!(window._eqLastTouch && Date.now() - window._eqLastTouch < 600)) return openModal(item, true, actualKey);
                    clearTimeout(window._eqSlotClickTimer);
                    window._eqSlotClickTimer = setTimeout(() => openModal(item, true, actualKey), 230);
                };
                slot.ondblclick = function (event) {
                    clearTimeout(window._eqSlotClickTimer);
                    event.preventDefault();
                    event.stopPropagation();
                    unequipItem(actualKey);
                };
            } else {
                slot.title = pos.lbl ? (pos.lbl + '：尚未裝備') : '尚未裝備'; if (pos.lbl) { const _l = document.createElement('span'); _l.className = 'equipment-slot-lbl'; _l.textContent = pos.lbl; slot.appendChild(_l); }   /* 🔌 加掛版補丁:轉生欄位 */
            }
            if (pos.click && typeof window[pos.click] === 'function') { slot.onclick = function () { window[pos.click](player); }; slot.ondblclick = null; slot.classList.remove('tip-host'); slot.removeAttribute('data-tip-uid'); slot.removeAttribute('data-tip-src'); slot.title = pos.lbl || ''; }   /* 🔌 加掛版補丁:守護者格 */
            host.appendChild(slot);
        });
        const pageOne = el('equipment-window-prev');
        const pageTwo = el('equipment-window-next');
        pageOne.disabled = false;
        pageTwo.disabled = false;
        pageOne.classList.toggle('active', page === 0);
        pageTwo.classList.toggle('active', page === 1);
        pageOne.setAttribute('aria-pressed', page === 0 ? 'true' : 'false');
        pageTwo.setAttribute('aria-pressed', page === 1 ? 'true' : 'false');
    }

    function fitEquipmentWindowToViewport() {   // 嵌入模式唯一版型：貼齊 #tab-content-panel、寬度以 183×408 底圖比例夾擠
        const frame = el('equipment-window-frame');
        const win = el('equipment-window');
        if (!frame || !win || win.classList.contains('hidden')) return;
        const host = el('tab-content-panel');
        if (!host) return;
        if (document.body.classList.contains('m-unified')) {
            if (win.parentElement !== host) host.appendChild(win);
            frame.style.setProperty('width', Math.min(host.clientWidth, 366) + 'px', 'important');
            return; // Native document flow handles scrolling; no fixed-position tracking on phones.
        }
        if (win.parentElement === host) document.body.appendChild(win);
        let hostRect = host.getBoundingClientRect();
        const maxFrameWidth = 366;
        if (innerWidth <= 768) {
            const mobileFrameWidth = Math.min(hostRect.width, maxFrameWidth);
            const mobileHeight = Math.ceil(mobileFrameWidth * 408 / 183);
            host.style.setProperty('--equipment-panel-height', mobileHeight + 'px');
            hostRect = host.getBoundingClientRect();
        }
        const frameWidth = Math.max(0, Math.min(
            hostRect.width,
            maxFrameWidth,
            hostRect.height * 183 / 408
        ));
        win.style.left = hostRect.left + 'px';
        win.style.top = hostRect.top + 'px';
        win.style.right = 'auto';
        win.style.bottom = 'auto';
        win.style.width = hostRect.width + 'px';
        win.style.height = hostRect.height + 'px';
        frame.style.left = '50%';
        frame.style.top = '0';
        frame.style.setProperty('width', frameWidth + 'px', 'important');
        frame.style.transform = 'translateX(-50%)';
    }

    window.refreshEquipmentWindow = function () {
        const win = el('equipment-window');
        if (!win || win.classList.contains('hidden')) return;
        syncEquipmentBackground();
        renderStats();
        renderSlots();
    };

    window.setEquipmentPanelEmbedded = function (visible) {
        const win = el('equipment-window');
        if (!win) return;
        const host = el('tab-content-panel');
        if (host) {
            host.classList.toggle('equipment-panel-host', visible);
            if (!visible || innerWidth > 768) host.style.removeProperty('--equipment-panel-height');
            else host.style.setProperty('--equipment-panel-height', Math.ceil(Math.min(host.getBoundingClientRect().width, 366) * 408 / 183) + 'px');
        }
        win.classList.add('equipment-window-embedded');
        win.classList.toggle('hidden', !visible);
        win.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (!visible) return;
        if (innerWidth <= 768 && !document.body.classList.contains('m-unified')) {
            const scroller = el('game-screen');
            if (scroller && host) {
                const scrollerRect = scroller.getBoundingClientRect();
                const hostRect = host.getBoundingClientRect();
                if (hostRect.bottom > scrollerRect.bottom) scroller.scrollTop += hostRect.bottom - scrollerRect.bottom + 8;
                if (hostRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - hostRect.top + 8;
            }
        }
        refreshEquipmentWindow();
        requestAnimationFrame(fitEquipmentWindowToViewport);
    };

    // 🗑️ 移除 window.openEquipmentWindow／window.toggleEquipmentWindow：
    //   v3.5.87 砍掉整組浮動視窗開關流程後兩者已零呼叫點（js/*.js、index.html/test.html 的 inline onclick、css/ 全域 Grep 皆無）。
    //   目前唯一活著的入口＝js/10-ui-tabs.js 直接呼叫 window.setEquipmentPanelEmbedded(布林)。

    function init() {
        const frame = el('equipment-window-frame');
        if (!frame) return;
        const win = el('equipment-window');
        if (win) win.classList.add('equipment-window-embedded');
        const background = frame.querySelector('.equipment-window-bg');
        if (background) {
            background.onerror = function () {
                this.onerror = null;
                this.src = 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.webp') + '?v=20260713';
            };
            syncEquipmentBackground();
        }
        el('equipment-window-prev').setAttribute('aria-label', '裝備第 1 頁');
        el('equipment-window-next').setAttribute('aria-label', '裝備第 2 頁');
        el('equipment-window-prev').onclick = function () { page = 0; refreshEquipmentWindow(); };
        el('equipment-window-next').onclick = function () { page = 1; refreshEquipmentWindow(); };
        window.addEventListener('resize', fitEquipmentWindowToViewport);
        const gameScroller = el('game-screen');
        if (gameScroller) gameScroller.addEventListener('scroll', fitEquipmentWindowToViewport, { passive: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
// 📥 手機裝備欄單擊延遲用：記下最後一次手指觸碰的時間
try { document.addEventListener('touchstart', function () { window._eqLastTouch = Date.now(); }, { passive: true, capture: true }); } catch (e) {}
