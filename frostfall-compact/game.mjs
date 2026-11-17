import {
  createState,
  deserialize,
  serialize,
  tick,
  purchase,
  assign,
  stashAll,
  retrieve,
  returnRaw,
  count,
  capacity,
  storage,
  UPGRADES,
  GOODS,
  JOBS,
  SPOTS,
  NAMES,
  PRICES,
  LINES,
  EQUIPMENT,
  CART_PRICE,
  CART_SLOTS,
  BULK,
  near,
  activity,
  inputCapacity,
  outputCapacity,
  outputCount,
  stationStatus,
  selectRecipe,
  install,
  acceptBulk,
  bulkRemaining,
  deliverBulk,
  cancelBulk, CART_RACKS, BIN_COST, REBUILDS, TARGETS, ROUTE_PRIORITIES, FUEL_CAP,
  cartRack, cartLoad, projectReady, buildProject, setWorkerRoute, setStation, sortTimber,
  handleLoad, marketAction, stageCapacity, inputCount, roomFor, onHand, recipeSeconds, rackFits, nextBatchNeeds,
} from "./sim.mjs";
import { CONTRACTS, ACCOUNTS, BAY, marketDay, marketOffers, marketTargets, accountUnlocked, canPack, neededFor } from "./market.mjs";
const THREE = globalThis.THREE;
const KEY = "frostfall-compact-v1",
  $ = (id) => document.getElementById(id);
let state,
  saveError = false;
try {
  state = deserialize(localStorage.getItem(KEY)) || createState();
} catch {
  state = createState();
  saveError = true;
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9e0e8);
const camera = new THREE.OrthographicCamera(-16, 16, 16, -16, 0.1, 100);
camera.position.set(0, 30, 24);
camera.lookAt(0, 0, 0);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $("canvas"),
    antialias: true,
    powerPreference: "low-power",
  });
} catch (e) {
  $("world").innerHTML =
    '<div class="webgl-error"><strong>Frostfall needs WebGL</strong><p>Your browser could not start the 3D scene. Enable hardware acceleration or try another browser, then reload.</p><button onclick="location.reload()">Try again</button></div>';
  $("panelTitle").textContent = "Unable to start the clearing";
  $("panelContent").textContent = "Your saved camp has not been changed.";
}
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x94b6b5, 1));
  const light = new THREE.DirectionalLight(0xfff8e8, 0.65);
  light.position.set(-8, 20, 10);
  scene.add(light);
  const mats = {};
  const goodsColors = { logs: 0xb88b5f, boards: 0xe4be83, lumber: 0xa66a35,
    meat: 0xcd7772, steaks: 0xa95540, trays: 0x8b5653 };
  function mat(c) {
    return mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  }
  function box(w, h, d, c, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, c, x, y, z, parent = scene, seg = 8) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function ball(r, c, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function group(x, z) {
    let g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  box(24, 0.7, 24, 0x93c6ce, 0, -0.55, 0);
  box(24, 0.22, 24, 0xf0faf4, 0, -0.08, 0);
  for (let i = 0; i < 14; i++) {
    let x = ((i * 37) % 220) / 10 - 11,
      z = ((i * 71) % 220) / 10 - 11;
    cyl(0.35, 0.5, 0.12, 0xd3eeed, x, 0.08, z);
  }
  function tree(x, z, s = 1) {
    let g = group(x, z);
    g.scale.setScalar(s);
    cyl(0.19, 0.25, 1, 0x856047, 0, 0.5, 0, g);
    cyl(0, 1.05, 1.5, 0x3e8587, 0, 1.45, 0, g);
    cyl(0, 0.85, 1.35, 0x59a4a1, 0, 2.05, 0, g);
    cyl(0, 0.58, 1, 0x79bdb5, 0, 2.6, 0, g);
    cyl(0, 0.3, 0.5, 0xf8fffa, 0, 2.94, 0, g);
    return g;
  }
  const forestTrees = [];
  [
    [-10, -10],
    [-7, -10.5],
    [-10, -7],
    [-5.7, -9.5],
    [-10.5, -4.7],
    [10, -10],
    [10.5, -6],
    [10.5, 1],
    [-10.5, 2],
    [-10.5, 9],
    [10.5, 9],
  ].forEach((p, i) => {
    const t = tree(...p, 0.75 + (i % 3) * 0.12);
    if (i < 4) forestTrees.push(t);
  });
  function person(color, x, z, scale = 1) {
    let g = group(x, z);
    g.scale.setScalar(scale);
    let l = box(0.2, 0.45, 0.22, 0x34485a, -0.14, 0.23, 0, g),
      r = box(0.2, 0.45, 0.22, 0x34485a, 0.14, 0.23, 0, g);
    cyl(0.31, 0.4, 0.75, color, 0, 0.82, 0, g, 10);
    ball(0.34, color, 0, 1.47, -0.06, g);
    ball(0.265, 0xf2c9a9, 0, 1.46, 0.12, g);
    ball(0.035, 0x243542, -0.09, 1.5, 0.36, g);
    ball(0.035, 0x243542, 0.09, 1.5, 0.36, g);
    const arms = [-.39, .39].map(x => {
      const arm = new THREE.Group();
      arm.position.set(x, 1.25, 0);
      g.add(arm);
      box(.18, .48, .2, color, 0, -.23, 0, arm);
      box(.16, .13, .17, 0xf2c9a9, 0, -.46, 0, arm);
      return arm;
    });
    const axe = new THREE.Group();
    axe.position.set(0, -.45, .08);
    arms[1].add(axe);
    box(.07, .68, .08, 0x80513c, 0, -.22, 0, axe);
    box(.2, .22, .3, 0xc9dce1, 0, -.48, .10, axe);
    const carried = box(.44, .21, .35, goodsColors.logs, 0, .85, .57, g);
    axe.visible = carried.visible = false;
    box(0.52, 0.55, 0.27, 0x996a43, 0, 0.88, -0.35, g);
    const load = [];
    for (let i = 0; i < 4; i++) {
      let m = box(0.34, 0.14, 0.2, 0xe4be83, 0, 1.15 + i * 0.15, -0.43, g);
      m.visible = false;
      load.push(m);
    }
    return { g, l, r, load, arms, axe, carried };
  }
  function boar(x, z) {
    let g = group(x, z);
    ball(0.68, 0x926247, 0, 0.55, 0, g).scale.set(1.35, 0.75, 0.7);
    ball(0.42, 0xa37452, 0.85, 0.65, 0, g);
    ball(0.22, 0xd3aa8b, 1.15, 0.55, 0, g);
    for (let a of [-0.55, 0.55])
      for (let b of [-0.35, 0.35]) box(0.15, 0.35, 0.15, 0x57443c, a, 0.17, b, g);
    return g;
  }
  const boarModels = [boar(7, -9), boar(9, -7.5)];
  // Station structures, deliberately low enough to leave the whole clearing readable.
  let saw = group(-5.5, -2);
  box(2.3, 0.85, 1.35, 0x986642, 0, 0.43, 0, saw);
  box(2.5, 0.12, 1.5, 0x6d4933, 0, 0.9, 0, saw);
  let blade = cyl(0.48, 0.48, 0.08, 0xcbdce0, 0, 1.1, 0, saw, 16);
  blade.rotation.x = Math.PI / 2;
  for (let x of [-1, 1]) box(0.13, 1.5, 0.13, 0x795238, x, 1.55, -0.55, saw);
  box(2.5, 0.14, 1, 0x5f9ba2, 0, 2.25, -0.35, saw);
  box(2.5, 0.07, 0.85, 0xf8fffa, 0, 2.35, -0.35, saw);
  let grill = group(5.5, -2);
  cyl(1.02, 1.1, 0.7, 0x7e8e91, 0, 0.35, 0, grill, 12);
  cyl(0.88, 0.88, 0.1, 0x364a4d, 0, 0.75, 0, grill, 12);
  const fire = cyl(0, 0.5, 0.65, 0xf5a24c, 0, 0.95, 0, grill);
  for (let x of [-0.8, 0.8])
    for (let z of [-0.65, 0.65]) box(0.09, 1.5, 0.09, 0x596968, x, 1.35, z, grill);
  let roof = cyl(0, 1.28, 0.65, 0xb97151, 0, 2.25, 0, grill, 4);
  roof.rotation.y = Math.PI / 4;
  cyl(0, 0.7, 0.28, 0xfafff6, 0, 2.57, 0, grill, 4).rotation.y = Math.PI / 4;
  let counter = group(1, 6);
  box(3, 0.85, 0.85, 0xa66f47, 0, 0.43, 0, counter);
  box(3.2, 0.12, 1.05, 0x795039, 0, 0.9, 0, counter);
  for (let x of [-1.4, 1.4]) box(0.12, 1.7, 0.12, 0x795039, x, 1.7, 0, counter);
  box(3.3, 0.17, 1.2, 0xdd7862, 0, 2.5, 0, counter);
  box(3.3, 0.08, 0.85, 0xfffcf2, 0, 2.62, -0.08, counter);
  const bay = group(3.25, 6.85);
  box(2.15, .2, 1.95, 0xb58154, 0, .13, 0, bay);
  for (const z of [-.74, .7]) box(.13, .65, .13, 0x815140, .94, .34, z, bay);
  box(.14, .13, 1.58, 0x815140, .94, .65, 0, bay);
  const packedCrates = Array.from({ length: 5 }, (_, i) =>
    box(.48, .43, .42, 0xd3a565, (i % 3) * .54 - .59, .42, Math.floor(i / 3) * .55 - .4, bay));
  // Equipment fits behind the existing machines and their loading pads.
  const fixtures = {};
  for (const [key, x] of [["saw", -5.5], ["grill", 5.5]]) {
    const kit = fixtures[key] = { machine: group(x, -4), rack: group(SPOTS[key + "In"].x, -3.4),
      bench: group(SPOTS[key + "Out"].x, -3.35), supply: group(SPOTS[key + "In"].x - 1.35, -2.85),
      rebuild: group(x, -.82) };
    box(.83, .17, .85, 0x98745a, 0, .16, 0, kit.supply);
    for (const edge of [-.4, .4]) box(.11, .49, .86, 0x68867c, edge, .36, 0, kit.supply);
    kit.staged = Array.from({ length: 4 }, (_, i) =>
      box(.34, .14, .47, goodsColors[LINES[key].raw], i % 2 ? .19 : -.19, .29 + .15 * Math.floor(i / 2), 0, kit.supply));
    kit.beam = box(1.65, .23, .27, 0x5e8e88, 0, .89, 0, kit.rebuild);
    for (const edge of [-.69, .69]) box(.13, .95, .16, 0x795238, edge, .46, 0, kit.rebuild);
    if (key === "saw") {
      box(1.5, .75, .9, 0x986642, 0, .38, 0, kit.machine);
      kit.blade = cyl(.36, .36, .09, 0xcbdce0, 0, .86, 0, kit.machine, 16);
      kit.blade.rotation.x = Math.PI / 2;
    } else {
      cyl(.62, .76, .63, 0x7e8e91, 0, .32, 0, kit.machine, 12);
      cyl(.6, .6, .1, 0x364a4d, 0, .68, 0, kit.machine, 12);
      kit.flame = cyl(0, .35, .45, 0xf5a24c, 0, .83, 0, kit.machine);
    }
    for (const part of ["rack", "bench"]) {
      const fixture = kit[part];
      for (const edge of [-.6, .6]) box(.13, .68, .13, 0x7f644b, edge, .34, 0, fixture);
      box(1.5, .13, .65, part === "rack" ? 0xb38a65 : 0x5e8e88, 0, .64, 0, fixture);
      if (part === "rack") box(1.4, .12, .61, 0xb38a65, 0, .23, 0, fixture);
    }
  }
  const cart = group(0, 0);
  cart.visible = false;
  box(1, .19, 1.28, 0x77523b, 0, .43, 0, cart);
  box(.09, .1, .79, 0x815942, 0, .47, .92, cart);
  for (const x of [-.55, .55]) {
    box(.1, .37, 1.25, 0xa97950, x * .85, .65, 0, cart);
    const wheel = cyl(.27, .27, .13, 0x4b575b, x, .27, -.17, cart, 12);
    wheel.rotation.z = Math.PI / 2;
  }
  const rackRails = [-.47, .47].map(x => box(.1, .35, 1.27, 0x39766e, x, .96, 0, cart));
  const cartGoods = Array.from({ length: 8 }, (_, i) =>
    box(.35, .17, .35, goodsColors.logs, (i % 2 ? 1 : -1) * .2, .62 + Math.floor(i / 4) * .18, i % 4 < 2 ? -.25 : .21, cart));
  const customers = [person(0xdca34e, 1, 8, 0.78), person(0xb57d9c, 2.5, 9, 0.72)];
  customers.forEach((c) => (c.g.rotation.y = Math.PI));
  let build = group(-8, 7);
  cyl(1.35, 1.45, 0.15, 0x7db4a5, 0, 0.08, 0, build, 12);
  box(0.16, 1.4, 0.16, 0x8b6748, 0, 0.75, 0, build);
  box(1.25, 0.68, 0.14, 0xf5dfae, 0, 1.35, 0, build);
  box(0.7, 0.08, 0.05, 0x9a7653, 0, 1.4, 0.1, build);
  box(0.08, 0.45, 0.05, 0x9a7653, 0, 1.4, 0.1, build);
  const player = person(0xd85f50, state.player.x, state.player.z);
  let workerModels = [];
  function syncWorkers() {
    while (workerModels.length < state.workers.length)
      workerModels.push(person(workerModels.length ? 0x9775b5 : 0x4ca69e, 0, 0, 0.88));
  }
  syncWorkers();
  const piles = Object.entries(LINES).flatMap(([key, line]) => ["In", "Out"].map(end => {
    const { x, z } = SPOTS[key + end];
    const g = group(x, z);
    cyl(.78, .8, .09, 0xd6e8d9, 0, .06, 0, g, 12);
    const items = Array.from({ length: 12 }, (_, i) =>
      box(.52, .15, .4, goodsColors[line.raw], ((i % 3) - 1) * .39, .17 + Math.floor(i / 3) * .16, 0, g));
    return { key, input: end === "In", line, items };
  }));
  const labels = [
    ["forest", "FOREST", "Gather logs"],
    ["boars", "BOARS", "Gather meat"],
    ["sawIn", "SAWMILL IN", "Waiting for logs"],
    ["sawOut", "SAWMILL OUT", "0 ready"],
    ["grillIn", "GRILL IN", "Waiting for meat"],
    ["grillOut", "GRILL OUT", "0 ready"],
    ["sell", "MARKET", "Sell goods"],
    ["build", "IMPROVE", "Upgrades & helpers"],
  ];
  let destination = null;
  const tmp = new THREE.Vector3();
  for (const [key, title, sub] of labels) {
    const el = document.createElement("button");
    el.className = "place";
    el.innerHTML = `${title}<span>${sub}</span>`;
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.onclick = () => {
      destination = { ...SPOTS[key] };
    };
    $("labels").appendChild(el);
    SPOTS[key].el = el;
  }
  function resize() {
    let w = $("world").clientWidth,
      h = $("world").clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    let vertical = Math.max(31, 25 / aspect);
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    // Project labels correctly before the renderer's first camera update.
    camera.updateMatrixWorld(true);
    for (const [k] of labels) {
      let p = SPOTS[k];
      tmp.set(p.x, 0, p.z).project(camera);
      p.el.style.left = `${(tmp.x + 1) * 50}%`;
      p.el.style.top = `${(1 - tmp.y) * 50}%`;
    }
  }
  window.addEventListener("resize", resize);
  // Opening the improvement panel changes the available world height too.
  new ResizeObserver(resize).observe($("world"));
  resize();
  let paused = false,
    keys = {},
    joy = { x: 0, z: 0 },
    drag = null;
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
      keys[e.key] = true;
      destination = null;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => (keys[e.key] = false));
  window.addEventListener("blur", () => {
    keys = {};
    joy.x = joy.z = 0;
  });
  $("pause").onclick = () => {
    paused = !paused;
    $("pause").textContent = paused ? "▶" : "Ⅱ";
    $("paused").hidden = !paused;
    if (paused) stopLoop();
    else startLoop();
  };
  function stickUpdate(e) {
    let rect = $("stick").getBoundingClientRect(),
      x = e.clientX - (rect.left + rect.width / 2),
      y = e.clientY - (rect.top + rect.height / 2),
      d = Math.hypot(x, y),
      n = Math.min(d, 25) / (d || 1);
    joy.x = (x * n) / 25;
    joy.z = (y * n) / 25;
    $("knob").style.transform = `translate(${x * n}px,${y * n}px)`;
    destination = null;
  }
  $("stick").addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    $("stick").setPointerCapture(e.pointerId);
    stickUpdate(e);
  });
  $("stick").addEventListener("pointermove", (e) => {
    if ($("stick").hasPointerCapture(e.pointerId)) stickUpdate(e);
  });
  function resetStick() {
    joy.x = joy.z = 0;
    $("knob").style.transform = "";
  }
  $("stick").addEventListener("pointerup", resetStick);
  $("stick").addEventListener("pointercancel", resetStick);
  $("world").addEventListener("pointerdown", (e) => {
    if (e.target !== $("canvas")) return;
    drag = { x: e.clientX, y: e.clientY };
    $("world").setPointerCapture(e.pointerId);
  });
  $("world").addEventListener("pointermove", (e) => {
    if (!drag) return;
    let dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 8) {
      let d = Math.max(35, Math.hypot(dx, dy));
      joy.x = dx / d;
      joy.z = dy / d;
      destination = null;
    }
  });
  function endDrag() {
    drag = null;
    joy.x = joy.z = 0;
  }
  $("world").addEventListener("pointerup", endDrag);
  $("world").addEventListener("pointercancel", endDrag);
  function save() {
    try {
      localStorage.setItem(KEY, serialize(state));
      saveError = false;
    } catch {
      saveError = true;
    }
  }
  let lastPanel = "";
  const unavailable = yes => yes ? "disabled" : "";
  const action = (label, data, disabled = false) => `<button class="action" ${data} ${unavailable(disabled)}>${label}</button>`;
  const details = (id, name, content) => `<details data-section="${id}"><summary>${name}</summary>${content}</details>`;
  const choices = (value, options) => Object.entries(options).map(([k, label]) =>
    `<option value="${k}"${String(value) === k ? " selected" : ""}>${label}</option>`).join("");
  const select = (label, data, value, options) => `<label class="field">${label}<select ${data}>${choices(value, options)}</select></label>`;
  const projectLabel = cost => `${cost.cash} coins + ${cost.lumber} finished lumber`;
  const recipeButtons = (key, st) => Object.entries(LINES[key].recipes).map(([good, recipe]) =>
    `<button class="action choice" data-recipe="${good}" data-station="${key}" aria-pressed="${st.recipe === good}">${recipe.name} · ${PRICES[good]} coins<br><small>${recipe.input} ${LINES[key].raw} · ${recipeSeconds(state, key, good).toFixed(2).replace(/\.?0+$/, "")}s</small></button>`).join("");
  function equipmentControls(key, st) {
    if (st.equipment) return `<p class="station-details">${EQUIPMENT[st.equipment].name} installed</p>`;
    return `<details data-section="equipment"><summary>Choose this station’s one equipment upgrade</summary><div class="actions">${Object.entries(EQUIPMENT).map(([part, e]) =>
      `<button class="action" data-install="${part}" data-station="${key}" ${unavailable(state.cash < e.price)}>${e.name} · ${e.price} coins<br><small>${e.effect}</small></button>`).join("")}</div></details>`;
  }
  function cartControls() {
    if (!state.cart) return "";
    return details("cart", `Cart · ${CART_RACKS[state.cartRack].name}`, `<div class="actions">${Object.entries(CART_RACKS).map(([id, r]) =>
      action(`${r.name} · +${r.slots} slots${r.cash && !state.ownedRacks[id] ? ` · ${r.cash} coins` : ""}`,
        `data-cart-rack="${id}"`, state.cartRack === id || !rackFits(state, id) || id !== "mixed" && !state.ownedRacks[id] && state.cash < r.cash)
    ).join("")}</div><p class="station-details">Timber and food racks leave the backpack free for other goods. Unload before switching if your load is too large.</p>`);
  }
  function helperControls(w, i) {
    const route = w.route;
    const routeSelect = (label, field, options) => select(label, `data-route="${field}" data-worker="${i}"`, route[field], options);
    const jobs = Object.entries(JOBS).map(([job, name]) =>
      `<button data-worker="${i}" data-job="${job}" aria-pressed="${w.job === job}" class="${w.job === job ? "active" : ""}">${name}</button>`).join("");
    const settings = w.job === "route" ?
      `<div class="fields">${routeSelect("Route", "line", { saw: "Forest → Sawmill → Counter", grill: "Boars → Grill → Counter" })}
      ${routeSelect("Preferred load", "min", { 1: "1 item", 2: "2 items", 3: "3 items" })}
      ${routeSelect("Priority", "priority", ROUTE_PRIORITIES)}</div>` : "";
    return details(`worker-${i}`, `Helper ${i + 1} · ${w.job === "route" ? (route.line === "saw" ? "Timber route" : "Food route") : JOBS[w.job]}`,
      `<div class="helper">${jobs}</div>${settings}
      <div class="fields">${routeSelect("At the counter", "reserve", { false: "Sell goods", true: "Pack jobs first · sell surplus" })}</div>`);
  }
  function stationControls(key, st, atInput) {
    const { raw, goods } = LINES[key], load = state.player.bag[raw];
    const stage = `data-station="${key}"`;
    const setting = (label, field, value, options) => select(label, `data-station-field="${field}" ${stage}`, value, options);
    const handling = `<div class="fields">${setting("Handling", "manual", st.manual, { false: "Automatic", true: "Manual" })}
      ${setting(`Keep ${goods[0]}`, "target", st.target, Object.fromEntries(TARGETS.map(n => [n, n || "Off"])))}</div>
      <p class="station-details">${onHand(state, goods[0])} ${goods[0]} on hand. A stock target makes basics first and holds surplus at the counter. Choose a premium recipe to switch to after stocking up.</p>`;
    const timber = key === "saw"
      ? `<p class="station-details">${state.timberSorted} selected logs. Selected timber speeds up finished lumber.</p><div class="actions">
         ${action("Sort 2 logs", `data-sort="2"`, !st.input)}${action("Return selected to general stock", `data-sort="-30"`, !state.timberSorted)}</div>`
      : `<p class="station-details">Shared offcuts ${state.fuel}/${FUEL_CAP}. One offcut and five meat make two trays when there’s room.</p>
         <div class="fields">${setting("Tray batches", "doubles", state.doubles, { false: "Single batch", true: "Double with offcuts" })}</div>`;
    const loading = atInput
      ? `<p class="station-details">Staged ${st.staging}/${stageCapacity(state, key)} ${raw}${st.bin ? " · bin feeds automatically" : ""}</p><div class="actions">
          ${action("Unload matching goods", `data-load="unload" ${stage}`, !load || inputCount(state, key) >= inputCapacity(state, key))}
          ${action(st.bin ? "Drop load into bin" : "Stage goods", `data-load="stage" ${stage}`, !load || st.staging >= stageCapacity(state, key))}
          ${action("Load next batch", `data-load="queue" ${stage}`, !st.staging || !nextBatchNeeds(state, key) || inputCount(state, key) >= inputCapacity(state, key))}</div>`
      : `<div class="actions">${action(state.cart ? "Fill cart from output" : "Pick up goods", `data-load="pickup" ${stage}`,
          !goods.some((g, i) => roomFor(state, state.player, g) > 0 && (i ? st.premium : st.output)))}</div>`;
    const projects = `<p class="station-details">Projects use lumber from your load or the camp crate.</p><div class="actions">
      ${action(st.bin ? "Drop-off bin installed" : `Build drop-off bin<br><small>${projectLabel(BIN_COST)} · 12 staged goods</small>`,
        `data-project="bin" ${stage}`, st.bin || !projectReady(state, BIN_COST))}
      ${st.layout ? `<p class="station-details">${REBUILDS[st.layout].name} rebuild · ${REBUILDS[st.layout].effect}</p>` :
        Object.entries(REBUILDS).map(([id, layout]) => action(`${layout.name}<br><small>${projectLabel(layout)} · ${layout.effect}</small>`,
          `data-project="${id}" ${stage}`, !projectReady(state, layout))).join("")}</div>`;
    return loading + details("production", "Stock targets, handling & batches", handling + timber) +
      equipmentControls(key, st) + details("projects", "Drop-off bin & permanent rebuild", projects);
  }
  const listedGoods = goods => Object.entries(goods).map(([good, qty]) => `${qty} ${NAMES[good]}`).join(" + ");
  function marketControls(b) {
    const m = state.market;
    const spot = Object.entries(PRICES).map(([k, price]) => `${NAMES[k]} ${price}`).join(" · ");
    const stock = m.stock;
    const available = Object.fromEntries(Object.keys(PRICES).map(k => [k, b[k] + (stock[k] ?? 0)]));
    const targets = marketTargets(state);
    const showTarget = t => {
      const progress = Object.entries(t.goods).map(([k, qty]) => `${t.packed[k] ?? 0}/${qty} ${NAMES[k]} · ${onHand(state, k)} on hand`).join("<br>");
      const timing = t.id === "contract" ? `Installment ${t.part + 1}/${t.total}` : t.ready ? "Pickup ready" : `Pickup on day ${t.due}`;
      return `<article class="operation-card"><h3>${t.name}</h3><p>${timing} · ${t.reward} coins</p><p>${progress}</p><div class="actions">
        ${action("Pack available goods", `data-market="pack" data-id="${t.id}"`, !canPack(available, t))}
        ${action("Close at regular prices", `data-market="close" data-id="${t.id}"`)}</div></article>`;
    };
    const offers = m.active ? "" : `<div class="offer-list">${marketOffers(state).map(id => {
      const c = CONTRACTS[id];
      const total = c.stages.reduce((sum, part) => sum + part.reward, 0);
      return `<article class="operation-card"><h3>${c.name}</h3><p>${c.stages.length} installments · ${total} coins</p>
        <p>First pickup · ${listedGoods(c.stages[0].goods)}</p>
        ${action("Take job", `data-market="accept" data-id="${id}"`)}</article>`;
    }).join("")}</div>`;
    const active = targets.find(t => t.id === "contract");
    const legacy = state.order ? `<article class="operation-card"><h3>Bulk order</h3>
      <p>Boards ${state.order.boards}/${BULK.boards} · Steaks ${state.order.steaks}/${BULK.steaks} · ${BULK.reward} coins</p><div class="actions">
      ${action("Deliver to order", 'data-bulk="deliver"', !["boards", "steaks"].some(k => b[k] && bulkRemaining(state, k)))}
      ${action("Close at regular prices", 'data-bulk="cancel"')}</div></article>` : "";
    const accounts = accountUnlocked(state) ? Object.entries(ACCOUNTS).map(([id, a]) => {
      const t = targets.find(entry => entry.id === id);
      return t ? showTarget(t) : `<article class="operation-card"><h3>${a.name}</h3>
        <p>${listedGoods(a.goods)} · ${a.reward} coins per pickup</p>${action("Open standing account", `data-market="account" data-id="${id}"`)}</article>`;
    }).join("") : "<p>Complete a market job to open standing accounts.</p>";
    const notice = m.notice ? `<p class="payment">${(CONTRACTS[m.notice.id] ?? ACCOUNTS[m.notice.id]).name} · ${m.notice.sale ? "Closed" : "Paid"} · ${m.notice.reward} coins</p>` : "";
    const warehouse = `<p>Held at the counter · ${stock.boards} boards · ${stock.steaks} steaks</p><div class="actions">
      ${Object.keys(stock).map(k => action(`Take ${NAMES[k]}`, `data-market="withdraw" data-id="${k}"`, !stock[k] || roomFor(state, state.player, k) <= 0)).join("")}</div>`;
    const sales = `<p>Spot prices per item · ${spot}</p><div class="actions">
      ${action(`Automatic sales ${m.autoSale ? "on" : "off"}`, 'data-market="autosale"')}
      ${action("Sell one at spot price", 'data-market="sell"', !Object.keys(PRICES).some(k => b[k]))}
      ${!m.active && !state.order ? action("Take quick bulk order · 92 coins", 'data-bulk="accept"') : ""}</div>` + warehouse;
    const loadingBay = m.bay ? `<p>Loading bay open · ${m.shipments} large shipments completed.</p>` :
      action(`Build loading bay · ${projectLabel(BAY)}`, 'data-project="bay"', !projectReady(state, BAY));
    return `<p class="station-details">Day ${marketDay(state)} · ${m.completed} jobs finished · ${m.recurring} account pickups</p>${notice}
      ${active ? showTarget(active) : legacy || offers}
      ${details("accounts", "Standing accounts", "<p>Pack ahead. Pickups recur every two play days.</p>" + accounts)}
      ${details("sales", "Spot sales & reserved stock", sales)}
      ${details("bay", "Loading bay & large shipments", loadingBay)}`;
  }
  function updateUI() {
    const p = state.player,
      b = p.bag;
    $("cash").textContent = state.cash;
    $("bag").textContent = `${count(b)}/${capacity(state)}` +
      GOODS.filter(k => b[k]).map(k => ` · ${NAMES[k]} ${b[k]}`).join("");
    $("bagLabel").textContent = state.cart ? "PACK + CART" : "BACKPACK";
    for (const key of Object.keys(LINES)) {
      const st = state.stations[key];
      SPOTS[key + "In"].el.lastElementChild.textContent = stationStatus(state, key);
      SPOTS[key + "Out"].el.lastElementChild.textContent =
        outputCount(st) === outputCapacity(state, key) ? "Output full" : `${outputCount(st)} ready`;
    }
    const active = state.market.active;
    SPOTS.sell.el.lastElementChild.textContent = active ? `Job ${active.part + 1}/${CONTRACTS[active.id].stages.length}` :
      state.order ? "Bulk order" : "Jobs & sales";
    const current = active ? marketTargets(state).find(t => t.id === "contract") : null;
    const focus = $("jobStatus");
    focus.hidden = !current;
    if (current) {
      const remaining = Object.keys(current.goods).flatMap(k => neededFor(current, k) ? [[k, neededFor(current, k)]] : []);
      focus.textContent = `${current.name} · Need ${listedGoods(Object.fromEntries(remaining))}`;
    }
    $("saveStatus").textContent = saveError ? " · Save unavailable" : "";
    let title = "Choose a destination",
      content = "Gather logs and meat, process them, then sell the finished goods at the counter.",
      hint = "Walk to the forest or boars to gather.",
      icon = "✳";
    let station = Object.entries(SPOTS).find(([k, v]) => near(p, v));
    if (station) {
      let k = station[0];
      if (k === "forest" || k === "boars") {
        title = k === "forest" ? "Forest edge" : "Boar meadow";
        content = `${state.sources[k].remaining ? "Gathering automatically while nearby." : "Restocking in " + Math.ceil(state.sources[k].regrow) + " seconds."} <button class="action" data-return="${k === "forest" ? "logs" : "meat"}" ${b[k === "forest" ? "logs" : "meat"] ? "" : "disabled"}>Return ${k === "forest" ? "logs" : "meat"} to nature (no coins)</button>`;
        hint =
          count(b) >= capacity(state)
            ? "Load full. Deliver goods or set them down at the improvement pad."
            : "Stay nearby to gather.";
      } else if (k === "build") {
        title = "Camp improvements";
        icon = "⌂";
        hint = "Choose an improvement or set down your load.";
        content =
          '<div class="actions">' +
          Object.entries(UPGRADES)
            .map(([key, u]) => {
              let l = state.levels[key];
              return `<button class="action" data-buy="${key}" ${l === 3 || state.cash < u.prices[l] ? "disabled" : ""}>${u.name} ${l === 3 ? "· MAX" : `<strong>· ${u.prices[l]} coins</strong><br>${u.values[l]} → ${u.values[l + 1]} ${u.unit}`}</button>`;
            })
            .join("") +
          `<button class="action" data-buy="helper" ${state.workers.length === 2 || state.cash < [35, 80][state.workers.length] ? "disabled" : ""}>Helper ${state.workers.length === 2 ? "· MAX" : `<strong>· ${[35, 80][state.workers.length]} coins</strong>`}</button><button class="action" data-stash ${count(b) ? "" : "disabled"}>Set down backpack (crate ${count(state.stash)}/16)</button>` +
          `<button class="action" data-buy="cart" ${unavailable(state.cart || state.cash < CART_PRICE)}>Handcart ${state.cart ? "· Installed" : `· ${CART_PRICE} coins<br>Carry ${CART_SLOTS} more goods`}</button>` +
          GOODS.filter((g) => state.stash[g])
            .map(
              (g) =>
                `<button class="action" data-get="${g}" ${unavailable(roomFor(state, state.player, g) <= 0)}>Take ${NAMES[g]} (${state.stash[g]})</button>`,
            )
            .join("") +
          "</div>" +
          cartControls() + state.workers.map(helperControls).join("");
      } else if (k === "sell") {
        title = "Market counter";
        content = marketControls(b);
        hint = "Take a job, pack an order, or sell your goods.";
      } else {
        const key = k.startsWith("saw") ? "saw" : "grill", st = state.stations[key];
        const [basic, premium] = LINES[key].goods;
        title = key === "saw" ? "Sawmill" : "Grill";
        content = `<p class="station-details"><strong>${stationStatus(state, key)}</strong> ·
          Input ${inputCount(state, key)}/${inputCapacity(state, key)} · Output ${outputCount(st)}/${outputCapacity(state, key)}
          ${st.output || st.premium ? `· ${st.output} ${NAMES[basic]}, ${st.premium} ${NAMES[premium]}` : ""}
          ${st.jobs.length ? `· ${st.jobs.map(job => NAMES[job.good]).join(" + ")} underway` : ""}</p>
          <div class="actions" aria-label="Next jobs">${recipeButtons(key, st)}</div>
          ${stationControls(key, st, k.endsWith("In"))}`;
        hint = st.manual ? "Manual handling. Use the load controls." : k.endsWith("In")
          ? "Matching raw goods unload automatically."
          : "Finished goods fill your available load.";
      }
    }
    $("hint").textContent = hint;
    $("panelTitle").textContent = title;
    $("panelIcon").textContent = icon;
    if (content !== lastPanel) {
      const panel = $("panelContent");
      const samePlace = panel.dataset.title === title;
      const opened = samePlace ? [...panel.querySelectorAll("details[open]")].map(el => el.dataset.section) : [];
      const focused = samePlace && panel.contains(document.activeElement) ? document.activeElement : null;
      const panelScroll = $("panel");
      const scrollTop = samePlace ? panelScroll.scrollTop : 0;
      panel.innerHTML = content;
      panel.dataset.title = title;
      for (const section of panel.querySelectorAll("details")) section.open = opened.includes(section.dataset.section);
      if (focused) {
        const original = JSON.stringify({ ...focused.dataset });
        const replacement = [...panel.querySelectorAll(focused.tagName)].find(el =>
          JSON.stringify({ ...el.dataset }) === original && el.parentElement?.dataset.section === focused.parentElement?.dataset.section && !el.disabled);
        replacement?.focus({ preventScroll: true });
      }
      panelScroll.scrollTop = scrollTop;
      lastPanel = content;
    }
  }
  $("jobStatus").onclick = () => { destination = { ...SPOTS.sell }; };
  $("panelContent").addEventListener("click", (e) => {
    let t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.buy) purchase(state, t.dataset.buy);
    if (t.hasAttribute("data-stash")) stashAll(state);
    if (t.dataset.get) retrieve(state, t.dataset.get);
    if (t.dataset.return) returnRaw(state, t.dataset.return);
    if (t.dataset.job) assign(state, +t.dataset.worker, t.dataset.job);
    if (t.dataset.recipe) selectRecipe(state, t.dataset.station, t.dataset.recipe);
    if (t.dataset.install) install(state, t.dataset.station, t.dataset.install);
    if (t.dataset.market) marketAction(state, t.dataset.market, t.dataset.id);
    if (t.dataset.cartRack) cartRack(state, t.dataset.cartRack);
    if (t.dataset.project) buildProject(state, t.dataset.project, t.dataset.station);
    if (t.dataset.load) handleLoad(state, t.dataset.station, t.dataset.load);
    if (t.dataset.sort) sortTimber(state, Number(t.dataset.sort));
    if (t.dataset.bulk === "accept") acceptBulk(state);
    if (t.dataset.bulk === "deliver") deliverBulk(state);
    if (t.dataset.bulk === "cancel") cancelBulk(state);
    lastPanel = "";
    updateUI();
    save();
  });
  $("panelContent").addEventListener("change", e => {
    const { dataset: d, value } = e.target;
    const converted = value === "true" || value === "false" ? value === "true" : /^\d+$/.test(value) ? Number(value) : value;
    if (d.route) setWorkerRoute(state, Number(d.worker), d.route, converted);
    else if (d.stationField) setStation(state, d.station, d.stationField, converted);
    else return;
    lastPanel = "";
    updateUI();
    save();
  });
  let last = performance.now(),
    acc = 0,
    ui = 0,
    saveTimer = 0,
    raf = 0,
    lastSold = state.sold,
    customerReaction = 0;
  function pose(model, person, now) {
    const dx = person.x - model.g.position.x, dz = person.z - model.g.position.z;
    const walking = Math.hypot(dx, dz) > .001;
    const work = activity(person);
    // The fixed simulation advances every 100ms; keep the stride between those frames.
    if (walking) {
      model.g.rotation.y = Math.atan2(dx, dz);
      model.lastStep = now;
    }
    const stride = now - model.lastStep < 135 ? Math.sin(now / 78) * .43 : 0;
    model.l.rotation.x = stride;
    model.r.rotation.x = -stride;
    model.g.position.set(person.x, 0, person.z);
    model.axe.visible = work?.kind === "chop";
    model.carried.visible = !!work && ["load", "stack", "gather"].includes(work.kind);
    let reach = 0;
    if (work) {
      if (work.kind === "chop" || work.kind === "gather") {
        const source = work.kind === "chop" ? SPOTS.forest : SPOTS.boars;
        model.g.rotation.y = Math.atan2(source.x - person.x, source.z - person.z);
      }
      const phase = 1 - work.left / work.duration;
      reach = Math.sin(phase * Math.PI);
      model.carried.material = mat(goodsColors[work.good]);
      model.carried.position.y = .62 + reach * .56;
    }
    model.arms[0].rotation.x = -reach * .9 - stride * .6;
    model.arms[1].rotation.x = -reach * (model.axe.visible ? 2.9 : 1.4) + stride * .6;
    const firstGood = GOODS.find(k => person.bag[k]);
    const amount = count(person.bag);
    for (const [i, item] of model.load.entries()) {
      item.visible = i < amount;
      if (firstGood) item.material = mat(goodsColors[firstGood]);
    }
  }
  function drawCamp(now) {
    pose(player, state.player, now);
    workerModels.forEach((model, i) => pose(model, state.workers[i], now));
    if (state.cart) {
      const heading = player.g.rotation.y;
      const p = state.player;
      cart.position.set(p.x - 1.7 * Math.sin(heading), 0, p.z - 1.7 * Math.cos(heading));
      cart.rotation.y = heading;
      const load = cartLoad(state);
      for (const rail of rackRails) {
        rail.visible = state.cartRack !== "mixed";
        rail.material = mat(state.cartRack === "timber" ? 0xa26d47 : 0x39766e);
      }
      cartGoods.forEach((item, i) => {
        item.visible = i < load.length;
        if (item.visible) item.material = mat(goodsColors[load[i]]);
      });
    }
    cart.visible = state.cart;
    bay.visible = state.market.bay;
    const active = state.market.active;
    const packed = active ? Object.values(active.packed).reduce((sum, n) => sum + n, 0) : 0;
    packedCrates.forEach((crate, i) => { crate.visible = i < Math.ceil(packed / 3); });
    for (const [key, kit] of Object.entries(fixtures)) {
      const st = state.stations[key];
      for (const part of Object.keys(EQUIPMENT)) kit[part].visible = st.equipment === part;
      kit.supply.visible = st.bin || st.staging > 0;
      kit.staged.forEach((item, i) => { item.visible = i < st.staging; });
      kit.rebuild.visible = !!st.layout;
      if (st.layout) kit.beam.material = mat({ fast: 0xbe8c37, finish: 0x567da0, freight: 0x508e77 }[st.layout]);
      if (kit.blade && st.jobs.length > 1) kit.blade.rotateY(.13);
      if (kit.flame) kit.flame.visible = st.jobs.length > 1;
    }
    if (state.stations.saw.jobs.length) blade.rotateY(.13);
    fire.visible = state.stations.grill.jobs.length > 0;
    for (const { key, input, line, items } of piles) {
      const st = state.stations[key];
      for (const [i, item] of items.entries()) {
        item.visible = i < (input ? st.input : outputCount(st));
        if (item.visible) item.material = mat(goodsColors[input ? line.raw : line.goods[Number(i >= st.output)]]);
      }
    }
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function startLoop() {
    last = performance.now();
    if (!raf && !paused && !document.hidden) raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = 0;
    if (document.hidden || paused) return;
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000);
    if (now - last < 1000 / 30) return;
    last = now;
    acc += dt;
    while (acc >= 0.1) {
      let dx = joy.x + (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0),
        dz = joy.z + (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      if (!dx && !dz && destination) {
        dx = destination.x - state.player.x;
        dz = destination.z - state.player.z;
        if (Math.hypot(dx, dz) < 0.25) {
          destination = null;
          dx = dz = 0;
        }
      }
      let d = Math.hypot(dx, dz);
      if (d) {
        let step = Math.min(0.38, d);
        state.player.x = Math.max(-10.7, Math.min(10.7, state.player.x + (dx / d) * step));
        state.player.z = Math.max(-10.7, Math.min(10.7, state.player.z + (dz / d) * step));
      }
      tick(state, 0.1);
      acc -= 0.1;
    }
    syncWorkers();
    drawCamp(now);
    if (state.sold !== lastSold) {
      lastSold = state.sold;
      customerReaction = 1;
    }
    customerReaction = Math.max(0, customerReaction - dt);
    customers[0].g.position.y = Math.sin(customerReaction * Math.PI) * 0.35;
    boarModels.forEach((m, i) => {
      m.visible = state.sources.boars.remaining > i * 3;
    });
    forestTrees.forEach((m, i) => {
      m.visible = state.sources.forest.remaining > i * 1.5;
    });
    renderer.render(scene, camera);
    ui += dt;
    saveTimer += dt;
    if (ui > 0.25) {
      updateUI();
      ui = 0;
    }
    if (saveTimer > 3) {
      save();
      saveTimer = 0;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      save();
      stopLoop();
    } else startLoop();
  });
  window.addEventListener("pagehide", () => {
    save();
    stopLoop();
  });
  updateUI();
  startLoop();
}
