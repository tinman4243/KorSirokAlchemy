# Changelog

## 0.5.0
- Added the managed world RollTable compendium `world.kor-sirok-gathering` (`Kor Sirok — Gathering Tables`).
- Added Zone 1, **Hercynian Coastal Foreland**, as the first canonical regional gathering definition.
- Added seven Zone 1 botanical/fungal gathering focuses: Open Woodland & Grassland, Riverbank & Floodplain, Wet Woodland, Freshwater Wetland, Dry Ridge & Rocky Slope, Coast & Littoral, and Estuary & Salt Marsh.
- Generate 19 non-empty Common/Uncommon/Rare RollTables from the Zone 1 regional-filter data.
- Generated results point only at stable Items in `world.kor-sirok-alchemy`, use equal weight within tier, roll with replacement, and carry Gatherer quantity `1`.
- Empty rarity tiers are not materialized as invalid/empty RollTables.
- Added managed gathering-table folder hierarchy and safe synchronization of table roots/results.
- Added `syncGatheringTables()` to the module API and automatic ready-time synchronization.
- Added Gatherer as a recommended module relationship.

## 0.4.0
- Made Kris's Compendium of Trade Goods (`kctg-5e`) a required module relationship.
- Added `data/sources/kctg.json` with 159 approved non-duplicate source materials and Kor Sirok gathering classifications.
- Added `syncKctgSources()` to copy KCTG Items into stable IDs inside `world.kor-sirok-alchemy`.
- KCTG-derived source Items refresh when the installed upstream Item changes while retaining Kor Sirok stable IDs, folders, and gathering metadata.
- Missing KCTG sources never delete existing local copies; unresolved entries are warned and skipped.
- Added safe replacement/rollback handling for upstream KCTG Item-type changes.
- Recipe resolution now prefers imported Kor Sirok copies for managed KCTG ingredients and falls back to the upstream KCTG pack for ordinary trade goods not yet imported.
- Bumped all recipe revisions so affected ingredient UUIDs repoint to stable Kor Sirok copies.
- Repaired the Battle Balm and Ironhide Salve icon paths and bumped those formulation revisions.

## 0.3.0
- Added managed folders inside `world.kor-sirok-alchemy`, including Source Materials and Alchemy hierarchies.
- Added a one-time migration manifest for all 69 campaign Herbarium Items.
- Herbarium Items are copied into stable Kor Sirok compendium IDs; original world Items are never deleted.
- After import, Herbarium item content is local-owned and is not refreshed from the original world Item on later syncs.
- Added Kor Sirok gathering-classification metadata to migrated Herbarium source Items.
- Organized the nine foundations and five formulations into managed compendium folders.
- Changed Herbarium recipe resolution to use the migrated Kor Sirok compendium copies.
- Bumped all managed recipe revisions so existing recipe pages repoint automatically.
- Added `syncFolders()` and `syncHerbariumSources()` module API methods.

## 0.2.1
- Fixed recipe synchronization when a Herbarium plant and an old KCTG world Item share the same name.
- Herbarium ingredients now resolve only from world Items whose source book is `Herbarium`.
- Custom spell-component resources now resolve by D&D5e identifier instead of display name.
- Bumped managed recipe revisions so a failed/partial v0.2.0 sync is repaired automatically.

## 0.2.0
- Added five finished alchemical formulation Items.
- Added *The First Principles of Practical Alchemy* as a managed Mastercrafted recipe book.
- Added fourteen recipes: nine foundations and five field formulations.
- Added exact-name ingredient resolution for KCTG compendium Items and campaign world Items.
- Added recipe/page revision tracking and manual recipe-book sync API.

## 0.1.0
- Initial external-source module scaffold.
- Synchronized nine foundational alchemical intermediates into `world.kor-sirok-alchemy`.
- Preserved stable IDs used by existing Mastercrafted recipes.
