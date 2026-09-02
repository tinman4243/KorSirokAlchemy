const MODULE_ID = "kor-sirok-alchemy";
const ITEM_PACK_ID = "world.kor-sirok-alchemy";
const ITEM_PACK_NAME = "kor-sirok-alchemy";
const ITEM_PACK_LABEL = "Kor Sirok — Alchemy";
const KCTG_PACK_ID = "kctg-5e.kctg-dnd5e";
const RECIPE_SOURCE = "data/recipes/introduction-to-alchemy.json";
const FOLDER_SOURCE = "data/folders.json";
const HERBARIUM_SOURCE = "data/sources/herbarium.json";
const KCTG_SOURCE = "data/sources/kctg.json";
const ITEM_SOURCES = [
  "data/items/foundations.json",
  "data/items/formulations.json"
];

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

  return foundry.documents.collections.CompendiumCollection.createCompendium({
    name: ITEM_PACK_NAME,
    label: ITEM_PACK_LABEL,
    type: "Item",
    package: "world",
    system: "dnd5e"
  });
}


async function withUnlockedPack(pack, callback) {
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  try {
    return await callback();
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

function currentFolderId(document) {
  return document.folder?.id ?? document._source?.folder ?? null;
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function syncFolders(pack = null) {
  pack ??= await ensureItemPack();
  const payload = await loadJson(FOLDER_SOURCE);
  const definitions = payload.folders ?? [];

  return withUnlockedPack(pack, async () => {
    const folderCollection = pack.folders;
    if (!folderCollection) {
      throw new Error(
        `Compendium ${ITEM_PACK_ID} does not expose its folder collection. ` +
        `Kor Sirok Alchemy requires Foundry VTT 14 compendium-folder support.`
      );
    }

    const byKey = new Map();
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const definition of definitions) {
      const parentId = definition.parent ? byKey.get(definition.parent)?.id : null;
      if (definition.parent && !parentId) {
        throw new Error(
          `Folder "${definition.name}" refers to unresolved parent key "${definition.parent}".`
        );
      }

      let folder = folderCollection.get(definition.id);

      if (!folder) {
        const sameName = folderCollection.contents.filter(candidate =>
          candidate.name === definition.name && currentFolderId(candidate) === parentId
        );

        if (sameName.length > 1) {
          throw new Error(
            `Compendium ${ITEM_PACK_ID} contains multiple folders named "${definition.name}" ` +
            `under the same parent. Resolve the duplicate folders before syncing.`
          );
        }

        folder = sameName[0] ?? null;
      }

      const managedFlags = {
        managed: true,
        kind: "compendium-folder",
        key: definition.key,
        source: FOLDER_SOURCE,
        revision: definition.revision
      };

      if (!folder) {
        folder = await Folder.create(
          {
            _id: definition.id,
            name: definition.name,
            type: "Item",
            folder: parentId,
            sorting: "a",
            color: definition.color ?? null,
            flags: { [MODULE_ID]: managedFlags }
          },
          { pack: pack.collection, keepId: true }
        );
        created++;
      } else {
        const changes = {};

        if (folder.name !== definition.name) changes.name = definition.name;
        if (currentFolderId(folder) !== parentId) changes.folder = parentId;
        if (folder.sorting !== "a") changes.sorting = "a";
        if ((folder.color ?? null) !== (definition.color ?? null)) {
          changes.color = definition.color ?? null;
        }

        if (!sameJson(folder.flags?.[MODULE_ID], managedFlags)) {
          changes[`flags.${MODULE_ID}`] = managedFlags;
        }

        if (Object.keys(changes).length) {
          await folder.update(changes);
          updated++;
        } else {
          unchanged++;
        }
      }

      byKey.set(definition.key, folder);
    }

    console.log(`[${MODULE_ID}] Compendium-folder sync complete.`, {
      created,
      updated,
      unchanged,
      pack: pack.collection
    });

    return { created, updated, unchanged, byKey };
  });
}

function materialItem(source, sourceFile, folderId = null) {
  const description =
    `<p>${source.description}</p>` +
    `<p><strong>Alchemical Use.</strong> ${source.alchemicalUse}</p>` +
    `<p>One unit represents enough prepared material for one normal alchemical formulation.</p>`;

  return {
    _id: source.id,
    name: source.name,
    type: "loot",
    img: source.img,
    folder: folderId,
    system: {
      description: { value: description, chat: "" },
      source: {
        book: "",
        page: "",
        custom: "Kor Sirok Alchemy",
        license: "",
        rules: "2014",
        revision: 1
      },
      identified: true,
      unidentified: { description: "" },
      container: null,
      quantity: 1,
      weight: { value: source.weightLb, units: "lb" },
      price: { value: source.priceGp, denomination: "gp" },
      rarity: "common",
      properties: [],
      type: { value: "material", subtype: "" },
      identifier: source.identifier
    },
    effects: [],
    flags: {
      dnd5e: { riders: { activity: [], effect: [] } },
      [MODULE_ID]: {
        managed: true,
        source: sourceFile,
        revision: source.revision
      }
    }
  };
}

function consumableItem(source, sourceFile, folderId = null) {
  const description =
    `<p>${source.description}</p>` +
    `<p><strong>Effect.</strong> ${source.effect}</p>`;

  return {
    _id: source.id,
    name: source.name,
    type: "consumable",
    img: source.img,
    folder: folderId,
    system: {
      activities: {},
      uses: {
        spent: 0,
        recovery: [],
        autoDestroy: false,
        max: ""
      },
      description: { value: description, chat: "" },
      identifier: source.identifier,
      source: {
        book: "",
        page: "",
        custom: "Kor Sirok Alchemy",
        license: "",
        rules: "2024",
        revision: 1
      },
      identified: true,
      unidentified: { description: "" },
      container: null,
      quantity: 1,
      weight: { value: source.weightLb, units: "lb" },
      price: { value: source.priceGp, denomination: "gp" },
      rarity: "",
      attunement: "",
      attuned: false,
      equipped: false,
      type: { value: "", subtype: "" },
      damage: {
        base: {
          number: null,
          denomination: null,
          types: [],
          custom: { enabled: false },
          scaling: { number: 1 }
        },
        replace: false
      },
      properties: []
    },
    effects: [],
    flags: {
      dnd5e: { riders: { activity: [], effect: [] } },
      [MODULE_ID]: {
        managed: true,
        source: sourceFile,
        revision: source.revision
      }
    }
  };
}

function toFoundryItem(source, sourceFile, folderId = null) {
  return source.kind === "consumable"
    ? consumableItem(source, sourceFile, folderId)
    : materialItem(source, sourceFile, folderId);
}

async function syncItems({ pack = null, folderMap = null } = {}) {
  pack ??= await ensureItemPack();

  if (!folderMap) {
    const folders = await syncFolders(pack);
    folderMap = folders.byKey;
  }

  const sources = [];

  for (const sourceFile of ITEM_SOURCES) {
    const payload = await loadJson(sourceFile);
    const folderKey = payload.folder ?? null;

    for (const item of payload.items ?? []) {
      sources.push({ sourceFile, folderKey, item });
    }
  }

  return withUnlockedPack(pack, async () => {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const { sourceFile, folderKey, item: sourceItem } of sources) {
      const folderId = folderKey ? folderMap.get(folderKey)?.id : null;
      if (folderKey && !folderId) {
        throw new Error(`Could not resolve target folder key "${folderKey}" for ${sourceItem.name}.`);
      }

      const existing = await pack.getDocument(sourceItem.id);
      const existingRevision = existing?.flags?.[MODULE_ID]?.revision;
      const existingSource = existing?.flags?.[MODULE_ID]?.source;
      const folderMatches = existing ? currentFolderId(existing) === folderId : false;

      if (
        existing &&
        existingRevision === sourceItem.revision &&
        existingSource === sourceFile &&
        folderMatches
      ) {
        unchanged++;
        continue;
      }

      const data = toFoundryItem(sourceItem, sourceFile, folderId);

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

    console.log(`[${MODULE_ID}] Item sync complete.`, {
      created,
      updated,
      unchanged,
      pack: pack.collection
    });

    return { created, updated, unchanged };
  });
}

async function syncHerbariumSources({ pack = null, folderMap = null } = {}) {
  pack ??= await ensureItemPack();

  if (!folderMap) {
    const folders = await syncFolders(pack);
    folderMap = folders.byKey;
  }

  const payload = await loadJson(HERBARIUM_SOURCE);
  const definitions = payload.items ?? [];

  return withUnlockedPack(pack, async () => {
    let created = 0;
    let metadataUpdated = 0;
    let unchanged = 0;
    let missing = 0;
    const missingItems = [];

    for (const definition of definitions) {
      const folderId = folderMap.get(definition.targetFolder)?.id;
      if (!folderId) {
        throw new Error(
          `Could not resolve Herbarium target folder key "${definition.targetFolder}" ` +
          `for "${definition.name}".`
        );
      }

      const managedFlags = {
        managed: true,
        kind: "source-material",
        contentOwner: "local-after-import",
        source: HERBARIUM_SOURCE,
        revision: definition.revision,
        origin: {
          provider: "herbarium",
          worldItemId: definition.sourceId,
          name: definition.name
        },
        gathering: foundry.utils.deepClone(definition.gathering ?? {})
      };

      const existing = await pack.getDocument(definition.targetId);

      if (existing) {
        if (existing.name !== definition.name) {
          throw new Error(
            `Herbarium target ID collision: ${definition.targetId} is "${existing.name}" ` +
            `in ${ITEM_PACK_ID}, expected "${definition.name}".`
          );
        }

        const changes = {};
        if (currentFolderId(existing) !== folderId) changes.folder = folderId;

        // The imported description, image, price, system data, etc. are deliberately
        // NOT refreshed. After the first copy, the Kor Sirok document owns its content.
        if (!sameJson(existing.flags?.[MODULE_ID], managedFlags)) {
          changes[`flags.${MODULE_ID}`] = managedFlags;
        }

        if (Object.keys(changes).length) {
          await existing.update(changes);
          metadataUpdated++;
        } else {
          unchanged++;
        }

        continue;
      }

      let sourceItem = game.items.get(definition.sourceId);

      if (sourceItem && sourceItem.name !== definition.name) {
        sourceItem = null;
      }

      if (!sourceItem) {
        const exactName = game.items.contents.filter(item => item.name === definition.name);
        if (exactName.length === 1) sourceItem = exactName[0];
      }

      if (!sourceItem) {
        missing++;
        missingItems.push({
          name: definition.name,
          sourceId: definition.sourceId,
          targetId: definition.targetId
        });
        continue;
      }

      const data = sourceItem.toObject();
      data._id = definition.targetId;
      data.folder = folderId;
      delete data._stats;
      delete data.ownership;

      data.flags = foundry.utils.deepClone(data.flags ?? {});
      data.flags[MODULE_ID] = managedFlags;

      await Item.implementation.create(data, {
        pack: pack.collection,
        keepId: true
      });
      created++;
    }

    if (missingItems.length) {
      console.warn(
        `[${MODULE_ID}] Herbarium source Items were missing and could not be imported. ` +
        `Existing Kor Sirok copies are never deleted.`,
        missingItems
      );
    }

    console.log(`[${MODULE_ID}] Herbarium source migration complete.`, {
      created,
      metadataUpdated,
      unchanged,
      missing,
      pack: pack.collection
    });

    return { created, metadataUpdated, unchanged, missing, missingItems };
  });
}

function uniqueNameMap(entries, label) {
  const grouped = new Map();

  for (const entry of entries) {
    const matches = grouped.get(entry.name) ?? [];
    matches.push(entry);
    grouped.set(entry.name, matches);
  }

  const result = new Map();

  for (const [name, matches] of grouped) {
    if (matches.length === 1) {
      result.set(name, matches[0]);
    } else {
      console.warn(
        `[${MODULE_ID}] ${label} contains ${matches.length} entries named "${name}".`,
        matches
      );
    }
  }

  return result;
}


async function replaceCompendiumItemWithRollback(pack, existing, desired) {
  const backup = existing.toObject();
  delete backup._stats;
  delete backup.ownership;

  await existing.delete();

  try {
    return await Item.implementation.create(desired, {
      pack: pack.collection,
      keepId: true
    });
  } catch (error) {
    try {
      await Item.implementation.create(backup, {
        pack: pack.collection,
        keepId: true
      });
    } catch (rollbackError) {
      console.error(
        `[${MODULE_ID}] KCTG replacement rollback failed for "${backup.name}" (${backup._id}).`,
        rollbackError
      );
    }

    throw error;
  }
}

async function syncKctgSources({ pack = null, folderMap = null } = {}) {
  pack ??= await ensureItemPack();

  if (!folderMap) {
    const folders = await syncFolders(pack);
    folderMap = folders.byKey;
  }

  const payload = await loadJson(KCTG_SOURCE);
  const definitions = payload.items ?? [];
  const sourcePackId = payload.sourcePack ?? KCTG_PACK_ID;
  const sourcePack = game.packs.get(sourcePackId);

  if (!sourcePack) {
    throw new Error(
      `Could not find required KCTG pack "${sourcePackId}". ` +
      `Kor Sirok Alchemy 0.4.0+ requires the KCTG module to be installed and active.`
    );
  }

  // The index lets routine world loads avoid materializing every KCTG Item. We only
  // fetch full source documents when a local copy is new or the upstream Item changed.
  const sourceIndex = await sourcePack.getIndex({ fields: ["_stats.modifiedTime"] });
  const sourceById = new Map(sourceIndex.map(entry => [entry._id, entry]));
  const sourceByName = uniqueNameMap(sourceIndex, sourcePackId);

  return withUnlockedPack(pack, async () => {
    let created = 0;
    let refreshed = 0;
    let metadataUpdated = 0;
    let unchanged = 0;
    let missing = 0;
    let replacedForTypeChange = 0;
    const missingItems = [];

    for (const definition of definitions) {
      const folderId = folderMap.get(definition.targetFolder)?.id;
      if (!folderId) {
        throw new Error(
          `Could not resolve KCTG target folder key "${definition.targetFolder}" ` +
          `for "${definition.targetName}".`
        );
      }

      // Prefer the known current source ID. If a future KCTG release changes IDs,
      // fall back to a unique exact source name. We never guess beyond that.
      const sourceEntry =
        sourceById.get(definition.sourceId) ?? sourceByName.get(definition.sourceName) ?? null;

      const existing = await pack.getDocument(definition.targetId);

      if (!sourceEntry) {
        missing++;
        missingItems.push({
          sourceId: definition.sourceId,
          sourceName: definition.sourceName,
          targetId: definition.targetId,
          targetName: definition.targetName,
          existingKept: Boolean(existing)
        });
        continue;
      }

      if (existing && existing.flags?.[MODULE_ID]?.origin?.provider !== "kctg") {
        const provider = existing.flags?.[MODULE_ID]?.origin?.provider ?? "unmanaged";
        throw new Error(
          `KCTG target ID collision: ${definition.targetId} is already ${provider} content ` +
          `("${existing.name}"). Kor Sirok will not overwrite it.`
        );
      }

      const sourceModifiedTime = sourceEntry._stats?.modifiedTime ?? null;
      const managedFlags = {
        managed: true,
        kind: "source-material",
        contentOwner: "refresh-from-kctg",
        source: KCTG_SOURCE,
        revision: definition.revision,
        origin: {
          provider: "kctg",
          pack: sourcePackId,
          sourceId: definition.sourceId,
          sourceName: definition.sourceName,
          resolvedSourceId: sourceEntry._id,
          resolvedSourceName: sourceEntry.name,
          modifiedTime: sourceModifiedTime
        },
        gathering: foundry.utils.deepClone(definition.gathering ?? {})
      };

      const existingOrigin = existing?.flags?.[MODULE_ID]?.origin;
      const sourceChanged =
        !existing ||
        sourceModifiedTime === null ||
        existingOrigin?.resolvedSourceId !== sourceEntry._id ||
        existingOrigin?.modifiedTime !== sourceModifiedTime;

      if (existing && !sourceChanged) {
        const changes = {};

        if (existing.name !== definition.targetName) changes.name = definition.targetName;
        if (currentFolderId(existing) !== folderId) changes.folder = folderId;
        if (!sameJson(existing.flags?.[MODULE_ID], managedFlags)) {
          changes[`flags.${MODULE_ID}`] = managedFlags;
        }

        if (Object.keys(changes).length) {
          await existing.update(changes);
          metadataUpdated++;
        } else {
          unchanged++;
        }

        continue;
      }

      const sourceItem = await sourcePack.getDocument(sourceEntry._id);
      if (!sourceItem) {
        missing++;
        missingItems.push({
          sourceId: definition.sourceId,
          sourceName: definition.sourceName,
          resolvedSourceId: sourceEntry._id,
          targetId: definition.targetId,
          targetName: definition.targetName,
          existingKept: Boolean(existing)
        });
        continue;
      }

      const desired = sourceItem.toObject();
      desired._id = definition.targetId;
      desired.name = definition.targetName;
      desired.folder = folderId;
      delete desired._stats;
      delete desired.ownership;

      desired.flags = foundry.utils.deepClone(desired.flags ?? {});
      desired.flags[MODULE_ID] = managedFlags;

      if (!existing) {
        await Item.implementation.create(desired, {
          pack: pack.collection,
          keepId: true
        });
        created++;
        continue;
      }

      if (existing.type !== desired.type) {
        await replaceCompendiumItemWithRollback(pack, existing, desired);
        refreshed++;
        replacedForTypeChange++;
        continue;
      }

      const update = foundry.utils.deepClone(desired);
      delete update._id;
      await existing.update(update);
      refreshed++;
    }

    if (missingItems.length) {
      console.warn(
        `[${MODULE_ID}] Some KCTG source Items could not be resolved. ` +
        `Existing Kor Sirok copies were kept and nothing was deleted.`,
        missingItems
      );
    }

    console.log(`[${MODULE_ID}] KCTG source synchronization complete.`, {
      created,
      refreshed,
      metadataUpdated,
      unchanged,
      missing,
      replacedForTypeChange,
      pack: pack.collection,
      sourcePack: sourcePackId
    });

    return {
      created,
      refreshed,
      metadataUpdated,
      unchanged,
      missing,
      replacedForTypeChange,
      missingItems
    };
  });
}

function stableId(key) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;

  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0;
  }

  let out = "";
  for (let i = 0; i < 16; i++) {
    a = (Math.imul(a ^ (a >>> 13), 0x5bd1e995) + b + i) >>> 0;
    b = (Math.imul(b ^ (b >>> 15), 0x27d4eb2d) + a + i) >>> 0;
    out += alphabet[((a ^ b) >>> 0) % alphabet.length];
  }

  return out;
}

function formatMinutes(minutes) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

async function buildResolvers(alchemyPack) {
  const kctg = game.packs.get(KCTG_PACK_ID);
  if (!kctg) {
    throw new Error(
      `Could not find KCTG pack "${KCTG_PACK_ID}". Enable Kris's Compendium of Trade Goods before synchronizing recipes.`
    );
  }

  const [alchemyDocs, kctgIndex] = await Promise.all([
    alchemyPack.getDocuments(),
    kctg.getIndex({ fields: ["img"] })
  ]);

  const alchemyByName = uniqueNameMap(alchemyDocs, ITEM_PACK_ID);
  const kctgByName = uniqueNameMap(kctgIndex, KCTG_PACK_ID);
  const herbariumByName = uniqueNameMap(
    alchemyDocs.filter(doc => doc.flags?.[MODULE_ID]?.origin?.provider === "herbarium"),
    `${ITEM_PACK_ID} Herbarium sources`
  );

  // Recipes still use the source label "kctg" for ordinary trade-goods ingredients.
  // When that KCTG Item has been imported into the definitive Kor Sirok source library,
  // prefer the stable local copy. Items outside the managed source catalog continue to
  // resolve directly from KCTG.
  const localKctgBySourceName = new Map();
  for (const doc of alchemyDocs) {
    const origin = doc.flags?.[MODULE_ID]?.origin;
    if (origin?.provider !== "kctg" || !origin.sourceName) continue;

    if (localKctgBySourceName.has(origin.sourceName)) {
      console.warn(
        `[${MODULE_ID}] Multiple imported KCTG Items claim source name "${origin.sourceName}".`,
        [localKctgBySourceName.get(origin.sourceName), doc]
      );
      localKctgBySourceName.set(origin.sourceName, null);
    } else {
      localKctgBySourceName.set(origin.sourceName, doc);
    }
  }

  // Some ordinary spell-component resources are campaign world Items. Their D&D5e
  // identifier is a better key than display name because display names may be duplicated.
  const worldByIdentifier = new Map();
  for (const item of game.items.contents) {
    const identifier = item.system?.identifier;
    if (!identifier) continue;

    if (worldByIdentifier.has(identifier)) {
      worldByIdentifier.set(identifier, null);
    } else {
      worldByIdentifier.set(identifier, item);
    }
  }

  return {
    alchemy(name) {
      const entry = alchemyByName.get(name);
      if (!entry) {
        throw new Error(`Could not uniquely resolve alchemy item "${name}" in ${ITEM_PACK_ID}.`);
      }

      return {
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img
      };
    },

    kctg(name) {
      const local = localKctgBySourceName.get(name);
      if (local) {
        return {
          uuid: local.uuid,
          name: local.name,
          img: local.img
        };
      }

      const entry = kctgByName.get(name);
      if (!entry) {
        throw new Error(`Could not uniquely resolve KCTG item "${name}" in ${KCTG_PACK_ID}.`);
      }

      return {
        uuid: `Compendium.${KCTG_PACK_ID}.Item.${entry._id}`,
        name: entry.name,
        img: entry.img
      };
    },

    herbarium(name) {
      const entry = herbariumByName.get(name);
      if (!entry) {
        throw new Error(
          `Could not uniquely resolve migrated Herbarium Item "${name}" in ${ITEM_PACK_ID}. ` +
          `Run the Herbarium source migration before synchronizing recipes.`
        );
      }

      return {
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img
      };
    },

    worldIdentifier(name, option) {
      const identifier = option.identifier;
      const entry = worldByIdentifier.get(identifier);

      if (!entry) {
        throw new Error(
          `Could not uniquely resolve world Item identifier "${identifier}" for "${name}".`
        );
      }

      return {
        uuid: entry.uuid,
        name: entry.name,
        img: entry.img
      };
    }
  };
}

function resolveComponent(option, resolvers, key) {
  const resolver = resolvers[option.source];
  if (!resolver) {
    throw new Error(`Unknown recipe component source "${option.source}" for "${option.name}".`);
  }

  const doc = resolver(option.name, option);

  return {
    id: stableId(`${key}|component|${option.source}|${option.name}`),
    uuid: doc.uuid,
    quantity: String(option.quantity ?? 1),
    name: doc.name,
    img: doc.img,
    tags: [],
    resourcePath: ""
  };
}

function recipeGroups(groups, resolvers, recipeId, kind) {
  return (groups ?? []).map((group, groupIndex) => ({
    id: stableId(`${recipeId}|${kind}|group|${groupIndex}`),
    name: group.name ?? null,
    components: (group.options ?? []).map((option, componentIndex) =>
      resolveComponent(
        option,
        resolvers,
        `${recipeId}|${kind}|${groupIndex}|${componentIndex}`
      )
    )
  }));
}

function recipeText(recipe) {
  let html = `<p>${recipe.instructions}</p>`;

  if (recipe.effect) {
    html += `<p><strong>Effect.</strong> ${recipe.effect}</p>`;
  }

  html +=
    `<p><strong>Yield:</strong> ${recipe.yield}. ` +
    `<strong>Time:</strong> ${formatMinutes(recipe.time)} (${recipe.time.toLocaleString()} minutes).</p>`;

  return html;
}

function bookMastercraftedFlags(sourceBook) {
  return {
    description: sourceBook.description,
    img: sourceBook.img,
    ingredientsInspection: sourceBook.ingredientsInspection ?? "1",
    productInspection: sourceBook.productInspection ?? "1",
    sound: "",
    require: sourceBook.require ?? ""
  };
}

function recipePageData(recipe, sourceBook, book, resolvers, sort) {
  const bookFlags = bookMastercraftedFlags(sourceBook);

  return {
    _id: recipe.id,
    name: recipe.name,
    type: "mastercrafted.mastercrafted",
    text: {
      content: recipeText(recipe),
      format: 1
    },
    flags: {
      mastercrafted: {
        img: recipe.img,
        ingredients: recipeGroups(recipe.ingredients, resolvers, recipe.id, "ingredient"),
        ingredientsInspection: sourceBook.ingredientsInspection ?? "1",
        macroName: "",
        products: recipeGroups(
          (recipe.products ?? []).map(product => ({ options: [product] })),
          resolvers,
          recipe.id,
          "product"
        ),
        productInspection: sourceBook.productInspection ?? "1",
        sound: "",
        time: recipe.time,
        require: recipe.require ?? "",
        toolDc: null,
        toolCheck: null,
        abilityCheck: null,
        abilityDc: null,
        expression: "",
        modifierList: [],
        recipeBook: {
          id: sourceBook.id,
          name: sourceBook.name,
          description: sourceBook.description,
          ownership: foundry.utils.deepClone(book.ownership),
          ...bookFlags
        }
      },
      [MODULE_ID]: {
        managed: true,
        source: RECIPE_SOURCE,
        revision: recipe.revision
      }
    },
    system: {
      text: { format: 1 }
    },
    title: {
      show: true,
      level: 1
    },
    image: {},
    video: {
      controls: true,
      volume: 0.5
    },
    src: null,
    category: null,
    sort,
    ownership: {
      default: -1
    }
  };
}

async function ensureRecipeBook(sourceBook) {
  let book = game.journal.get(sourceBook.id);
  if (book) return book;

  const sameName = game.journal.filter(j => j.name === sourceBook.name);
  if (sameName.length) {
    throw new Error(
      `A Journal named "${sourceBook.name}" already exists with a different ID. ` +
      `Rename or remove it before Kor Sirok Alchemy creates its managed recipe book.`
    );
  }

  book = await JournalEntry.implementation.create(
    {
      _id: sourceBook.id,
      name: sourceBook.name,
      pages: [],
      flags: {
        mastercrafted: bookMastercraftedFlags(sourceBook),
        [MODULE_ID]: {
          managed: true,
          source: RECIPE_SOURCE,
          revision: sourceBook.revision
        }
      },
      categories: [],
      ownership: {
        default: 0
      }
    },
    { keepId: true }
  );

  return book;
}

async function syncRecipeBook() {
  if (!game.modules.get("mastercrafted")?.active) {
    console.warn(`[${MODULE_ID}] Mastercrafted is not active; recipe-book synchronization skipped.`);
    return { created: 0, updated: 0, unchanged: 0, skipped: true };
  }

  const payload = await loadJson(RECIPE_SOURCE);
  const sourceBook = payload.book;

  if (!sourceBook) {
    throw new Error(`${RECIPE_SOURCE} does not contain a book definition.`);
  }

  const alchemyPack = await ensureItemPack();
  const resolvers = await buildResolvers(alchemyPack);
  const book = await ensureRecipeBook(sourceBook);

  const currentBookRevision = book.flags?.[MODULE_ID]?.revision;
  if (currentBookRevision !== sourceBook.revision) {
    await book.update({
      name: sourceBook.name,
      "flags.mastercrafted": bookMastercraftedFlags(sourceBook),
      [`flags.${MODULE_ID}`]: {
        managed: true,
        source: RECIPE_SOURCE,
        revision: sourceBook.revision
      }
    });
  }

  const pagesById = new Map(book.pages.map(page => [page.id, page]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const creates = [];
  const updates = [];

  for (let i = 0; i < sourceBook.recipes.length; i++) {
    const recipe = sourceBook.recipes[i];
    const existing = pagesById.get(recipe.id);
    const existingRevision = existing?.flags?.[MODULE_ID]?.revision;

    if (existing && existingRevision === recipe.revision) {
      unchanged++;
      continue;
    }

    const data = recipePageData(recipe, sourceBook, book, resolvers, i * 100000);

    if (existing) {
      const update = foundry.utils.deepClone(data);
      update._id = existing.id;
      updates.push(update);
    } else {
      creates.push(data);
    }
  }

  if (updates.length) {
    await book.updateEmbeddedDocuments("JournalEntryPage", updates);
    updated += updates.length;
  }

  if (creates.length) {
    await book.createEmbeddedDocuments("JournalEntryPage", creates, { keepId: true });
    created += creates.length;
  }

  console.log(`[${MODULE_ID}] Recipe-book sync complete.`, {
    created,
    updated,
    unchanged,
    book: sourceBook.name
  });

  return { created, updated, unchanged, skipped: false };
}

async function syncAll({ notify = true } = {}) {
  if (!game.user?.isGM) {
    if (notify) ui.notifications.warn("Kor Sirok Alchemy synchronization requires a GM.");
    return;
  }

  try {
    const pack = await ensureItemPack();
    const folders = await syncFolders(pack);
    const items = await syncItems({ pack, folderMap: folders.byKey });
    const herbarium = await syncHerbariumSources({ pack, folderMap: folders.byKey });
    const kctg = await syncKctgSources({ pack, folderMap: folders.byKey });
    const recipes = await syncRecipeBook();

    if (notify) {
      const recipeText = recipes.skipped
        ? "recipes skipped (Mastercrafted inactive)"
        : `${recipes.created} recipes created, ${recipes.updated} updated, ${recipes.unchanged} unchanged`;

      const herbariumText =
        `${herbarium.created} Herbarium imported, ` +
        `${herbarium.metadataUpdated} metadata updated, ` +
        `${herbarium.unchanged} unchanged` +
        (herbarium.missing ? `, ${herbarium.missing} source missing` : "");

      const kctgText =
        `${kctg.created} KCTG imported, ` +
        `${kctg.refreshed} refreshed, ` +
        `${kctg.metadataUpdated} metadata updated, ` +
        `${kctg.unchanged} unchanged` +
        (kctg.missing ? `, ${kctg.missing} source missing` : "") +
        (kctg.replacedForTypeChange ? `, ${kctg.replacedForTypeChange} type-replaced` : "");

      ui.notifications.info(
        `Kor Sirok Alchemy synced: ` +
        `${folders.created} folders created, ${folders.updated} updated; ` +
        `${items.created} native items created, ${items.updated} updated, ${items.unchanged} unchanged; ` +
        `${herbariumText}; ${kctgText}; ${recipeText}.`
      );
    }

    return { folders, items, herbarium, kctg, recipes };
  } catch (error) {
    console.error(`[${MODULE_ID}] Synchronization failed.`, error);
    if (notify) ui.notifications.error(`Kor Sirok Alchemy sync failed: ${error.message}`);
    throw error;
  }
}

Hooks.once("ready", async () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      sync: syncAll,
      syncFolders,
      syncItems,
      syncHerbariumSources,
      syncKctgSources,
      syncRecipeBook
    };
  }

  const activeGM = game.users?.activeGM;
  if (!game.user?.isGM) return;
  if (activeGM && activeGM.id !== game.user.id) return;

  await syncAll({ notify: true });
});
