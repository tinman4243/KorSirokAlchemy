const MODULE_ID = "kor-sirok-alchemy";
const ITEM_PACK_ID = "world.kor-sirok-alchemy";
const GATHERING_PACK_ID = "world.kor-sirok-gathering";
const GATHERING_CONFIG_SOURCE = "data/gathering/config.json";
const GATHER_SESSION_TTL_MS = 30 * 60 * 1000;

let moduleSocket = null;
let gatheringConfig = null;

// Sessions live only on the GM client that approved the regional/local environment.
// The player is sent back the GM user id and later resolves the session on that same client.
const gmGatherSessions = new Map();

function modulePath(relative) {
  return `modules/${MODULE_ID}/${relative}`;
}

async function loadGatheringConfig() {
  if (gatheringConfig) return gatheringConfig;

  const response = await fetch(modulePath(GATHERING_CONFIG_SOURCE), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${GATHERING_CONFIG_SOURCE}: HTTP ${response.status}`);
  }

  gatheringConfig = await response.json();
  return gatheringConfig;
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function actorFromApplication(application) {
  const candidates = [
    application?.document,
    application?.actor,
    application?.object
  ];

  return candidates.find(document => document?.documentName === "Actor") ?? null;
}

function isGatheringActor(actor) {
  return Boolean(
    actor &&
    actor.documentName === "Actor" &&
    actor.type === "character" &&
    actor.isOwner
  );
}

function truthyFormValue(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function activeGmAvailable() {
  return Boolean(game.users?.find(user => user.active && user.isGM));
}

async function gatheringCatalog({ discipline = null } = {}) {
  const pack = game.packs.get(GATHERING_PACK_ID);
  if (!pack) {
    throw new Error(
      `Could not find gathering-table pack "${GATHERING_PACK_ID}". ` +
      `Run the Kor Sirok synchronization first.`
    );
  }

  const tables = await pack.getDocuments();
  const zones = new Map();

  for (const table of tables) {
    const flags = table.flags?.[MODULE_ID];
    if (flags?.kind !== "gathering-table") continue;
    if (discipline && flags.discipline !== discipline) continue;

    const zone = flags.zone;
    if (!zone?.id || !flags.focus || !flags.tier) continue;

    let zoneEntry = zones.get(zone.id);
    if (!zoneEntry) {
      zoneEntry = {
        id: zone.id,
        number: zone.number,
        name: zone.name,
        discipline: flags.discipline,
        focuses: new Map()
      };
      zones.set(zone.id, zoneEntry);
    }

    let focusEntry = zoneEntry.focuses.get(flags.focus);
    if (!focusEntry) {
      focusEntry = {
        name: flags.focus,
        tables: new Map()
      };
      zoneEntry.focuses.set(flags.focus, focusEntry);
    }

    focusEntry.tables.set(flags.tier, table);
  }

  return { pack, zones };
}

function sortedZones(zones) {
  return [...zones.values()].sort((a, b) => {
    const an = Number(a.number ?? Number.MAX_SAFE_INTEGER);
    const bn = Number(b.number ?? Number.MAX_SAFE_INTEGER);
    return an - bn || String(a.name).localeCompare(String(b.name));
  });
}

function sortedFocusNames(zone) {
  return [...zone.focuses.keys()].sort((a, b) => a.localeCompare(b));
}

async function chooseGatherType() {
  const config = await loadGatheringConfig();
  const botanical = config.generalGathering?.disciplines?.["botanical-fungal"];

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Gather Resources" },
    position: { width: 430 },
    content: `
      <p>What kind of resource gathering would you like to undertake?</p>
      <fieldset style="display:grid;gap:.5rem">
        <label style="display:flex;align-items:center;gap:.5rem">
          <input type="radio" name="gatherType" value="botanical-fungal" checked>
          <i class="${escapeHtml(botanical?.icon ?? "fa-solid fa-seedling")}"></i>
          <strong>Plants &amp; Fungi</strong>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;opacity:.55">
          <input type="radio" name="gatherType" value="fishing" disabled>
          <i class="fa-solid fa-fish"></i>
          Fishing <em>(coming soon)</em>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;opacity:.55">
          <input type="radio" name="gatherType" value="hunting" disabled>
          <i class="fa-solid fa-paw"></i>
          Hunting &amp; Trapping <em>(coming soon)</em>
        </label>
        <label style="display:flex;align-items:center;gap:.5rem;opacity:.55">
          <input type="radio" name="gatherType" value="prospecting" disabled>
          <i class="fa-solid fa-gem"></i>
          Prospecting for Rocks &amp; Minerals <em>(coming soon)</em>
        </label>
      </fieldset>
    `,
    ok: {
      label: "Continue",
      icon: "fa-solid fa-arrow-right"
    },
    rejectClose: false,
    modal: true
  });

  return result?.gatherType ?? null;
}

async function chooseGatherEnvironmentAsGm(payload) {
  if (!game.user?.isGM) {
    throw new Error("Gather-environment selection must execute on a GM client.");
  }

  const { actorUuid, userId, discipline } = payload ?? {};
  const actor = await fromUuid(actorUuid);
  const requestingUser = game.users.get(userId);

  if (!actor || actor.documentName !== "Actor") {
    throw new Error("The gathering Actor could not be resolved on the GM client.");
  }
  if (!requestingUser?.active) {
    throw new Error("The requesting player is no longer connected.");
  }
  if (!actor.testUserPermission(requestingUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
    throw new Error(`${requestingUser.name} does not own ${actor.name}.`);
  }

  const { zones } = await gatheringCatalog({ discipline });
  const availableZones = sortedZones(zones);
  if (!availableZones.length) {
    throw new Error(`No gathering regions exist for discipline "${discipline}".`);
  }

  const zoneOptions = availableZones.map(zone => {
    const label = `Zone ${escapeHtml(zone.number)} — ${escapeHtml(zone.name)}`;
    return `<option value="${escapeHtml(zone.id)}">${label}</option>`;
  }).join("");

  const regionChoice = await foundry.applications.api.DialogV2.input({
    window: { title: `Gathering Region — ${actor.name}` },
    position: { width: 470 },
    content: `
      <p><strong>${escapeHtml(requestingUser.name)}</strong> is beginning a gathering attempt with
      <strong>${escapeHtml(actor.name)}</strong>.</p>
      <p>Which regional gathering zone is the party currently in?</p>
      <select name="zoneId" style="width:100%">${zoneOptions}</select>
    `,
    ok: {
      label: "Choose Region",
      icon: "fa-solid fa-map-location-dot"
    },
    rejectClose: false,
    modal: true
  });

  if (!regionChoice?.zoneId) return null;

  const zone = zones.get(regionChoice.zoneId);
  if (!zone) throw new Error("The selected gathering region no longer exists.");

  const focusNames = sortedFocusNames(zone);
  if (!focusNames.length) {
    throw new Error(`No ecological gathering focuses exist for ${zone.name}.`);
  }

  const focusRows = focusNames.map((focus, index) => {
    const tiers = [...zone.focuses.get(focus).tables.keys()]
      .filter(tier => ["Common", "Uncommon", "Rare"].includes(tier));
    const tierText = tiers.length ? tiers.join(", ") : "No active pools";

    return `
      <label style="display:grid;grid-template-columns:auto 1fr;gap:.15rem .55rem;align-items:start;padding:.25rem 0">
        <input type="checkbox" name="focus${index}" value="true">
        <span><strong>${escapeHtml(focus)}</strong><br>
        <small style="opacity:.7">Available pools: ${escapeHtml(tierText)}</small></span>
      </label>`;
  }).join("");

  const localChoice = await foundry.applications.api.DialogV2.input({
    window: { title: `Immediate Surroundings — ${zone.name}` },
    position: { width: 520 },
    content: `
      <p>Which ecological environments are immediately accessible from the party's current location?</p>
      <p><small>Only the checked choices will be offered to the player for this gathering activity.</small></p>
      <fieldset style="display:grid;gap:.2rem">${focusRows}</fieldset>
    `,
    ok: {
      label: "Offer These Environments",
      icon: "fa-solid fa-check"
    },
    rejectClose: false,
    modal: true
  });

  if (!localChoice) return null;

  const selectedFocuses = focusNames.filter((focus, index) => truthyFormValue(localChoice[`focus${index}`]));
  if (!selectedFocuses.length) {
    ui.notifications.warn("Kor Sirok: Select at least one locally available gathering environment.");
    return null;
  }

  const sessionId = foundry.utils.randomID(20);
  gmGatherSessions.set(sessionId, {
    actorUuid,
    userId,
    discipline,
    zoneId: zone.id,
    zoneNumber: zone.number,
    zoneName: zone.name,
    availableFocuses: selectedFocuses,
    createdAt: Date.now()
  });

  return {
    sessionId,
    gmUserId: game.user.id,
    zone: {
      id: zone.id,
      number: zone.number,
      name: zone.name
    },
    focuses: selectedFocuses
  };
}

async function chooseGatherHours(environment) {
  const config = await loadGatheringConfig();
  const maxHours = Number(config.generalGathering?.maxHours ?? 3);
  const focuses = environment.focuses ?? [];

  const options = [
    `<option value="">— Don't gather —</option>`,
    ...focuses.map(focus => `<option value="${escapeHtml(focus)}">${escapeHtml(focus)}</option>`)
  ].join("");

  const rows = Array.from({ length: maxHours }, (_, index) => `
    <div style="display:grid;grid-template-columns:5.5rem 1fr;gap:.5rem;align-items:center;margin:.4rem 0">
      <label for="slot${index + 1}"><strong>Hour ${index + 1}</strong></label>
      <select id="slot${index + 1}" name="slot${index + 1}" style="width:100%">${options}</select>
    </div>
  `).join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Choose Your Gathering Focus" },
    position: { width: 520 },
    content: `
      <p>The GM has made these environments available in <strong>${escapeHtml(environment.zone.name)}</strong>.</p>
      <p>Allocate up to <strong>${maxHours} hours</strong>. You may work the same environment more than once.</p>
      ${rows}
    `,
    ok: {
      label: "Begin Gathering",
      icon: "fa-solid fa-seedling"
    },
    rejectClose: false,
    modal: true
  });

  if (!result) return null;

  return Array.from({ length: maxHours }, (_, index) => result[`slot${index + 1}`])
    .filter(value => typeof value === "string" && value.length);
}

async function cancelGatherSession(gmUserId, sessionId) {
  if (!moduleSocket || !gmUserId || !sessionId) return;
  try {
    await moduleSocket.executeAsUser("cancelGatherSessionAsGM", gmUserId, { sessionId });
  } catch (error) {
    console.warn(`[${MODULE_ID}] Could not cancel abandoned gathering session ${sessionId}.`, error);
  }
}

function cancelGatherSessionAsGm({ sessionId } = {}) {
  if (!game.user?.isGM) return false;
  return gmGatherSessions.delete(sessionId);
}

function drawPlanForTotal(total, ladder) {
  const ordered = [...(ladder ?? [])].sort((a, b) => Number(b.min) - Number(a.min));
  const rung = ordered.find(entry => total >= Number(entry.min));
  return foundry.utils.deepClone(rung?.draws ?? { Common: 0, Uncommon: 0, Rare: 0 });
}

async function rollTableManyWithoutDrawing(table, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    // RollTable#roll identifies a random result without formalizing a draw, so the
    // managed compendium can remain locked and the table never needs to be reset.
    const draw = await table.roll({ recursive: false });
    for (const result of draw?.results ?? []) results.push(result);
  }
  return results;
}

async function sourceItemFromResult(result) {
  const uuid = result?.documentUuid;
  if (uuid) {
    const document = await fromUuid(uuid);
    if (document?.documentName === "Item") return document;
  }

  const targetItemId = result?.flags?.[MODULE_ID]?.targetItemId;
  if (!targetItemId) return null;
  return game.packs.get(ITEM_PACK_ID)?.getDocument(targetItemId) ?? null;
}

function incrementItemMap(map, item, quantity = 1) {
  const current = map.get(item.id);
  if (current) {
    current.quantity += quantity;
  } else {
    map.set(item.id, { item, quantity });
  }
}

function findActorInventoryMatch(actor, sourceItem) {
  const exactSource = actor.items.filter(item =>
    item.flags?.[MODULE_ID]?.gatheredSource?.itemId === sourceItem.id
  );
  if (exactSource.length === 1) return exactSource[0];

  const compendiumSource = actor.items.filter(item => item._stats?.compendiumSource === sourceItem.uuid);
  if (compendiumSource.length === 1) return compendiumSource[0];

  const sameNameAndType = actor.items.filter(item =>
    item.name === sourceItem.name && item.type === sourceItem.type
  );
  return sameNameAndType.length === 1 ? sameNameAndType[0] : null;
}

async function awardGatheredItems(actor, aggregate) {
  const updates = [];
  const creates = [];

  for (const { item: sourceItem, quantity } of aggregate.values()) {
    const existing = findActorInventoryMatch(actor, sourceItem);

    if (existing) {
      const currentQuantity = Number(existing.system?.quantity ?? 0);
      updates.push({
        _id: existing.id,
        "system.quantity": currentQuantity + quantity,
        [`flags.${MODULE_ID}.gatheredSource`]: {
          pack: ITEM_PACK_ID,
          itemId: sourceItem.id,
          uuid: sourceItem.uuid
        }
      });
      continue;
    }

    const data = sourceItem.toObject();
    delete data._id;
    delete data.folder;
    delete data._stats;
    delete data.ownership;

    data.system ??= {};
    data.system.quantity = quantity;
    data.flags = foundry.utils.deepClone(data.flags ?? {});
    data.flags[MODULE_ID] = {
      ...(data.flags[MODULE_ID] ?? {}),
      gatheredSource: {
        pack: ITEM_PACK_ID,
        itemId: sourceItem.id,
        uuid: sourceItem.uuid
      }
    };

    creates.push(data);
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (creates.length) await actor.createEmbeddedDocuments("Item", creates);

  return { updated: updates.length, created: creates.length };
}

function formatHourHaul(hour) {
  const items = [...hour.haul.values()]
    .sort((a, b) => a.item.name.localeCompare(b.item.name));

  if (!items.length) {
    return `<em>No useful materials found.</em>`;
  }

  return items.map(({ item, quantity }) =>
    `${escapeHtml(item.name)} ×${quantity}`
  ).join(", ");
}

async function createGatheringChatMessage(actor, zoneName, hourResults, totalHours) {
  const hourBlocks = hourResults.map((hour, index) => `
    <li style="margin:.35rem 0">
      <strong>Hour ${index + 1}: ${escapeHtml(hour.focus)}</strong>
      — Herbalism ${escapeHtml(hour.total)}<br>
      ${formatHourHaul(hour)}
    </li>
  `).join("");

  const content = `
    <div class="kor-sirok-gathering-result">
      <h3><i class="fa-solid fa-seedling"></i> Gathering Results</h3>
      <p><strong>${escapeHtml(actor.name)}</strong> spends ${totalHours} hour${totalHours === 1 ? "" : "s"}
      gathering in <strong>${escapeHtml(zoneName)}</strong>.</p>
      <ol>${hourBlocks}</ol>
    </div>
  `;

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

async function resolveGeneralGatherAsGm(payload) {
  if (!game.user?.isGM) {
    throw new Error("Gather resolution must execute on a GM client.");
  }

  const { sessionId, actorUuid, userId, slots } = payload ?? {};
  const session = gmGatherSessions.get(sessionId);
  if (!session) {
    throw new Error("This gathering session is no longer valid. Start a new gathering attempt.");
  }

  try {
    if ((Date.now() - session.createdAt) > GATHER_SESSION_TTL_MS) {
      throw new Error("This gathering session expired. Start a new gathering attempt.");
    }
    if (session.actorUuid !== actorUuid || session.userId !== userId) {
      throw new Error("Gathering session validation failed.");
    }

    const actor = await fromUuid(actorUuid);
    const requestingUser = game.users.get(userId);
    if (!actor || actor.documentName !== "Actor") throw new Error("Gathering Actor could not be resolved.");
    if (!requestingUser?.active) throw new Error("The requesting player is no longer connected.");
    if (!actor.testUserPermission(requestingUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
      throw new Error(`${requestingUser.name} does not own ${actor.name}.`);
    }

    const config = await loadGatheringConfig();
    const general = config.generalGathering ?? {};
    const maxHours = Number(general.maxHours ?? 3);

    if (!Array.isArray(slots) || slots.length < 1 || slots.length > maxHours) {
      throw new Error(`Gathering must contain between 1 and ${maxHours} hour slots.`);
    }

    const allowedFocuses = new Set(session.availableFocuses);
    for (const slot of slots) {
      if (!allowedFocuses.has(slot.focus)) {
        throw new Error(`"${slot.focus}" was not approved as a locally available environment.`);
      }
      if (!Number.isFinite(Number(slot.total))) {
        throw new Error(`Invalid Herbalism check total for ${slot.focus}.`);
      }
    }

    const { zones } = await gatheringCatalog({ discipline: session.discipline });
    const zone = zones.get(session.zoneId);
    if (!zone) throw new Error("The approved gathering region no longer exists.");

    const overall = new Map();
    const hourResults = [];

    for (const slot of slots) {
      const focus = zone.focuses.get(slot.focus);
      if (!focus) throw new Error(`Gathering focus "${slot.focus}" no longer exists in ${zone.name}.`);

      const total = Number(slot.total);
      const drawPlan = drawPlanForTotal(total, general.ladder);
      const haul = new Map();

      for (const tier of ["Common", "Uncommon", "Rare"]) {
        const requestedDraws = Math.max(0, Math.floor(Number(drawPlan[tier] ?? 0)));
        if (!requestedDraws) continue;

        const table = focus.tables.get(tier);
        // Missing pools simply contribute nothing. This is intentional: a barren or
        // fantastical environment may not have a Common table at all.
        if (!table) continue;

        const results = await rollTableManyWithoutDrawing(table, requestedDraws);
        for (const result of results) {
          const sourceItem = await sourceItemFromResult(result);
          if (!sourceItem) {
            console.warn(`[${MODULE_ID}] Could not resolve gathering TableResult to an Item.`, result);
            continue;
          }

          incrementItemMap(haul, sourceItem, 1);
          incrementItemMap(overall, sourceItem, 1);
        }
      }

      hourResults.push({ focus: slot.focus, total, haul });
    }

    await awardGatheredItems(actor, overall);

    const minutesPerHour = Number(general.minutesPerHour ?? 60);
    const seconds = slots.length * minutesPerHour * 60;
    await game.time.advance(seconds, {
      [MODULE_ID]: {
        reason: "general-gathering",
        actorUuid,
        hours: slots.length
      }
    });

    await createGatheringChatMessage(actor, zone.name, hourResults, slots.length);

    return {
      ok: true,
      hours: slots.length,
      zone: { id: zone.id, name: zone.name, number: zone.number },
      results: hourResults.map(hour => ({
        focus: hour.focus,
        total: hour.total,
        haul: [...hour.haul.values()].map(({ item, quantity }) => ({
          itemId: item.id,
          name: item.name,
          quantity
        }))
      }))
    };
  } finally {
    gmGatherSessions.delete(sessionId);
  }
}

async function rollGatheringChecks(actor, focuses, discipline) {
  const config = await loadGatheringConfig();
  const disciplineConfig = config.generalGathering?.disciplines?.[discipline];
  const toolId = disciplineConfig?.toolId ?? "herb";
  const toolLabel = disciplineConfig?.toolLabel ?? "Herbalism Kit";
  const slots = [];

  for (let index = 0; index < focuses.length; index++) {
    const focus = focuses[index];
    ui.notifications.info(`Gathering hour ${index + 1}: ${focus}. Roll ${toolLabel}.`);

    const rolls = await actor.rollToolCheck({ tool: toolId });
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    if (!roll) return null;

    slots.push({ focus, total: Number(roll.total) });
  }

  return slots;
}

async function startGatherResources(actorOrUuid = null) {
  try {
    const actor = typeof actorOrUuid === "string"
      ? await fromUuid(actorOrUuid)
      : actorOrUuid;

    if (!isGatheringActor(actor)) {
      ui.notifications.warn("Gather Resources requires a player-owned character Actor.");
      return;
    }

    if (!moduleSocket) initializeSocketlib();
    if (!moduleSocket) {
      const socketModule = game.modules.get("socketlib");
      const detail = socketModule?.active
        ? "SocketLib is active, but its API could not be registered."
        : "SocketLib is not active.";
      ui.notifications.error(`Kor Sirok gathering could not initialize SocketLib. ${detail}`);
      return;
    }

    if (!activeGmAvailable()) {
      ui.notifications.warn("A GM must be connected to approve the local gathering environment.");
      return;
    }

    const gatherType = await chooseGatherType();
    if (!gatherType) return;
    if (gatherType !== "botanical-fungal") {
      ui.notifications.info("That gathering discipline is not implemented yet.");
      return;
    }

    const environment = await moduleSocket.executeAsGM("chooseGatherEnvironmentAsGM", {
      actorUuid: actor.uuid,
      userId: game.user.id,
      discipline: gatherType
    });

    if (!environment?.sessionId) return;

    const focuses = await chooseGatherHours(environment);
    if (!focuses?.length) {
      await cancelGatherSession(environment.gmUserId, environment.sessionId);
      if (focuses && !focuses.length) ui.notifications.info("No gathering time was selected.");
      return;
    }

    const slots = await rollGatheringChecks(actor, focuses, gatherType);
    if (!slots) {
      await cancelGatherSession(environment.gmUserId, environment.sessionId);
      ui.notifications.info("Gathering cancelled before all checks were completed.");
      return;
    }

    const resolution = await moduleSocket.executeAsUser(
      "resolveGeneralGatherAsGM",
      environment.gmUserId,
      {
        sessionId: environment.sessionId,
        actorUuid: actor.uuid,
        userId: game.user.id,
        slots
      }
    );

    if (resolution?.ok) {
      ui.notifications.info(
        `${actor.name} completed ${resolution.hours} hour${resolution.hours === 1 ? "" : "s"} of gathering.`
      );
    }
  } catch (error) {
    console.error(`[${MODULE_ID}] Gathering workflow failed.`, error);
    ui.notifications.error(`Kor Sirok gathering failed: ${error.message}`);
  }
}

function addGatherResourcesHeaderControl(application, controls) {
  const actor = actorFromApplication(application);
  if (!isGatheringActor(actor)) return;

  // This generic hook fires for classes in the ApplicationV2 inheritance chain.
  // Guard by action id so the control is only present once.
  if (controls.some(control => control.action === "kor-sirok-gather-resources")) return;

  controls.push({
    action: "kor-sirok-gather-resources",
    label: "Gather Resources",
    icon: "fa-solid fa-seedling",
    onClick: () => startGatherResources(actor)
  });
}

Hooks.on("getHeaderControlsApplicationV2", addGatherResourcesHeaderControl);

function initializeSocketlib() {
  if (moduleSocket) return moduleSocket;

  const socketApi = globalThis.socketlib;
  if (!socketApi?.registerModule) return null;

  moduleSocket = socketApi.registerModule(MODULE_ID);
  moduleSocket.register("chooseGatherEnvironmentAsGM", chooseGatherEnvironmentAsGm);
  moduleSocket.register("resolveGeneralGatherAsGM", resolveGeneralGatherAsGm);
  moduleSocket.register("cancelGatherSessionAsGM", cancelGatherSessionAsGm);

  console.log(`[${MODULE_ID}] SocketLib integration registered.`);
  return moduleSocket;
}

Hooks.once("socketlib.ready", initializeSocketlib);

Hooks.once("ready", async () => {
  // A dependent module can occasionally load after SocketLib has already fired its
  // one-time ready hook. Recover by registering lazily once Foundry itself is ready.
  initializeSocketlib();
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  module.api ??= {};
  Object.assign(module.api, {
    startGatherResources,
    gatheringCatalog
  });

  // Prime the config so malformed data is discovered at world load instead of the
  // first time a player tries to gather.
  try {
    await loadGatheringConfig();
  } catch (error) {
    console.error(`[${MODULE_ID}] Gathering configuration failed to load.`, error);
    if (game.user?.isGM) {
      ui.notifications.error(`Kor Sirok gathering configuration failed: ${error.message}`);
    }
  }
});
