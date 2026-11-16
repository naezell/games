export const TICKS_PER_SECOND = 4;
export const DAY = 360;
export const VERSION = 1;

export const LOCATIONS = {
  forest: { name: 'Timber Intake', x: -8, z: -5 },
  farm: { name: 'Grow Room', x: 3, z: -6 },
  kitchen: { name: 'Kitchen', x: 7, z: -2 },
  mill: { name: 'Sawmill', x: -7, z: 3 },
  depot: { name: 'Dispatch', x: 0, z: 1 },
  hall: { name: 'Dining Hall', x: 5, z: 6 },
};
export const ROLES = {
  auto: 'Any work', farm: 'Farming', forest: 'Logging', kitchen: 'Cooking',
  mill: 'Milling', haul: 'Hauling', service: 'Maintenance & builds',
};
export const RESOURCES = { crops: 'Crops', logs: 'Logs', meals: 'Meals', planks: 'Planks' };
export const CAPACITY = {
  forest: { logs: 12 }, farm: { crops: 14 },
  kitchen: { crops: 10, logs: 6, meals: 12 },
  mill: { logs: 10, planks: 12 },
  depot: { meals: 14, logs: 18, planks: 24 },
  hall: { meals: 12 },
};
export const PROJECTS = {
  cart: { name: 'Handcarts', site: 'depot', planks: 6, cash: 22, work: 28, effect: 'Carry two extra units per trip.' },
  road: { name: 'Packed paths', site: 'depot', planks: 9, cash: 38, work: 44, effect: 'Walk 25% faster throughout camp.' },
  depot: { name: 'Warehouse annex', site: 'depot', planks: 7, cash: 28, work: 38, effect: 'Double warehouse capacity and extend meal life.' },
  kitchen: { name: 'Second oven', site: 'kitchen', planks: 10, cash: 42, work: 42, effect: 'Let two cooks work in parallel. Each oven needs fuel and maintenance.' },
  mill: { name: 'Twin saw bench', site: 'mill', planks: 10, cash: 42, work: 42, effect: 'Let two millers work in parallel. Both benches draw from the same log supply.' },
};
const CREW = [
  ['Ada', 'farm', 'farm'], ['Bram', 'forest', 'forest'], ['Cora', 'kitchen', 'kitchen'],
  ['Dane', 'mill', 'mill'], ['Edda', 'haul', 'depot'], ['Finn', 'haul', 'hall'],
  ['Greta', 'service', 'depot'], ['Hugo', 'haul', 'farm'],
];
const PERISHABLE = { crops: 540, meals: 390 };
const ROUTES = [
  { from: 'forest', to: 'depot', resource: 'logs', score: 36 },
  { from: 'farm', to: 'kitchen', resource: 'crops', score: 52 },
  { from: 'depot', to: 'kitchen', resource: 'logs', score: 50 },
  { from: 'depot', to: 'mill', resource: 'logs', score: 42 },
  { from: 'kitchen', to: 'depot', resource: 'meals', score: 56 },
  { from: 'depot', to: 'hall', resource: 'meals', score: 62 },
  { from: 'mill', to: 'depot', resource: 'planks', score: 32 },
];
const POLICY = {
  priority: ['balanced', 'food', 'timber'], loads: ['responsive', 'full'],
  maintenance: ['early', 'normal', 'late'], kitchenReserve: [12, 20, 30], fuelReserve: [0, 2, 4],
};
export const SHIFTS = { steady: 'All day', day: 'Day shift', night: 'Night shift' };
export const CONDITIONS = [
  { label: 'Opening week', demand: 3, crop: 12, tree: 20, wear: 1, note: 'Build a food reserve and fund a logistics project.' },
  { label: 'Cold snap', demand: 8, crop: 20, tree: 23, wear: 1.3, note: 'Harvests take longer. Shift crew to food hauling and set a higher meal target.' },
  { label: 'Thaw', demand: 3, crop: 10, tree: 15, wear: 1, note: 'Build stock while farms and forests recover faster.' },
  { label: 'Market week', demand: 7, crop: 13, tree: 19, wear: 1.2, note: 'Keep the hall supplied while preparing orders.' },
];
export const ORDERS = {
  timber: { name: 'Builder’s order', resource: 'planks', amount: 8, reward: 36, days: 2, reserve: 3 },
  meals: { name: 'Trail rations', resource: 'meals', amount: 8, reward: 34, days: 2, reserve: 5 },
  wagon: { name: 'Timber wagon', resource: 'planks', amount: 18, reward: 82, days: 3, reserve: 3 },
};
const METRICS = ['harvested', 'felled', 'meals', 'planks', 'hauled', 'served', 'demand', 'spoiled', 'exported', 'repairs'];
const metrics = () => Object.fromEntries(METRICS.map(key => [key, 0]));
const siteIds = Object.keys(LOCATIONS);
const resourceIds = Object.keys(RESOURCES);
const projectIds = Object.keys(PROJECTS);
const roleIds = Object.keys(ROLES);
const coatColors = [0xa692cf, 0xab7b54, 0xc46255, 0x637ea8, 0x489284, 0xc49346, 0x887ab8, 0x6f9bb2];
const count = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const stock = (s, site, resource) => s.sites[site].stock[resource] ?? 0;

export function createState(seed = 104729) {
  const state = {
    version: VERSION, seed: seed >>> 0 || 104729, tick: 0, cash: 55, appetite: 1,
    sites: Object.fromEntries(siteIds.map(id => [id, {
      stock: Object.fromEntries(Object.keys(CAPACITY[id]).map(resource => [resource, 0])),
      lots: {}, level: 1, wear: 0, ready: id === 'farm' ? 14 : id === 'forest' ? 19 : 0,
      shift: 'steady', repair: false,
    }])),
    workers: CREW.map(([name, skill, home], i) => {
      const location = LOCATIONS[home];
      const x = location.x + (i % 3 - 1) * .4;
      const z = location.z + 1 + (i % 2) * .4;
      return { id: String(i + 1), name, color: coatColors[i], skill, role: skill, x, z, prevX: x, prevZ: z, task: null };
    }),
    policy: { priority: 'balanced', loads: 'responsive', maintenance: 'normal', kitchenReserve: 20, fuelReserve: 2 },
    projects: Object.fromEntries(projectIds.map(id => [id, { queued: false, complete: false, progress: 0 }])),
    order: null, lastOrder: null, repairs: 0,
    day: metrics(), history: [],
  };
  add(state, 'farm', 'crops', 4);
  add(state, 'forest', 'logs', 5);
  add(state, 'kitchen', 'logs', 3);
  add(state, 'kitchen', 'crops', 5);
  add(state, 'mill', 'logs', 4);
  add(state, 'depot', 'logs', 4);
  add(state, 'depot', 'planks', 4);
  add(state, 'depot', 'meals', 5);
  add(state, 'hall', 'meals', 7);
  return state;
}

export function capacity(s, site, resource) {
  return (CAPACITY[site]?.[resource] ?? 0) * (site === 'depot' ? s.sites.depot.level : 1);
}

function random(s) {
  let seed = s.seed;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  s.seed = seed >>> 0;
  return s.seed / 4294967296;
}
export const dayNumber = s => Math.floor(s.tick / DAY) + 1;
export const condition = s => CONDITIONS[Math.floor((dayNumber(s) - 1) / 2) % CONDITIONS.length];
const hallReserve = s => Math.min(capacity(s, 'hall', 'meals'), condition(s).demand * 2);
const atSite = id => ({ x: LOCATIONS[id].x, z: LOCATIONS[id].z + .9 });
const perish = (resource, s, site) => s.tick + PERISHABLE[resource] + (s.projects.depot.complete && site === 'depot' ? 140 : 0);
const lotList = (site, resource) => site.lots[resource] ?? [];
function add(s, id, resource, amount, lots) {
  const site = s.sites[id];
  site.stock[resource] += amount;
  if (!PERISHABLE[resource]) return;
  const expiry = perish(resource, s, id);
  const previous = lotList(site, resource);
  const source = lots ?? [{ n: amount, until: expiry }];
  site.lots[resource] = previous.concat(source).sort((a, b) => a.until - b.until);
}
function take(s, id, resource, amount) {
  const site = s.sites[id];
  site.stock[resource] -= amount;
  if (!PERISHABLE[resource]) return [];
  const removed = [];
  const lots = lotList(site, resource);
  let remaining = amount;
  while (remaining > 0 && lots.length) {
    const lot = lots[0];
    const n = Math.min(remaining, lot.n);
    removed.push({ n, until: lot.until });
    lot.n -= n;
    remaining -= n;
    if (!lot.n) lots.shift();
  }
  return removed;
}

function locked(s, site, resource, direction) {
  let units = 0;
  for (const { task } of s.workers) {
    if (!task) continue;
    if (direction === 'in') {
      if ((task.kind === 'haul' || task.kind === 'harvest' || task.kind === 'process') && task.to === site && task.resource === resource) units += task.amount;
    } else {
      if ((task.kind === 'haul' || task.kind === 'repair') && task.stage === 'pickup' && task.from === site && task.resource === resource) units += task.amount;
      if ((task.kind === 'process' || task.kind === 'repair') && task.to === site && task.inputs?.[resource]) units += task.inputs[resource];
    }
  }
  return units;
}
const available = (s, site, resource) => Math.max(0, stock(s, site, resource) - locked(s, site, resource, 'out'));
const space = (s, site, resource) => Math.max(0, capacity(s, site, resource) - stock(s, site, resource) - locked(s, site, resource, 'in'));
const assigned = (s, site, kind) => s.workers.some(({ task }) => task?.to === site && task.kind === kind);
const processCount = (s, id) => s.workers.filter(({ task }) => task?.kind === 'process' && task.to === id).length;
const openShift = (s, id) => s.sites[id].shift === 'steady' || (s.sites[id].shift === 'day') === (s.tick % DAY < DAY * .65);
const threshold = s => ({ early: 35, normal: 58, late: 80 })[s.policy.maintenance];
function mealPipeline(s) {
  return stock(s, 'kitchen', 'meals') + stock(s, 'depot', 'meals') + stock(s, 'hall', 'meals') +
    s.workers.reduce((total, { task }) => total + (task?.resource === 'meals' &&
      (task.kind === 'process' || task.kind === 'haul' && task.stage === 'deliver') ? task.amount : 0), 0);
}
function mealTarget(s) {
  return s.policy.kitchenReserve + (s.order?.id === 'meals' ? ORDERS.meals.amount : 0);
}
const RECIPE = { kitchen: { inputs: { crops: 2, logs: 1 }, resource: 'meals', amount: 5, duration: 16 },
  mill: { inputs: { logs: 2 }, resource: 'planks', amount: 3, duration: 17 } };

function harvestTask(s, to) {
  const resource = to === 'farm' ? 'crops' : 'logs';
  if (s.sites[to].ready < 3 || space(s, to, resource) < 3 || assigned(s, to, 'harvest')) return null;
  return { kind: 'harvest', to, resource, amount: 3, duration: to === 'farm' ? 13 : 15 };
}
function repairTask(s, to) {
  const site = s.sites[to];
  if (site.wear < 25 || (!site.repair && site.wear < threshold(s)) || processCount(s, to) ||
      assigned(s, to, 'repair') || available(s, 'depot', 'planks') < 1) return null;
  return { kind: 'repair', from: 'depot', to, resource: 'planks', amount: 1, duration: 24 };
}
function processTask(s, to) {
  const site = s.sites[to];
  const recipe = RECIPE[to];
  const repairDue = (site.repair || site.wear >= threshold(s)) && available(s, 'depot', 'planks') > 0;
  if ((to === 'kitchen' && mealPipeline(s) >= mealTarget(s)) || !openShift(s, to) || site.wear >= 100 || repairDue || assigned(s, to, 'repair') ||
      processCount(s, to) >= site.level || space(s, to, recipe.resource) < recipe.amount ||
      Object.entries(recipe.inputs).some(([resource, n]) => available(s, to, resource) < n)) return null;
  return { ...recipe, kind: 'process', to, duration: Math.ceil(recipe.duration * (1 + site.wear / 130)) };
}
function projectTask(s, id) {
  const progress = s.projects[id];
  if (!progress.queued || progress.complete || s.workers.some(w => w.task?.project === id)) return null;
  return { kind: 'project', to: PROJECTS[id].site, project: id, duration: PROJECTS[id].work };
}
function haulTasks(s, w) {
  const carry = 2 + Number(w.skill === 'haul') + (s.projects.cart.complete ? 2 : 0);
  const mealsShort = stock(s, 'hall', 'meals') < hallReserve(s);
  const routes = [];
  for (const { from, to, resource, score } of ROUTES) {
    const reserve = to === 'mill' ? s.policy.fuelReserve : 0;
    const amount = Math.min(carry, available(s, from, resource) - reserve, space(s, to, resource));
    const food = resource === 'crops' || resource === 'meals' || to === 'kitchen';
    const emergency = mealsShort && (food || to === 'depot' && resource === 'logs' && stock(s, 'depot', 'logs') < 2);
    const outputBackedUp = available(s, from, resource) >= capacity(s, from, resource) * .75;
    if (amount <= 0 || (s.policy.loads === 'full' && amount < carry && !emergency && !outputBackedUp)) continue;
    const src = atSite(from);
    const dest = atSite(to);
    const preference = s.policy.priority === 'food' && food || s.policy.priority === 'timber' && !food ? 12 : 0;
    const lowTarget = stock(s, to, resource) + locked(s, to, resource, 'in') <= (to === 'hall' ? hallReserve(s) : 2) ? 16 : 0;
    routes.push({ kind: 'haul', from, to, resource, amount,
      score: score + preference + lowTarget + (emergency ? 14 : 0) + amount * 3
        - Math.hypot(w.x - src.x, w.z - src.z) * 1.2 - Math.hypot(dest.x - src.x, dest.z - src.z) * .7 });
  }
  return routes;
}

function dispatch(s, w) {
  const eligible = role => w.role === role || w.role === 'auto';
  const candidates = [];
  function consider(task, role, score) {
    if (task) candidates.push({ ...task, score: score + (w.skill === role ? 10 : 0) });
  }
  if (eligible('service')) {
    for (const id of ['kitchen', 'mill']) consider(repairTask(s, id), 'service', 94 + s.sites[id].wear / 4);
    for (const id of projectIds) consider(projectTask(s, id), 'service', 61);
  }
  for (const id of ['farm', 'forest']) if (eligible(id)) consider(harvestTask(s, id), id, 50);
  for (const id of ['kitchen', 'mill']) if (eligible(id)) consider(processTask(s, id), id, id === 'kitchen' ? 68 : 57);
  if (eligible('haul') || w.role === 'service') {
    for (const task of haulTasks(s, w)) consider(task, 'haul', task.score - (w.role === 'service' ? 30 : 0));
  }
  if (!candidates.length) return;
  candidates.sort((a, b) => b.score - a.score);
  const { score, ...task } = candidates[0];
  w.task = { ...task, stage: task.from ? 'pickup' : 'work', remaining: task.duration ?? 0, lots: [] };
}
function walk(s, w, site) {
  const target = atSite(site);
  const lane = (Number(w.id) % 3 - 1) * .44;
  const dx = target.x + lane - w.x;
  const dz = target.z + lane * .5 - w.z;
  const distance = Math.hypot(dx, dz);
  const stride = (w.skill === 'haul' ? .86 : .75) * (.67 + .33 * s.appetite) * (s.projects.road.complete ? 1.25 : 1);
  if (distance <= stride) {
    w.x += dx;
    w.z += dz;
    return true;
  }
  w.x += dx / distance * stride;
  w.z += dz / distance * stride;
  return false;
}
function finish(s, task) {
  const { kind, to, resource, amount } = task;
  if (kind === 'harvest') {
    s.sites[to].ready -= amount;
    add(s, to, resource, amount);
    s.day[to === 'farm' ? 'harvested' : 'felled'] += amount;
  } else if (kind === 'process') {
    if (Object.entries(task.inputs).some(([input, n]) => stock(s, to, input) < n)) return;
    for (const [input, n] of Object.entries(task.inputs)) take(s, to, input, n);
    add(s, to, resource, amount);
    s.sites[to].wear = Math.min(100, s.sites[to].wear + (to === 'kitchen' ? 6 : 9) * condition(s).wear);
    s.day[resource] += amount;
  } else if (kind === 'repair') {
    s.sites[to].wear = 0;
    s.sites[to].repair = false;
    s.day.repairs += 1;
    s.repairs += 1;
  } else {
    const project = s.projects[task.project];
    project.queued = false;
    project.complete = true;
    project.progress = PROJECTS[task.project].work;
    if (['depot', 'kitchen', 'mill'].includes(task.project)) s.sites[to].level = 2;
  }
}
function work(s, w) {
  const task = w.task;
  if (!task) return;
  if (task.stage === 'pickup') {
    if (!walk(s, w, task.from)) return;
    task.amount = Math.min(task.amount, stock(s, task.from, task.resource));
    if (!task.amount) { w.task = null; return; }
    task.lots = take(s, task.from, task.resource, task.amount);
    task.stage = 'deliver';
    return;
  }
  if (!walk(s, w, task.to)) return;
  if (task.stage === 'deliver' && task.kind === 'haul') {
    if (task.amount) {
      // Cold storage slows the clock after arrival. It never resurrects cargo that spoiled on the path.
      if (task.to === 'depot' && task.resource === 'meals' && s.projects.depot.complete) {
        task.lots = task.lots.map(lot => ({ ...lot, until: lot.until + 140 }));
      }
      add(s, task.to, task.resource, task.amount, task.lots);
      s.day.hauled += task.amount;
    }
    w.task = null;
    return;
  }
  task.stage = 'work';
  const role = task.kind === 'repair' || task.kind === 'project' ? 'service' : task.to;
  const productivity = (w.skill === role ? 1.18 : .86) * (.62 + .38 * s.appetite);
  task.remaining -= productivity;
  if (task.kind === 'project') {
    s.projects[task.project].progress = Math.min(task.duration, Math.floor(task.duration - task.remaining));
  }
  if (task.remaining > 0) return;
  finish(s, task);
  w.task = null;
}

function expire(s) {
  for (const [id, site] of Object.entries(s.sites)) {
    for (const resource of Object.keys(site.lots)) {
      const expired = site.lots[resource].filter(lot => lot.until <= s.tick).reduce((n, lot) => n + lot.n, 0);
      if (expired) { take(s, id, resource, expired); s.day.spoiled += expired; }
    }
  }
  for (const w of s.workers) {
    const task = w.task;
    if (task?.kind !== 'haul' || task.stage !== 'deliver' || !task.lots.length) continue;
    const fresh = task.lots.filter(lot => lot.until > s.tick);
    const lost = task.amount - fresh.reduce((n, lot) => n + lot.n, 0);
    task.amount -= lost;
    task.lots = fresh;
    s.day.spoiled += lost;
    if (!task.amount) w.task = null;
  }
}
function serve(s) {
  // Eight workers plus seasonal visitors share the hall.
  const demand = condition(s).demand + (s.tick % (DAY * 2) === 180 ? 1 : 0);
  const served = Math.min(demand, stock(s, 'hall', 'meals'));
  take(s, 'hall', 'meals', served);
  s.appetite = .65 * s.appetite + .35 * served / demand;
  s.day.served += served;
  s.day.demand += demand;
  s.cash += served;
}
function fulfill(s) {
  if (!s.order) return;
  const order = ORDERS[s.order.id];
  if (s.tick >= s.order.due) {
    s.lastOrder = { id: s.order.id, delivered: false };
    s.order = null;
    return;
  }
  if (available(s, 'depot', order.resource) < order.amount + order.reserve ||
      order.resource === 'meals' && stock(s, 'hall', 'meals') < hallReserve(s)) return;
  take(s, 'depot', order.resource, order.amount);
  s.day.exported += order.amount;
  s.cash += order.reward;
  s.lastOrder = { id: s.order.id, delivered: true };
  s.order = null;
}

export function tick(s) {
  s.tick += 1;
  if (s.tick % DAY === 0) {
    s.history.push(s.day);
    if (s.history.length > 6) s.history.shift();
    s.day = metrics();
  }
  const weather = condition(s);
  if (s.tick % weather.crop === 0) s.sites.farm.ready = Math.min(21, s.sites.farm.ready + 2);
  if (s.tick % weather.tree === 0) s.sites.forest.ready = Math.min(24, s.sites.forest.ready + (random(s) < .8 ? 2 : 1));
  expire(s);
  if (s.tick % 45 === 0) serve(s);
  for (const w of s.workers) {
    w.prevX = w.x;
    w.prevZ = w.z;
    work(s, w);
  }
  if (s.tick % 4 === 0) {
    fulfill(s);
    // Rotate who dispatches first so worker order cannot permanently win tied jobs.
    const start = (s.tick / 4) % s.workers.length;
    for (let i = 0; i < s.workers.length; i++) {
      const w = s.workers[(start + i) % s.workers.length];
      if (!w.task) dispatch(s, w);
    }
  }
  return s;
}

export function setRole(s, id, role) {
  const worker = s.workers.find(w => w.id === id);
  if (!worker || !Object.hasOwn(ROLES, role)) return false;
  worker.role = role;
  return true;
}
export function setPolicy(s, id, value) {
  if (!Object.hasOwn(POLICY, id) || !POLICY[id].includes(value)) return false;
  s.policy[id] = value;
  return true;
}
export function setShift(s, id, shift) {
  if (!Object.hasOwn(RECIPE, id) || !Object.hasOwn(SHIFTS, shift)) return false;
  s.sites[id].shift = shift;
  return true;
}
export function requestRepair(s, id) {
  if (!Object.hasOwn(RECIPE, id) || s.sites[id].wear < 25) return false;
  s.sites[id].repair = true;
  return true;
}
export function projectAvailable(s, id) {
  if (!Object.hasOwn(PROJECTS, id)) return false;
  const project = PROJECTS[id];
  const current = s.projects[id];
  return !current.complete && !current.queued && s.cash >= project.cash &&
    available(s, 'depot', 'planks') >= project.planks + 2;
}
export function queueProject(s, id) {
  if (!projectAvailable(s, id)) return false;
  const project = PROJECTS[id];
  const current = s.projects[id];
  take(s, 'depot', 'planks', project.planks);
  s.cash -= project.cash;
  current.queued = true;
  return true;
}
export function buyServiceParts(s) {
  if (s.cash < 12 || stock(s, 'depot', 'planks') > 1 || space(s, 'depot', 'planks') < 2) return false;
  s.cash -= 12;
  add(s, 'depot', 'planks', 2);
  return true;
}

export function acceptOrder(s, id) {
  if (s.order || !Object.hasOwn(ORDERS, id)) return false;
  s.order = { id, due: s.tick + ORDERS[id].days * DAY };
  return true;
}

export function describeSite(s, id) {
  const site = s.sites[id];
  const status = { active: s.workers.filter(w => w.task?.to === id).length,
    stock: Object.fromEntries(Object.entries(site.stock).map(([resource, amount]) => [resource, {
      amount, capacity: capacity(s, id, resource), incoming: locked(s, id, resource, 'in'), allocated: locked(s, id, resource, 'out'),
    }])) };
  if (id === 'hall') status.reason = site.stock.meals < condition(s).demand ? 'Meal shortage' : site.stock.meals < hallReserve(s) ? 'Low meal reserve' : 'Serving steady meals';
  else if (id === 'depot') status.reason = Object.keys(site.stock).some(r => !space(s, id, r)) ? 'Storage lane at capacity' : 'Transferring supplies';
  else if (id === 'farm' || id === 'forest') {
    const resource = id === 'farm' ? 'crops' : 'logs';
    status.reason = site.ready < 3 ? 'Waiting for regrowth' : space(s, id, resource) < 3 ? 'Pickup buffer full' :
      assigned(s, id, 'harvest') ? 'Harvesting' : 'Waiting for a worker';
  } else {
    const recipe = RECIPE[id];
    const missing = Object.keys(recipe.inputs).filter(r => stock(s, id, r) < recipe.inputs[r]);
    status.reason = assigned(s, id, 'repair') ? 'Servicing equipment' : site.wear >= 100 ? 'Stopped: maintenance required' :
      !openShift(s, id) ? 'Outside scheduled shift' : processCount(s, id) ? 'Producing' :
      (site.repair || site.wear >= threshold(s)) ? (available(s, 'depot', 'planks') ? 'Maintenance due' : 'Maintenance needs a warehouse plank') :
      id === 'kitchen' && mealPipeline(s) >= mealTarget(s) ? 'Meal target reached' :
      missing.length ? 'Waiting for ' + missing.join(' and ') :
      space(s, id, recipe.resource) < recipe.amount ? 'Output buffer full' : 'Waiting for an operator';
  }
  return status;
}

export function inventory(s) {
  const total = Object.fromEntries(resourceIds.map(resource => [resource, 0]));
  for (const site of Object.values(s.sites)) for (const [resource, n] of Object.entries(site.stock)) total[resource] += n;
  for (const { task } of s.workers) if (task?.kind === 'haul' && task.stage === 'deliver') total[task.resource] += task.amount;
  return total;
}

const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const validMetrics = v => object(v) && METRICS.every(m => count(v[m]));
function validLots(lots, amount) {
  return Array.isArray(lots) && lots.length <= 48 && lots.every((lot, i) => object(lot) &&
    count(lot.n, 48) && lot.n > 0 && count(lot.until) && (!i || lots[i - 1].until <= lot.until)) &&
    lots.reduce((n, lot) => n + lot.n, 0) === amount;
}
function validTask(t) {
  if (t === null) return true;
  if (!object(t) || !siteIds.includes(t.to) || !['pickup', 'deliver', 'work'].includes(t.stage) ||
      !finite(t.remaining, -2, 80) || !Array.isArray(t.lots)) return false;
  const validResource = resourceIds.includes(t.resource) && count(t.amount, 5) && t.amount > 0;
  if (t.kind === 'haul') return validResource && ['pickup', 'deliver'].includes(t.stage) &&
    ROUTES.some(r => r.from === t.from && r.to === t.to && r.resource === t.resource) &&
    validLots(t.lots, PERISHABLE[t.resource] && t.stage === 'deliver' ? t.amount : 0);
  if (t.kind === 'repair') return validResource && t.amount === 1 && t.resource === 'planks' && t.from === 'depot' &&
    t.duration === 24 && Object.hasOwn(RECIPE, t.to) && !t.lots.length;
  if (t.from !== undefined || t.stage !== 'work' || t.lots.length) return false;
  if (t.kind === 'harvest') return validResource && t.amount === 3 &&
    (t.to === 'farm' && t.resource === 'crops' && t.duration === 13 || t.to === 'forest' && t.resource === 'logs' && t.duration === 15);
  if (t.kind === 'project') return Object.hasOwn(PROJECTS, t.project) && t.to === PROJECTS[t.project].site && t.duration === PROJECTS[t.project].work;
  const recipe = RECIPE[t.to];
  return t.kind === 'process' && validResource && recipe && t.resource === recipe.resource &&
    t.amount === recipe.amount && count(t.duration, 35) && t.duration >= recipe.duration && object(t.inputs) &&
    Object.keys(t.inputs).length === Object.keys(recipe.inputs).length &&
    Object.entries(recipe.inputs).every(([r, n]) => t.inputs[r] === n);
}
export function validState(s) {
  if (!object(s) || s.version !== VERSION || !count(s.tick) || !count(s.cash) || !count(s.seed, 0xffffffff) ||
      !s.seed || !finite(s.appetite, 0, 1) || !count(s.repairs) || !validMetrics(s.day) ||
      !Array.isArray(s.history) || s.history.length > 6 || !s.history.every(validMetrics) ||
      !object(s.policy) || !Object.entries(POLICY).every(([id, values]) => values.includes(s.policy[id])) ||
      !(s.order === null || object(s.order) && Object.hasOwn(ORDERS, s.order.id) && count(s.order.due)) ||
      !(s.lastOrder === null || object(s.lastOrder) && Object.hasOwn(ORDERS, s.lastOrder.id) && typeof s.lastOrder.delivered === 'boolean') ||
      !object(s.projects) || Object.keys(s.projects).length !== projectIds.length ||
      !object(s.sites) || Object.keys(s.sites).length !== siteIds.length) return false;
  for (const id of projectIds) {
    const p = s.projects[id];
    if (!object(p) || typeof p.queued !== 'boolean' || typeof p.complete !== 'boolean' ||
        p.queued && p.complete || !count(p.progress, PROJECTS[id].work) ||
        p.complete && p.progress !== PROJECTS[id].work || !p.complete && !p.queued && p.progress !== 0) return false;
  }
  for (const id of siteIds) {
    const site = s.sites[id];
    if (!object(site) || site.level !== (s.projects[id]?.complete ? 2 : 1) || !finite(site.wear, 0, 100) ||
        !count(site.ready, 24) || !Object.hasOwn(SHIFTS, site.shift) || typeof site.repair !== 'boolean' ||
        !object(site.stock) || !object(site.lots) || Object.keys(site.stock).length !== Object.keys(CAPACITY[id]).length ||
        Object.keys(site.lots).some(r => !PERISHABLE[r] || !Object.hasOwn(CAPACITY[id], r))) return false;
    for (const r of Object.keys(CAPACITY[id])) {
      if (!count(site.stock[r], capacity(s, id, r)) ||
          PERISHABLE[r] && !validLots(lotList(site, r), site.stock[r])) return false;
    }
  }
  if (!Array.isArray(s.workers) || s.workers.length !== CREW.length || !s.workers.every((w, i) => {
    const [name, skill] = CREW[i];
    return object(w) && w.id === String(i + 1) && w.name === name && w.skill === skill && w.color === coatColors[i] &&
      roleIds.includes(w.role) && ['x', 'z', 'prevX', 'prevZ'].every(k => finite(w[k], -15, 15)) && validTask(w.task);
  })) return false;
  for (const id of siteIds) for (const r of Object.keys(CAPACITY[id])) {
    if (stock(s, id, r) + locked(s, id, r, 'in') > capacity(s, id, r)) return false;
  }
  return true;
}
