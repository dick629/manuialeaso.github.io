# -*- coding: utf-8 -*-
"""高階變身的特殊造型（玩家 2026-10-26：神話／天上／時空／聖衣不要只是原圖加描邊，要更多元）

參考私服「特殊變身」的做法——同一隻原作動畫做成不同主題的版本（火焰死騎、暗黑死騎、雷神死騎、紅／紫色警衛…），
再加上變身檔濾鏡常見的「發光」「半透明」「殘影」效果。每一張卡都有自己的主題色，不再只是原圖：
  神話（32）：八種主題輪替——烈焰、暗黑、雷神、冰霜、翠玉、血月、黃金、月銀。盔甲換主題金屬色、外發光、主題粒子
  天上（21）：白金聖光——整體提亮、21 種各自的點綴色、頭頂光環、背後光翼、飄落羽光
  時空（14）：時空殘影——每張自己的色相、身後兩層半透明殘影、星點、輕微半透明
  聖衣（12）：黃金聖衣——金屬全部鍍金、該星座代表色點綴、強烈金色外發光、星座光點

做法：先用 forge-morph.py 的匯入／骨架（不加光效）得到原圖三方向資料夾，再逐幀加工：
  畫布左右、上方各加 PAD 像素留給光暈與殘影（畫面以底部置中對齊，所以站位不變），影子與武器層同樣補邊。
用法：python3 scripts/forge-style.py all | <卡名…>     （可重跑；會覆寫 assets/morphanim/<卡名>{,2,F}）
"""
import sys, os, json, time, zlib, importlib.util
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.dirname(HERE)
ROOT = os.path.join(WORK, 'assets', 'morphanim')
spec = importlib.util.spec_from_file_location('forge', os.path.join(HERE, 'forge-morph.py'))
FM = importlib.util.module_from_spec(spec); spec.loader.exec_module(FM)
PAD = 12

# ───────────── 色彩（numpy 向量化 HSV） ─────────────
def rgb2hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = ((b - r)[gm] / d[gm]) + 2
    h[bm] = ((r - g)[bm] / d[bm]) + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def hsv2rgb(h, s, v):
    h = (h % 360) / 60.0; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[sel, 0] = a[sel]; out[sel, 1] = b[sel]; out[sel, 2] = c[sel]
    return out

def hue_toward(h, target, k):
    dlt = ((target - h + 540) % 360) - 180
    return (h + dlt * k) % 360

# ───────────── 效果 ─────────────
def glow_layer(alpha, color, radius, strength):
    """alpha：0~1 的身體遮罩 → 擴張＋模糊的外發光（只留在身體外側）"""
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    g = a.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(radius))
    ga = np.asarray(g).astype(float) / 255 * strength
    ga = np.clip(ga, 0, 1)
    lay = np.zeros(alpha.shape + (4,))
    lay[..., 0] = color[0] / 255; lay[..., 1] = color[1] / 255; lay[..., 2] = color[2] / 255; lay[..., 3] = ga
    return lay

def over(top, bot):
    """premultiplied-free alpha composite（0~1 浮點 RGBA）"""
    ta = top[..., 3:4]; ba = bot[..., 3:4]
    oa = ta + ba * (1 - ta)
    oc = np.where(oa > 1e-6, (top[..., :3] * ta + bot[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-6), 0)
    return np.concatenate([oc, oa], -1)

def outline(arr, color, alpha_cut=0.04):
    a = arr[..., 3] > alpha_cut
    n = np.zeros_like(a)
    n[1:, :] |= a[:-1, :]; n[:-1, :] |= a[1:, :]; n[:, 1:] |= a[:, :-1]; n[:, :-1] |= a[:, 1:]
    edge = n & ~a
    arr[edge, 0] = color[0] / 255; arr[edge, 1] = color[1] / 255; arr[edge, 2] = color[2] / 255; arr[edge, 3] = np.maximum(arr[edge, 3], 0.6)
    return arr

def rng_for(name, fi, act, salt=0):
    return np.random.default_rng((hash((name, act, fi // 2, salt)) & 0xffffffff))

def particles(arr, name, fi, act, kind, color, n=6):
    """主題粒子：依幀數往上飄（每 2 幀同一組種子位移，連起來是緩慢上升）"""
    if act.startswith('death'): return arr
    H, W = arr.shape[:2]
    a = arr[..., 3] > 0.1
    ys, xs = np.where(a)
    if not len(ys): return arr
    top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    rg = np.random.default_rng(zlib.crc32((name + kind).encode("utf-8")))
    seeds = rg.random((n, 3))
    col = np.array(color[:3]) / 255
    for i in range(n):
        sx, sy, ph = seeds[i]
        x = int(left - 4 + sx * (right - left + 8))
        span = max(8, bot - top)
        y = int(bot - ((sy * span + (fi + ph * 8) * 3) % (span + 10)))
        pts = []
        if kind in ('ember', 'glitter', 'mote'): pts = [(0, 0)] + ([(0, -1)] if kind == 'ember' else [])
        elif kind == 'spark': pts = [(0, 0), (1, -1), (0, -2), (1, -3)]
        elif kind == 'snow': pts = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]
        elif kind == 'leaf': pts = [(0, 0), (1, 0), (1, -1)]
        elif kind == 'smoke': pts = [(0, 0), (1, 0), (0, -1), (1, -1)]
        elif kind == 'feather': pts = [(0, 0), (0, -1), (1, -2), (-1, -1)]
        elif kind == 'star': pts = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)] if (fi + i) % 3 else [(0, 0)]
        elif kind == 'drop': pts = [(0, 0), (0, -1)]
        tw = 0.55 + 0.45 * abs(np.sin((fi + ph * 6) * 0.9))
        for dx, dy in pts:
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H:
                al = (0.55 if kind == 'smoke' else 0.95) * tw
                cur = arr[yy, xx]
                na = al + cur[3] * (1 - al)
                arr[yy, xx, :3] = (col * al + cur[:3] * cur[3] * (1 - al)) / max(na, 1e-6)
                arr[yy, xx, 3] = na
    return arr

def halo(arr, color=(255, 240, 184)):
    a = arr[..., 3] > 0.1
    ys, xs = np.where(a)
    if not len(ys): return arr
    top = ys.min(); row = xs[ys <= top + 3]; cx = int(np.median(row)) if len(row) else int(xs.mean())
    w = max(6, int((xs.max() - xs.min()) * 0.22)); y = top - 4
    H, W = arr.shape[:2]
    for x in range(cx - w, cx + w + 1):
        t = (x - cx) / max(1, w); dy = int(round(1.6 * (1 - t * t)))
        for yy in (y - dy, y + dy):
            if 0 <= x < W and 0 <= yy < H:
                arr[yy, x, :3] = np.array(color) / 255; arr[yy, x, 3] = 0.95
    return arr

# ───────────── 主題 ─────────────
# metal：灰白／金屬部分換成的色相與飽和；accent：原本有顏色的部分轉向的色相；glow：外發光；part：粒子
MYTHIC = [
    dict(key='烈焰', metal=(22, 0.55, 0.95), accent=12, glow=(255, 120, 30), out=(255, 170, 60), part=('ember', (255, 190, 80))),
    dict(key='暗黑', metal=(272, 0.35, 0.62), accent=285, glow=(150, 60, 255), out=(190, 120, 255), part=('smoke', (120, 70, 200))),
    dict(key='雷神', metal=(212, 0.45, 1.05), accent=200, glow=(120, 200, 255), out=(200, 235, 255), part=('spark', (220, 245, 255))),
    dict(key='冰霜', metal=(192, 0.30, 1.12), accent=185, glow=(170, 240, 255), out=(220, 250, 255), part=('snow', (235, 250, 255))),
    dict(key='翠玉', metal=(150, 0.45, 0.95), accent=140, glow=(60, 230, 140), out=(150, 255, 190), part=('leaf', (120, 240, 150))),
    dict(key='血月', metal=(356, 0.55, 0.85), accent=350, glow=(230, 30, 60), out=(255, 110, 120), part=('drop', (220, 40, 60))),
    dict(key='黃金', metal=(44, 0.70, 1.05), accent=40, glow=(255, 200, 60), out=(255, 225, 120), part=('glitter', (255, 240, 170))),
    dict(key='月銀', metal=(225, 0.12, 1.15), accent=235, glow=(200, 215, 255), out=(235, 240, 255), part=('mote', (240, 245, 255))),
]
ZODIAC_HUE = FM.ZODIAC_HUE

def recolor(arr, metal, accent, accent_k=0.85, sat_floor=0.0, light=1.0):
    rgb = arr[..., :3]; a = arr[..., 3] > 0.02
    h, s, v = rgb2hsv(rgb)
    low = s < 0.22
    mh, ms, mv = metal
    nh = np.where(low, mh, hue_toward(h, accent, accent_k))
    ns = np.where(low, np.clip(ms * (0.5 + v), 0, 1), np.clip(np.maximum(s, sat_floor), 0, 1))
    nv = np.clip(np.where(low, v * mv, v) * light, 0, 1)
    out = hsv2rgb(nh, ns, nv)
    arr[a, :3] = out[a]
    return arr

def style(arr, tier, name, idx, side, fi, act):
    """arr：已補邊的 0~1 RGBA 浮點陣列（本體一幀）"""
    alpha = arr[..., 3].copy()
    if tier == 'mythic':
        th = MYTHIC[idx % len(MYTHIC)]
        arr = recolor(arr, th['metal'], th['accent'])   # 玩家 2026-10-26：神話只換色（原本造型＋主題色，不加光膜、粒子）
    elif tier == 'celestial':
        hue = LOOK[name][1] if name in LOOK else (idx * 360 / 21 + 15) % 360
        h, s, v = rgb2hsv(arr[..., :3]); a = alpha > 0.02
        nh = np.where(s < 0.22, 46, hue_toward(h, hue, 0.8))
        ns = np.where(s < 0.22, 0.22 + 0.2 * (1 - v), np.clip(s * 0.9 + 0.15, 0, 1))
        nv = np.clip(v + (1 - v) * 0.30, 0, 1)
        arr[a, :3] = hsv2rgb(nh, ns, nv)[a]
        wing = glow_layer(alpha, (255, 246, 210), 5, 0.55)
        # 光翼：把外發光往左右拉寬一點（背後的柔光）
        wing2 = np.roll(wing, 4, axis=1) * 0.5 + np.roll(wing, -4, axis=1) * 0.5
        arr = over(arr, over(glow_layer(alpha, (255, 230, 150), 2, 0.35), wing2))
        arr = halo(arr)
        accent_rgb = tuple(int(c * 255) for c in hsv2rgb(np.array([hue]), np.array([0.45]), np.array([1.0]))[0])
        arr = particles(arr, name, fi, act, 'feather', accent_rgb, 6)
    elif tier == 'spacetime':
        hue = LOOK[name][1] if name in LOOK else (185 + idx * 23) % 360
        arr = recolor(arr, (hue, 0.35, 1.0), (hue + 40) % 360, 0.9, 0.35)
        glow_rgb = tuple(int(c * 255) for c in hsv2rgb(np.array([hue]), np.array([0.6]), np.array([1.0]))[0])
        body = arr.copy()
        # 殘影：身後兩層半透明（朝背後方向位移）
        dx = -side if side else 1
        trail = np.zeros_like(arr)
        for k, al in ((10, 0.28), (5, 0.45)):
            sh = np.roll(body, dx * k, axis=1).copy()
            sh[..., :3] = sh[..., :3] * 0.5 + np.array(glow_rgb) / 255 * 0.5
            sh[..., 3] *= al
            trail = over(sh, trail)
        arr = over(body, over(trail, glow_layer(alpha, glow_rgb, 2.5, 0.4)))
        arr[..., 3] = np.where(alpha > 0.02, np.minimum(arr[..., 3], 0.93), arr[..., 3])   # 本體輕微半透明
        arr = particles(arr, name, fi, act, 'star', (235, 248, 255), 7)
    elif tier == 'samsara':   # 保留角色原色：金色光膜＋星座色外光＋星點（翅膀另外畫進圖，見 bake_wings）
        zh = next((v for k, v in ZODIAC_HUE.items() if name.startswith(k)), 45)
        zc = tuple(int(c * 255) for c in hsv2rgb(np.array([zh]), np.array([0.7]), np.array([1.0]))[0])
        arr[..., :3] = np.clip(arr[..., :3] * 1.06 + 0.02, 0, 1)
        arr = over(arr, over(glow_layer(alpha, (255, 214, 90), 2.5, 0.6), glow_layer(alpha, zc, 5, 0.4)))
        arr = outline(arr, (255, 232, 150))
        arr = particles(arr, name, fi, act, 'star', zc, 8)
    return arr

def pad_img(im, pad):
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad), (0, 0, 0, 0))
    out.paste(im, (pad, pad))
    return out

def process_folder(name, tier, idx):
    n = 0
    for sfx in FM.DIRS:
        d = os.path.join(ROOT, name + sfx)
        if not os.path.isdir(d): continue
        side = FM.SIDE[sfx]
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'): continue
            p = os.path.join(d, f)
            act, fi = FM.frame_info(f)
            im = pad_img(Image.open(p).convert('RGBA'), PAD)
            if act.endswith('_s') or act.endswith('_w'):
                im.save(p, optimize=True); continue
            arr = np.asarray(im).astype(float) / 255
            arr = style(arr.copy(), tier, name, idx, side, fi, act)
            out = Image.fromarray((np.clip(arr, 0, 1) * 255).round().astype(np.uint8), 'RGBA')
            FM.save_png(out, p); n += 1
    return n

def rebuild_plain(row):
    """原圖（不加光效）重建三方向資料夾"""
    name = row['name']
    # 玩家 2026-10-26：「收藏圖鑑的樣子就可以」——天上／時空／聖衣一律用原型變身（圖鑑上看到的那張）當本體，
    #   再套光膜、翅膀（afk-card-fx 動態層）、改配色；LOOK 只用它的色相
    if row['tier'] == 'samsara' and name in SAMSARA_BODY:
        return FM.build(name, SAMSARA_BODY[name], lambda im, side, fi, act: im)
    if row['tier'] != 'mythic':
        skel = FM.SKELETON_OVERRIDE.get(name) or (row['proto'] if os.path.isdir(os.path.join(ROOT, row['proto'])) else row['alias'])
        return FM.build(name, skel, lambda im, side, fi, act: im)
    if name in FM.CARD_IMPORT: return FM.import_anim(name, FM.CARD_IMPORT[name], None)
    skel = FM.card_skeleton(row)
    return FM.build(name, skel, lambda im, side, fi, act: im)



# ───────────── 月畔天堂式外觀（玩家 2026-10-26：參照 lineagemoon.com 變身卡，連 NPC、玩家角色也拿來用）─────────────
# 卡名：(原作動畫, 主色相, 參照的造型名稱)；沒列的沿用 forge-morph.py 的 CARD_IMPORT
LOOK = {
    # 天上：英雄／傳說級——玩家角色與 NPC 的「神聖」「月之」配色版
    '天上・曙光聖騎': ('玩家男騎士', 48, '神聖男騎士'), '天上・月羽神弓': ('玩家女妖精', 220, '月之絲莉安'),
    '天上・熾光聖賢': ('玩家男法師', 32, '吉倫'), '天上・天穹劍聖': ('玩家女騎士', 200, '神聖女騎士'),
    '天上・雷霆天將': ('玩家男龍騎士', 210, '屠龍者'), '天上・金輝守護': ('玩家女戰士', 45, '守護者菲利亞'),
    '天上・焚天戰神': ('玩家男戰士', 12, '狂暴戰士'), '天上・夜幕天刃': ('玩家女黑暗妖精', 272, '女黑妖'),
    '天上・天律裁決': ('玩家王子', 52, '王子'), '天上・星海魔導': ('玩家女法師', 250, '女法師'),
    '天上・雲端劍豪': ('玩家男黑暗妖精', 178, '男黑妖'), '天上・天羽獵星': ('玩家男妖精', 125, '男妖精'),
    '天上・天影忍神': ('黑暗妖精盜賊', 300, '精靈劍士'), '天上・天命陰陽': ('玩家女幻術士', 285, '黑暗之星'),
    '天上・曦光射手': ('黑暗妖精巡守', 15, '英雄警衛(弓)'), '天上・天籟法師': ('玩家公主', 330, '公主'),
    '天上・天雷武士': ('黑騎士搜索隊', 200, '英雄倫德'), '天上・天威大名': ('受詛咒的艾爾摩將軍', 0, '伯爵安托里歐'),
    '天上・天弓姬武': ('依詩蒂公主', 340, '依詩蒂'), '天上・蒼穹拳聖': ('玩家女龍騎士', 195, '女武神艾伊爾'),
    '天上・天狼王': ('玩家男幻術士', 30, '幻術大師'),
    # 時空：神話級——荒神、統治者、不敗、漆黑焚焰…
    '時空・永劫騎士': ('死亡騎士', 0, '荒神死亡騎士'), '時空・裂星獵手': ('法令軍王蕾雅', 212, '荒神白金巡守'),
    '時空・萬象先知': ('長老．泰瑪斯', 280, '傳說賢者'), '時空・終焉守門': ('拉斯塔巴德近衛隊', 45, '不敗甘特'),
    '時空・虛空劍帝': ('暗黑火焰戰士', 15, '漆黑焚焰戰士'), '時空・逆時雷霆': ('闇黑君王', 190, '海神'),
    '時空・時砂暴君': ('火焰之魔法師', 25, '覺醒炎魔'), '時空・輪迴劍鬼': ('黑暗復仇者', 262, '黑暗之星'),
    '時空・次元裁判': ('黑暗精靈使', 55, '宙斯'), '時空・混沌魔尊': ('長老．巴洛斯', 300, '國王巴溫'),
    '時空・時空劍豪': ('血騎士', 220, '白金劍豪'), '時空・星界弓神': ('冰之女王', 185, '傲慢的女王'),
    '時空・永夜忍皇': ('黑暗棲林者', 265, '漆黑刺客'), '時空・時之巫女': ('魔女賽尼斯', 320, '魔女莉夏'),
    # 聖衣：一律人形（玩家 2026-10-26：不要用怪物）
    '獅子座聖衣': ('黑暗妖精將軍', 30, '黃金獅子騎士'), '摩羯座聖衣': ('長老．巴陸德', 260, '黃金山羊聖者'),
}

# ───────────── 道具專用變身（afk-polys-item.js）─────────────
# 名稱：(來源種類, 來源, 主題)  來源種類 anim＝原作怪物動畫（assets/anim）、morph＝現有三方向變身；主題 None＝原色
ITEM = {
    '狂暴將軍': ('anim', '黑暗妖精將軍', (0, 0.55, 0.85, 355)), '甘特': ('anim', '拉斯塔巴德近衛隊', (215, 0.35, 1.05, 205)),
    '布魯迪卡': ('anim', '暗黑火焰戰士', (350, 0.5, 0.9, 345)), '丹特斯': ('anim', '真‧死亡騎士 冥皇丹特斯', None),
    '海露拜': ('anim', '冥法軍王海露拜', None), '黃金史雷佛': ('anim', '暗殺軍王史雷佛', (44, 0.7, 1.05, 40)),
    '紅色海音警衛': ('anim', '黑暗妖精警衛(矛)', (0, 0.6, 0.85, 355)), '銀光刺客': ('morph', '黑暗妖精刺客', (220, 0.1, 1.2, 225)),
    '黃金刺客': ('morph', '黑暗妖精刺客', (44, 0.7, 1.05, 40)), '老虎': ('anim', '真‧虎男', None),
    '火焰弓箭手': ('anim', '火焰弓箭手', None), '黑法師': ('anim', '黑法師', None), '魔女': ('anim', '魔女賽尼斯', None),
    '少女賽尼斯': ('anim', '賽尼斯', (330, 0.35, 1.1, 325)), '黑翼賽尼斯': ('anim', '魔女賽尼斯', (275, 0.3, 0.6, 285)),
    '死神': ('anim', '死神', None), '德雷克': ('anim', '德雷克', None), '亞丁近衛隊': ('anim', '拉斯塔巴德近衛隊隊長', (220, 0.45, 1.0, 215)),
    '哈維': ('anim', '哈維', None), '土精靈王': ('anim', '土精靈王', None), '艾庫阿茲特': ('anim', '提卡爾艾庫阿茲特', None),
    '曼波兔': ('anim', '曼波兔', None), '胡蘿蔔曼波兔': ('anim', '曼波兔', (28, 0.75, 1.05, 25)),
    '黑貓': ('anim', '貓', (0, 0.0, 0.35, 0)), '招財貓': ('anim', '貓', (44, 0.6, 1.1, 0)),
    '南瓜稻草人': ('anim', '紙人', (28, 0.85, 1.0, 25)), '淘氣小孩': ('anim', '唐傘小僧', None),
    '高等柯利': ('anim', '高等柯利', None), '高等浣熊': ('anim', '高等浣熊', None), '高等熊': ('anim', '高等熊', None), '熊貓': ('anim', '熊貓', None),
}

def build_item(name):
    kind, src, theme = ITEM[name]
    if kind == 'anim':
        if os.path.isdir(os.path.join(FM.ANIM, src, 'd5')): src = src + '/d5'   # 八方向怪物：取面向左下（與單向怪物圖同向）
        FM.import_anim(name, src, None)
    else: FM.build(name, src, lambda im, side, fi, act: im)
    if not theme: return 0
    mh, ms, mv, acc = theme
    n = 0
    for sfx in FM.DIRS:
        d = os.path.join(ROOT, name + sfx)
        for f in sorted(os.listdir(d)):
            act, fi = FM.frame_info(f)
            if not f.endswith('.png') or act.endswith('_s') or act.endswith('_w'): continue
            pth = os.path.join(d, f)
            arr = np.asarray(Image.open(pth).convert('RGBA')).astype(float) / 255
            arr = recolor(arr.copy(), (mh, ms, mv), acc, 0.85 if ms > 0.05 else 0.0, 0.0, 1.0)
            if ms == 0.0 and mv < 0.5:   # 黑：整體壓暗
                arr[..., :3] *= 0.45
            FM.save_png(Image.fromarray((np.clip(arr, 0, 1) * 255).round().astype(np.uint8), 'RGBA'), pth); n += 1
    return n

# 聖衣本體（玩家 2026-10-26：用圖鑑上這幾個角色組成聖衣，保留角色原色，套光膜＋星座特效＋翅膀）
SAMSARA_BODY = {'白羊座聖衣': '特羅斯', '金牛座聖衣': '黃金死亡騎士', '雙子座聖衣': '闇黑死亡騎士', '巨蟹座聖衣': '死亡',
    '獅子座聖衣': '雷霆死亡騎士', '處女座聖衣': '伊詩蒂', '天秤座聖衣': '喬', '天蠍座聖衣': '焚焰死亡騎士',
    '射手座聖衣': '莉絲安', '摩羯座聖衣': '格利特', '水瓶座聖衣': '亞克騎士', '雙魚座聖衣': '絲莉安'}

# ───────────── 聖衣：把星座背翼直接畫進圖檔（玩家 2026-10-26：圖鑑、傭兵身上也要看得到翅膀）─────────────
# 翅膀圖由遊戲內 afk-cloth-art 產生後存成 scripts/cloth-strips/<星座>.png（橫排動畫幀）＋ meta.json
STRIPS = os.path.join(HERE, 'cloth-strips')
def bake_wings(name):
    meta = json.load(open(os.path.join(STRIPS, 'meta.json'), encoding='utf-8'))
    m = meta['cards'].get(name); B = meta['box']
    if not m: return 0
    strip = Image.open(os.path.join(STRIPS, m['zodiac'] + '.png')).convert('RGBA')
    ks = float(os.environ.get('WING_SCALE', '0.5'))   # 2026-10-28 玩家：翅膀原本比角色大兩倍多、太粗糙 → 預設縮成一半
    m = dict(m); m['w'] = max(8, int(round(m['w'] * ks))); m['h'] = max(8, int(round(m['h'] * ks)))
    frames = [strip.crop((k * m['cw'], 0, (k + 1) * m['cw'], m['ch'])).resize((m['w'], m['h']), Image.LANCZOS if ks < 1 else Image.NEAREST) for k in range(m['frames'])]
    n = 0
    for sfx in FM.DIRS:
        d = os.path.join(ROOT, name + sfx)
        if not os.path.isdir(d): continue
        ref = np.asarray(Image.open(os.path.join(d, 'idle_0.png')).convert('RGBA'))
        H, W = ref.shape[:2]; a = ref[..., 3] > 32
        ys, xs = np.where(a)
        top, bot = ys.min(), ys.max(); bh = bot - top + 1; u = bh / 100
        rows = xs[ys <= top + max(4, round(bh * .18))]; hx = float(np.median(rows)) + .5
        bottom_gap = (H - bot - 1) + max(3, bh * .04)
        left = hx - B['sx'] * u * ks; bottom_px = bottom_gap + bh * .66 - m['h'] * (1 - B['syFrac']); top_px = H - bottom_px - m['h']
        pad = int(np.ceil(max(0, -left, left + m['w'] - W))); padt = int(np.ceil(max(0, -top_px)))
        front = sfx == 'F'
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'): continue
            pth = os.path.join(d, f); im = Image.open(pth).convert('RGBA')
            big = Image.new('RGBA', (im.width + pad * 2, im.height + padt), (0, 0, 0, 0)); big.paste(im, (pad, padt))
            act, fi = FM.frame_info(f)
            if act.endswith('_s') or act.endswith('_w'):
                big.save(pth, optimize=True); continue
            wing = frames[fi % len(frames)]
            pos = (int(round(left)) + pad, int(round(top_px)) + padt)
            if front: big.alpha_composite(wing, pos)
            else:
                layer = Image.new('RGBA', big.size, (0, 0, 0, 0)); layer.alpha_composite(wing, pos); layer.alpha_composite(big); big = layer
            FM.save_png(big, pth); n += 1
    return n

def mythic_themes(cards):
    """神話主題分配：同系列（銀光／黃金／白金／黑暗…）、同職能（騎士／法師／巡守）盡量不撞主題，八種平均使用"""
    used = [0] * len(MYTHIC); taken = {}; out = {}
    for row in [r for r in cards if r['tier'] == 'mythic']:
        base = row['proto']; ser, role = base[:2], base[-2:]
        bad = set(taken.get(('s', ser), [])) | set(taken.get(('r', role), []))
        cand = sorted(range(len(MYTHIC)), key=lambda t: (t in bad, used[t], t))
        t = cand[0]; out[row['name']] = t; used[t] += 1
        taken.setdefault(('s', ser), []).append(t); taken.setdefault(('r', role), []).append(t)
    return out

def main():
    cards = json.load(open(os.path.join(HERE, 'forge-cards.json'), encoding='utf-8'))
    if len(sys.argv) > 1 and sys.argv[1] == 'bake':
        for nm in sys.argv[2:]: print('bake', nm, bake_wings(nm), flush=True)
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'item':
        for nm in (sys.argv[2:] or list(ITEM)): print('item', nm, build_item(nm), flush=True)
        return
    want = set(sys.argv[1:]) - {'all'}
    order = {}; themes = mythic_themes(cards)
    t0 = time.time()
    for row in cards:
        i = order.get(row['tier'], 0); order[row['tier']] = i + 1
        if row['tier'] == 'mythic': i = themes[row['name']]
        if want and row['name'] not in want: continue
        rebuild_plain(row)
        n = process_folder(row['name'], row['tier'], i)
        if row['tier'] == 'samsara' and os.environ.get('NO_BAKE') != '1': bake_wings(row['name'])
        theme = MYTHIC[i % len(MYTHIC)]['key'] if row['tier'] == 'mythic' else ''
        print(row['tier'], row['name'], theme, n, 'frames', flush=True)
    print('done in %.0fs' % (time.time() - t0))

if __name__ == '__main__':
    main()
