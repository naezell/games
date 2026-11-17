import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  tick,
  interact,
  SPOTS,
  count,
  capacity,
  storage,
  purchase,
  assign,
  stashAll,
  retrieve,
  returnRaw,
  serialize,
  deserialize,
  selectRecipe,
  stationStatus,
  inputCapacity,
  outputCapacity,
  install,
  acceptBulk,
  deliverBulk,
  cancelBulk,
  activity,
  BULK,
} from "./sim.mjs";
const at = (p, k) => Object.assign(p, { x: SPOTS[k].x, z: SPOTS[k].z });
const advance = (s, seconds) => {
  for (let i = 0; i < seconds * 10; i++) tick(s, 0.1);
};
test("manual loops gather, process and sell both products", () => {
  let s = createState();
  for (const [source, input, output, raw, finished] of [
    ["forest", "sawIn", "sawOut", "logs", "boards"],
    ["boars", "grillIn", "grillOut", "meat", "steaks"],
  ]) {
    at(s.player, source);
    advance(s, 3.2);
    assert.ok(s.player.bag[raw] > 0);
    at(s.player, input);
    tick(s);
    assert.equal(s.player.bag[raw], 0);
    advance(s, 13);
    at(s.player, output);
    tick(s);
    assert.ok(s.player.bag[finished] > 0);
    at(s.player, "sell");
    advance(s, 3);
    assert.equal(s.player.bag[finished], 0);
  }
  assert.ok(s.cash > 0);
  assert.ok(s.sold >= 4);
});
test("buffers and bag stay bounded and progress waits for output space", () => {
  let s = createState();
  let st = s.stations.saw;
  st.input = storage(s);
  st.output = storage(s);
  advance(s, 10);
  assert.equal(st.input, 5);
  assert.equal(st.output, 5);
  at(s.player, "sawOut");
  tick(s);
  assert.equal(count(s.player.bag), 5);
  at(s.player, "build");
  advance(s, 5);
  assert.ok(st.output > 0);
  assert.ok(count(s.player.bag) <= capacity(s));
});
test("upgrades cost money, cap at three and raise capacities", () => {
  let s = createState();
  assert.equal(purchase(s, "pack"), false);
  s.cash = 1000;
  for (let i = 0; i < 3; i++) assert.equal(purchase(s, "pack"), true);
  assert.equal(purchase(s, "pack"), false);
  assert.equal(capacity(s), 16);
  for (let i = 0; i < 3; i++) assert.equal(purchase(s, "storage"), true);
  assert.equal(storage(s), 18);
});
test("helpers batch raw goods, deliver and preserve load on reassignment", () => {
  let s = createState();
  s.cash = 500;
  purchase(s, "helper");
  let w = s.workers[0];
  at(w, "forest");
  advance(s, 3.3);
  assert.equal(w.bag.logs, 3);
  assign(s, 0, "meat");
  advance(s, 5);
  assert.equal(w.bag.logs, 0);
  assert.ok(s.stations.saw.input + s.stations.saw.output > 0);
  advance(s, 12);
  assert.ok(s.stations.grill.input + s.stations.grill.output + w.bag.meat > 0);
});
test("lumber helper does not haul finished boards when input is full", () => {
  let s = createState();
  s.cash = 50;
  purchase(s, "helper");
  s.stations.saw.input = 5;
  s.stations.saw.output = 5;
  at(s.workers[0], "sawIn");
  advance(s, 10);
  assert.equal(s.workers[0].bag.boards, 0);
  assert.equal(s.stations.saw.output, 5);
});
test("full bag recovery crate is bounded and raw goods can be returned", () => {
  let s = createState();
  s.player.bag.logs = 6;
  stashAll(s);
  assert.equal(s.stash.logs, 6);
  retrieve(s, "logs");
  assert.equal(s.player.bag.logs, 6);
  at(s.player, "forest");
  returnRaw(s, "logs");
  assert.equal(count(s.player.bag), 0);
  s.stash.boards = 16;
  s.player.bag.logs = 6;
  stashAll(s);
  assert.equal(count(s.stash), 16);
  assert.equal(s.player.bag.logs, 6);
});
test("sources regenerate and saved partial state round trips with validation", () => {
  let s = createState();
  at(s.player, "forest");
  advance(s, 6.5);
  assert.equal(s.sources.forest.remaining, 0);
  s.stations.saw.input = 2;
  tick(s);
  s.cash = 50;
  purchase(s, "helper");
  assign(s, 0, "haul");
  let restored = deserialize(serialize(s));
  assert.deepEqual(restored, s);
  advance(restored, 9);
  assert.ok(restored.sources.forest.remaining > 0);
  let bad = JSON.parse(serialize(s));
  bad.stations.saw.input = 999;
  assert.equal(deserialize(JSON.stringify(bad)), null);
  assert.equal(deserialize("{"), null);
});

test("recipes preserve work already underway and pay the premium price", () => {
  const s = createState();
  at(s.player, "sawIn");
  s.player.bag.logs = 3;
  tick(s);
  assert.equal(activity(s.player).kind, "load");
  tick(s);
  assert.equal(stationStatus(s, "saw"), "Processing");
  assert.ok(selectRecipe(s, "saw", "lumber"));
  advance(s, 4);
  assert.equal(s.stations.saw.output, 1);
  assert.equal(s.stations.saw.jobs[0].good, "lumber");
  advance(s, 11);
  at(s.player, "sawOut");
  tick(s);
  assert.equal(activity(s.player).kind, "stack");
  assert.equal(s.player.bag.lumber, 1);
  at(s.player, "grillIn");
  assert.ok(selectRecipe(s, "grill", "trays"));
  s.player.bag.meat = 3;
  advance(s, 14.5);
  at(s.player, "grillOut");
  tick(s);
  at(s.player, "sell");
  advance(s, 2);
  assert.equal(s.cash, 36);
});

test("the two station slots enforce equipment limits and reserve parallel output", () => {
  const s = createState();
  s.cash = 250;
  assert.equal(install(s, "saw", "machine"), false);
  at(s.player, "sawIn");
  assert.ok(install(s, "saw", "machine"));
  assert.equal(install(s, "saw", "rack"), false);
  s.stations.saw.input = 5;
  s.stations.saw.output = 4;
  tick(s);
  assert.equal(s.stations.saw.jobs.length, 1);
  advance(s, 4);
  assert.equal(stationStatus(s, "saw"), "Output full");
  at(s.player, "sawOut");
  advance(s, .3);
  assert.equal(s.stations.saw.jobs.length, 2);
  at(s.player, "grillIn");
  assert.ok(install(s, "grill", "rack"));
  assert.equal(inputCapacity(s, "grill"), 9);
  assert.equal(outputCapacity(s, "grill"), 5);
  const other = createState();
  other.cash = 45;
  at(other.player, "grillOut");
  assert.ok(install(other, "grill", "bench"));
  assert.equal(outputCapacity(other, "grill"), 9);
  assert.equal(inputCapacity(other, "grill"), 5);
});

test("cart extends the player's capacity and untimed orders survive reloads", () => {
  let s = createState();
  s.cash = 55;
  assert.ok(purchase(s, "cart"));
  assert.equal(purchase(s, "cart"), false);
  assert.equal(capacity(s), 11);
  assert.equal(acceptBulk(s), true);
  s.player.bag.boards = 8;
  s.player.bag.steaks = 3;
  advance(s, 5);
  assert.equal(s.cash, 0);
  assert.ok(deliverBulk(s));
  assert.equal(s.order.boards, 8);
  s = deserialize(serialize(s));
  at(s.player, "build");
  advance(s, 800);
  assert.equal(s.order.steaks, 3);
  s.player.bag.steaks = 6;
  at(s.player, "sell");
  advance(s, 2);
  assert.equal(s.cash, 5);
  assert.ok(deliverBulk(s));
  assert.equal(s.order, null);
  assert.equal(s.cash, 5 + BULK.reward);
  assert.equal(deliverBulk(s), false);
  assert.ok(acceptBulk(s));
  s.player.bag.boards = 2;
  assert.ok(deliverBulk(s));
  assert.ok(cancelBulk(s));
  assert.equal(s.cash, 5 + BULK.reward + 8);
});

test("a split helper supplies both lines and a clearing helper restarts a blocked line", () => {
  const s = createState();
  s.cash = 150;
  purchase(s, "helper");
  assign(s, 0, "split");
  advance(s, 30);
  assert.ok(s.stations.saw.output);
  assert.ok(s.stations.grill.output);
  assert.ok(purchase(s, "helper"));
  assign(s, 1, "clear");
  s.stations.saw.output = 5 - s.stations.saw.jobs.length;
  at(s.workers[1], "sawOut");
  advance(s, 1);
  assert.ok(s.workers[1].bag.boards);
  advance(s, 10);
  assert.ok(s.sold > 0);
});

test("a published v1 save carries over inventory, workers and partially processed goods", () => {
  const old = createState();
  old.version = 1;
  old.cash = 111;
  old.player.bag.boards = 2;
  purchase(old, "helper");
  old.stations.saw = { input: 2, output: 1, progress: 2.1 };
  old.stations.grill = { input: 0, output: 0, progress: 0 };
  for (const bag of [old.player.bag, old.stash, old.workers[0].bag]) {
    delete bag.trays;
    delete bag.lumber;
  }
  delete old.workers[0].nextLine;
  delete old.cart;
  delete old.order;
  const s = deserialize(serialize(old));
  assert.equal(s.version, 2);
  assert.equal(s.cash, old.cash);
  assert.equal(s.workers[0].job, "lumber");
  assert.equal(s.player.bag.boards, 2);
  assert.equal(s.stations.saw.input, 1);
  assert.equal(s.stations.saw.output, 1);
  advance(s, 2);
  assert.equal(s.stations.saw.output, 2);
  s.stations.saw.premium = 999;
  assert.equal(deserialize(serialize(s)), null);
});
