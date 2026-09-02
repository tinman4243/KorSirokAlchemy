# Kor Sirok Alchemy

Kor Sirok Alchemy keeps the campaign's editable alchemy and gathering-source metadata in ordinary JSON and synchronizes that source into Foundry VTT.

## Managed world content

The module manages:

- `world.kor-sirok-alchemy` — the campaign's definitive runtime Item compendium.
- `world.kor-sirok-gathering` — generated regional botanical/fungal RollTables.
- `The First Principles of Practical Alchemy` — a Mastercrafted Journal recipe book.

The world Item compendium remains the runtime target so stable compendium UUIDs can be used by Mastercrafted, Gatherer, and future Kor Sirok automation.

## Required / recommended modules

- **Required:** Kris's Compendium of Trade Goods (`kctg-5e`). Kor Sirok imports selected source materials from the current KCTG compendium at runtime.
- **Required:** SocketLib (`socketlib`). The gathering workflow uses it for authoritative player-to-GM prompts, awards, and world-time advancement.
- **Recommended:** Mastercrafted. If Mastercrafted is inactive, the source library still synchronizes but recipe-book synchronization is skipped.
- **Recommended:** Gatherer. Kor Sirok generates Gatherer-ready RollTables, while v0.6.0 also provides its own player-facing degree-of-success gathering workflow.

## Version 0.6.0

Version 0.6.0 adds the first playable **General Plants & Fungi Gathering** workflow. Owned character sheets receive a **Gather Resources** seedling control. The player chooses a gathering discipline, the GM selects the current regional zone and the ecological focuses immediately present, and the player allocates up to three one-hour gathering slots. The same focus may be selected repeatedly.

Each selected hour prompts a normal D&D5e Herbalism Kit check. The total is converted through the configurable ladder in `data/gathering/config.json` into hidden rolls on the Common, Uncommon, and Rare tables for that regional focus. Even a very poor check receives one Common roll when that Common pool exists; environments without a Common pool can still produce a true failure.

Results are awarded from the stable `world.kor-sirok-alchemy` source library and consolidated into the character inventory. A single public chat summary reports the hour, environment, check total, and ingredients found without exposing rarity-pool mechanics. World time advances one hour per selected slot.

The current implementation supports Plants & Fungi only. Fishing, Hunting & Trapping, Prospecting, targeted ingredient searches, habitat-recall Nature checks, and a regional map chooser are future layers built on the same regional/focus architecture.

## Version 0.5.0

Version 0.5.0 adds the first generated regional gathering tables.

The module now manages `world.kor-sirok-gathering`, a world RollTable compendium. The first regional definition is **Zone 1 — Hercynian Coastal Foreland**, a humid warm-temperate/subtropical foreland between the northern sea and the Hercynian uplands.

Zone 1 currently generates **19 non-empty botanical/fungal RollTables** across seven ecological gathering focuses. Each focus is split into Common, Uncommon, and Rare pools when that tier has eligible ingredients. Estuary & Salt Marsh currently has only a Common pool, so no empty Uncommon/Rare tables are created.

Each table result points only at stable Items in `world.kor-sirok-alchemy`, uses equal weight within its rarity tier, allows replacement, and carries `flags.gatherer.quantity = "1"`. The later degree-of-success integration will decide how many hidden draws are made from each tier.

The tables are fully generated/managed content; edit `data/gathering/zones/hercynian-coastal-foreland.json`, not the generated RollTables.

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
- Nineteen generated Zone 1 botanical/fungal gathering RollTables.
- Finished formulation Items currently carry rules text but no Midi-QOL automation.

## Automatic and manual synchronization

The active GM synchronizes automatically on `ready`. Manual synchronization is also available:

`game.modules.get("kor-sirok-alchemy").api.sync()`

Individual passes:

`game.modules.get("kor-sirok-alchemy").api.syncFolders()`

`game.modules.get("kor-sirok-alchemy").api.syncItems()`

`game.modules.get("kor-sirok-alchemy").api.syncHerbariumSources()`

`game.modules.get("kor-sirok-alchemy").api.syncKctgSources()`

`game.modules.get("kor-sirok-alchemy").api.syncGatheringTables()`

`game.modules.get("kor-sirok-alchemy").api.syncRecipeBook()`

Gathering workflow entry point:

`game.modules.get("kor-sirok-alchemy").api.startGatherResources(actor)`

## Source files

- `data/folders.json`
- `data/items/foundations.json`
- `data/items/formulations.json`
- `data/sources/herbarium.json`
- `data/sources/kctg.json`
- `data/recipes/introduction-to-alchemy.json`
- `data/gathering/zones/hercynian-coastal-foreland.json`
- `data/gathering/config.json`
- `scripts/sync.js`
- `scripts/gathering.js`

Native Kor Sirok managed documents should be edited in these source files rather than directly in Foundry. Increment the relevant `revision` whenever a managed native record changes.

Herbarium source-material content is intentionally local-owned after first import. KCTG source-material content is intentionally refreshable from the installed KCTG source, while Kor Sirok-specific folder and gathering classification metadata remains controlled by this module.


### v0.6.1 SocketLib initialization hotfix
Kor Sirok now recovers if SocketLib's one-time `socketlib.ready` hook fired before the gathering script registered its listener.


### v0.6.2 Socket manifest hotfix
Added the Foundry manifest `"socket": true` flag required by SocketLib.
