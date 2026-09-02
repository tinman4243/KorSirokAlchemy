# Changelog

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
