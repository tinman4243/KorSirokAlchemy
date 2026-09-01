const MODULE_ID = "kor-sirok-alchemy";
const ITEM_PACK_ID = "world.kor-sirok-alchemy";
const ITEM_PACK_NAME = "kor-sirok-alchemy";
const ITEM_PACK_LABEL = "Kor Sirok — Alchemy";

function modulePath(relative) {
  return `modules/${MODULE_ID}/${relative}`;
}

async function loadJson(relative) {
  const response = await fetch(modulePath(relative), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${relative}: HTTP ${response.status}`);
  }
  return response.json();
}

async function ensureItemPack() {
  let pack = game.packs.get(ITEM_PACK_ID);
  if (pack) return pack;

  console.log(`[${MODULE_ID}] Creating world Item compendium ${ITEM_PACK_ID}.`);

  pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
    name: ITEM_PACK_NAME,
    label: ITEM_PACK_LABEL,
    type: "Item",
    package: "world",
    system: "dnd5e"
  });

  return pack;
}

function toFoundryItem(source) {
  const description =
    `<p>${source.description}</p>` +
    `<p><strong>Alchemical Use.</strong> ${source.alchemicalUse}</p>` +
    `<p>One unit represents enough prepared material for one normal alchemical formulation.</p>`;

  return {
    _id: source.id,
    name: source.name,
    type: "loot",
    img: source.img,
    system: {
      description: {
        value: description,
        chat: ""
      },
      source: {
        book: "",
        page: "",
        custom: "Kor Sirok Alchemy",
        license: "",
        rules: "2014",
        revision: 1
      },
      identified: true,
      unidentified: {
        description: ""
      },
      container: null,
      quantity: 1,
      weight: {
        value: source.weightLb,
        units: "lb"
      },
      price: {
        value: source.priceGp,
        denomination: "gp"
      },
      rarity: "common",
      properties: [],
      type: {
        value: "material",
        subtype: ""
      },
      identifier: source.identifier
    },
    effects: [],
    flags: {
      dnd5e: {
        riders: {
          activity: [],
          effect: []
        }
      },
      [MODULE_ID]: {
        managed: true,
        source: "data/items/foundations.json",
        revision: source.revision
      }
    }
  };
}

async function syncItems() {
  const source = await loadJson("data/items/foundations.json");
  const pack = await ensureItemPack();

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  const index = await pack.getIndex({ fields: [`flags.${MODULE_ID}.revision`] });

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    for (const sourceItem of source.items) {
      const indexed = index.get(sourceItem.id);
      const existingRevision = indexed?.flags?.[MODULE_ID]?.revision;

      if (indexed && existingRevision === sourceItem.revision) {
        unchanged++;
        continue;
      }

      const data = toFoundryItem(sourceItem);
      const existing = await pack.getDocument(sourceItem.id);

      if (existing) {
        const update = foundry.utils.deepClone(data);
        delete update._id;
        await existing.update(update);
        updated++;
      } else {
        await Item.implementation.create(data, {
          pack: pack.collection,
          keepId: true
        });
        created++;
      }
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }

  console.log(`[${MODULE_ID}] Item sync complete.`, {
    created,
    updated,
    unchanged,
    pack: pack.collection
  });

  return { created, updated, unchanged };
}

async function syncAll({ notify = true } = {}) {
  if (!game.user?.isGM) {
    if (notify) ui.notifications.warn("Kor Sirok Alchemy synchronization requires a GM.");
    return;
  }

  try {
    const items = await syncItems();

    if (notify) {
      ui.notifications.info(
        `Kor Sirok Alchemy synced: ${items.created} created, ` +
        `${items.updated} updated, ${items.unchanged} unchanged.`
      );
    }

    return { items };
  } catch (error) {
    console.error(`[${MODULE_ID}] Synchronization failed.`, error);
    if (notify) ui.notifications.error(`Kor Sirok Alchemy sync failed: ${error.message}`);
    throw error;
  }
}

Hooks.once("ready", async () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = { sync: syncAll, syncItems };

  // Only one GM should perform the automatic write pass.
  const activeGM = game.users?.activeGM;
  if (!game.user?.isGM) return;
  if (activeGM && activeGM.id !== game.user.id) return;

  await syncAll({ notify: true });
});
