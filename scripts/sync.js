const MODULE_ID = "kor-sirok-alchemy";
const ITEM_PACK_ID = "world.kor-sirok-alchemy";
const ITEM_PACK_NAME = "kor-sirok-alchemy";
const ITEM_PACK_LABEL = "Kor Sirok — Alchemy";
const KCTG_PACK_ID = "kctg-5e.kctg-dnd5e";
const RECIPE_SOURCE = "data/recipes/introduction-to-alchemy.json";
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

function materialItem(source, sourceFile) {
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

function consumableItem(source, sourceFile) {
  const description =
    `<p>${source.description}</p>` +
    `<p><strong>Effect.</strong> ${source.effect}</p>`;

  return {
    _id: source.id,
    name: source.name,
    type: "consumable",
    img: source.img,
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

function toFoundryItem(source, sourceFile) {
  return source.kind === "consumable"
    ? consumableItem(source, sourceFile)
    : materialItem(source, sourceFile);
}

async function syncItems() {
  const pack = await ensureItemPack();
  const sources = [];

  for (const sourceFile of ITEM_SOURCES) {
    const payload = await loadJson(sourceFile);
    for (const item of payload.items ?? []) {
      sources.push({ sourceFile, item });
    }
  }

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  const index = await pack.getIndex({
    fields: [`flags.${MODULE_ID}.revision`, `flags.${MODULE_ID}.source`]
  });

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    for (const { sourceFile, item: sourceItem } of sources) {
      const indexed = index.get(sourceItem.id);
      const existingRevision = indexed?.flags?.[MODULE_ID]?.revision;
      const existingSource = indexed?.flags?.[MODULE_ID]?.source;

      if (
        indexed &&
        existingRevision === sourceItem.revision &&
        existingSource === sourceFile
      ) {
        unchanged++;
        continue;
      }

      const data = toFoundryItem(sourceItem, sourceFile);
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

  const [alchemyIndex, kctgIndex] = await Promise.all([
    alchemyPack.getIndex({ fields: ["img"] }),
    kctg.getIndex({ fields: ["img"] })
  ]);

  const alchemyByName = uniqueNameMap(alchemyIndex, ITEM_PACK_ID);
  const kctgByName = uniqueNameMap(kctgIndex, KCTG_PACK_ID);
  const worldByName = uniqueNameMap(game.items.contents, "world Items");

  return {
    alchemy(name) {
      const entry = alchemyByName.get(name);
      if (!entry) {
        throw new Error(`Could not uniquely resolve alchemy item "${name}" in ${ITEM_PACK_ID}.`);
      }

      return {
        uuid: `Compendium.${ITEM_PACK_ID}.Item.${entry._id}`,
        name: entry.name,
        img: entry.img
      };
    },

    kctg(name) {
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

    world(name) {
      const entry = worldByName.get(name);
      if (!entry) {
        throw new Error(`Could not uniquely resolve world Item "${name}".`);
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

  const doc = resolver(option.name);

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
    const items = await syncItems();
    const recipes = await syncRecipeBook();

    if (notify) {
      const recipeText = recipes.skipped
        ? "recipes skipped (Mastercrafted inactive)"
        : `${recipes.created} recipes created, ${recipes.updated} updated, ${recipes.unchanged} unchanged`;

      ui.notifications.info(
        `Kor Sirok Alchemy synced: ` +
        `${items.created} items created, ${items.updated} updated, ${items.unchanged} unchanged; ` +
        `${recipeText}.`
      );
    }

    return { items, recipes };
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
      syncItems,
      syncRecipeBook
    };
  }

  const activeGM = game.users?.activeGM;
  if (!game.user?.isGM) return;
  if (activeGM && activeGM.id !== game.user.id) return;

  await syncAll({ notify: true });
});
