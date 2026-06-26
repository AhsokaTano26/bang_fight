// ============================================================
// Character card definitions for the backend
// Simplified subset of frontend/src/types/cards-data.ts
// ============================================================

import type { CharacterCardDef } from './types'

export const CHARACTER_CARDS: CharacterCardDef[] = [
  // ---- AG faction ----
  {
    id: 'AG1001',
    name: '初始兰',
    category: 'character',
    faction: 'AG',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '一直摸兜里',
        description: '消耗行动点，无效化一次针对己方的攻击或策略牌。',
        consumeActionPoint: true,
        effect: { type: 'counterAttack', params: {} },
      },
    ],
  },
  {
    id: 'AG1002',
    name: '初始摩卡',
    category: 'character',
    faction: 'AG',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '积分卡收集',
        description: '消耗行动点，其他角色弃牌时从弃牌堆中获取一张即将进入弃牌堆的牌。',
        consumeActionPoint: true,
        effect: { type: 'stealDiscard', params: {} },
      },
    ],
  },
  {
    id: 'AG1003',
    name: '初始绯玛丽',
    category: 'character',
    faction: 'AG',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '一呼零应',
        description: '每回合使用的第一张手牌必定生效。',
        consumeActionPoint: false,
        effect: { type: 'firstCardGuaranteed', params: {} },
      },
    ],
  },
  {
    id: 'AG1004',
    name: '初始巴',
    category: 'character',
    faction: 'AG',
    maxHp: 7,
    attack: 1,
    keywords: ['guardian', 'counter'],
    skills: [
      {
        name: 'SOIYA',
        description: '角色自带守护、反击效果。',
        consumeActionPoint: false,
        effect: { type: 'guardianCounter', params: { guardian: true, counter: true } },
      },
    ],
  },
  {
    id: 'AG1005',
    name: '初始鸫',
    category: 'character',
    faction: 'AG',
    maxHp: 5,
    attack: 3,
    keywords: [],
    skills: [
      {
        name: '查卡',
        description: '消耗行动点，选择一名玩家的随机一张手牌加入己方手牌。',
        consumeActionPoint: true,
        effect: { type: 'stealCard', params: {} },
      },
    ],
  },

  // ---- PPP faction ----
  {
    id: 'PPP1001',
    name: '初始香澄',
    category: 'character',
    faction: 'PPP',
    maxHp: 3,
    attack: 1,
    keywords: ['aoeAttack'],
    skills: [
      {
        name: 'CDD',
        description: '角色攻击时自带群攻效果。',
        consumeActionPoint: false,
        effect: { type: 'aoeAttack', params: {} },
      },
    ],
  },
  {
    id: 'PPP1002',
    name: '初始有咲',
    category: 'character',
    faction: 'PPP',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '仓库大王',
        description: '每次己方角色的攻击让敌方角色进入濒死状态时可立即抽一张牌。',
        consumeActionPoint: false,
        effect: { type: 'drawOnNearDeath', params: {} },
      },
    ],
  },
  {
    id: 'PPP1003',
    name: '初始多惠',
    category: 'character',
    faction: 'PPP',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '迷兔花园',
        description: '消耗行动点，召唤"欧酱"。优先部署在角色槽（1/1守护），角色槽满时部署在道具槽（弃置恢复+1血量）。',
        consumeActionPoint: true,
        effect: { type: 'summon', params: { summonId: 'oujiang', stats: { hp: 1, attack: 1 }, keywords: ['guardian'], maxCount: 1, preferCharacterSlot: true, equipmentSlotEffect: 'discardRestoreHp' } },
      },
    ],
  },
  {
    id: 'PPP1004',
    name: '初始沙绫',
    category: 'character',
    faction: 'PPP',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '面包圣母',
        description: '消耗行动点，指定一名己方角色+1血量，+1基础攻击力，持续一回合。',
        consumeActionPoint: true,
        effect: { type: 'buffAlly', params: { hpBoost: 1, atkBoost: 1, duration: 1 } },
      },
    ],
  },
  {
    id: 'PPP1005',
    name: '初始里美',
    category: 'character',
    faction: 'PPP',
    maxHp: 6,
    attack: 1,
    keywords: [],
    skills: [
      {
        name: '螺包狂热者',
        description: '弃置一张手牌，角色在本回合+1基础攻击力。',
        consumeActionPoint: false,
        effect: { type: 'sacrificeForPower', params: { atkBoost: 1, permanentIfChocolate: true } },
      },
    ],
  },

  // ---- ROS faction ----
  {
    id: 'ROS1001',
    name: '初始友希那',
    category: 'character',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '压',
        description: '该角色在场时所有进入濒死状态的角色只能通过使用回复牌来恢复正常状态。',
        consumeActionPoint: false,
        effect: { type: 'nearDeathRestriction', params: { restrictRecovery: true } },
      },
    ],
  },
  {
    id: 'ROS1002',
    name: '初始纱夜',
    category: 'character',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
    keywords: ['veteran'],
    skills: [
      {
        name: '吉他店老板',
        description: '角色自带历战效果。',
        consumeActionPoint: false,
        effect: { type: 'veteran', params: {} },
      },
    ],
  },
  {
    id: 'ROS1003',
    name: '初始莉莎',
    category: 'character',
    faction: 'ROS',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '魅惑女神',
        description: '消耗行动点，该角色进入濒死状态，选择一名己方濒死角色恢复正常状态并恢复一点行动点。',
        consumeActionPoint: true,
        effect: { type: 'sacrificeHealAlly', params: { selfNearDeath: true, restoreAlly: true, ignoreRestriction: true } },
      },
    ],
  },
  {
    id: 'ROS1004',
    name: '初始燐子',
    category: 'character',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '骑骑开花',
        description: '消耗行动点，转移场上一名角色的一项负面效果至另一名角色。',
        consumeActionPoint: true,
        effect: { type: 'transferDebuff', params: {} },
      },
    ],
  },
  {
    id: 'ROS1005',
    name: '初始亚子',
    category: 'character',
    faction: 'ROS',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '大魔姬封印',
        description: '己方角色因受到攻击退场后发动，攻击者永久失去角色技能。',
        consumeActionPoint: false,
        effect: { type: 'silenceOnDeath', params: { targetAttacker: true, permanent: true } },
      },
    ],
  },

  // ---- HHW faction ----
  {
    id: 'HHW1001',
    name: '初始心',
    category: 'character',
    faction: 'HHW',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '弦卷家的大手',
        description: '弃置两张手牌，指定一名角色恢复一点行动点。',
        consumeActionPoint: false,
        effect: { type: 'restoreAllyAP', params: { apRestore: 1, discardCount: 2, oncePerTurn: false } },
      },
    ],
  },
  {
    id: 'HHW1002',
    name: '初始美咲',
    category: 'character',
    faction: 'HHW',
    maxHp: 4,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '欧数尔万事',
        description: '从牌堆或弃牌堆中获取一张"米歇尔"系道具牌；免疫缴械效果；可弃置该技能牌免于退场一次。',
        consumeActionPoint: false,
        effect: { type: 'michelSearch', params: { immuneToDisarm: true, discardToSurvive: true } },
      },
    ],
  },

  // ---- PAS faction ----
  {
    id: 'PAS1001',
    name: '初始彩',
    category: 'character',
    faction: 'PAS',
    maxHp: 5,
    attack: 2,
    keywords: ['armorPierce'],
    skills: [
      {
        name: '劈瓦',
        description: '角色攻击时自带破甲效果。',
        consumeActionPoint: false,
        effect: { type: 'armorPierceAttack', params: {} },
      },
    ],
  },
  {
    id: 'PAS1002',
    name: '初始千圣',
    category: 'character',
    faction: 'PAS',
    maxHp: 5,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '猫狗饲主',
        description: '消耗行动点，赋予己方其他角色本回合触发技能后对一名敌方角色造成1点伤害。',
        consumeActionPoint: true,
        effect: { type: 'grantSkillTrigger', params: { bonusDamage: 1 } },
      },
    ],
  },
  {
    id: 'PAS1005',
    name: '初始伊芙',
    category: 'character',
    faction: 'PAS',
    maxHp: 6,
    attack: 2,
    keywords: [],
    skills: [
      {
        name: '求雨',
        description: '消耗行动点，从牌堆顶展示四张牌选择一张加入手牌，其余按原顺序放回牌堆底。',
        consumeActionPoint: true,
        effect: { type: 'scryDraw', params: { revealCount: 4, pickCount: 1, restToBottom: true } },
      },
    ],
  },
]

/** Lookup a character card definition by its id. */
export function getCharacterDef(id: string): CharacterCardDef | undefined {
  return CHARACTER_CARDS.find((c) => c.id === id)
}
