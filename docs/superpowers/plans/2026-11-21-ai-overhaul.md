# AI Overhaul Implementation Plan

> **For agentic workers:** Follow superpowers:executing-plans or focused independent domain delegation. Track verification before completion; do not commit unrelated work.

**Goal:** Replace brittle fixed AI stages with a fair, bounded utility decision loop backed by real game rules and regression tests.

**Architecture:** Small typed functional AI modules, thin Nest service orchestration, shared rule validation for humans and AI. Reuse current card definitions/effects.

**Tech Stack:** Existing NestJS/TypeScript/Jest; no new backend dependency.

**Spec:** docs/superpowers/specs/2026-11-21-ai-overhaul-design.md

## Global Constraints

Preserve current API, V1.9 metadata and20-character runtime roster. No hidden-information inspection, new card effects, commits or destructive workspace cleanup. Existing uncommitted user changes remain. Work in this checkout because the prior resource update is still uncommitted; snapshots exist in /tmp/bang-fight-before-overhaul.

## Review Focus

Wrong phase/dead player; self/invalid targets; hand mutation/card uid conservation; no-progress loops; enemy/deck hidden-info permutations. Pin these with service/scoring tests.

### Task 1: Rules boundary regressions
- [x] Write failing real-service tests for skipAction/raw attack, failed skill AP and strategy mutation.
- [x] Run them to prove failures.
- [x] Fix minimal shared GameService/controller boundaries and uid handling.
- [x] Run regression tests and existing Jest suite.

### Task 2: Observable decisions
- [x] Add typed observation/actions/scoring modules under backend/src/game/ai/.
- [x] Add tests for target value, complete params, defense/retaliation, hidden-info independence and implemented strategy support.
- [x] Enumerate legal candidates without reading hidden identities or deck order.
- [x] Score explicit comparable game gains/costs; document heuristic limitations and sources.

### Task 3: Bounded turn orchestration
- [x] Replace ai.service.ts stages with re-observation loop.
- [x] Test draw/recruit/recovery follow-ups, failures, no-progress budget, attacker retirement and game-over stopping.
- [x] Execute through shared game service, inspect results, blacklisting failed candidates until public state changes.
- [x] Run complete Jest suite and npm run build; multi-game deterministic smoke if practical.
