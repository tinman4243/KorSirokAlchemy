# Kor Sirok Alchemy

Kor Sirok Alchemy keeps the campaign's editable alchemy and gathering-source metadata in ordinary JSON and synchronizes that source into Foundry VTT.

## Managed world content

The module manages:

- `world.kor-sirok-alchemy` — the campaign's definitive runtime Item compendium.
- `The First Principles of Practical Alchemy` — a Mastercrafted Journal recipe book.

The world Item compendium remains the runtime target so stable compendium UUIDs can be used by Mastercrafted, Gatherer, and future Kor Sirok automation.

## Version 0.3.0

Version 0.3.0 establishes the source-material library and performs the one-time Herbarium migration.

The managed compendium now receives this folder structure:

- `Source Materials`
  - `Wild Plants`
  - `Fungi`
  - `Minerals & Geological`
  - `Agricultural Plants`
  - `Wild Animal Products`
  - `Domestic Animal Products`
  - `Processed & Derived`
  - `Natural Waters`
  - `Special & Esoteric`
- `Alchemy`
  - `Foundations`
  - `Formulations`

The existing 69 campaign Herbarium world Items are copied once into the managed compendium using stable IDs. After the first successful import, the Kor Sirok copy owns its description, image, price, system data, and other content; later synchronization does **not** refresh those fields from the old world Item. Later runs only maintain Kor Sirok folder/classification metadata.

The original world Herbarium Items are never deleted by the module. They may be kept, archived, or removed manually after the migration has been verified.

Herbarium recipe components now resolve from the migrated `world.kor-sirok-alchemy` copies instead of directly from world Items. The managed recipe revisions are bumped so existing pages repoint automatically.

KCTG remains an external ingredient source in 0.3.0. A later release will import the approved KCTG source catalog into stable Kor Sirok IDs and can then make KCTG an explicit module dependency.

## Current alchemy content

- Nine foundational alchemical media.
- Five finished field formulations.
- Fourteen Mastercrafted recipes in *The First Principles of Practical Alchemy*.
- Finished formulation Items currently carry rules text but no Midi-QOL automation.

## Automatic and manual synchronization

The active GM synchronizes automatically on `ready`. Manual synchronization is also available:

`game.modules.get("kor-sirok-alchemy").api.sync()`

Individual passes:

`game.modules.get("kor-sirok-alchemy").api.syncFolders()`

`game.modules.get("kor-sirok-alchemy").api.syncItems()`

`game.modules.get("kor-sirok-alchemy").api.syncHerbariumSources()`

`game.modules.get("kor-sirok-alchemy").api.syncRecipeBook()`

## Source files

- `data/folders.json`
- `data/items/foundations.json`
- `data/items/formulations.json`
- `data/sources/herbarium.json`
- `data/recipes/introduction-to-alchemy.json`
- `scripts/sync.js`

Native Kor Sirok managed documents should be edited in these source files rather than directly in Foundry. Increment the relevant `revision` whenever a managed record changes. Herbarium source-material content is the exception: after first import, its compendium copy is intentionally local-owned and may be edited directly without being overwritten by the original world Item.
