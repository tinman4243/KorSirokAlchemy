# Kor Sirok Alchemy

Kor Sirok Alchemy keeps the campaign's editable alchemy source in ordinary JSON and synchronizes that source into Foundry VTT.

## Managed world content

The module currently manages:

- `world.kor-sirok-alchemy` — the existing world Item compendium.
- `The First Principles of Practical Alchemy` — a Mastercrafted Journal recipe book.

The Item compendium remains the runtime target so existing stable compendium UUIDs continue to work.

## Version 0.2.0

The module now contains:

- Nine foundational alchemical media.
- Five finished field formulations.
- Fourteen Mastercrafted recipes in *The First Principles of Practical Alchemy*.
- Runtime resolution of KCTG ingredients by exact name.
- Runtime resolution of campaign Herbarium/spell-component Items by exact world Item name.
- Revision-based synchronization so unchanged managed documents are left alone.

Finished formulation Items currently carry their rules text but no Midi-QOL automation. Automation can be layered onto them later without changing their stable IDs.

## Manual synchronization

As GM:

`game.modules.get("kor-sirok-alchemy").api.sync()`

Individual passes are also available:

`game.modules.get("kor-sirok-alchemy").api.syncItems()`

`game.modules.get("kor-sirok-alchemy").api.syncRecipeBook()`

## Source files

- `data/items/foundations.json`
- `data/items/formulations.json`
- `data/recipes/introduction-to-alchemy.json`
- `scripts/sync.js`

Managed documents should be edited in these source files rather than directly in Foundry. Increment the relevant `revision` whenever a managed record changes.
