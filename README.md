# Kor Sirok Alchemy

Kor Sirok Alchemy keeps the campaign's editable alchemy and gathering-source metadata in ordinary JSON and synchronizes that source into Foundry VTT.

## Managed world content

The module manages:

- `world.kor-sirok-alchemy` — the campaign's definitive runtime Item compendium.
- `The First Principles of Practical Alchemy` — a Mastercrafted Journal recipe book.

The world Item compendium remains the runtime target so stable compendium UUIDs can be used by Mastercrafted, Gatherer, and future Kor Sirok automation.

## Required / recommended modules

- **Required:** Kris's Compendium of Trade Goods (`kctg-5e`). Kor Sirok imports selected source materials from the current KCTG compendium at runtime.
- **Recommended:** Mastercrafted. If Mastercrafted is inactive, the source library still synchronizes but recipe-book synchronization is skipped.

## Version 0.4.0

Version 0.4.0 adds the KCTG source-material import layer.

The managed source-material library now has two ownership models:

- **Herbarium-derived Items:** copied once from the campaign's old world Items. After import, the Kor Sirok copy owns its content and is never refreshed from the old source Item.
- **KCTG-derived Items:** copied from the installed KCTG compendium into stable Kor Sirok IDs. Kor Sirok checks the current KCTG source and refreshes the local copy when the upstream source Item changes.

The KCTG manifest currently contains **159 approved non-duplicate source materials**, classified into the Kor Sirok folder hierarchy and carrying gathering metadata. Herbarium duplicates were deliberately omitted.

KCTG source refreshes are non-destructive when a source cannot be resolved: an existing Kor Sirok copy is retained and a warning is logged. If an upstream KCTG Item changes Foundry Item type, Kor Sirok replaces the local document under the same stable target ID and attempts rollback if recreation fails.

Recipes still use the logical source label `kctg`, but now prefer a stable Kor Sirok copy whenever that ingredient belongs to the imported source catalog. Ordinary trade goods not yet included in the source catalog continue to resolve directly from KCTG.

Version 0.4.0 also repairs the broken Battle Balm and Ironhide Salve icon references by switching them to core icon paths already used successfully by other formulations.

## Compendium folder structure

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

## Current alchemy content

- Nine foundational alchemical media.
- Five finished field formulations.
- Fourteen Mastercrafted recipes in *The First Principles of Practical Alchemy*.
- Sixty-nine migrated Herbarium source Items.
- One hundred fifty-nine managed KCTG source Items.
- Finished formulation Items currently carry rules text but no Midi-QOL automation.

## Automatic and manual synchronization

The active GM synchronizes automatically on `ready`. Manual synchronization is also available:

`game.modules.get("kor-sirok-alchemy").api.sync()`

Individual passes:

`game.modules.get("kor-sirok-alchemy").api.syncFolders()`

`game.modules.get("kor-sirok-alchemy").api.syncItems()`

`game.modules.get("kor-sirok-alchemy").api.syncHerbariumSources()`

`game.modules.get("kor-sirok-alchemy").api.syncKctgSources()`

`game.modules.get("kor-sirok-alchemy").api.syncRecipeBook()`

## Source files

- `data/folders.json`
- `data/items/foundations.json`
- `data/items/formulations.json`
- `data/sources/herbarium.json`
- `data/sources/kctg.json`
- `data/recipes/introduction-to-alchemy.json`
- `scripts/sync.js`

Native Kor Sirok managed documents should be edited in these source files rather than directly in Foundry. Increment the relevant `revision` whenever a managed native record changes.

Herbarium source-material content is intentionally local-owned after first import. KCTG source-material content is intentionally refreshable from the installed KCTG source, while Kor Sirok-specific folder and gathering classification metadata remains controlled by this module.
