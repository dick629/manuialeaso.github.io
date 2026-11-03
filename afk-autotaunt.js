/* ============================================================================
 * afk-autotaunt.js — 「自動嗆聲」設定（玩家 2026-11-03 21:57）
 *
 * 核心 logTrollEncounterTrashTalk（js/03）：野外出現玩家 NPC 時，你的角色會自動在世界頻道嗆對方一句、對方回嗆一句。
 * 設定分頁（回選角／NPC AI 對話那一列）多一個勾選「自動嗆聲」：預設勾著＝原本的行為；取消勾選＝不再自動嗆聲
 *   （玩家 NPC 照常出現、照常打，只是世界頻道不會多那兩句）。
 * 只是介面偏好，存在這台電腦（localStorage afk_auto_taunt：'0'＝關），不進存檔。不改核心檔，包核心函式。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, KEY = 'afk_auto_taunt';
  var on = function () { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
  var set = function (v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
  if (typeof W.logTrollEncounterTrashTalk === 'function') {
    var o = W.logTrollEncounterTrashTalk;
    W.logTrollEncounterTrashTalk = function () { if (!on()) return; return o.apply(this, arguments); };
    try { (0, eval)('logTrollEncounterTrashTalk = window.logTrollEncounterTrashTalk'); } catch (e) {}
  } else { try { console.warn('[AFK-autotaunt] 找不到 logTrollEncounterTrashTalk，未啟用'); } catch (e) {} }

  var inject = function () {
    var anchor = document.getElementById('npc-language-setting');
    if (!anchor || !anchor.parentNode) return false;
    if (document.getElementById('afk-auto-taunt')) return true;
    var lab = document.createElement('label');
    lab.id = 'afk-auto-taunt';
    lab.className = 'btn min-w-32 py-1 px-3 text-sm font-bold bg-slate-700 hover:bg-slate-600 border-slate-500 text-rose-100 cursor-pointer flex items-center justify-center gap-2';
    lab.title = '遇到玩家時，自動在世界頻道嗆對方一句';
    lab.innerHTML = '<input type="checkbox" class="w-4 h-4"><span>自動嗆聲</span>';
    var cb = lab.querySelector('input');
    cb.checked = on();
    cb.addEventListener('change', function () { set(cb.checked); });
    anchor.parentNode.insertBefore(lab, anchor.nextSibling);
    return true;
  };
  var tries = 0;
  (function retry() { if (inject()) return; if (++tries < 40) setTimeout(retry, 500); })();
  W.__afkAutoTaunt = { on: on, set: function (v) { set(!!v); var el = document.querySelector('#afk-auto-taunt input'); if (el) el.checked = !!v; } };
})();
