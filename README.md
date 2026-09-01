# Kor Sirok Alchemy

A small campaign module that keeps the editable source for the Kor Sirok alchemy subsystem outside Foundry and synchronizes it into the world at runtime.

## Why the world compendium remains

Foundry V11+ module compendium packs are database directories rather than ordinary editable JSON files. To keep this project easy to author in Dropbox, this module treats its JSON files as the canonical source and synchronizes them into a world Item compendium named:

`world.kor-sirok-alchemy`

The world compendium is therefore generated/runtime data. Do not hand-edit managed entries unless you intend those edits to be overwritten by a future module revision.

If the compendium does not exist, the module will create it.

## Source layout

- `data/items/foundations.json` — canonical alchemical intermediate Items.
- `data/recipes/introduction-to-alchemy.json` — source scaffold for the introductory Mastercrafted book.
- `scripts/sync.js` — synchronization logic.

Each managed Item has a stable Foundry document ID and a small integer `revision`. Increment an Item's revision when changing that Item. On world startup, only new or revised managed Items are written.

## Manual sync

As GM, run this in the browser console:

`game.modules.get("kor-sirok-alchemy").api.sync()`

## Initial manual install

Extract the `kor-sirok-alchemy` folder into:

`FoundryVTT/Data/modules/`

Restart Foundry, enable **Kor Sirok Alchemy**, and load the world.

## Dropbox update hosting

After the first local test, host two stable shared files:

- `module.json` — use a direct/raw Dropbox URL for Foundry's manifest.
- `kor-sirok-alchemy.zip` — use a direct-download Dropbox URL for Foundry's download field.

Then add `manifest` and `download` fields to `module.json` and bump `version` for every release.

The ZIP must contain the top-level `kor-sirok-alchemy/` directory.
