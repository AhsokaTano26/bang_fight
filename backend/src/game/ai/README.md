# Computer decisions

The computer uses a small utility system over the existing rules. It does not use
a language model, search the game tree, or implement additional V1.9 card effects.
The runtime roster remains 20 characters, 52 action cards and 76 strategy cards.

## Data flow

`AiService.executeTurn(state, player)` keeps its existing arguments. Its optional
return value is a bounded diagnostic report: attempted actions, positive utility,
success/failure messages, and the reason selection stopped. Existing callers may
ignore the report.

1. `observation.ts` copies the computer's own hand and public board, equipment,
   graveyards, discards and judgment zones. Opponents have hand counts, with no
   hand identities; the decks and character pool have counts, with no contents.
2. `actions.ts` enumerates supported actions and complete legal target parameters.
3. `scoring.ts` compares positive expected gains and opportunity costs. Equal
   scores use a stable action key, independent of hand enumeration order.
4. The service executes one action through `GameService`, checks its actual
   result and game-over state, then observes and scores again.

The shared `CombatService.validateActor` boundary checks game-over, current
player, phase, living actor and `skipAction`. Attack resolution additionally
checks attacker state/AP, `loseAbility`, disarm, opposing living targets and direct
attack eligibility. Card, skill, equipment, deployment and replacement routes use
that same actor validation. Public HTTP actions and computer attacks use the same
`GameService.attack` / `directAttack` entry points.

Both failed actions and successful actions that do not change the observable
state are rejected for that state. The entire turn has a hard 64-attempt budget,
including successful resource cycles. Rejection keys include the observation, so
an action can be reconsidered after relevant visible circumstances change.

## Utility assumptions

Scores are HP equivalents, with one retained card valued at one HP. A character's
current HP plus attack approximates its board value; attack represents one future
turn of contribution. These are explicit heuristics for this game, not claims of
optimal play or empirically calibrated win rates.

- Attack scores use real attack boosts/weaken, guardian redirection, armor,
  single-use blocks, immunity, critical outcomes, earth-store keywords, forced
  retirement and counterattack risk. Damage is capped at actual remaining HP;
  spread uses the actual uncapped hit, as the existing engine does. Net HP accounts
  for forced retirement, earth-store's 1 HP floor and the probabilistic full-heal
  branch of near-death recovery, even when attacking would heal the opponent.
- Crit and near-death probabilities are evaluated without rolling dice. Shared
  `combat-model.ts` arithmetic is also used by combat resolution for attack power,
  guardian redirection and near-death thresholds.
- Armor attrition is discounted by the additional hits needed to reach HP. A
  block's consumption is valued over a two-hit horizon. This lets the computer
  break finite protection without confusing it with permanent immunity.
- Retirement adds the opponent's lost attack contribution. A publicly provable
  elimination receives a terminal value derived from the total visible material.
  Empty enemy hands prove there is no undeployed character; nonempty hands do not.
- Healing uses the exact HP/AP behavior of the current handler. The existing
  recovery cards restore AP even after acting, so the computer may use a recovery
  card to buy another valuable attack. A redundant heal with no useful AP gain has
  no positive score. Sacrifice-healing does **not** invent AP restoration that its
  handler does not perform.
- Buffs, cleanses, AP refresh and drawing equipment are compared with the attack
  opportunity they consume or create. The block AP payer is the same first
  eligible character that the rules select. Excess hand cards have no retention
  cost beyond the existing limit; extra draws are capped at available hand space.
- Recruitment and same-faction deployment use priors from the supported public
  roster, not character-pool identities. Suit bonus drawing uses the uniform
  four-suit prior, not the hidden next cards.
- A0004 uses a uniform-location prior over unknown cards: remaining characters
  are inferred from the supported roster, known public/own characters and pool
  count. A hypergeometric probability estimates whether the chosen enemy hand
  contains a character. This estimate is intentionally approximate when cards
  have previously been revealed or shuffled. The actual selection happens only
  inside rule resolution, which chooses the first eligible character in that
  hand and moves it to the graveyard.

Ordinary card-free attack is already part of this game's API. When an ordinary
attack card has the same effect and AP cost, retaining the card is rational.
Armor-piercing cards can still be selected when they improve expected utility.

## Supported choices and conservative omissions

The computer considers deployment/replacement, character and direct-player
attacks, recovery and AP reuse, blocks, drawing/recruitment, implemented stat and
combat equipment, supported drawing equipment activations, buffs, summons,
stealing, AP restoration, draw skills and useful debuff transfers. Strategy
evaluation includes E-series drawing, recovery/retrieval/revival, same-faction
deployment, cleanse, crit/pierce, AP refresh, weakening pairs and A0004 removal.

Unknown handlers and unconsumed marker effects receive no invented utility.
`readyToCounter`, `counterInstant`, `counterSkill`, `ignoreNextSkill` and
`skillTriggerDamage` currently have no consuming rule. `forceEarthStore` writes a
buff while combat reads the `earthStore` keyword; that card is not scored as
protection. `forceDiceSuccess`, nuke and several conditional equipment markers
similarly have no supported outcome model.

Some implemented effects are conservatively withheld: A0003 equipment disarm,
hand exchanges/duels,
roulette, slot-machine outcomes, position swaps, hand viewing, silence/faction
silence, judgment placement/removal and global draws. This avoids speculative
positive scores while their useful outcomes or timing are not modeled. They are
not all inert. A0003's 1-turn disarm expires at the target's next startTurn, before
it can prevent an action; the computer therefore assigns no benefit to it.
Similarly, several existing judgment debuffs are decremented
before the action phase; printed text is not a reliable substitute for resolution.

The current `aoeAttack` keyword is not expanded by combat resolution. The computer
uses the existing single-declaration resolution rather than resetting AP or
fabricating multiple hits. Future work can model additional effects after their
rules have explicit tested contracts.

## Strategy parameter contracts

- Attack cards: `{ attackerCharUid, targetPlayerId, targetCharUid? }`. An omitted
  character UID means a direct attack, which only succeeds against an empty
  opposing board. Attack-card type determines piercing and successful plays
  consume the card.
- A0004: `{ targetPlayerId, targetCardUid? }`. The optional explicit UID must be a
  character in that hand. Without it, resolution chooses the first eligible
  character. No eligible character means failure without consuming the strategy.
- C0012: `{ targetCharUid1, targetCharUid2 }`. Two distinct non-retired deployed
  characters on living players, including different owners or the caster's own
  board. Both are validated before either changes. The legacy optional
  `targetPlayerId` restricts both lookups to that player. Missing, duplicate,
  ambiguous or invalid UIDs fail without consuming the card. Existing guaranteed
  weaken resolution is preserved; this change does not add printed V1.9 dice rules.

Played cards are reserved before handlers can draw, discard or exchange the hand,
then restored on failure. Equipment stays in its slot instead of also entering
discard. Permanent negative-duration buffs/debuffs survive turn refresh; finite
durations still expire. Successful skill discard costs enter discard rather than
disappearing, and failed skill/equipment validation preserves resources. Stealing
an excess character removes it from its previous graveyard, and consumed discard
steal markers cannot trigger a second time.

## Verification and sources

From `backend/`, run `npm test -- --runInBand`,
`npm run test:e2e -- --runInBand`, and `npm run build`.
The e2e suite uses a local HTTP test port. Tests cover real service behavior,
public observations, hidden-information permutation, complete targeting,
card-identity conservation, no-progress/rejection handling, resource cycles,
terminal stopping, finite/permanent durations and seeded multi-game smoke.

For a separate reproducible 24-game smoke/performance readout, run
`node -r ts-node/register test/ai-smoke.cjs`. It uses 2/3/4 players with seeds 1–8,
caps each game at 150 turns, checks the 64-attempt turn budget and original-card
UID conservation after every turn, and prints completion/attempt/time metrics.
It fails if a game reaches that cap or a rejected action has any reason other
than A0004 finding no eligible hidden character.
This is a bounded correctness smoke, not a win-rate or balance benchmark.

The architecture follows established utility AI; the particular game heuristics
above are this implementation's assumptions:

- [Dave Mark and Kevin Dill, GDC 2010: Improving AI Decision Modeling Through Utility Theory](https://www.gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through)
- [David Graham, Game AI Pro chapter 9: An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)
- [Mike Lewis, Game AI Pro 3 chapter 13: Choosing Effective Utility-Based Considerations](https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter13_Choosing_Effective_Utility-Based_Considerations.pdf)
- [NestJS testing documentation](https://docs.nestjs.com/fundamentals/testing)
