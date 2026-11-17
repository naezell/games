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
  cancelBulk,
} from "./sim.mjs";
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
  // Equipment fits behind the existing machines and their loading pads.
  const fixtures = {};
  for (const [key, x] of [["saw", -5.5], ["grill", 5.5]]) {
    const kit = fixtures[key] = { machine: group(x, -4), rack: group(SPOTS[key + "In"].x, -3.4),
      bench: group(SPOTS[key + "Out"].x, -3.35) };
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
  const cartGoods = Array.from({ length: CART_SLOTS }, (_, i) =>
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
  const recipeButtons = (key, st) => Object.entries(LINES[key].recipes).map(([good, recipe]) =>
    `<button class="action choice" data-recipe="${good}" data-station="${key}" aria-pressed="${st.recipe === good}">${recipe.name} · ${PRICES[good]} coins<br><small>${recipe.input} ${LINES[key].raw} · ${(recipe.time * UPGRADES[key].values[state.levels[key]]).toFixed(2).replace(/\.?0+$/, "")}s</small></button>`).join("");
  function equipmentControls(key, st) {
    if (st.equipment) return `<p class="station-details">${EQUIPMENT[st.equipment].name} installed</p>`;
    return `<details><summary>Choose this station’s one equipment upgrade</summary><div class="actions">${Object.entries(EQUIPMENT).map(([part, e]) =>
      `<button class="action" data-install="${part}" data-station="${key}" ${unavailable(state.cash < e.price)}>${e.name} · ${e.price} coins<br><small>${e.effect}</small></button>`).join("")}</div></details>`;
  }
  function marketControls(b) {
    const spot = Object.entries(PRICES).map(([k, price]) => `${NAMES[k]} ${price}`).join(" · ");
    const order = state.order;
    const canDeliver = ["boards", "steaks"].some(k => b[k] && bulkRemaining(state, k));
    if (!order) return `<p class="station-details">Automatic sales · ${spot} coins each</p>
      <button class="action" data-bulk="accept">Take bulk order · 8 boards + 8 steaks · ${BULK.reward} coins</button>
      <small class="market-note">Optional · no deadline</small>`;
    return `<p class="station-details"><strong>Bulk order · ${BULK.reward} coins</strong> · Boards ${order.boards}/${BULK.boards} · Steaks ${order.steaks}/${BULK.steaks}</p>
      <p class="station-details">Needed goods stay in your load until you deliver them. Other goods sell automatically.</p>
      <div class="actions"><button class="action" data-bulk="deliver" ${unavailable(!canDeliver)}>Deliver to order</button>
      <button class="action" data-bulk="cancel">Close order at regular prices</button></div>`;
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
                `<button class="action" data-get="${g}" ${count(b) >= capacity(state) ? "disabled" : ""}>Take ${NAMES[g]} (${state.stash[g]})</button>`,
            )
            .join("") +
          "</div>" +
          state.workers
            .map(
              (w, i) =>
                `<div class="helper">Helper ${i + 1}: ${Object.entries(JOBS).map(([job, name]) => `<button data-worker="${i}" data-job="${job}" aria-pressed="${w.job === job}" class="${w.job === job ? "active" : ""}">${name}</button>`).join("")}</div>`,
            )
            .join("");
      } else if (k === "sell") {
        title = "Market counter";
        content = marketControls(b);
        hint = "Sell goods or deliver a bulk order.";
      } else {
        const key = k.startsWith("saw") ? "saw" : "grill", st = state.stations[key];
        const [basic, premium] = LINES[key].goods;
        title = key === "saw" ? "Sawmill" : "Grill";
        content = `<p class="station-details"><strong>${stationStatus(state, key)}</strong> ·
          Input ${st.input}/${inputCapacity(state, key)} · Output ${outputCount(st)}/${outputCapacity(state, key)}
          ${st.output || st.premium ? `· ${st.output} ${NAMES[basic]}, ${st.premium} ${NAMES[premium]}` : ""}
          ${st.jobs.length ? `· ${st.jobs.map(job => NAMES[job.good]).join(" + ")} underway` : ""}</p>
          <div class="actions" aria-label="Next jobs">${recipeButtons(key, st)}</div>
          ${equipmentControls(key, st)}`;
        hint = k.endsWith("In")
          ? "Raw goods unload automatically."
          : "Finished goods load automatically if your backpack has room.";
      }
    }
    $("hint").textContent = hint;
    $("panelTitle").textContent = title;
    $("panelIcon").textContent = icon;
    if (content !== lastPanel) {
      const panel = $("panelContent");
      const wasOpen = panel.querySelector("details")?.open && panel.dataset.title === title;
      const focused = panel.contains(document.activeElement) ? document.activeElement : null;
      panel.innerHTML = content;
      panel.dataset.title = title;
      if (wasOpen && panel.querySelector("details")) panel.querySelector("details").open = true;
      if (focused) {
        const replacement = [...panel.querySelectorAll(focused.tagName)].find(el =>
          el.textContent.trim() === focused.textContent.trim() && !el.disabled);
        replacement?.focus({ preventScroll: true });
      }
      lastPanel = content;
    }
  }
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
    if (t.dataset.bulk === "accept") acceptBulk(state);
    if (t.dataset.bulk === "deliver") deliverBulk(state);
    if (t.dataset.bulk === "cancel") cancelBulk(state);
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
      const bagGoods = GOODS.flatMap(k => Array(p.bag[k]).fill(k));
      const load = bagGoods.slice(UPGRADES.pack.values[state.levels.pack]);
      cartGoods.forEach((item, i) => {
        item.visible = i < load.length;
        if (item.visible) item.material = mat(goodsColors[load[i]]);
      });
    }
    cart.visible = state.cart;
    for (const [key, kit] of Object.entries(fixtures)) {
      const st = state.stations[key];
      for (const part of Object.keys(EQUIPMENT)) kit[part].visible = st.equipment === part;
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
