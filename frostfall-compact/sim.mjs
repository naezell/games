import { built, newConstruction, reservedForPlan, advanceConstruction, constructionIsValid } from "./construction.mjs";
import { createMarket, marketIsValid, marketDay, marketAdvance, shipAccounts, marketTargets, marketNeed,
  packGoods, contractAction, accountAction, closeMarketJob, BAY } from "./market.mjs";

export const GOODS = ["logs", "boards", "lumber", "meat", "steaks", "trays"];
export const NAMES = { logs: "logs", boards: "boards", lumber: "finished lumber", meat: "meat", steaks: "steaks", trays: "steak trays" };
export const PRICES = { boards: 4, lumber: 12, steaks: 5, trays: 20 };
export const SPOTS = {
  forest: { x: -8, z: -8 },
  boars: { x: 8, z: -8 },
  sawIn: { x: -8, z: -2 },
  sawOut: { x: -3, z: -2 },
  grillIn: { x: 3, z: -2 },
  grillOut: { x: 8, z: -2 },
  sell: { x: 1, z: 6 },
  build: { x: -8, z: 7 },
};
export const UPGRADES = {
  pack: { name: "Backpack", values: [6, 9, 12, 16], prices: [18, 45, 90], unit: "items" },
  saw: { name: "Sawmill speed", values: [4, 3, 2, 1.25], prices: [20, 50, 100], unit: "sec/item" },
  grill: { name: "Grill speed", values: [4, 3, 2, 1.25], prices: [20, 50, 100], unit: "sec/item" },
  storage: { name: "Station storage", values: [5, 8, 12, 18], prices: [25, 60, 120], unit: "items/buffer" },
};
export const LINES = {
  saw: { raw: "logs", source: "forest", goods: ["boards", "lumber"], recipes: {
    boards: { input: 1, time: 1, name: "Quick boards" },
    lumber: { input: 2, time: 2.75, name: "Finished lumber" },
  } },
  grill: { raw: "meat", source: "boars", goods: ["steaks", "trays"], recipes: {
    steaks: { input: 1, time: 1, name: "Single steaks" },
    trays: { input: 3, time: 3.5, name: "Steak trays" },
  } },
};
export const EQUIPMENT = {
  machine: { name: "Second machine", price: 70, effect: "Run two jobs at once" },
  rack: { name: "Loading rack", price: 40, effect: "Hold 4 more raw goods" },
  bench: { name: "Packing bench", price: 45, effect: "Stack 4 more finished goods" },
};
export const CART_PRICE = 55;
export const CART_SLOTS = 5;
export const CART_RACKS = {
  mixed: { name: "Mixed bed", slots: CART_SLOTS, cash: 0 },
  timber: { name: "Timber rack", slots: 8, cash: 38, goods: ["logs", "boards", "lumber"] },
  food: { name: "Food rack", slots: 8, cash: 38, goods: ["meat", "steaks", "trays"] },
};
export const BIN_COST = { cash: 54, lumber: 2 };
export const REBUILDS = {
  fast: { name: "Quick batch", cash: 145, lumber: 5, effect: "Quick recipes run 40% faster" },
  finish: { name: "Premium workshop", cash: 165, lumber: 5, effect: "Premium recipes run 40% faster" },
  freight: { name: "Easy loading", cash: 150, lumber: 5, effect: "+8 input and output slots · feeds from staging" },
};
export const TARGETS = [0, 4, 8, 12, 16];
export const ROUTE_PRIORITIES = { supply: "Supply first", pickup: "Pickup first" };
export const FUEL_CAP = 16;
const stationExtras = () => ({ staging: 0, bin: false, layout: null, target: 0, manual: false });
const routeDefaults = () => ({ line: "saw", min: 2, priority: "supply", reserve: false });
export const JOBS = {
  lumber: "Supply sawmill", meat: "Supply grill", haul: "Haul finished goods",
  clear: "Clear full outputs first", split: "Split gathering", route: "Run a route",
};
export const BULK = { boards: 8, steaks: 8, reward: 92 };
const stationKeys = Object.keys(LINES);
const saleGoods = Object.keys(PRICES);
const bulkGoods = ["boards", "steaks"];
const empty = () => Object.fromEntries(GOODS.map(k => [k, 0]));
const newOrder = () => ({ boards: 0, steaks: 0 });
export const count = bag => GOODS.reduce((total, k) => total + bag[k], 0);
export const near = (p, q, r = 1.65) => Math.hypot(p.x - q.x, p.z - q.z) < r;
export const stationAt = p => stationKeys.find(key => near(p, SPOTS[key + "In"]) || near(p, SPOTS[key + "Out"]));
const motions = new WeakMap();
export const activity = person => motions.get(person);
function animate(person, kind, good, duration = .65) {
  motions.set(person, { kind, good, duration, left: duration });
}

export function createState() {
  return {
    version: 4,
    cash: 0,
    levels: { pack: 0, saw: 0, grill: 0, storage: 0 },
    player: { x: 0, z: 7, bag: empty(), gather: 0, sell: 0 },
    stations: Object.fromEntries(stationKeys.map(key => [key, {
      input: 0, output: 0, premium: 0, recipe: LINES[key].goods[0], equipment: null, jobs: [], ...stationExtras(),
    }])),
    workers: [],
    stash: empty(),
    sources: { forest: { remaining: 6, regrow: 0 }, boars: { remaining: 6, regrow: 0 } },
    sold: 0,
    cart: false,
    cartRack: "mixed",
    ownedRacks: { timber: false, food: false },
    order: null,
    market: createMarket(),
    timberSorted: 0,
    fuel: 0,
    doubles: false,
    construction: newConstruction(),
    plan: null,
  };
}

export const packCapacity = s => UPGRADES.pack.values[s.levels.pack];
export const rackSlots = (s, rack = s.cartRack) => CART_RACKS[rack].slots + (built(s, "cart") ? 3 : 0);
export const capacity = s => packCapacity(s) + (s.cart ? rackSlots(s) : 0);
export const stashCapacity = s => built(s, "store") ? 32 : 16;
export const helperLimit = s => built(s, "dispatch") ? 3 : 2;
export const helperPrice = s => [35, 80, 125][s.workers.length];
export const spotPrice = (s, good) => PRICES[good] + (built(s, "exchange") ? (good === "lumber" || good === "trays" ? 3 : 1) : 0);
const sourceUpgrade = key => key === "forest" ? "yard" : "cold";
export const sourceCapacity = (s, key) => built(s, sourceUpgrade(key)) ? 9 : 6;
const siteExtension = (s, key) => built(s, key === "saw" ? "mill" : "kitchen");
const mixFits = (s, rack, bag) => {
  const { goods } = CART_RACKS[rack];
  const load = count(bag);
  return load <= packCapacity(s) + rackSlots(s, rack) &&
    (!goods || load - goods.reduce((n, k) => n + bag[k], 0) <= packCapacity(s));
};
export function roomFor(s, person, good) {
  const load = count(person.bag);
  if (person !== s.player) return 3 - load;
  const room = capacity(s) - load;
  const { goods } = CART_RACKS[s.cartRack];
  if (!goods || goods.includes(good)) return room;
  return Math.min(room, packCapacity(s) - load + goods.reduce((n, k) => n + person.bag[k], 0));
}
export function cartLoad(s) {
  const { bag } = s.player;
  const rackGoods = CART_RACKS[s.cartRack].goods ?? GOODS;
  return goodsList(bag, GOODS.filter(k => !rackGoods.includes(k)).concat(rackGoods)).slice(packCapacity(s));
}
const goodsList = (bag, keys) => keys.flatMap(k => Array(bag[k]).fill(k));

export const storage = s => UPGRADES.storage.values[s.levels.storage];
export const inputCount = (s, key) => s.stations[key].input + (key === "saw" ? s.timberSorted : 0);
const freight = (s, key) => s.stations[key].layout === "freight";
export const inputCapacity = (s, key) => storage(s) + (s.stations[key].equipment === "rack" ? 4 : 0) + (freight(s, key) ? 8 : 0);
export const outputCapacity = (s, key) => storage(s) + (s.stations[key].equipment === "bench" ? 4 : 0) + (freight(s, key) ? 8 : 0) + (siteExtension(s, key) ? 4 : 0);
export const stageCapacity = (s, key) => (s.stations[key].bin ? 12 : 4) + (freight(s, key) ? 4 : 0);
const inputRoom = (s, key) => inputCapacity(s, key) - inputCount(s, key);
export const outputCount = st => st.output + st.premium;
const slots = st => st.equipment === "machine" ? 2 : 1;
const outputRoom = (s, key) => outputCapacity(s, key) - outputCount(s.stations[key]) -
  s.stations[key].jobs.reduce((n, job) => n + job.units, 0);

export function onHand(s, good) {
  const field = stationKeys.find(key => LINES[key].goods.includes(good));
  const station = field ? s.stations[field] : null;
  const waiting = !station ? 0 : good === LINES[field].goods[0] ? station.output : station.premium;
  return s.player.bag[good] + s.stash[good] + waiting + (s.market.stock[good] ?? 0) +
    s.workers.reduce((n, w) => n + w.bag[good], 0);
}
function nextGood(s, key) {
  const st = s.stations[key], basic = LINES[key].goods[0];
  const scheduled = st.jobs.reduce((n, job) => n + (job.good === basic ? job.units : 0), 0);
  return onHand(s, basic) + scheduled < st.target ? basic : st.recipe;
}
export function recipeSeconds(s, key, good) {
  const st = s.stations[key], basic = good === LINES[key].goods[0];
  const accelerated = st.layout === (basic ? "fast" : "finish");
  return UPGRADES[key].values[s.levels[key]] * LINES[key].recipes[good].time * (accelerated ? .6 : 1) * (siteExtension(s, key) ? .8 : 1);
}
function batch(s, key) {
  const st = s.stations[key], good = nextGood(s, key);
  const recipe = LINES[key].recipes[good];
  const selected = key === "saw" && good === "lumber" ? Math.min(s.timberSorted, recipe.input) : 0;
  const boosted = key === "grill" && good === "trays" && s.doubles && s.fuel > 0 &&
    inputCapacity(s, key) >= 5 && outputRoom(s, key) >= 2;
  return { good, selected, raw: boosted ? 5 : recipe.input - selected, units: boosted ? 2 : 1,
    left: recipeSeconds(s, key, good) * (boosted ? 1.25 : 1 - .2 * selected) };
}
export function stationStatus(s, key) {
  const st = s.stations[key];
  if (st.jobs.length) return "Processing";
  if (outputRoom(s, key) <= 0) return "Output full";
  const next = batch(s, key);
  if (st.input < next.raw) return next.raw === 1 ? `Waiting for ${LINES[key].raw}` : `Needs ${next.raw} ${LINES[key].raw}`;
  return "Ready";
}

export function selectRecipe(s, key, recipe) {
  if (stationAt(s.player) !== key || !Object.hasOwn(LINES[key]?.recipes ?? {}, recipe)) return false;
  s.stations[key].recipe = recipe;
  return true;
}

export function install(s, key, part) {
  if (stationAt(s.player) !== key || !Object.hasOwn(EQUIPMENT, part)) return false;
  const st = s.stations[key], cost = EQUIPMENT[part].price;
  if (st.equipment || s.cash < cost) return false;
  s.cash -= cost;
  st.equipment = part;
  return true;
}

export const projectReady = (s, cost) => s.cash >= cost.cash && s.player.bag.lumber + s.stash.lumber >= cost.lumber;
function payProject(s, cost) {
  if (!projectReady(s, cost)) return false;
  const carried = Math.min(cost.lumber, s.player.bag.lumber);
  s.player.bag.lumber -= carried;
  s.stash.lumber -= cost.lumber - carried;
  s.cash -= cost.cash;
  return true;
}

export function buildProject(s, project, key) {
  if (project === "bay") {
    if (!near(s.player, SPOTS.sell) || s.market.bay || !payProject(s, BAY)) return false;
    s.market.bay = true;
    return true;
  }
  if (!stationKeys.includes(key) || stationAt(s.player) !== key) return false;
  const st = s.stations[key];
  if (project === "bin") {
    if (st.bin || !payProject(s, BIN_COST)) return false;
    st.bin = true;
    return true;
  }
  if (st.layout || !Object.hasOwn(REBUILDS, project) || !payProject(s, REBUILDS[project])) return false;
  st.layout = project;
  return true;
}

export const rackFits = (s, rack) => Object.hasOwn(CART_RACKS, rack) && mixFits(s, rack, s.player.bag);

export function cartRack(s, rack) {
  if (!s.cart || !near(s.player, SPOTS.build) || !rackFits(s, rack)) return false;
  if (rack !== "mixed" && !s.ownedRacks[rack]) {
    if (s.cash < CART_RACKS[rack].cash) return false;
    s.cash -= CART_RACKS[rack].cash;
    s.ownedRacks[rack] = true;
  }
  s.cartRack = rack;
  return true;
}

export function setWorkerRoute(s, index, field, value) {
  const w = s.workers[index];
  if (!w || !near(s.player, SPOTS.build)) return false;
  const values = { line: stationKeys, min: [1, 2, 3], priority: Object.keys(ROUTE_PRIORITIES), reserve: [true, false] };
  if (!Object.hasOwn(values, field) || !values[field].includes(value)) return false;
  w.route[field] = value;
  return true;
}

export function setStation(s, key, field, value) {
  if (!stationKeys.includes(key) || stationAt(s.player) !== key) return false;
  if (field === "target" && TARGETS.includes(value)) s.stations[key].target = value;
  else if (field === "manual" && typeof value === "boolean") s.stations[key].manual = value;
  else if (key === "grill" && field === "doubles" && typeof value === "boolean") s.doubles = value;
  else return false;
  return true;
}

export function sortTimber(s, amount) {
  if (stationAt(s.player) !== "saw" || !Number.isSafeInteger(amount)) return false;
  const st = s.stations.saw;
  const change = Math.max(-s.timberSorted, Math.min(st.input, amount));
  s.timberSorted += change;
  st.input -= change;
  return change !== 0;
}

function stagingToInput(s, key, amount) {
  const st = s.stations[key];
  const n = Math.min(st.staging, inputRoom(s, key), amount);
  st.staging -= n;
  st.input += n;
  return n;
}
function unload(s, person, key, bin = false) {
  const st = s.stations[key], raw = LINES[key].raw;
  const field = bin ? "staging" : "input";
  const n = Math.min(person.bag[raw], bin ? stageCapacity(s, key) - st.staging : inputRoom(s, key));
  if (!n) return 0;
  person.bag[raw] -= n;
  st[field] += n;
  animate(person, "load", raw);
  if (person !== s.player && !person.bag[raw]) person.nextLine = other(key);
  return n;
}
function pickup(s, person, key) {
  const st = s.stations[key];
  let loaded = 0;
  for (const [i, field] of ["output", "premium"].entries()) {
    const good = LINES[key].goods[i];
    const n = Math.min(st[field], roomFor(s, person, good));
    if (!n) continue;
    person.bag[good] += n;
    st[field] -= n;
    loaded += n;
    animate(person, "stack", good);
  }
  return loaded;
}
export const nextBatchNeeds = (s, key) => Math.max(0, batch(s, key).raw - s.stations[key].input);

export function handleLoad(s, key, action) {
  if (!stationKeys.includes(key)) return false;
  if (action === "pickup") return near(s.player, SPOTS[key + "Out"]) && pickup(s, s.player, key) > 0;
  if (!near(s.player, SPOTS[key + "In"])) return false;
  if (action === "unload") return unload(s, s.player, key) > 0;
  if (action === "stage") return unload(s, s.player, key, true) > 0;
  if (action === "queue") {
    if (!stagingToInput(s, key, nextBatchNeeds(s, key))) return false;
    animate(s.player, "load", LINES[key].raw);
    return true;
  }
  return false;
}

export function marketAction(s, action, id) {
  if (!near(s.player, SPOTS.sell)) return false;
  if (action === "accept") return contractAction(s, id);
  if (action === "account") return accountAction(s, id);
  if (action === "close") return closeMarketJob(s, id, Object.fromEntries(saleGoods.map(k => [k, spotPrice(s, k)])));
  if (action === "pack") {
    return packAtCounter(s, id, s.player, true);
  }
  if (action === "withdraw" && Object.hasOwn(s.market.stock, id)) {
    const n = Math.min(s.market.stock[id], roomFor(s, s.player, id));
    if (!n) return false;
    s.market.stock[id] -= n;
    s.player.bag[id] += n;
    s.market.autoSale = false;
    s.player.sell = 0;
    return true;
  }
  if (action === "autosale") {
    s.market.autoSale = !s.market.autoSale;
    s.player.sell = 0;
    return true;
  }
  if (action === "sell") {
    // A manual sale is intentional even when an order still needs these goods.
    const good = saleGoods.find(k => s.player.bag[k]);
    if (!good) return false;
    sellOne(s, s.player, good);
    return true;
  }
  return false;
}

export function purchase(s, key) {
  if (key === "cart") {
    if (s.cart || s.cash < CART_PRICE) return false;
    s.cash -= CART_PRICE;
    s.cart = true;
    return true;
  }
  if (key === "helper") {
    if (s.workers.length >= helperLimit(s)) return false;
    const price = helperPrice(s);
    if (s.cash < price) return false;
    s.cash -= price;
    s.workers.push({ x: -8, z: 7, bag: empty(), job: "lumber", nextLine: "saw", route: routeDefaults(), gather: 0, sell: 0 });
    return true;
  }
  if (!Object.hasOwn(UPGRADES, key)) return false;
  const u = UPGRADES[key], level = s.levels[key];
  if (level >= 3 || s.cash < u.prices[level]) return false;
  s.cash -= u.prices[level];
  s.levels[key]++;
  return true;
}

export function assign(s, i, job) {
  if (!s.workers[i] || !Object.hasOwn(JOBS, job)) return false;
  s.workers[i].job = job;
  return true;
}

export function acceptBulk(s) {
  if (s.order || s.market.active || !near(s.player, SPOTS.sell)) return false;
  s.order = newOrder();
  s.player.sell = 0;
  return true;
}

export const bulkRemaining = (s, k) => s.order && bulkGoods.includes(k) ? BULK[k] - s.order[k] : 0;
export function deliverBulk(s, person = s.player) {
  if (!s.order || !near(person, SPOTS.sell)) return false;
  let delivered = 0;
  for (const k of bulkGoods) {
    const n = Math.min(person.bag[k], bulkRemaining(s, k));
    person.bag[k] -= n;
    s.order[k] += n;
    if (n) animate(person, "stack", k);
    delivered += n;
  }
  if (bulkGoods.every(k => !bulkRemaining(s, k))) {
    s.cash += BULK.reward;
    s.sold += BULK.boards + BULK.steaks;
    s.order = null;
  }
  return delivered > 0;
}

export function cancelBulk(s) {
  if (!s.order || !near(s.player, SPOTS.sell)) return false;
  for (const k of bulkGoods) {
    s.cash += s.order[k] * spotPrice(s, k);
    s.sold += s.order[k];
  }
  s.order = null;
  return true;
}

function move(person, target, dt) {
  const dx = target.x - person.x, dz = target.z - person.z;
  const d = Math.hypot(dx, dz);
  if (d > 0) {
    const step = Math.min(d, 3 * dt);
    person.x += dx / d * step;
    person.z += dz / d * step;
  }
  return d <= 3 * dt + .08;
}

const other = key => key === "saw" ? "grill" : "saw";
function collect(person, source, good, room, restock, dt) {
  if (!source.remaining || room <= 0) {
    person.gather = 0;
    return;
  }
  person.gather += dt;
  animate(person, good === "logs" ? "chop" : "gather", good, 1);
  motions.get(person).left = Math.max(0, 1 - person.gather);
  if (person.gather + 1e-9 < 1) return;
  person.gather = Math.max(0, person.gather - 1);
  person.bag[good]++;
  if (--source.remaining === 0) source.regrow = restock;
}

function packAtCounter(s, id, person, useStock) {
  const bag = person.bag;
  const stock = s.market.stock;
  const combined = useStock ? Object.fromEntries(saleGoods.map(k => [k, bag[k] + (stock[k] ?? 0)])) : bag;
  const good = packGoods(s, id, combined);
  if (!good) return false;
  if (useStock) {
    for (const k of saleGoods) {
      const n = bag[k] + (stock[k] ?? 0) - combined[k];
      const carried = Math.min(n, bag[k]);
      bag[k] -= carried;
      if (n > carried) stock[k] -= n - carried;
    }
  }
  animate(person, "stack", good);
  return true;
}

const keepForMarketAndPlan = (s, good) => marketNeed(s, good) + bulkRemaining(s, good) + reservedForPlan(s, good);

function topUpStock(s, person, hasOrders) {
  for (const key of stationKeys) {
    const good = LINES[key].goods[0], stock = s.market.stock;
    const spare = person.bag[good] - (hasOrders ? keepForMarketAndPlan(s, good) : 0);
    const n = Math.max(0, Math.min(spare, s.stations[key].target - stock[good]));
    if (!n) continue;
    person.bag[good] -= n;
    stock[good] += n;
    animate(person, "stack", good);
  }
}

function sellOne(s, person, good) {
  person.sell = 0;
  person.bag[good]--;
  s.cash += spotPrice(s, good);
  s.sold++;
  animate(person, "stack", good);
}

export function interact(s, person = s.player, dt = .1) {
  const b = person.bag, manual = person === s.player;
  const active = motions.get(person);
  if (active && (active.left -= dt) <= 0) motions.delete(person);
  const source = stationKeys.find(key => near(person, SPOTS[LINES[key].source]));
  if (source) {
    const { raw, source: key } = LINES[source];
    collect(person, s.sources[key], raw, roomFor(s, person, raw), built(s, sourceUpgrade(key)) ? 6 : 8, dt);
  } else {
    person.gather = 0;
    if (active?.kind === "chop" || active?.kind === "gather") motions.delete(person);
  }
  for (const key of stationKeys) {
    const st = s.stations[key];
    if (manual && st.manual) continue;
    if (near(person, SPOTS[key + "In"])) {
      if (st.bin || freight(s, key)) unload(s, person, key, true);
      else if (!manual && person.job === "route" && person.route.line === key) {
        stagingToInput(s, key, inputRoom(s, key));
        unload(s, person, key);
        unload(s, person, key, true);
      }
      unload(s, person, key);
    }
    if (near(person, SPOTS[key + "Out"])) pickup(s, person, key);
  }

  const atCounter = near(person, SPOTS.sell);
  if (atCounter && !manual && person.route.reserve && saleGoods.some(k => b[k])) {
    if (s.order) deliverBulk(s, person);
    for (const t of marketTargets(s)) packAtCounter(s, t.id, person, true);
  }
  if (atCounter && (!manual || s.market.autoSale) && (b.boards || b.steaks)) topUpStock(s, person, manual);
  const good = atCounter && (!manual || s.market.autoSale) && saleGoods.find(k =>
    b[k] > 0 && b[k] > (manual ? keepForMarketAndPlan(s, k) : 0));
  person.sell = good ? (person.sell || 0) + dt : 0;
  if (person.sell + 1e-9 >= .6) sellOne(s, person, good);
}

export function stashAll(s) {
  for (const k of GOODS) {
    const n = Math.min(s.player.bag[k], stashCapacity(s) - count(s.stash));
    s.stash[k] += n;
    s.player.bag[k] -= n;
  }
}
export function returnRaw(s, k) {
  if ((k === "logs" && near(s.player, SPOTS.forest)) || (k === "meat" && near(s.player, SPOTS.boars)))
    s.player.bag[k] = 0;
}
export function retrieve(s, k) {
  if (!GOODS.includes(k)) return;
  const n = Math.min(s.stash[k], roomFor(s, s.player, k));
  s.stash[k] -= n;
  s.player.bag[k] += n;
}

function workerTarget(s, w) {
  const b = w.bag;
  if (saleGoods.some(k => b[k])) return SPOTS.sell;
  const route = w.job === "route" ? w.route : null;
  const supply = route ? [route.line] : w.job === "lumber" ? ["saw"] : w.job === "meat" ? ["grill"] :
    w.job === "haul" ? [] : [w.nextLine, other(w.nextLine)];
  const gatherable = key => (inputRoom(s, key) > 0 ||
    ((s.stations[key].bin || freight(s, key)) && s.stations[key].staging < stageCapacity(s, key))) &&
    s.sources[LINES[key].source].remaining > 0;
  const routePickup = route && count(b) < 3 && outputCount(s.stations[route.line]) > 0;
  if (routePickup && (route.priority === "pickup" || outputRoom(s, route.line) === 0)) return SPOTS[route.line + "Out"];
  const load = stationKeys.find(key => b[LINES[key].raw]);
  if ((w.job === "haul" || w.job === "clear") && count(b) < 3) {
    const bySpace = stationKeys.filter(key => outputCount(s.stations[key]) &&
      (w.job === "haul" || outputRoom(s, key) === 0));
    bySpace.sort((a, b) => outputCount(s.stations[b]) / outputCapacity(s, b) -
      outputCount(s.stations[a]) / outputCapacity(s, a) ||
      Math.hypot(w.x - SPOTS[a + "Out"].x, w.z - SPOTS[a + "Out"].z) -
      Math.hypot(w.x - SPOTS[b + "Out"].x, w.z - SPOTS[b + "Out"].z));
    if (bySpace.length) return SPOTS[bySpace[0] + "Out"];
  }
  if (load) {
    const batch = route ? route.min : w.job === "clear" ? 2 : 3;
    if (supply.includes(load) && count(b) < batch && gatherable(load)) return SPOTS[LINES[load].source];
    return SPOTS[load + "In"];
  }
  if (route && s.stations[route.line].staging && inputRoom(s, route.line) > 0) return SPOTS[route.line + "In"];
  const next = supply.find(gatherable);
  if (next) return SPOTS[LINES[next].source];
  return routePickup ? SPOTS[route.line + "Out"] : null;
}

function runStation(s, key, dt) {
  const st = s.stations[key], line = LINES[key];
  for (const job of st.jobs) {
    job.left -= dt;
    if (job.left > 1e-9) continue;
    st[job.good === line.goods[0] ? "output" : "premium"] += job.units;
    if (key === "saw") s.fuel = Math.min(FUEL_CAP, s.fuel + 1);
  }
  st.jobs = st.jobs.filter(job => job.left > 1e-9);
  if (st.bin || freight(s, key)) stagingToInput(s, key, inputRoom(s, key));
  while (st.jobs.length < slots(st) && outputRoom(s, key) > 0) {
    const plan = batch(s, key);
    if (st.input < plan.raw) break;
    st.input -= plan.raw;
    s.timberSorted -= plan.selected;
    if (plan.units === 2) s.fuel--;
    st.jobs.push({ good: plan.good, units: plan.units, left: plan.left });
  }
}

export function tick(s, dt = .1) {
  const day = marketDay(s);
  marketAdvance(s, dt);
  if (marketDay(s) > day) shipAccounts(s);
  advanceConstruction(s, dt);
  for (const [key, source] of Object.entries(s.sources)) {
    if (!source.remaining) {
      source.regrow = Math.max(0, source.regrow - dt);
      if (source.regrow <= 1e-9) source.remaining = sourceCapacity(s, key);
    }
  }
  for (const key of stationKeys) runStation(s, key, dt);
  interact(s, s.player, dt);
  for (const w of s.workers) {
    const target = workerTarget(s, w);
    if (target && move(w, target, dt)) interact(s, w, dt);
    else {
      const active = motions.get(w);
      if (active && ((active.left -= dt) <= 0 || ["chop", "gather"].includes(active.kind))) motions.delete(w);
      w.gather = 0;
      w.sell = 0;
    }
  }
}

export const serialize = s => JSON.stringify(s);
const integer = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const number = (n, max) => Number.isFinite(n) && n >= 0 && n <= max;
const validBag = (bag, keys = GOODS) => bag && keys.every(k => integer(bag[k], 1000000));
const validPerson = (p, keys) => p && number(Math.abs(p.x), 11) && typeof p.x === "number" &&
  number(Math.abs(p.z), 11) && typeof p.z === "number" && number(p.gather, 1.01) &&
  (p.sell === undefined || number(p.sell, .61)) && validBag(p.bag, keys);

function migrate(s) {
  const oldGoods = ["logs", "boards", "meat", "steaks"];
  if (!validPerson(s.player, oldGoods) || !Array.isArray(s.workers) || s.workers.length > 2 ||
      !s.workers.every(w => validPerson(w, oldGoods) && ["lumber", "meat", "haul"].includes(w.job)) ||
      !validBag(s.stash, oldGoods)) return false;
  for (const key of stationKeys) {
    const st = s.stations?.[key], period = UPGRADES[key].values[s.levels[key]];
    if (!st || !integer(st.input, storage(s)) || !integer(st.output, storage(s)) || !number(st.progress, 4.01)) return false;
    st.recipe = LINES[key].goods[0];
    st.equipment = null;
    st.premium = 0;
    st.jobs = [];
    if (st.progress > 0 && st.input && st.output < storage(s)) {
      st.input--;
      st.jobs.push({ good: st.recipe, left: Math.max(.1, period - st.progress) });
    }
    delete st.progress;
  }
  for (const bag of [s.player.bag, s.stash, ...s.workers.map(w => w.bag)]) {
    bag.lumber = 0;
    bag.trays = 0;
  }
  for (const w of s.workers) w.nextLine = "saw";
  s.version = 2;
  s.cart = false;
  s.order = null;
  return true;
}

function migrateOperations(s) {
  const defaults = createState();
  for (const key of ["cartRack", "ownedRacks", "market", "timberSorted", "fuel", "doubles"]) s[key] = defaults[key];
  for (const key of stationKeys) {
    const st = s.stations?.[key];
    if (!st || !Array.isArray(st.jobs)) return false;
    Object.assign(st, stationExtras());
    for (const job of st.jobs) job.units = 1;
  }
  if (!Array.isArray(s.workers)) return false;
  for (const worker of s.workers) worker.route = routeDefaults();
  s.version = 3;
  return true;
}

const isRoute = route => route && stationKeys.includes(route.line) && [1, 2, 3].includes(route.min) &&
  Object.hasOwn(ROUTE_PRIORITIES, route.priority) && typeof route.reserve === "boolean";

export function deserialize(text) {
  try {
    const s = JSON.parse(text);
    if (!s || ![1, 2, 3, 4].includes(s.version) || !integer(s.cash) || !integer(s.sold) ||
        !Object.keys(UPGRADES).every(k => integer(s.levels?.[k], 3))) return null;
    if (s.version === 1 && !migrate(s)) return null;
    if (s.version === 2 && !migrateOperations(s)) return null;
    if (s.version === 3) {
      s.version = 4;
      s.construction = newConstruction();
      s.plan = null;
    }
    if (!constructionIsValid(s)) return null;
    if (!marketIsValid(s.market) || (s.order && s.market.active) || !integer(s.timberSorted, 30) ||
        !integer(s.fuel, FUEL_CAP) || typeof s.doubles !== "boolean" || !Object.hasOwn(CART_RACKS, s.cartRack) ||
        typeof s.ownedRacks?.timber !== "boolean" || typeof s.ownedRacks?.food !== "boolean" ||
        (s.cartRack !== "mixed" && (!s.cart || !s.ownedRacks[s.cartRack]))) return null;
    if (typeof s.cart !== "boolean" || !validPerson(s.player) || count(s.player.bag) > capacity(s) || (s.cart && !mixFits(s, s.cartRack, s.player.bag)) ||
        !validBag(s.stash) || count(s.stash) > stashCapacity(s) || !Array.isArray(s.workers) || s.workers.length > helperLimit(s) ||
        !s.workers.every(w => validPerson(w) && count(w.bag) <= 3 && Object.hasOwn(JOBS, w.job) && stationKeys.includes(w.nextLine) && isRoute(w.route)) ||
        !["forest", "boars"].every(k => integer(s.sources?.[k]?.remaining, sourceCapacity(s, k)) && number(s.sources[k].regrow, 8)) ||
        (s.order !== null && (!s.order || !bulkGoods.every(k => integer(s.order[k], BULK[k])) ||
          bulkGoods.every(k => s.order[k] === BULK[k])))) return null;
    for (const key of stationKeys) {
      const st = s.stations?.[key], { goods } = LINES[key];
      if (!st || !goods.includes(st.recipe) || (st.equipment !== null && !Object.hasOwn(EQUIPMENT, st.equipment)) ||
          (st.layout !== null && !Object.hasOwn(REBUILDS, st.layout)) || typeof st.bin !== "boolean" ||
          typeof st.manual !== "boolean" || !TARGETS.includes(st.target) || !integer(st.staging, stageCapacity(s, key)) ||
          !integer(st.input) || inputCount(s, key) > inputCapacity(s, key) || !integer(st.output) || !integer(st.premium) ||
          !Array.isArray(st.jobs) || st.jobs.length > slots(st) ||
          !st.jobs.every(job => job && goods.includes(job.good) && job.left > 0 && number(job.left, 17.5) &&
            (job.units === 1 || (job.units === 2 && job.good === "trays"))) || outputRoom(s, key) < 0) return null;
    }
    return s;
  } catch {
    return null;
  }
}
