/* ============================================================================
 * afk-dup-frames.js — 重複動畫幀改指向同一張圖（玩家 2026-10-30：網站再壓小）
 *
 * 動畫樹裡內容一模一樣的幀，公開版只留一張（清單：afk-dup-frames-data.js，由 scripts/build-dup-frames.py 產生）。
 * 這裡在圖片網址設定的當下（img.src、setAttribute('src')、new Image().src）把被拿掉的那張改成留下來的那張；
 * 萬一有圖從別的路徑（例如 innerHTML 直接寫 <img src>）載入失敗，再補一次改指向。
 * 畫面完全不變；同一張圖也只需要下載一次。第 0 格（*_0.png）一律保留，所以縮圖、圖鑑不受影響。
 * 2026-10-31（#161）：公開版另外把第 1 格以後的幀換成 WebP 無損（afk-webp-frames-data.js 開著時，網址 *_N.png → *_N.webp；
 *   載入失敗退回 PNG）。開發版（perf）是關的，照讀 PNG。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, M = W.AFK_DUP_FRAMES || { F: [], D: {} }, WEBP = !!(W.AFK_WEBP_FRAMES && W.AFK_WEBP_FRAMES.on);
  if (typeof HTMLImageElement === 'undefined') return;
  var F = M.F, D = M.D, fIdx = null, cache = Object.create(null), hits = 0;
  var folderMap = function (dir) {
    if (!fIdx) { fIdx = Object.create(null); for (var i = 0; i < F.length; i++) fIdx[F[i]] = i; }
    var i2 = fIdx[dir]; if (i2 === undefined) return null;
    var m = cache[i2];
    if (!m) {
      m = cache[i2] = Object.create(null);
      var s = D[i2]; if (s) s.split(';').forEach(function (e) { var k = e.indexOf('>'); m[e.slice(0, k)] = e.slice(k + 1); });
    }
    return m;
  };
  var RE_TREE = /(?:^|\/)(assets\/(?:anim|classanim|morphanim)\/|art-v3\/frames\/)/;
  // 公開版：動畫樹第 1 格以後的幀改讀 .webp（無損，像素完全相同；scripts/build-webp-frames.py，玩家 2026-10-31 #161）
  var RE_WEBP = /_[1-9]\d*\.png(?=[?#]|$)/;
  var toWebp = function (v) {
    if (!WEBP || typeof v !== 'string' || !RE_WEBP.test(v)) return v;
    var p = v; try { if (v.indexOf('%') >= 0) p = decodeURIComponent(v); } catch (e) {}
    if (!RE_TREE.test(p)) return v;
    return v.replace(RE_WEBP, function (x) { return x.slice(0, -4) + '.webp'; });
  };
  // ── 動畫幀合成大圖（Ping 11-18 22:49；scripts/build-anim-sheets.py，公開版部署時打開）──
  //   每個動作第 1 格以後的幀合成一張 <資料夾>/<動作>.sheet.webp（無損）。要第 N 格時：大圖已切好 → 給切好的那一格（blob 網址）；
  //   還沒載完 → 先給第 0 格，並記下這張 <img>，切好後自動換上。超過最大格號的照原網址（不存在＝探測幀數時會停下來）。
  var SH = W.AFK_ANIM_SHEETS && W.AFK_ANIM_SHEETS.on && W.AFK_ANIM_SHEETS.data ? W.AFK_ANIM_SHEETS.data : null;
  var shIdx = null, shState = Object.create(null);
  var hold = new Map(), cellOwners = new Map(), desired = new WeakMap(), waitForCell = {};
  var canRelease = typeof WeakRef === 'function' && typeof FinalizationRegistry === 'function';
  var release = canRelease && new FinalizationRegistry(function (entry) {
    entry.urls.forEach(function (url) { cellOwners.delete(url);URL.revokeObjectURL(url); });
    if (shState[entry.key] === entry.ref) delete shState[entry.key];
  });
  var workerUrl = new URL('world/sheet-worker.js', document.currentScript.src).href;
  var worker, workerId = 0, jobs = new Map();
  function splitInWorker(url, group, finish) {
    if (worker === false || typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function') return false;
    try {
      if (!worker) {
        worker = new Worker(workerUrl);
        worker.onmessage = function (ev) {
          var complete = jobs.get(ev.data.id);
          jobs.delete(ev.data.id);
          if (complete) complete(ev.data.blobs);
        };
        worker.onerror = function () {
          worker.terminate(); worker = false;
          var retry = Array.from(jobs.values()); jobs.clear(); retry.forEach(function (fn) { fn(); });
        };
      }
      var id=++workerId;
      jobs.set(id, finish); worker.postMessage({id:id,url:new URL(url,document.baseURI).href,group:group});
      return true;
    } catch (_) { jobs.delete(id); return false; }
  }
  function sourceURL(value) {
    if(typeof value!=='string'||!value.startsWith('blob:'))return value;
    var pos=value.indexOf('#giran-frame=');
    if(pos===-1)return value;
    var path=value.slice(pos+13);
    return /^(assets\/(anim|classanim|morphanim)\/|art-v3\/frames\/)/.test(path)?new URL(path,document.baseURI).href:value;
  }
  W.__afkFrameSource=sourceURL;
  var shGroup = function (dir, act) {
    if (!shIdx) { shIdx = Object.create(null); var D0 = SH.d, G = SH.g; for (var i = 0; i < G.length; i++) shIdx[D0[G[i][0]] + '/' + G[i][1]] = G[i]; }
    return shIdx[dir + '/' + act] || null;
  };
  var origSet = null;   // 原本的 img.src setter（下面設定）
  var shLoad = function (key, g, head, enc) {
    var st = canRelease ? shState[key]?.deref() : shState[key];
    if (st) return st;
    st = { cells: [], wait: Object.create(null), ok: false };
    if(canRelease){
      var ref=shState[key]=new WeakRef(st);
      release.register(st,{key:key,ref:ref,urls:st.cells});
      hold.set(key,st);
      if(hold.size>64)hold.delete(hold.keys().next().value);
    } else shState[key]=st;
    var dir = key.slice(0, key.lastIndexOf('/')), act = g[1];
    var url = dir + '/' + act + '.sheet.webp'; if (enc) url = url.split('/').map(encodeURIComponent).join('/');
    var apply = function(failed) {
      st.ok=!failed;st.bad=failed;
      st.cells.forEach(function(url){if(url)cellOwners.set(url,shState[key]);});
      for(var n in st.wait) {
        var cu=frameURL(st,g,+n,dir,act);
        st.wait[n].forEach(function(img){
          var request=desired.get(img);
          if(!request||request.st!==st||request.n!==+n)return;
          desired.delete(img);
          origSet.call(img,cu||toWebp(dupMap(request.url)));
        });
      }
      st.wait=null;
    };
    var onMain = function(){
    var im = new Image();
    im.onload = function () {
      var cols = g[3], cw = g[4], ch = g[5], sizes = g[7] || null, nCells = 0, c = g[6], k;
      if (c && c.length) { for (k = 0; k < c.length; k++) if (c[k] + 1 > nCells) nCells = c[k] + 1; } else nCells = g[2];
      var left = nCells;
      for (k = 0; k < nCells; k++) (function (i) {
        var w = sizes ? sizes[i][0] : cw, h = sizes ? sizes[i][1] : ch;
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(im, (i % cols) * cw, Math.floor(i / cols) * ch, w, h, 0, 0, w, h);
        cv.toBlob(function (bl) {
          st.cells[i] = bl ? URL.createObjectURL(bl) : '';
          cv.width=cv.height=0;
          if (--left === 0) apply(false);
        }, 'image/png');
      })(k);
    };
    im.onerror = function () { apply(true); };
    try { if (origSet) origSet.call(im, (head || '') + url); else im.src = (head || '') + url; } catch (e) {}
    };
    if(!splitInWorker((head || '') + url,g,function(blobs){
      if(!blobs){onMain();return;}
      blobs.forEach(function(bl){st.cells.push(URL.createObjectURL(bl));}); apply(false);
    }))onMain();
    return st;
  };
  var cellOf = function (g, n) { var c = g[6]; return c && c.length ? c[n - 1] : n - 1; };
  function frameURL(st,g,n,dir,act) {
    var cell=st.cells[cellOf(g,n)];
    return cell?cell+'#giran-frame='+encodeURI(dir+'/'+act+'_'+n+'.png'):'';
  }
  // These particular sprites are painted by assigning a URL to a visible image. The
  // checked atlas already describes every frame, including duplicate cells. Looking up
  // a pose should not decode a second, invisible image for every frame and direction.
  W.__afkSheetFrameSources = function (first, count) {
    if (!SH || count < 2) return null;
    var absolute = new URL(first, document.baseURI);
    var rel = decodeURIComponent(absolute.pathname), tree = RE_TREE.exec(rel);
    if (!tree || !rel.endsWith('_0.png')) return null;
    rel = rel.slice(tree.index + (tree[0][0] === '/' ? 1 : 0));
    var slash = rel.lastIndexOf('/'), dir = rel.slice(0, slash), act = rel.slice(slash + 1, -6);
    var group = shGroup(dir, act);
    if (!group || group[2] !== count - 1 || group[6]?.some(cell => cell < 0)) return null;
    var key = dir + '/' + act, firstURL = absolute.href;
    return Array.from({length:count}, function (_, n) {
      var url = n ? firstURL.replace(/_0\.png(?=[?#]|$)/, '_' + n + '.png') : firstURL;
      if (!n) return {src:url};
      // The regular src setter loads the sheet on first use. If the sheet is pending it
      // displays frame zero, then installs the desired cell only if this pose still owns the image.
      return Object.defineProperty({}, 'src', {get:function () {
        var state = canRelease ? shState[key]?.deref() : shState[key];
        return state?.ok ? frameURL(state, group, n, dir, act) || url : url;
      }});
    });
  };
  var RE_SH = /^(.*)_([1-9]\d*)$/;
  var sheetMap = function (v, img) {
    if (!SH || typeof v !== 'string' || v.indexOf('.png') < 0 || (v.indexOf('anim') < 0 && v.indexOf('art-v3') < 0)) return null;
    var q = '', qi = v.search(/[?#]/), u = v; if (qi >= 0) { q = v.slice(qi); u = v.slice(0, qi); }
    if (!/_[1-9]\d*\.png$/.test(u)) return null;
    var enc = u.indexOf('%') >= 0, p; try { p = enc ? decodeURIComponent(u) : u; } catch (e) { return null; }
    var m = RE_TREE.exec(p); if (!m) return null;
    var at = m.index + (m[0].charAt(0) === '/' ? 1 : 0), head = p.slice(0, at), rel = p.slice(at);
    var slash = rel.lastIndexOf('/'), dir = rel.slice(0, slash), mm = RE_SH.exec(rel.slice(slash + 1, -4)); if (!mm) return null;
    var g = shGroup(dir, mm[1]); if (!g) return null;
    var n = +mm[2]; if (n > g[2]) return v;   // 沒有這一格：照原網址（不存在）
    var ci = cellOf(g, n); if (ci < 0) return v;
    var st = shLoad(dir + '/' + mm[1], g, enc ? encodeURI(head) : head, enc);
    if(img)img.__giranSheet=st;
    if (st.ok && st.cells[ci]) return frameURL(st,g,n,dir,mm[1]);
    if (st.bad) return v;
    if (img && st.wait) {
      desired.set(img,{st:st,n:n,url:v});
      var wl = st.wait[n] || (st.wait[n] = []); if (wl.indexOf(img) < 0) wl.push(img);
      if(img.__giranProbeFrame)return waitForCell;
    }
    var f0 = dir + '/' + mm[1] + '_0.png'; if (enc) f0 = f0.split('/').map(encodeURIComponent).join('/');
    return (enc ? encodeURI(head) : head) + f0 + q;   // 大圖還沒好：先顯示第 0 格
  };
  var map = function (v, img) {
    if(typeof v==='string'&&v.startsWith('blob:')){
      var mark=v.indexOf('#giran-frame='),ref=mark>=0&&cellOwners.get(v.slice(0,mark));
      var owner=ref&&(canRelease?ref.deref():ref);
      if(owner){if(img){desired.delete(img);img.__giranSheet=owner;}return v;}
    }
    v=sourceURL(v);
    if(img){desired.delete(img);if(img.__giranSheet)img.__giranSheet=null;}
    var s = sheetMap(v, img); if (s !== null) return s; return toWebp(dupMap(v));
  };
  var dupMap = function (v) {
    if (typeof v !== 'string' || v.length < 12) return v;
    if (v.indexOf('anim') < 0 && v.indexOf('art-v3') < 0) return v;
    if (!/_[1-9]\d*\.png(?:[?#]|$)/.test(v)) return v;   // 只有「第 1 格以後」的幀可能被合併
    var q = '', qi = v.search(/[?#]/); if (qi >= 0) { q = v.slice(qi); v = v.slice(0, qi); }
    var raw = v, enc = v.indexOf('%') >= 0, p;
    try { p = enc ? decodeURIComponent(v) : v; } catch (e) { return raw + q; }
    var m = RE_TREE.exec(p); if (!m) return raw + q;
    var at = m.index + (m[0].charAt(0) === '/' ? 1 : 0), head = p.slice(0, at), rel = p.slice(at);
    var slash = rel.lastIndexOf('/'), dir = rel.slice(0, slash), name = rel.slice(slash + 1, -4);
    var fm = folderMap(dir); if (!fm) return raw + q;
    var t = fm[name]; if (!t) return raw + q;
    var out;
    if (t.charAt(0) === '=') out = dir + '/' + t.slice(1);
    else if (t.indexOf('/') > 0) { var k = t.indexOf('/'); out = F[+t.slice(0, k)] + '/' + t.slice(k + 1); }
    else out = dir + '/' + name.replace(/\d+$/, '') + t;
    out += '.png'; hits++;
    if (enc) out = out.split('/').map(encodeURIComponent).join('/');
    return (enc ? encodeURI(head) : head) + out + q;
  };
  // 1) img.src／new Image().src
  var d = null;
  try {
    d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.configurable) Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      // ⚡ 11-12 效能：動畫每格都會重設 src；跟現在一模一樣、而且已經載好的就不再設（瀏覽器每設一次都會重跑一次圖片更新流程）
      set: function (v) { var nv = map(v, this); if(nv===waitForCell)return; if (typeof nv === 'string' && this.complete && this.naturalWidth > 0 && this.getAttribute('src') === nv) return; d.set.call(this, nv); }
    });
  } catch (e) {}
  try { origSet = d && d.set ? d.set : null; } catch (e) {}
  // 2) setAttribute('src', …)
  try {
    var oSA = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if ((n === 'src' || n === 'SRC') && this instanceof HTMLImageElement) {v = map(v, this);if(v===waitForCell)return;}
      return oSA.call(this, n, v);
    };
  } catch (e) {}
  // 3) 保險：<img> 載入失敗而且是被拿掉的那張 → 改指向留下來的那張
  //    WebP 那張載入失敗（對照表漏了的新幀）→ 退回原本的 PNG，只退一次
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    var s = t.getAttribute('src');
    if (WEBP && typeof s === 'string' && /_[1-9]\d*\.webp(?=[?#]|$)/.test(s) && !t.__afkPngBack) {
      t.__afkPngBack = true; var back = s.replace(/\.webp(?=[?#]|$)/, '.png');
      if (d && d.set) d.set.call(t, back); else t.setAttribute('data-afk', '1');
      return;
    }
    var m2 = map(s); if (m2 && m2 !== s) t.src = m2;
  }, true);
  W.__afkAnimSheets = { on: !!SH, state: function () {
    if(!canRelease)return shState;
    var state=Object.create(null);
    for(var key in shState){var entry=shState[key].deref();if(entry)state[key]=entry;}
    return state;
  } };
  W.__afkDupSrc = map; W.__afkWebpOn = function () { return WEBP; };
  W.__afkDupStats = function () { return { folders: F.length, hits: hits }; };
})();
