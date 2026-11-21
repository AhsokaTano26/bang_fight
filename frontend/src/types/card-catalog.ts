import type { ActionCard, CharacterCard, Faction } from './card'
import { CARD_CATALOG, type CatalogEntry, type CatalogSkill } from './card-catalog.generated'

export { CARD_FACTIONS, CARD_PACK_VERSION, getCatalogEntry } from './card-catalog.generated'

// The complete printed collection is separate from cards supported by the battle engine.
export type CatalogCharacter = Omit<CharacterCard, 'skills' | 'keywords'> & {
  skills: CatalogSkill[]
  keywords: string[]
}

export const CATALOG_CHARACTER_CARDS: CatalogCharacter[] = CARD_CATALOG
  .filter(card => card.category === 'character')
  .map(card => ({
    id: card.id,
    name: card.name,
    category: 'character',
    imageFile: card.imageFile,
    thumbnailFile: card.thumbnailFile,
    faction: card.faction as Faction,
    maxHp: card.maxHp!,
    attack: card.attack!,
    keywords: card.keywords ?? [],
    skills: card.skills ?? [],
  }))

export const CATALOG_ACTION_CARDS: ActionCard[] = CARD_CATALOG
  .filter(card => card.category === 'action')
  .map(card => ({
    id: card.id,
    name: card.name,
    category: 'action',
    imageFile: card.imageFile,
    thumbnailFile: card.thumbnailFile,
    description: card.description,
    actionType: card.actionType!,
    requiresTarget: card.requiresTarget!,
    affectsAll: card.affectsAll!,
    armorPierce: card.armorPierce,
  }))

export type CatalogStrategy = CatalogEntry & { strategyType: 'deployable' | 'instant' }
export const CATALOG_STRATEGY_CARDS = CARD_CATALOG.filter(
  (card): card is CatalogStrategy => card.category === 'strategy',
)
export const CATALOG_AUXILIARY_CARDS = CARD_CATALOG.filter(card => card.category === 'auxiliary')
export const CATALOG_OTHER_ASSETS = CARD_CATALOG.filter(card => card.category === 'marker' || card.category === 'board')
