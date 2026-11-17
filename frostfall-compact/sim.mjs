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
export const JOBS = {
  lumber: "Supply sawmill", meat: "Supply grill", haul: "Haul finished goods",
  clear: "Clear full outputs first", split: "Split gathering",
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
    version: 2,
    cash: 0,
    levels: { pack: 0, saw: 0, grill: 0, storage: 0 },
    player: { x: 0, z: 7, bag: empty(), gather: 0, sell: 0 },
    stations: Object.fromEntries(stationKeys.map(key => [key, {
      input: 0, output: 0, premium: 0, recipe: LINES[key].goods[0], equipment: null, jobs: [],
    }])),
    workers: [],
    stash: empty(),
    sources: { forest: { remaining: 6, regrow: 0 }, boars: { remaining: 6, regrow: 0 } },
    sold: 0,
    cart: false,
    order: null,
  };
}

export const capacity = s => UPGRADES.pack.values[s.levels.pack] + (s.cart ? CART_SLOTS : 0);
export const storage = s => UPGRADES.storage.values[s.levels.storage];
export const inputCapacity = (s, key) => storage(s) + (s.stations[key].equipment === "rack" ? 4 : 0);
export const outputCapacity = (s, key) => storage(s) + (s.stations[key].equipment === "bench" ? 4 : 0);
export const outputCount = st => st.output + st.premium;
const slots = st => st.equipment === "machine" ? 2 : 1;
const outputRoom = (s, key) => outputCapacity(s, key) - outputCount(s.stations[key]) - s.stations[key].jobs.length;

export function stationStatus(s, key) {
  const st = s.stations[key];
  if (st.jobs.length) return "Processing";
  if (outputRoom(s, key) <= 0) return "Output full";
  const needed = LINES[key].recipes[st.recipe].input;
  if (st.input < needed) return needed === 1 ? `Waiting for ${LINES[key].raw}` : `Needs ${needed} ${LINES[key].raw}`;
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

export function purchase(s, key) {
  if (key === "cart") {
    if (s.cart || s.cash < CART_PRICE) return false;
    s.cash -= CART_PRICE;
    s.cart = true;
    return true;
  }
  if (key === "helper") {
    if (s.workers.length >= 2) return false;
    const price = [35, 80][s.workers.length];
    if (s.cash < price) return false;
    s.cash -= price;
    s.workers.push({ x: -8, z: 7, bag: empty(), job: "lumber", nextLine: "saw", gather: 0, sell: 0 });
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
  if (s.order || !near(s.player, SPOTS.sell)) return false;
  s.order = newOrder();
  s.player.sell = 0;
  return true;
}

export const bulkRemaining = (s, k) => s.order && bulkGoods.includes(k) ? BULK[k] - s.order[k] : 0;
export function deliverBulk(s) {
  if (!s.order || !near(s.player, SPOTS.sell)) return false;
  let delivered = 0;
  for (const k of bulkGoods) {
    const n = Math.min(s.player.bag[k], bulkRemaining(s, k));
    s.player.bag[k] -= n;
    s.order[k] += n;
    if (n) animate(s.player, "stack", k);
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
    s.cash += s.order[k] * PRICES[k];
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
function collect(person, source, good, cap, dt) {
  if (!source.remaining || count(person.bag) >= cap) {
    person.gather = 0;
    return;
  }
  person.gather += dt;
  animate(person, good === "logs" ? "chop" : "gather", good, 1);
  motions.get(person).left = Math.max(0, 1 - person.gather);
  if (person.gather + 1e-9 < 1) return;
  person.gather = Math.max(0, person.gather - 1);
  person.bag[good]++;
  if (--source.remaining === 0) source.regrow = 8;
}

export function interact(s, person = s.player, dt = .1) {
  const b = person.bag, manual = person === s.player;
  const cap = manual ? capacity(s) : 3;
  const active = motions.get(person);
  if (active && (active.left -= dt) <= 0) motions.delete(person);
  const source = stationKeys.find(key => near(person, SPOTS[LINES[key].source]));
  if (source) collect(person, s.sources[LINES[source].source], LINES[source].raw, cap, dt);
  else {
    person.gather = 0;
    if (active?.kind === "chop" || active?.kind === "gather") motions.delete(person);
  }

  for (const key of stationKeys) {
    const st = s.stations[key], { raw, goods } = LINES[key];
    if (near(person, SPOTS[key + "In"])) {
      const n = Math.min(b[raw], inputCapacity(s, key) - st.input);
      if (n) {
        b[raw] -= n;
        st.input += n;
        animate(person, "load", raw);
        if (!manual && !b[raw]) person.nextLine = other(key);
      }
    }
    if (near(person, SPOTS[key + "Out"])) {
      for (const [i, field] of ["output", "premium"].entries()) {
        const n = Math.min(st[field], cap - count(b));
        if (!n) continue;
        const good = goods[i];
        b[good] += n;
        st[field] -= n;
        animate(person, "stack", good);
      }
    }
  }

  const good = near(person, SPOTS.sell) && saleGoods.find(k => b[k] > (manual ? bulkRemaining(s, k) : 0));
  person.sell = good ? (person.sell || 0) + dt : 0;
  if (person.sell + 1e-9 >= .6) {
    person.sell = 0;
    b[good]--;
    s.cash += PRICES[good];
    s.sold++;
    animate(person, "stack", good);
  }
}

export function stashAll(s) {
  for (const k of GOODS) {
    const n = Math.min(s.player.bag[k], 16 - count(s.stash));
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
  const n = Math.min(s.stash[k], capacity(s) - count(s.player.bag));
  s.stash[k] -= n;
  s.player.bag[k] += n;
}

function workerTarget(s, w) {
  const b = w.bag;
  if (saleGoods.some(k => b[k])) return SPOTS.sell;
  const supply = w.job === "lumber" ? ["saw"] : w.job === "meat" ? ["grill"] :
    w.job === "haul" ? [] : [w.nextLine, other(w.nextLine)];
  const inputRoom = key => s.stations[key].input < inputCapacity(s, key);
  const gatherable = key => inputRoom(key) && s.sources[LINES[key].source].remaining > 0;
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
    const batch = w.job === "clear" ? 2 : 3;
    if (supply.includes(load) && count(b) < batch && gatherable(load)) return SPOTS[LINES[load].source];
    return SPOTS[load + "In"];
  }
  const next = supply.find(gatherable);
  return next ? SPOTS[LINES[next].source] : null;
}

function runStation(s, key, dt) {
  const st = s.stations[key], line = LINES[key], recipe = line.recipes[st.recipe];
  for (const job of st.jobs) {
    job.left -= dt;
    if (job.left <= 1e-9) st[job.good === line.goods[0] ? "output" : "premium"]++;
  }
  st.jobs = st.jobs.filter(job => job.left > 1e-9);
  while (st.jobs.length < slots(st) && st.input >= recipe.input && outputRoom(s, key) > 0) {
    st.input -= recipe.input;
    st.jobs.push({ good: st.recipe, left: UPGRADES[key].values[s.levels[key]] * recipe.time });
  }
}

export function tick(s, dt = .1) {
  for (const source of Object.values(s.sources)) {
    if (!source.remaining) {
      source.regrow = Math.max(0, source.regrow - dt);
      if (source.regrow <= 1e-9) source.remaining = 6;
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

export function deserialize(text) {
  try {
    const s = JSON.parse(text);
    if (!s || ![1, 2].includes(s.version) || !integer(s.cash) || !integer(s.sold) ||
        !Object.keys(UPGRADES).every(k => integer(s.levels?.[k], 3))) return null;
    if (s.version === 1 && !migrate(s)) return null;
    if (typeof s.cart !== "boolean" || !validPerson(s.player) || count(s.player.bag) > capacity(s) ||
        !validBag(s.stash) || count(s.stash) > 16 || !Array.isArray(s.workers) || s.workers.length > 2 ||
        !s.workers.every(w => validPerson(w) && count(w.bag) <= 3 && Object.hasOwn(JOBS, w.job) && stationKeys.includes(w.nextLine)) ||
        !["forest", "boars"].every(k => integer(s.sources?.[k]?.remaining, 6) && number(s.sources[k].regrow, 8)) ||
        (s.order !== null && (!s.order || !bulkGoods.every(k => integer(s.order[k], BULK[k])) ||
          bulkGoods.every(k => s.order[k] === BULK[k])))) return null;
    for (const key of stationKeys) {
      const st = s.stations?.[key], { goods } = LINES[key];
      if (!st || !goods.includes(st.recipe) || (st.equipment !== null && !Object.hasOwn(EQUIPMENT, st.equipment)) ||
          !integer(st.input, inputCapacity(s, key)) || !integer(st.output) || !integer(st.premium) ||
          !Array.isArray(st.jobs) || st.jobs.length > slots(st) || outputRoom(s, key) < 0 ||
          !st.jobs.every(job => job && goods.includes(job.good) && job.left > 0 && number(job.left, 14))) return null;
    }
    return s;
  } catch {
    return null;
  }
}
