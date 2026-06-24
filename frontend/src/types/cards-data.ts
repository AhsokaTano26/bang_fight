// ============================================================
// Complete card data for 邦邦武斗传 V1.0
// Extracted from card images and rulebook
// ============================================================

import type { CharacterCard, ActionCard, StrategyCard } from './card'

// 行动牌效果描述
export const ACTION_CARD_DESCRIPTIONS: Record<string, string> = {
  attack: '对目标造成等于使用者攻击力的伤害。',
  armorPierce: '对目标造成伤害，无视守护和格挡效果。',
  bigBlock: '保护己方所有角色，抵挡下一次攻击。',
  smallBlock: '保护己方一名角色，抵挡下一次攻击。',
  recovery: '恢复己方一名角色2点体力。',
  bigRecovery: '恢复己方所有角色2点体力。',
  replenish: '从牌堆摸2张牌。',
}

// ============================================================
// Character Cards (角色牌) - 20 characters, 5 factions
// ============================================================

export const CHARACTER_CARDS: CharacterCard[] = [
  // ---- AG faction ----
  {
    id: 'AG1001',
    name: '初始兰',
    category: 'character',
    imageFile: 'cards/角色牌/AG1001.png',
    faction: 'AG',
    maxHp: 5,
    attack: 2,
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
    imageFile: 'cards/角色牌/AG1002.png',
    faction: 'AG',
    maxHp: 6,
    attack: 2,
    skills: [
      {
        name: '积分卡收集',
        description: '消耗行动点，除你以外的玩家弃牌时将其中一张纳入己方手牌。',
        consumeActionPoint: true,
        effect: { type: 'stealDiscard', params: {} },
      },
    ],
  },
  {
    id: 'AG1003',
    name: '初始绯玛丽',
    category: 'character',
    imageFile: 'cards/角色牌/AG1003.png',
    faction: 'AG',
    maxHp: 6,
    attack: 2,
    skills: [
      {
        name: '一呼零应',
        description: '每回合使用的第一张手牌必定生效，且不会触发其他角色技能和玩家手牌的效果。',
        consumeActionPoint: false,
        effect: { type: 'firstCardGuaranteed', params: {} },
      },
    ],
  },
  {
    id: 'AG1004',
    name: '初始巴',
    category: 'character',
    imageFile: 'cards/角色牌/AG1004.png',
    faction: 'AG',
    maxHp: 7,
    attack: 1,
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
    imageFile: 'cards/角色牌/AG1005.png',
    faction: 'AG',
    maxHp: 5,
    attack: 3,
    skills: [
      {
        name: '查卡',
        description: '消耗行动点，选择一名玩家的随机一张手牌加入己方手牌中。',
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
    imageFile: 'cards/角色牌/PPP1001.png',
    faction: 'PPP',
    maxHp: 5,
    attack: 1,
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
    imageFile: 'cards/角色牌/PPP1002.png',
    faction: 'PPP',
    maxHp: 6,
    attack: 2,
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
    imageFile: 'cards/角色牌/PPP1003.png',
    faction: 'PPP',
    maxHp: 5,
    attack: 2,
    skills: [
      {
        name: '迷兔花园',
        description: '消耗行动点，可在己方回合时召唤"欧酱"(1/1,自带守护效果)。',
        consumeActionPoint: true,
        effect: { type: 'summon', params: { summonId: 'oujiang', stats: { hp: 1, attack: 1 }, keywords: ['guardian'] } },
      },
    ],
  },
  {
    id: 'PPP1004',
    name: '初始沙绫',
    category: 'character',
    imageFile: 'cards/角色牌/PPP1004.png',
    faction: 'PPP',
    maxHp: 6,
    attack: 2,
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
    imageFile: 'cards/角色牌/PPP1005.png',
    faction: 'PPP',
    maxHp: 6,
    attack: 1,
    skills: [
      {
        name: '螺包狂热者',
        description: '弃置一张手牌，角色在本回合+1基础攻击力。若弃置手牌为"巧克力螺"则持续时间为永久。',
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
    imageFile: 'cards/角色牌/ROS1001.png',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
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
    imageFile: 'cards/角色牌/ROS1002.png',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
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
    imageFile: 'cards/角色牌/ROS1003.png',
    faction: 'ROS',
    maxHp: 6,
    attack: 2,
    skills: [
      {
        name: '魅惑女神',
        description: '消耗行动点，该角色进入濒死状态，选择一名己方濒死角色恢复正常状态并恢复一点行动点。无视初始友希那的【压】。',
        consumeActionPoint: true,
        effect: { type: 'sacrificeHealAlly', params: { selfNearDeath: true, restoreAlly: true, ignoreRestriction: true } },
      },
    ],
  },
  {
    id: 'ROS1004',
    name: '初始烧子',
    category: 'character',
    imageFile: 'cards/角色牌/ROS1004.png',
    faction: 'ROS',
    maxHp: 5,
    attack: 2,
    skills: [
      {
        name: '骑骑开花',
        description: '消耗行动点，转移场上一名角色的一项负面效果至另一名角色，若该角色已存在相同负面效果则负面效果持续时间为永久。',
        consumeActionPoint: true,
        effect: { type: 'transferDebuff', params: {} },
      },
    ],
  },
  {
    id: 'ROS1005',
    name: '初始亚子',
    category: 'character',
    imageFile: 'cards/角色牌/ROS1005.png',
    faction: 'ROS',
    maxHp: 6,
    attack: 2,
    skills: [
      {
        name: '大魔姬封印',
        description: '己方角色因受到攻击退场后发动，指定一名非己方角色使其永久失去角色技能。',
        consumeActionPoint: false,
        effect: { type: 'silenceOnDeath', params: { targetEnemy: true, permanent: true } },
      },
    ],
  },

  // ---- HHW faction ----
  {
    id: 'HHW1001',
    name: '初始心',
    category: 'character',
    imageFile: 'cards/角色牌/HHW1001.png',
    faction: 'HHW',
    maxHp: 5,
    attack: 2,
    skills: [
      {
        name: '弦卷家的大手',
        description: '弃置一张手牌，指定一名角色恢复一点行动点，每回合限一次。',
        consumeActionPoint: false,
        effect: { type: 'restoreAllyAP', params: { apRestore: 1, oncePerTurn: true } },
      },
    ],
  },
  {
    id: 'HHW1002',
    name: '初始美咲',
    category: 'character',
    imageFile: 'cards/角色牌/HHW1002.png',
    faction: 'HHW',
    maxHp: 4,
    attack: 2,
    skills: [
      {
        name: '欧数尔万事',
        description: '每次部署角色时，场上所有角色执行一次攻击力/血量随机调整（±1），需消耗行动点。',
        consumeActionPoint: true,
        effect: { type: 'randomStatAdjust', params: { min: -1, max: 1 } },
      },
    ],
  },

  // ---- PAS faction ----
  {
    id: 'PAS1001',
    name: '初始彩',
    category: 'character',
    imageFile: 'cards/角色牌/PAS1001.png',
    faction: 'PAS',
    maxHp: 5,
    attack: 2,
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
    imageFile: 'cards/角色牌/PAS1002.png',
    faction: 'PAS',
    maxHp: 5,
    attack: 2,
    skills: [
      {
        name: '猫狗饲主',
        description: '消耗行动点，赋予一名除自己以外的己方角色本回合触发技能后对一名敌方角色造成1点伤害。',
        consumeActionPoint: true,
        effect: { type: 'grantSkillTrigger', params: { bonusDamage: 1 } },
      },
    ],
  },
  {
    id: 'PAS1005',
    name: '初始伊芙',
    category: 'character',
    imageFile: 'cards/角色牌/PAS1005.png',
    faction: 'PAS',
    maxHp: 6,
    attack: 2,
    skills: [
      {
        name: '求雨',
        description: '消耗行动点，从摸牌堆最上方四张牌中选择一张加入手牌。',
        consumeActionPoint: true,
        effect: { type: 'scryDraw', params: { revealCount: 4, pickCount: 1 } },
      },
    ],
  },
]

// ============================================================
// Action Cards (行动牌)
// ============================================================

export const ACTION_CARDS: ActionCard[] = [
  {
    id: 'ATK_1',
    name: '攻击',
    category: 'action',
    imageFile: 'cards/行动牌/攻击1.png',
    actionType: 'attack',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: false,
  },
  {
    id: 'ATK_2',
    name: '攻击',
    category: 'action',
    imageFile: 'cards/行动牌/攻击2.png',
    actionType: 'attack',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: false,
  },
  {
    id: 'ATK_3',
    name: '攻击',
    category: 'action',
    imageFile: 'cards/行动牌/攻击3.png',
    actionType: 'attack',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: false,
  },
  {
    id: 'ATK_4',
    name: '攻击',
    category: 'action',
    imageFile: 'cards/行动牌/攻击4.png',
    actionType: 'attack',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: false,
  },
  {
    id: 'ARMOR_1',
    name: '破甲攻击',
    category: 'action',
    imageFile: 'cards/行动牌/破甲攻击1.png',
    actionType: 'armorPierce',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: true,
  },
  {
    id: 'ARMOR_2',
    name: '破甲攻击',
    category: 'action',
    imageFile: 'cards/行动牌/破甲攻击2.png',
    actionType: 'armorPierce',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: true,
  },
  {
    id: 'ARMOR_3',
    name: '破甲攻击',
    category: 'action',
    imageFile: 'cards/行动牌/破甲攻击3.png',
    actionType: 'armorPierce',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: true,
  },
  {
    id: 'ARMOR_4',
    name: '破甲攻击',
    category: 'action',
    imageFile: 'cards/行动牌/破甲攻击4.png',
    actionType: 'armorPierce',
    requiresTarget: true,
    affectsAll: false,
    armorPierce: true,
  },
  {
    id: 'BIG_BLOCK_1',
    name: '防御',
    category: 'action',
    imageFile: 'cards/行动牌/防御1.png',
    actionType: 'bigBlock',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_BLOCK_2',
    name: '防御',
    category: 'action',
    imageFile: 'cards/行动牌/防御2.png',
    actionType: 'bigBlock',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_BLOCK_3',
    name: '防御',
    category: 'action',
    imageFile: 'cards/行动牌/防御3.png',
    actionType: 'bigBlock',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_BLOCK_4',
    name: '防御',
    category: 'action',
    imageFile: 'cards/行动牌/防御4.png',
    actionType: 'bigBlock',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'SMALL_BLOCK_1',
    name: '格挡',
    category: 'action',
    imageFile: 'cards/行动牌/格挡1.png',
    actionType: 'smallBlock',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'SMALL_BLOCK_2',
    name: '格挡',
    category: 'action',
    imageFile: 'cards/行动牌/格挡2.png',
    actionType: 'smallBlock',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'SMALL_BLOCK_3',
    name: '格挡',
    category: 'action',
    imageFile: 'cards/行动牌/格挡3.png',
    actionType: 'smallBlock',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'SMALL_BLOCK_4',
    name: '格挡',
    category: 'action',
    imageFile: 'cards/行动牌/格挡4.png',
    actionType: 'smallBlock',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'RECOVERY_1',
    name: '回复',
    category: 'action',
    imageFile: 'cards/行动牌/回复1.png',
    actionType: 'recovery',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'RECOVERY_2',
    name: '回复',
    category: 'action',
    imageFile: 'cards/行动牌/回复2.png',
    actionType: 'recovery',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'RECOVERY_3',
    name: '回复',
    category: 'action',
    imageFile: 'cards/行动牌/回复3.png',
    actionType: 'recovery',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'RECOVERY_4',
    name: '回复',
    category: 'action',
    imageFile: 'cards/行动牌/回复4.png',
    actionType: 'recovery',
    requiresTarget: true,
    affectsAll: false,
  },
  {
    id: 'BIG_RECOVERY_1',
    name: '回复大',
    category: 'action',
    imageFile: 'cards/行动牌/回复大1.png',
    actionType: 'bigRecovery',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_RECOVERY_2',
    name: '回复大',
    category: 'action',
    imageFile: 'cards/行动牌/回复大2.png',
    actionType: 'bigRecovery',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_RECOVERY_3',
    name: '回复大',
    category: 'action',
    imageFile: 'cards/行动牌/回复大3.png',
    actionType: 'bigRecovery',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'BIG_RECOVERY_4',
    name: '回复大',
    category: 'action',
    imageFile: 'cards/行动牌/回复大4.png',
    actionType: 'bigRecovery',
    requiresTarget: false,
    affectsAll: true,
  },
  {
    id: 'REPLENISH_1',
    name: '补充',
    category: 'action',
    imageFile: 'cards/行动牌/补充1.png',
    actionType: 'replenish',
    requiresTarget: false,
    affectsAll: false,
  },
  {
    id: 'REPLENISH_2',
    name: '补充',
    category: 'action',
    imageFile: 'cards/行动牌/补充2.png',
    actionType: 'replenish',
    requiresTarget: false,
    affectsAll: false,
  },
  {
    id: 'REPLENISH_3',
    name: '补充',
    category: 'action',
    imageFile: 'cards/行动牌/补充3.png',
    actionType: 'replenish',
    requiresTarget: false,
    affectsAll: false,
  },
  {
    id: 'REPLENISH_4',
    name: '补充',
    category: 'action',
    imageFile: 'cards/行动牌/补充4.png',
    actionType: 'replenish',
    requiresTarget: false,
    affectsAll: false,
  },
]

// ============================================================
// Card lookup helpers
// ============================================================

export function getCardById(id: string): CharacterCard | ActionCard | undefined {
  return CHARACTER_CARDS.find(c => c.id === id) || ACTION_CARDS.find(c => c.id === id)
}

export function getCharacterCardsByFaction(faction: string): CharacterCard[] {
  return CHARACTER_CARDS.filter(c => c.faction === faction)
}
