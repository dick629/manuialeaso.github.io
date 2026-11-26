window.LineageTalentCatalog={
  "branches": {
    "melee": {
      "A": "近戰直接傷害 +0.5%（第 5 顆為增強節點，見逐點說明）",
      "B": "近戰命中 +1",
      "N1": "本職近戰攻擊技能傷害 +2%",
      "N2": "近戰爆擊率 +0.5 百分點",
      "N3": [
        "近戰技能 MP 成本 −3%",
        "近戰爆擊傷害 +5 百分點",
        "近戰命中 +2"
      ],
      "K": "破軍：每三次近戰直接命中，取得 8 秒近戰技能傷害 +12%；冷卻 12 秒"
    },
    "ranged": {
      "A": "遠攻直接傷害 +0.5%（第 5 顆為增強節點，見逐點說明）",
      "B": "遠攻命中 +1",
      "N1": "遠攻攻擊技能傷害 +2%",
      "N2": "遠攻爆擊率 +0.5 百分點",
      "N3": [
        "遠攻技能 MP 成本 −3%",
        "遠攻爆擊傷害 +5 百分點",
        "遠攻命中 +2"
      ],
      "K": "貫星：對同目標連續三次普攻命中，第三次傷害 +25% 後重新計數；未命中或換目標清零"
    },
    "magic": {
      "A": "法術直接傷害 +1%",
      "B": "MP 上限 +1%",
      "N1": "本職攻擊魔法傷害 +2%",
      "N2": "MP 自然恢復量 +2%",
      "N3": [
        "法術命中 +2",
        "攻擊魔法 MP 成本 −3%",
        "法術爆擊傷害 +5 百分點"
      ],
      "K": "法潮：完成三次付費攻擊施法後，下次攻擊魔法傷害 +12%；派生攻擊不計次"
    },
    "defense": {
      "A": "HP 上限 +1%",
      "B": "魔防 +2",
      "N1": "受到普攻傷害 −0.5%",
      "N2": "火、水、風、地抗性各 +2",
      "N3": [
        "AC −1",
        "異常狀態抵抗 +2 百分點",
        "受到的治療量 +4%"
      ],
      "K": "磐石：受到攻擊後 HP 首次低於 40%，取得自身最大 HP 10% 的護盾，持續 6 秒、冷卻 30 秒；不能救回已死亡角色"
    },
    "support": {
      "A": "自己施放的治療量 +1.5%",
      "B": "自己施放的增益持續時間 +2%",
      "N1": "自己施放的數值增益效果 +1%",
      "N2": "治療技能 MP 成本 −1%",
      "N3": [
        "自己產生的護盾量 +4%",
        "輔助技能 MP 成本 −3%",
        "自己施放的治療量 +4%"
      ],
      "K": "同心：有效施放治療或增益後，存活隊友獲得 6 秒治療受益 +10%；冷卻 12 秒，不複製其他增益"
    },
    "minions": {
      "A": "自己召喚物／寵物傷害 +1.5%",
      "B": "自己召喚物／寵物 HP +2%",
      "N1": "伙伴命中 +1",
      "N2": "伙伴受到範圍傷害 −1%",
      "N3": [
        "伙伴四屬性抗性各 +5",
        "伙伴治療受益量 +4%",
        "伙伴受到普攻傷害 −2%"
      ],
      "K": "共獵：主人直接命中後標記目標 8 秒，自己伙伴對該目標傷害 +10%；冷卻 12 秒，不新增出戰格"
    },
    "movement": {
      "A": "移動速度 +1%",
      "B": "負重上限 +2%",
      "N1": "移動速度 +2%",
      "N2": "擊敗敵人後 3 秒移速額外 +2%；重複擊敗只刷新時間",
      "N3": [
        "移動速度 +10%、負重上限 +3%",
        "移動速度 +10%、負重上限 +3%",
        "捷徑：副本內每擊殺一隻符合條件的怪物，有 5% 機率直接進入下一層"
      ],
      "K": "逐風：每擊敗三個不同敵人，獲得 6 秒移速 +15%；冷卻 12 秒，不縮短固定副本等待或技能冷卻"
    }
  },
  "j": {
    "magic+melee+ranged": {
      "name": "三相戰技",
      "description": "10 秒內各完成一次近戰、遠攻、法術直接命中後，下次原生攻擊傷害 +30%；冷卻 20 秒"
    },
    "defense+melee+ranged": {
      "name": "攻守輪轉",
      "description": "近戰與遠攻交替命中後取得護盾；護盾存在期間，對該目標的近／遠直接傷害 +10%"
    },
    "melee+ranged+support": {
      "name": "雙鋒戰歌",
      "description": "近／遠交替命中後，自己下一次有效治療量 +20%；成功治療的隊友獲得近／遠直接傷害 +6%"
    },
    "melee+minions+ranged": {
      "name": "合圍狩獵",
      "description": "近／遠交替命中同目標後，自己一名伙伴對該目標協擊一次，取伙伴普通攻擊基礎 50%；全體伙伴共用冷卻"
    },
    "melee+movement+ranged": {
      "name": "游擊大師",
      "description": "近／遠交替命中後移速 +20%，且下一次近／遠攻擊命中 +8"
    },
    "defense+magic+melee": {
      "name": "魔鋼誓約",
      "description": "近戰與法術交替命中後取得護盾；護盾存在期間，近戰與法術技能 MP 成本 −10%"
    },
    "magic+melee+support": {
      "name": "聖咒武裝",
      "description": "近戰與攻擊法術交替命中後，下次治療或數值增益 +15%；施放後下一次近戰直接傷害 +15%"
    },
    "magic+melee+minions": {
      "name": "契約戰刃",
      "description": "近戰與法術交替命中同目標後，自己伙伴獲得對該目標傷害 +15%，並回復伙伴最大 HP 3% 一次"
    },
    "magic+melee+movement": {
      "name": "閃襲法刃",
      "description": "近戰與法術交替命中後移速 +20%；下次近戰或法術技能 MP 成本 −20%"
    },
    "defense+melee+support": {
      "name": "誓衛領主",
      "description": "自身護盾有效時近戰命中，使當下血量比例最低的存活隊友獲得護盾，並提高其治療受益 10%；不轉移或複製原護盾數值"
    },
    "defense+melee+minions": {
      "name": "鐵衛共獵",
      "description": "自己近戰命中後，自己與一名血量比例最低的伙伴各取得護盾；該伙伴下一次普攻傷害 +15%"
    },
    "defense+melee+movement": {
      "name": "破陣先鋒",
      "description": "近戰命中後取得移速 +20% 與護盾；不提供穿牆、無敵或直接傳送"
    },
    "melee+minions+support": {
      "name": "獸群戰歌",
      "description": "有效施放治療／增益後，下次近戰命中使自己伙伴傷害 +12%，並回復伙伴最大 HP 3% 一次"
    },
    "melee+movement+support": {
      "name": "行軍誓言",
      "description": "近戰命中後有效施放治療／增益，自己取得移速 +20%，受益隊友取得治療受益 +10%"
    },
    "melee+minions+movement": {
      "name": "獵群突進",
      "description": "主人與伙伴在 8 秒內命中同目標後，自己移速 +20%，伙伴下一次普攻傷害 +25%"
    },
    "defense+magic+ranged": {
      "name": "星幕壁壘",
      "description": "遠攻與法術交替命中後取得護盾，並使該目標對自己的下一次直接攻擊傷害 −10%"
    },
    "magic+ranged+support": {
      "name": "星詠共鳴",
      "description": "遠攻與法術交替命中後，下次有效治療／數值增益 +15%；其受益隊友下一次直接攻擊傷害 +8%"
    },
    "magic+minions+ranged": {
      "name": "星獸追獵",
      "description": "遠攻與法術交替命中同目標後，一名伙伴協擊一次，取伙伴普通攻擊基礎 50%，並獲得命中 +8"
    },
    "magic+movement+ranged": {
      "name": "流星游俠",
      "description": "遠攻與法術交替命中後移速 +20%；下次遠攻或法術直接攻擊傷害 +15%"
    },
    "defense+ranged+support": {
      "name": "守望旗手",
      "description": "遠攻命中後，下次有效治療同時給受療者護盾；自己取得魔防 +10"
    },
    "defense+minions+ranged": {
      "name": "獸衛獵陣",
      "description": "遠攻命中被自己伙伴鎖定的目標後，伙伴獲得護盾；主人對該目標遠攻傷害 +10%"
    },
    "defense+movement+ranged": {
      "name": "風牆獵手",
      "description": "遠攻命中後取得移速 +20% 與護盾；護盾失效不額外重置冷卻"
    },
    "minions+ranged+support": {
      "name": "牧獵祝福",
      "description": "有效治療／增益後，下一次遠攻命中使自己伙伴傷害 +12%，並回復伙伴最大 HP 3% 一次"
    },
    "movement+ranged+support": {
      "name": "疾風號令",
      "description": "遠攻命中後有效施放治療／增益，自己移速 +20%，受益隊友下一次原生攻擊命中 +8"
    },
    "minions+movement+ranged": {
      "name": "群獵疾行",
      "description": "主人遠攻與伙伴在 8 秒內命中同目標後，自己移速 +20%，伙伴對該目標傷害 +12%"
    },
    "defense+magic+support": {
      "name": "聖幕法典",
      "description": "攻擊法術命中後，下次有效治療量 +15% 並給受療者護盾；不把溢補重複計成治療"
    },
    "defense+magic+minions": {
      "name": "契約護壁",
      "description": "攻擊法術命中後，自己及一名血量比例最低的伙伴取得護盾；該伙伴魔防 +10"
    },
    "defense+magic+movement": {
      "name": "流光護幕",
      "description": "攻擊法術命中後取得移速 +20% 與護盾；不降低攻擊施法間隔"
    },
    "magic+minions+support": {
      "name": "靈潮共鳴",
      "description": "攻擊法術命中後有效施放治療／增益，自己伙伴傷害 +12%，且下一次受到的有效治療量 +20%"
    },
    "magic+movement+support": {
      "name": "巡風禱者",
      "description": "有效施放治療／增益後，自己移速 +20%；下一次攻擊魔法 MP 成本 −20%"
    },
    "magic+minions+movement": {
      "name": "星靈疾行",
      "description": "攻擊法術命中伙伴鎖定目標後，自己移速 +20%，一名伙伴協擊一次，取其普通攻擊基礎 40%"
    },
    "defense+minions+support": {
      "name": "萬靈庇護",
      "description": "有效治療／增益後，自己與一名血量比例最低的伙伴取得護盾；伙伴受到的治療量 +10%"
    },
    "defense+movement+support": {
      "name": "行旅聖域",
      "description": "有效治療／增益後，自己移速 +20%，當下血量比例最低的存活隊友取得護盾"
    },
    "defense+minions+movement": {
      "name": "獸衛行軍",
      "description": "伙伴命中時，自己移速 +20%，一名血量比例最低的伙伴取得護盾；同次施放或多伙伴同幀只觸發一次"
    },
    "minions+movement+support": {
      "name": "逐風牧靈",
      "description": "有效治療／增益後，自己移速 +20%，伙伴傷害 +10%、治療受益 +10%"
    }
  }
};

// Node text is derived from the same values used by combat.
window.LineageTalentCatalog.nodeDescription=window.LineageGrowthCore.nodeDescription;
