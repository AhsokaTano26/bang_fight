# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"邦邦武斗传" (Bang Bang Fight) — an online card game simulation system based on the BanG Dream! universe. Players control character cards from different bands (AG, HHW, PAS, PPP, ROS) in a free-for-all battle.

## Planned Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript + TailwindCSS
- **Backend**: NestJS + TypeScript
- **Real-time**: Socket.io (for future multiplayer)
- **Game phase**: Single-player vs AI first, multiplayer later

## Key Assets

- **Rulebook**: `邦邦武斗传规则书（新规V1.0.5）(1).docx` — the authoritative game rules (V1.0.5). Convert with `textutil -convert txt -stdout <file>` to read.
- **Card images**: `内测1.0卡牌组/` — 116 PNG card images organized by type:
  - `行动牌/` — Action cards (攻击, 破甲攻击, 防御, 格挡, 回复, 回复大, 补充)
  - `角色牌/` — Character cards (20 characters across 5 bands)
  - `策略牌/` — Strategy cards (64 cards in 4 series A-D)
  - `辅助牌/` — Auxiliary cards

## Game Rules Summary

- **Players**: 2-4 (v1.0 supports up to 3)
- **Win condition**: Last player standing; or last player to cause elimination
- **Player HP**: 10 (only attackable when no deployed characters remain)
- **Setup**: Each player draws 5 characters, deploys them, draws 5 cards
- **Turn flow**: Judgment → Draw (2 cards) → Action → Discard (hand limit 5)
- **Action points**: 1 AP per character per turn, max 3 characters' AP per turn
- **Card types**: Character (HP/Attack/Faction/Skills), Action (Attack/Block/Recovery/Replenish), Strategy (Deployable items + Instant effects), Auxiliary (tracking)
- **Combat**: Damage vs HP with probability-based near-death mechanic (1/6, 1/3, 1/2 thresholds based on HP-damage difference)
- **Keywords**: 守护, 无视守护, 群攻, 历战, 免伤, 不可选中, 反击, 地藏, 扩散
- **Negative effects**: Skip draw, skip action, lose action ability, armor-pierce, disarm, weaken, silence

## Project Structure

```
bang_fight/
├── frontend/          # Vue 3 + Vite + Pinia + TailwindCSS
│   ├── src/
│   │   ├── components/    # Vue components (GameBoard, CardHand, etc.)
│   │   ├── stores/        # Pinia stores (game state, player state)
│   │   ├── composables/   # Vue composables (useGame, useCard, etc.)
│   │   ├── types/         # TypeScript types (shared with backend)
│   │   └── assets/        # Styles, static assets
│   └── public/
│       └── cards/         # Card images copied from 内测1.0卡牌组/
├── backend/           # NestJS + TypeScript
│   ├── src/
│   │   ├── game/          # GameModule - game engine, state, turn manager, combat
│   │   ├── card/          # CardModule - card registry, effect resolver, deck builder
│   │   ├── ai/            # AIModule - simple rule-based AI, strategy evaluation
│   │   ├── player/        # PlayerModule - session management
│   │   └── gateway/       # GatewayModule - WebSocket (future multiplayer)
│   └── test/
└── 内测1.0卡牌组/     # Source card images (do not modify)
```

## Architecture

- Game logic lives on the backend (NestJS) — frontend is a rendering/interaction layer
- Frontend sends user actions to backend, backend validates and returns state updates
- Card data defined as structured TypeScript objects, not hardcoded
- Card images in `内测1.0卡牌组/` copied to `frontend/public/cards/` for serving
- AI system: start with simple rule-based AI, iterate on strategy later

## Key Game Mechanics

### Turn Flow
1. **判定阶段 (Judgment)**: Resolve pending effects, dice rolls for probability checks
2. **摸牌阶段 (Draw)**: Draw 2 cards, refresh AP and HP states for deployed characters
3. **行动阶段 (Action)**: Deploy characters, use action cards, use skills, equip strategy cards
4. **弃牌阶段 (Discard)**: Discard down to hand limit (5 cards, character cards don't count)

### Combat System
- Normal attack: damage = attacker's base attack stat
- Armor-pierce attack: ignores block and armor
- Near-death probability: when damage ≤ HP, roll dice based on (HP - damage) difference
  - Difference > 5: 1/6 chance of near-death
  - Difference 3-5: 1/3 chance
  - Difference < 3: 1/2 chance
- Near-death character is revived at start of owner's next turn

### Card Categories
- **行动牌 (Action)**: 攻击, 破甲攻击, 防御(大格挡), 格挡(小格挡), 回复, 回复大, 补充
- **角色牌 (Character)**: 20 characters, 5 factions (AG, HHW, PAS, PPP, ROS)
- **策略牌 (Strategy)**: 64 cards in series A-D (deployable items + instant effects)
- **辅助牌 (Auxiliary)**: Tracking cards for special states

### Keywords
守护, 无视守护, 群攻, 历战, 免伤, 不可选中, 反击, 地藏, 扩散

### Negative Effects
跳过摸牌阶段, 跳过行动阶段, 失去行动能力, 破甲/无视护甲, 缴械, 虚弱, 沉默
