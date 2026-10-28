# 介面大圖轉 WebP（玩家 2026-10-27）：登入／選角／創角畫面、遊戲背景、人物欄底圖、職業標誌、裝備欄底圖
# 原 .png 保留；引用路徑由 scripts/apply-webp-patches.mjs 改成 .webp。新增或更換這些圖之後重跑本腳本。
from PIL import Image
import glob, os
files = glob.glob('public/assets/login/*.png') + glob.glob('public/assets/login/EQ UI/*.png') + ['assets/background/background.png'] + glob.glob('assets/character/*.png') + glob.glob('assets/logo/*.png')
t0 = t1 = 0
for f in files:
    im = Image.open(f); out = f[:-4] + '.webp'
    if im.mode == 'P': im = im.convert('RGBA' if 'transparency' in im.info else 'RGB')
    im.save(out, 'WEBP', quality=72 if f.endswith('background.png') else 90, method=6)   # 遊戲背景大多被暗色遮罩蓋住，用 72 就夠
    t0 += os.path.getsize(f); t1 += os.path.getsize(out)
print(len(files), 'files', round(t0 / 1024), 'KB ->', round(t1 / 1024), 'KB')
