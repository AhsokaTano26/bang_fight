// ============================================================
// Strategy card definitions — all 64 cards (A-D series)
// ============================================================

import type { StrategyCardDef } from './types'

export const STRATEGY_CARDS: StrategyCardDef[] = [
  // ===========================================================
  // A Series (16 cards)
  // ===========================================================

  // A0001 破坏者之钳 — 道具: 每次攻击有1/3概率拆除被攻击角色的道具牌
  {
    id: 'A0001',
    name: '破坏者之钳',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0001.png',
    description: '每次攻击有1/3概率拆除被攻击角色的道具牌',
    requiresTarget: true,
    equipEffects: [{ type: 'forceRetireOnHit', value: 3 }],
  },

  // A0002 难绷假面 — 道具: 免疫沉默效果
  {
    id: 'A0002',
    name: '难绷假面',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0002.png',
    description: '免疫沉默效果',
    requiresTarget: true,
    equipEffects: [{ type: 'silenceImmunity' }],
  },

  // A0003 禁止事项 — 即时: 缴械一名角色装备的道具牌一回合
  {
    id: 'A0003',
    name: '禁止事项',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0003.png',
    description: '缴械一名角色装备的道具牌一回合',
    requiresTarget: true,
    instantType: 'disarmEquipment',
  },

  // A0004 财团B的阴谋 — 即时: 将一名玩家手牌上未部署的角色送入休息室
  {
    id: 'A0004',
    name: '财团B的阴谋',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0004.png',
    description: '将一名玩家手牌上尚未部署的角色送入休息室',
    requiresTarget: true,
    instantType: 'discardUndeployedChar',
  },

  // A0005 无限制live格斗 — 即时: 双方轮流出攻击牌直到一方不能出
  {
    id: 'A0005',
    name: '无限制live格斗',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0005.png',
    description: '指定一名己方角色和对方角色，双方轮流出攻击牌直到一方不能出，该角色直接退场',
    requiresTarget: true,
    instantType: 'duelMode',
  },

  // A0006 米歇尔红豆饼 — 道具: +1手牌上限
  {
    id: 'A0006',
    name: '米歇尔红豆饼',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0006.png',
    description: '+1手牌上限',
    requiresTarget: true,
    equipEffects: [{ type: 'handLimitBoost', value: 1 }],
  },

  // A0007 原装米歇尔 — 道具: +1攻击力，+1护甲
  {
    id: 'A0007',
    name: '原装米歇尔',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0007.png',
    description: '+1攻击力，+1护甲',
    requiresTarget: true,
    equipEffects: [
      { type: 'attackBoost', value: 1 },
      { type: 'armorBoost', value: 1 },
    ],
  },

  // A0008 我有异议 — 即时: 使一张即将发动的即时牌失效
  {
    id: 'A0008',
    name: '我有异议',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0008.png',
    description: '使一张即将发动的即时牌失效',
    requiresTarget: false,
    instantType: 'counterInstant',
  },

  // A0009 战斗用Random star — 道具: +1攻击力
  {
    id: 'A0009',
    name: '战斗用Random star',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0009.png',
    description: '+1攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 1 }],
  },

  // A0010 黑色笔记本 — 道具: 猜花色，猜对目标退场，猜错自己濒死
  {
    id: 'A0010',
    name: '黑色笔记本',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/A0010.png',
    description: '消耗行动点，指定一名角色，猜牌库顶花色，猜对目标退场，猜错自己濒死',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'guessSuit' }],
  },

  // A0011 世界守护者 — 即时: 阵容技能失效时维持到下一个己方角色退场
  {
    id: 'A0011',
    name: '世界守护者',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0011.png',
    description: '当阵容技能失效时可立即使用，维持阵容技能直到下一个己方角色退场',
    requiresTarget: false,
    instantType: 'maintainFactionSkill',
  },

  // A0012 拿来吧你 — 即时: 指定有装备牌的角色，将装备加入己方手牌
  {
    id: 'A0012',
    name: '拿来吧你',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0012.png',
    description: '指定一名有装备牌的角色，将该牌加入己方手牌',
    requiresTarget: true,
    instantType: 'stealEquipment',
  },

  // A0013 乐 — 即时: 指定玩家判定区放此牌，花色判定不为Powerful则跳过行动
  {
    id: 'A0013',
    name: '乐',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0013.png',
    description: '指定一名玩家，放入判定区。判定阶段花色判定，若不为Powerful则跳过行动阶段',
    requiresTarget: true,
    instantType: 'placeJudgment',
    judgmentEffect: {
      type: 'suitCheck',
      suitCondition: 'Powerful',
      onFail: 'skipAction',
    },
  },

  // A0014 巧克力螺 — 即时: 己方角色本回合获得1/3破甲
  {
    id: 'A0014',
    name: '巧克力螺',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0014.png',
    description: '指定一名己方角色在该回合获得1/3概率破甲效果',
    requiresTarget: true,
    instantType: 'grantTempArmorPierce',
  },

  // A0015 俄罗斯轮盘 — 即时: 双方轮流概率判定，失败则退场
  {
    id: 'A0015',
    name: '俄罗斯轮盘',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0015.png',
    description: '指定一名己方角色和对方角色，双方轮流进行概率判定，失败则强制退场。每次成功失败概率+1/6',
    requiresTarget: true,
    instantType: 'russianRoulette',
  },

  // A0016 小星星无限loop — 即时: 花色判定Powerful则返还手牌+获得花色牌
  {
    id: 'A0016',
    name: '小星星无限loop',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/A0016.png',
    description: '放入判定区，花色判定Powerful则返还手牌并获得花色牌',
    requiresTarget: false,
    instantType: 'suitJudgmentDraw',
    judgmentEffect: {
      type: 'suitCheck',
      suitCondition: 'Powerful',
      onSuccess: 'returnToHandAndDraw',
    },
  },

  // ===========================================================
  // B Series (16 cards)
  // ===========================================================

  // B0001 钢巴歇尔 — 道具: +2血量，赋予守护，每回合免疫一次伤害
  {
    id: 'B0001',
    name: '钢巴歇尔',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0001.png',
    description: '+2血量，赋予"守护"，且每回合免疫一次伤害',
    requiresTarget: true,
    equipEffects: [
      { type: 'hpBoost', value: 2 },
      { type: 'grantKeyword', keyword: 'guardian' },
    ],
  },

  // B0002 五字不行 — 即时: 判定区传递，投出5则失去行动能力
  {
    id: 'B0002',
    name: '五字不行',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0002.png',
    description: '指定一名玩家放入判定区，概率判定投出5则失去行动能力，否则移到下一个玩家',
    requiresTarget: true,
    instantType: 'placeJudgmentPass',
    judgmentEffect: {
      type: 'probabilityCheck',
      onFail: 'loseAbility',
    },
  },

  // B0003 轨迹展 — 即时: 从弃牌堆获取一张即时牌
  {
    id: 'B0003',
    name: '轨迹展',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0003.png',
    description: '从弃牌堆里获取一张即时牌进入手牌',
    requiresTarget: false,
    instantType: 'retrieveInstantFromDiscard',
  },

  // B0004 星光魔方 — 即时: 抽取一张角色卡，有同乐队则部署
  {
    id: 'B0004',
    name: '星光魔方',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0004.png',
    description: '抽取一张角色卡，若己方有部署同乐队角色即可获取，反之弃置',
    requiresTarget: false,
    instantType: 'drawCharAndDeploy',
  },

  // B0005 拆弹专家 — 即时: 弃置判定区一张即时牌（己方判定阶段使用）
  {
    id: 'B0005',
    name: '拆弹专家',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0005.png',
    description: '弃置一张任意判定区的即时牌（需在己方判定阶段打出）',
    requiresTarget: false,
    instantType: 'removeJudgment',
  },

  // B0006 复活赛 — 即时: 随机抽取一名休息室的退场角色
  {
    id: 'B0006',
    name: '复活赛',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0006.png',
    description: '随机抽取一名位于休息室的退场角色',
    requiresTarget: false,
    instantType: 'summonFromGraveyard',
  },

  // B0007 石头 — 道具: +2护甲
  {
    id: 'B0007',
    name: '石头',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0007.png',
    description: '+2护甲',
    requiresTarget: true,
    equipEffects: [{ type: 'armorBoost', value: 2 }],
  },

  // B0008 小·珍妮弗 — 道具: 濒死时可弃置恢复为正常
  {
    id: 'B0008',
    name: '小·珍妮弗',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0008.png',
    description: '濒死时可以弃置该牌恢复为正常状态',
    requiresTarget: true,
    equipEffects: [{ type: 'nearDeathRecover' }],
  },

  // B0009 折叠椅 — 道具: +1攻击力
  {
    id: 'B0009',
    name: '折叠椅',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0009.png',
    description: '+1攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 1 }],
  },

  // B0010 阿提斯特 — 即时: 己方角色本回合获得暴击
  {
    id: 'B0010',
    name: '阿提斯特',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0010.png',
    description: '指定一名己方角色在该回合获得暴击效果',
    requiresTarget: true,
    instantType: 'grantCrit',
  },

  // B0011 诡异的蘑菇 — 即时: 本回合不限制行动点，回合后失去行动能力
  {
    id: 'B0011',
    name: '诡异的蘑菇',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0011.png',
    description: '本回合不限制行动点使用，但回合结束后失去行动能力一回合',
    requiresTarget: false,
    instantType: 'unlimitedApThisTurn',
  },

  // B0012 何意味 — 即时: 选择手牌与玩家交换
  {
    id: 'B0012',
    name: '何意味',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0012.png',
    description: '选择己方最多n张手牌并与最多n名玩家进行交换',
    requiresTarget: false,
    instantType: 'swapHandWithPlayers',
  },

  // B0013 丸君 — 道具: +1攻击力
  {
    id: 'B0013',
    name: '丸君',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0013.png',
    description: '+1攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 1 }],
  },

  // B0014 铁打的距离感 — 道具: 攻击与受击判定强制锁定为1/6
  {
    id: 'B0014',
    name: '铁打的距离感',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/B0014.png',
    description: '角色攻击与受击判定强制锁定为1/6',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'forceCrit16' }],
  },

  // B0015 灵魂互换 — 即时: 交换场上角色位置
  {
    id: 'B0015',
    name: '灵魂互换',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0015.png',
    description: '指定一名场上部署的角色与一名己方部署的角色进行位置互换',
    requiresTarget: true,
    instantType: 'swapPositions',
  },

  // B0016 是不想说话吗 — 即时: 概率判定沉默目标一回合
  {
    id: 'B0016',
    name: '是不想说话吗',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/B0016.png',
    description: '指定一名角色，概率判定≥3则沉默一回合',
    requiresTarget: true,
    instantType: 'silenceTarget',
  },

  // ===========================================================
  // C Series (15 cards)
  // ===========================================================

  // C0001 视奸 — 即时: 查看一名玩家的所有手牌和角色牌
  {
    id: 'C0001',
    name: '视奸',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0001.png',
    description: '查看一名玩家的所有手牌和角色牌',
    requiresTarget: true,
    instantType: 'viewHand',
  },

  // C0002 老虎机 — 即时: 三次投骰子触发效果
  {
    id: 'C0002',
    name: '老虎机',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0002.png',
    description: '进入老虎机模式，进行三次投骰子触发相关效果',
    requiresTarget: false,
    instantType: 'slotMachine',
  },

  // C0003 地狱火炸弹 — 道具: 弃置所有手牌激活，下一回合结束全场角色退场
  {
    id: 'C0003',
    name: '地狱火炸弹',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0003.png',
    description: '弃置所有手牌激活，无法拆除，下一回合结束全场角色退场，1/3概率失去体力',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'nuke' }],
  },

  // C0004 孔雀 — 道具: 获得守护效果
  {
    id: 'C0004',
    name: '孔雀',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0004.png',
    description: '获得守护效果',
    requiresTarget: true,
    equipEffects: [{ type: 'grantKeyword', keyword: 'guardian' }],
  },

  // C0005 恩！情！— 即时: 所有玩家摸一张牌
  {
    id: 'C0005',
    name: '恩！情！',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0005.png',
    description: '所有玩家摸一张牌',
    requiresTarget: false,
    instantType: 'allPlayersDraw',
  },

  // C0006 屹立不倒 — 即时: 濒死时不退场
  {
    id: 'C0006',
    name: '屹立不倒',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0006.png',
    description: '部署角色退场前可打出此牌让其以正常状态继续存活',
    requiresTarget: false,
    instantType: 'protectNearDeath',
  },

  // C0007 武士刀 — 道具: 每次攻击附带破甲
  {
    id: 'C0007',
    name: '武士刀',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0007.png',
    description: '每次攻击附带"破甲"',
    requiresTarget: true,
    equipEffects: [{ type: 'armorPierceOnAttack' }],
  },

  // C0008 灵光一闪 — 即时: 1/2概率无视一次针对己方的角色技能
  {
    id: 'C0008',
    name: '灵光一闪',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0008.png',
    description: '1/2概率无视一次针对己方的角色技能',
    requiresTarget: false,
    instantType: 'chanceIgnoreSkill',
  },

  // C0009 熊霸米歇尔 — 道具: +2护甲
  {
    id: 'C0009',
    name: '熊霸米歇尔',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0009.png',
    description: '+2护甲',
    requiresTarget: true,
    equipEffects: [{ type: 'armorBoost', value: 2 }],
  },

  // C0010 金玉 — 即时: 判定区放此牌，花色判定不为Happy则跳过摸牌
  {
    id: 'C0010',
    name: '金玉',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0010.png',
    description: '指定一名玩家放入判定区，花色判定不为Happy则跳过摸牌阶段',
    requiresTarget: true,
    instantType: 'placeJudgment',
    judgmentEffect: {
      type: 'suitCheck',
      suitCondition: 'Happy',
      onFail: 'skipDraw',
    },
  },

  // C0011 不仲蕾 — 即时: 使指定玩家的阵营技失效
  {
    id: 'C0011',
    name: '不仲蕾',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0011.png',
    description: '使指定玩家的阵营技失效',
    requiresTarget: true,
    instantType: 'disableFactionSkill',
  },

  // C0012 做了！— 即时: 指定两个角色概率判定，≥3则虚弱
  {
    id: 'C0012',
    name: '做了！',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0012.png',
    description: '指定两个角色分别进行概率判定，结果≥3则虚弱到下个回合结束',
    requiresTarget: true,
    instantType: 'weakenTwoTargets',
  },

  // C0013 村好剑 — 道具: +2攻击力，-2血量
  {
    id: 'C0013',
    name: '村好剑',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0013.png',
    description: '+2攻击力，-2血量',
    requiresTarget: true,
    equipEffects: [
      { type: 'attackBoost', value: 2 },
      { type: 'hpBoost', value: -2 },
    ],
  },

  // C0014 街边的星星贴纸 — 道具: 消耗行动点翻5张选2张
  {
    id: 'C0014',
    name: '街边的星星贴纸',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/C0014.png',
    description: '消耗行动点，翻出牌堆顶五张牌，选择其中两张加入手牌',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'scry5pick2' }],
  },

  // C0015 Fever!!!!! — 即时: 抽3张牌 或 5同阵营造成3伤害
  {
    id: 'C0015',
    name: 'Fever!!!!!',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/C0015.png',
    description: '二选一：抽取三张手牌；或首次部署五名同阵营角色时直接对非己方玩家造成3点伤害',
    requiresTarget: false,
    instantType: 'feverEffect',
  },

  // ===========================================================
  // D Series (17 cards)
  // ===========================================================

  // D0001 家虎根绝 — 道具: 赋予不可选中
  {
    id: 'D0001',
    name: '家虎根绝',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0001.png',
    description: '赋予"不可选中"',
    requiresTarget: true,
    equipEffects: [{ type: 'unTargetable' }],
  },

  // D0002 回收站 — 即时: 从弃牌堆选一张牌加入手牌
  {
    id: 'D0002',
    name: '回收站',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0002.png',
    description: '从弃牌堆里选择一张牌加入手牌',
    requiresTarget: false,
    instantType: 'retrieveFromDiscard',
  },

  // D0003 筹码 — 道具: 概率判定时可放置手牌增加判定
  {
    id: 'D0003',
    name: '筹码',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0003.png',
    description: '概率判定时可消耗行动点放置手牌，判定成功则摸牌，失败则弃置',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'gamblerBet' }],
  },

  // D0004 我是纯良 — 即时: 己方角色地藏一回合
  {
    id: 'D0004',
    name: '我是纯良',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0004.png',
    description: '指定一名己方角色，将该角色翻面进入"地藏"一回合',
    requiresTarget: true,
    instantType: 'forceEarthStore',
  },

  // D0005 利根川 — 道具: 可弃置抽牌
  {
    id: 'D0005',
    name: '利根川',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0005.png',
    description: '可弃置该牌抽取一张手牌',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'discardToDraw' }],
  },

  // D0006 禁止947 — 即时: 抽一张手牌，若有邪神角色则送入休息室
  {
    id: 'D0006',
    name: '禁止947',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0006.png',
    description: '抽取一张手牌，若场上存在邪神角色则将其送入休息室',
    requiresTarget: false,
    instantType: 'drawAndRemoveEvil',
  },

  // D0007 野蛮米歇尔 — 道具: +2攻击力
  {
    id: 'D0007',
    name: '野蛮米歇尔',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0007.png',
    description: '+2攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 2 }],
  },

  // D0008 幸运四叶草 — 道具: 概率判定强制成功/变为1/2
  {
    id: 'D0008',
    name: '幸运四叶草',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0008.png',
    description: '概率判定涉及到己方时，1/2及以上成功率强制成功，1/2以下强制变为1/2',
    requiresTarget: true,
    equipEffects: [{ type: 'conditionalBonus', condition: 'forceDiceSuccess' }],
  },

  // D0009 巴巴恩波神之力 — 即时: 解除一个常规负面效果
  {
    id: 'D0009',
    name: '巴巴恩波神之力',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0009.png',
    description: '解除一个常规负面效果',
    requiresTarget: true,
    instantType: 'removeDebuff',
  },

  // D0010 维修扳手 — 道具: 1/3概率赋予沉默
  {
    id: 'D0010',
    name: '维修扳手',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0010.png',
    description: '每次攻击有1/3概率赋予被攻击角色一回合沉默',
    requiresTarget: true,
    equipEffects: [{ type: 'counterSilence', value: 3 }],
  },

  // D0011 啥是XXX — 即时: 指定玩家阵营技失效一回合
  {
    id: 'D0011',
    name: '啥是XXX',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0011.png',
    description: '指定一名玩家，该玩家的阵营技失效一回合',
    requiresTarget: true,
    instantType: 'disableFactionSkill',
  },

  // D0012 绿接粉 — 即时: 其他角色发动技能时无效化
  {
    id: 'D0012',
    name: '绿接粉',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0012.png',
    description: '在其他角色发动技能时，使本次发动的技能无效',
    requiresTarget: false,
    instantType: 'counterSkill',
  },

  // D0013 苦瓜 — 道具: +1攻击力
  {
    id: 'D0013',
    name: '苦瓜',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0013.png',
    description: '+1攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 1 }],
  },

  // D0014 噜不动了 — 即时: 判定区放此牌，花色判定不为Pure则角色地藏
  {
    id: 'D0014',
    name: '噜不动了',
    category: 'strategy',
    strategyType: 'instant',
    imageFile: 'cards/策略牌/D0014.png',
    description: '指定一名玩家放入判定区，花色判定不为Pure则选择一名角色地藏',
    requiresTarget: true,
    instantType: 'placeJudgment',
    judgmentEffect: {
      type: 'suitCheck',
      suitCondition: 'Pure',
      onFail: 'forceEarthStore',
    },
  },

  // D0015 抹茶巴菲 — 道具: 赋予无视守护
  {
    id: 'D0015',
    name: '抹茶巴菲',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0015.png',
    description: '赋予"无视守护"',
    requiresTarget: true,
    equipEffects: [{ type: 'ignoreGuardian' }],
  },

  // D0016 黄瓜 — 道具: +1攻击力
  {
    id: 'D0016',
    name: '黄瓜',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0016.png',
    description: '+1攻击力',
    requiresTarget: true,
    equipEffects: [{ type: 'attackBoost', value: 1 }],
  },

  // D0017 朝日啤酒 — 道具: -1血量，+2护甲，六次骰子全同则攻击力168亿
  {
    id: 'D0017',
    name: '朝日啤酒',
    category: 'strategy',
    strategyType: 'deployable',
    imageFile: 'cards/策略牌/D0017.png',
    description: '-1血量，+2护甲，攻击时投六次骰子全同则攻击力变为168亿',
    requiresTarget: true,
    equipEffects: [
      { type: 'hpBoost', value: -1 },
      { type: 'armorBoost', value: 2 },
      { type: 'conditionalBonus', condition: 'luckySixDice' },
    ],
  },
]
