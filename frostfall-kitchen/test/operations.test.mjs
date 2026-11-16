import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, PROJECTS, ORDERS, createState, tick, inventory, validState, describeSite,
  setPolicy, setRole, setShift, queueProject, requestRepair, buyServiceParts, acceptOrder,
} from '../works/engine.mjs';
import {
  SAVE_KEY, exportSave, parseSave, writeSave, loadGame, previousSave, importClassic,
} from '../works/save.mjs';

function advance(s, ticks) {
  for (let i = 0; i < ticks; i++) {
    tick(s);
    assert.equal(validState(s), true, `Invalid state at tick ${s.tick}`);
  }
  return s;
}

function storageFixture() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('a seed and the same policies replay identically, including from an in-flight save', () => {
  const state = advance(createState(482), 175);
  assert.ok(state.workers.some(w => w.task?.stage === 'deliver'));
  const resumed = parseSave(exportSave(state));
  assert.deepEqual(resumed, state);
  for (const s of [state, resumed]) {
    setRole(s, '8', 'auto');
    setPolicy(s, 'priority', 'food');
    advance(s, DAY * 3);
  }
  assert.deepEqual(resumed, state);
});

test('scheduled work, haul reservations and recipes conserve inventory', () => {
  const s = createState();
  const initial = inventory(s);
  advance(s, DAY - 1);
  const total = inventory(s);
  const d = s.day;
  assert.ok(d.meals > 0 && d.planks > 0 && d.hauled > 0 && d.repairs > 0);
  assert.equal(d.planks % 3, 0);
  assert.equal(d.meals % 5, 0);
  assert.equal(total.logs, initial.logs + d.felled - d.meals / 5 - 2 * d.planks / 3);
  const repairGoods = s.workers.filter(w => w.task?.kind === 'repair' && w.task.stage !== 'pickup').length;
  assert.equal(total.planks, initial.planks + d.planks - d.repairs - repairGoods);
  assert.equal(total.meals + total.crops,
    initial.meals + initial.crops + d.meals + d.harvested - d.meals / 5 * 2 - d.served - d.spoiled);
  for (const id of Object.keys(s.sites)) {
    const station = describeSite(s, id);
    for (const b of Object.values(station.stock)) assert.ok(b.amount + b.incoming <= b.capacity);
  }
});

test('removing haulers stalls deliveries while field production fills its buffer', () => {
  const s = createState();
  for (const w of s.workers) if (w.role === 'haul' || w.role === 'service') setRole(s, w.id, 'forest');
  advance(s, DAY - 1);
  assert.equal(s.day.hauled, 0);
  assert.equal(s.day.served, 7);
  assert.ok(s.day.demand > s.day.served);
  assert.equal(s.sites.farm.stock.crops, 13);
  assert.equal(describeSite(s, 'farm').reason, 'Pickup buffer full');
});

test('scheduled night shifts defer milling until the window opens', () => {
  const s = createState();
  assert.ok(setShift(s, 'mill', 'night'));
  advance(s, 220);
  assert.equal(s.day.planks, 0);
  assert.equal(describeSite(s, 'mill').reason, 'Outside scheduled shift');
  advance(s, 110);
  assert.ok(s.day.planks > 0);
});

test('broken machinery needs a warehouse plank and assigned service labor', () => {
  const s = createState();
  s.sites.mill.wear = 100;
  s.sites.depot.stock.planks = 0;
  setRole(s, '7', 'haul');
  assert.equal(describeSite(s, 'mill').reason, 'Stopped: maintenance required');
  assert.ok(requestRepair(s, 'mill'));
  assert.ok(buyServiceParts(s));
  assert.equal(buyServiceParts(s), false);
  advance(s, 96);
  assert.equal(s.sites.mill.wear, 100);
  assert.equal(s.day.planks, 0);
  setRole(s, '7', 'service');
  advance(s, 170);
  assert.ok(s.sites.mill.wear < 100);
  assert.ok(s.day.repairs >= 1);
  assert.ok(s.day.planks > 0);
});

test('construction commits resources once, needs labor, and increases capacity in place', () => {
  const s = createState();
  const project = PROJECTS.depot;
  s.sites.depot.stock.planks = project.planks + 2;
  setRole(s, '7', 'haul');
  assert.ok(queueProject(s, 'depot'));
  assert.equal(s.cash, 55 - project.cash);
  assert.equal(s.sites.depot.stock.planks, 2);
  assert.equal(queueProject(s, 'depot'), false);
  advance(s, 120);
  assert.equal(s.projects.depot.progress, 0);
  setRole(s, '7', 'service');
  advance(s, 140);
  assert.equal(s.projects.depot.complete, true);
  assert.equal(describeSite(s, 'depot').stock.planks.capacity, 48);
});

test('food prioritization and capacity improvements can cover the cold-snap demand', () => {
  const baseline = advance(createState(), DAY * 3);
  const improved = advance(createState(), DAY);
  setRole(improved, '8', 'auto');
  setPolicy(improved, 'priority', 'food');
  setPolicy(improved, 'kitchenReserve', 30);
  assert.ok(queueProject(improved, 'cart'));
  advance(improved, DAY * 2);
  const before = baseline.history.at(-1);
  const after = improved.history.at(-1);
  assert.ok(before.served < before.demand);
  assert.equal(after.served, after.demand);
});

test('market orders use warehouse inventory and preserve a local reserve', () => {
  const s = createState();
  const order = ORDERS.timber;
  assert.ok(acceptOrder(s, 'timber'));
  assert.equal(acceptOrder(s, 'meals'), false);
  s.sites.depot.stock.planks = order.amount + order.reserve - 1;
  advance(s, 4);
  assert.ok(s.order);
  s.sites.depot.stock.planks += 1;
  advance(s, 4);
  assert.equal(s.order, null);
  assert.equal(s.cash, 55 + order.reward);
  assert.equal(s.sites.depot.stock.planks, order.reserve);
  assert.equal(s.lastOrder.delivered, true);
});

test('meal cargo spoils in transit rather than filling a destination with stale stock', () => {
  const s = createState();
  const w = s.workers[4];
  w.task = { kind: 'haul', stage: 'deliver', from: 'depot', to: 'hall', resource: 'meals', amount: 2, remaining: 0, lots: [{ n: 2, until: 1 }] };
  advance(s, 1);
  assert.equal(w.task, null);
  assert.equal(s.day.spoiled, 2);
  assert.equal(s.sites.hall.stock.meals, 7);
});

test('versioned saves retain a checkpoint and recover from invalid data', () => {
  const storage = storageFixture();
  const s = advance(createState(), 100);
  writeSave(storage, s);
  const checkpoint = exportSave(s);
  advance(s, 137);
  writeSave(storage, s);
  assert.deepEqual(loadGame(storage).state, s);
  assert.equal(exportSave(previousSave(storage)), checkpoint);
  storage.setItem(SAVE_KEY, '{"version":999}');
  assert.equal(exportSave(loadGame(storage).state), checkpoint);
  const edited = JSON.parse(exportSave(s));
  edited.state.sites.kitchen.stock.logs = 100;
  assert.equal(parseSave(JSON.stringify(edited)), null);
});

test('Classic supplies migrate selectively without overwriting the original save', () => {
  const storage = storageFixture();
  const legacyKey = 'frostfall-kitchen-mill-v1';
  const classic = JSON.stringify({ cash: 500, kitchenCamp: { planks: 13, logs: 4, fuel: 7 } });
  storage.setItem(legacyKey, classic);
  const s = importClassic(storage);
  assert.equal(s.cash, 250);
  assert.equal(s.sites.depot.stock.planks, 13);
  assert.equal(s.sites.depot.stock.logs, 11);
  assert.equal(validState(s), true);
  writeSave(storage, s);
  assert.equal(storage.getItem(legacyKey), classic);
  assert.deepEqual(loadGame(storage).state, s);
});
