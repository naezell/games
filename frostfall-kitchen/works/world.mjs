// A fixed, batched view of the original camp's low-poly winter settlement.
const COLORS = {
  snow: 0xeaf0f7, ice: 0xb6cedf, shale: 0x6c879a, soil: 0x405c6e,
  path: 0xc1b4a6, wood: 0xaa6645, darkWood: 0x553b37, timber: 0xd69a62,
  metal: 0x547082, glass: 0x8dc7d3, lit: 0xf9cd83, crop: 0xdead64,
  blue: 0x435e78, green: 0x366e6d, red: 0x9c4f49, shadow: 0xa5a7a6,
  wall: 0xcc8554, wallLight: 0xdca06a, wallTrim: 0x8c513e, machine: 0x577f83,
  rail: 0x43717a, field: 0xc4cfca, tile: 0x988b86,
};
const SITE_ACCENT = {
  forest: '#a2d8ba', farm: '#f5cc78', kitchen: '#f8ad8e',
  mill: '#e5bca0', depot: '#9cd3ed', hall: '#c2c6ff',
};
const COATS = [0xba513c, 0x19656c, 0x426aa8, 0x9e5737, 0x655393, 0x378158, 0xaa3f6f, 0x718035];
const SKIN = [0xe8a785, 0xaa704d, 0xf1c3a0, 0xbe875f];
const WORKSHOPS = { kitchen: [4.55, 4.15], mill: [4.6, 4.1], depot: [4.7, 4.27] };
const NODE_LIMIT = 160;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const seededFraction = n => ((Math.imul(n + 515, 1664525) ^ Math.imul(n * n + 47, 1013904223)) >>> 0) / 4294967296;

export function createWorld(canvas, { onSelect, lowPower = true, locations }) {
  const THREE = globalThis.THREE;
  if (!THREE) throw new Error('Frostfall’s 3D library could not be loaded.');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !lowPower, powerPreference: lowPower ? 'low-power' : 'default',
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ea5af);
  scene.add(new THREE.HemisphereLight(0xf5f8fb, 0xa78b7a, 0.92));
  const key = new THREE.DirectionalLight(0xffecd6, 1.03);
  key.position.set(-6, 16, -4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc1def2, 0.38);
  fill.position.set(8, 8, 12);
  scene.add(fill);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const bounds = Object.values(locations).reduce((box, point) => ({
    xmin: Math.min(box.xmin, point.x - 3.65),
    xmax: Math.max(box.xmax, point.x + 3.25),
    zmin: Math.min(box.zmin, point.z - 3.85),
    zmax: Math.max(box.zmax, point.z + 3.05),
  }), { xmin: -10, xmax: 10, zmin: -9, zmax: 8 });
  const midX = (bounds.xmax + bounds.xmin) / 2;
  const midZ = (bounds.zmax + bounds.zmin) / 2;
  camera.position.set(midX + 15, 26, midZ + 23);
  camera.lookAt(midX, 0.25, midZ);
  camera.updateMatrixWorld();
  const vector = new THREE.Vector3();
  const extent = { x: 0, y: 0 };
  for (const x of [bounds.xmin, bounds.xmax]) {
    for (const z of [bounds.zmin, bounds.zmax]) {
      for (const y of [-1.45, 1.7]) {
        vector.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        extent.x = Math.max(extent.x, Math.abs(vector.x));
        extent.y = Math.max(extent.y, Math.abs(vector.y));
      }
    }
  }

  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(0.5, 1, 7),
    trunk: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    coat: new THREE.CylinderGeometry(0.38, 0.5, 1, 8),
    orb: new THREE.SphereGeometry(0.5, 8, 6),
    stone: new THREE.DodecahedronGeometry(0.5, 0),
  };
  const solid = new THREE.MeshLambertMaterial();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const staticParts = new Map();
  const dynamicParts = new Map();
  const labelAssets = [];
  const siteLabels = new Map();
  const roadMarks = [];
  const clickTargets = [];
  const rotations = new Map();
  const part = (type, tint, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => (
    { type, tint, x, y, z, sx, sy, sz, ry, rx, rz }
  );
  const add = (...args) => {
    const p = part(...args);
    const parts = staticParts.get(p.type) || [];
    parts.push(p);
    staticParts.set(p.type, parts);
  };

  function setInstance(mesh, index, p) {
    transform.position.set(p.x, p.y, p.z);
    transform.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
    transform.scale.set(p.sx, p.sy, p.sz);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, color.set(p.tint));
  }

  function assembleStaticMeshes() {
    for (const [type, parts] of staticParts) {
      const mesh = new THREE.InstancedMesh(geometries[type], solid, parts.length);
      mesh.frustumCulled = false;
      for (let index = 0; index < parts.length; index++) setInstance(mesh, index, parts[index]);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }
    staticParts.clear();
  }

  function addMoving(...args) {
    const p = part(...args);
    let batch = dynamicParts.get(p.type);
    if (!batch) {
      const mesh = new THREE.InstancedMesh(geometries[p.type], solid, NODE_LIMIT);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch = { mesh, count: 0 };
      dynamicParts.set(p.type, batch);
      scene.add(mesh);
    }
    if (batch.count < NODE_LIMIT) setInstance(batch.mesh, batch.count++, p);
  }

  function box(tint, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) {
    add('box', tint, x, y, z, w, h, d, ry, rx, rz);
  }

  function greenhouse(x, z) {
    box(0xdcd3b6, x, 0.03, z, 4.2, .12, 3.65);
    for (const [i, hz] of [-1.2, -.38, .44, 1.26].entries()) {
      box(i % 2 ? 0x74544e : 0x876555, x, .12, z + hz, 3.8, .14, .58);
      for (let j = 0; j < 6; j++) {
        const fx = x - 1.45 + .58 * j;
        const h = .23 + seededFraction(21 + i * 7 + j) * .28;
        add('trunk', 0xaa824e, fx, .17 + h / 2, z + hz, .055, h, .055);
        add('cone', j % 2 ? 0xc59352 : COLORS.crop, fx, .17 + h, z + hz, .28, .42, .28, j);
      }
    }
    for (const fx of [-2.12, 2.12]) {
      box(COLORS.darkWood, x + fx, .38, z, .095, .12, 3.75);
      for (const fz of [-1.8, 0, 1.8]) {
        box(COLORS.timber, x + fx, .34, z + fz, .14, .68, .14);
        box(COLORS.snow, x + fx, .71, z + fz, .16, .08, .16);
      }
    }
    cabin(x + 1.25, z - 2.13, 1.85, 1.12, 1.07, COLORS.green);
  }

  function tree(x, z, size, palette) {
    add('trunk', COLORS.darkWood, x, size * .45, z, .29 * size, .9 * size, .29 * size);
    for (let i = 0; i < 3; i++) {
      const width = size * (1.32 - .25 * i);
      const height = size * (1.07 - .12 * i);
      const y = size * (.84 + i * .44);
      add('cone', palette[i], x, y, z, width, height, width, i * .64);
      add('cone', COLORS.snow, x, y + height * .16, z + .01, width * .74, height * .75, width * .74, i * .64);
    }
  }

  function forest(x, z) {
    const pines = [[-2.3, -1.6, 1.2], [-.9, -2.05, 1.5], [.45, -2.2, 1.25], [1.8, -1.85, 1.1],
      [-2.8, -.17, 1.08], [2.3, -.55, .98], [-1.3, -.74, 1.05], [.55, -.82, 1.14]];
    for (const [i, [tx, tz, size]] of pines.entries()) {
      tree(x + tx, z + tz, size, i % 2 ? [0x335d5f, 0x487674, 0x608782] : [0x365a53, 0x4e7464, 0x6f9078]);
    }
    add('trunk', COLORS.wood, x - 1.5, .19, z + .65, .63, .38, .61);
    add('trunk', COLORS.timber, x - 1.5, .391, z + .65, .63, .035, .61);
    timberStack(x + .87, z + .41, 1.1);
  }

  function timberStack(x, z, length) {
    for (const [dx, height] of [[-.25, .17], [.09, .17], [.43, .17], [-.08, .41], [.26, .41]]) {
      add('trunk', COLORS.wood, x + dx, height, z, .33, length, .33, 0, Math.PI / 2);
      add('trunk', COLORS.timber, x + dx, height, z + length / 2, .28, .035, .28, 0, Math.PI / 2);
    }
  }

  function windowAt(x, y, z, width) {
    box(COLORS.darkWood, x, y, z, width + .13, .72, .045);
    box(COLORS.lit, x, y, z + .027, width, .54, .03);
    box(COLORS.darkWood, x, y, z + .05, .055, .57, .025);
    box(COLORS.darkWood, x, y, z + .05, width, .046, .025);
  }

  function cabin(x, z, width, height, depth, roofColor, wall = COLORS.wood) {
    box(COLORS.shale, x, .13, z, width + .22, .26, depth + .22);
    box(wall, x, height / 2 + .22, z, width, height, depth);
    for (const dx of [-width / 2 + .03, width / 2 - .03]) {
      box(COLORS.darkWood, x + dx, height / 2 + .22, z + depth / 2, .14, height, .13);
      box(COLORS.darkWood, x + dx, height / 2 + .22, z - depth / 2, .14, height, .13);
    }
    for (let i = 1; .3 * i < height; i++) {
      box(COLORS.darkWood, x, .3 * i + .19, z + depth / 2, width, .025, .028);
      box(COLORS.darkWood, x + width / 2, .3 * i + .19, z, .028, .025, depth);
    }
    const panel = (depth / 2 + .17) / Math.cos(.43);
    for (const sign of [-1, 1]) {
      box(roofColor, x, height + .49, z + sign * (depth / 4 + .05), width + .45, .18, panel, 0, sign * .43);
      box(COLORS.snow, x, height + .585, z + sign * (depth / 4 + .02), width + .3, .09, panel * .88, 0, sign * .43);
    }
    box(roofColor, x, height + .785, z, width + .42, .11, .13);
  }

  function workshop(x, z, accent, [width, depth]) {
    const back = z - depth / 2;
    const left = x - width / 2;
    box(COLORS.shale, x + .05, .08, z + .04, width + .29, .15, depth + .26);
    box(COLORS.tile, x, .176, z, width + .1, .1, depth + .1);
    const floor = [0xa79994, 0xb8aaa2, 0xa99f99, 0xada29c, 0x9c938e];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 6; j++) {
        const tint = floor[Math.floor(seededFraction(i * 7 + j + 42) * floor.length)];
        box(tint, left + (i + .5) * width / 7, .233, back + (j + .5) * depth / 6, width / 7 - .024, .025, depth / 6 - .025);
      }
    }
    const high = 1.91;
    const wallTop = high + .25;
    const sideA = depth / 2 - .8;
    const sideB = depth / 2 - .39;
    const gateSide = [[back + sideA / 2, sideA], [back + depth - sideB / 2, sideB]];
    box(COLORS.wall, x, high / 2 + .25, back, width + .17, high, .18);
    box(COLORS.wallTrim, x, wallTop + .04, back, width + .23, .12, .22);
    box(COLORS.snow, x, wallTop + .11, back, width + .16, .04, .11);
    for (const [center, length] of gateSide) {
      box(COLORS.wallLight, left, high / 2 + .25, center, .18, high, length);
      box(COLORS.wallTrim, left, wallTop + .04, center, .22, .12, length + .05);
      box(COLORS.snow, left, wallTop + .11, center, .11, .04, length - .03);
      box(COLORS.wallTrim, left + .113, .39, center, .05, .19, length);
      for (const fraction of [-.28, .08, .36]) {
        box(COLORS.wallTrim, left + .1, 1.21, center + fraction * length, .025, 1.83, .019);
      }
    }
    for (const edge of [back + sideA, back + depth - sideB]) {
      box(COLORS.wallTrim, left, 1.2, edge, .225, 1.9, .195);
    }
    for (let i = 1; i < 10; i++) {
      box(COLORS.wallTrim, left + i * width / 10, 1.2, back + .101, .022, 1.84, .02);
    }
    box(COLORS.darkWood, left + .03, 1.18, back + .05, .19, 1.89, .18);
    box(COLORS.darkWood, left + width, 1.2, back + .03, .16, 1.9, .2);
    box(COLORS.darkWood, left, 1.2, back + depth, .2, 1.9, .17);
    box(accent, x, .29, back + depth + .064, width + .17, .14, .16);
    box(accent, left + width + .07, .287, z, .15, .13, depth + .07);
    box(COLORS.wallTrim, x, .39, back + .113, width, .19, .05);
    for (let i = 0; i < 2; i++) {
      const panelX = x - .72 + i * 1.48;
      box(COLORS.wallTrim, panelX, 1.49, back + .113, .92, .65, .09);
      box(COLORS.rail, panelX, 1.49, back + .174, .77, .53, .05);
      box(COLORS.glass, panelX, 1.52, back + .206, .66, .39, .024);
      box(COLORS.rail, panelX, 1.5, back + .224, .057, .47, .03);
    }
  }

  function crate(x, y, z, tint, size = .52) {
    box(COLORS.darkWood, x, y - .04, z, size + .03, .09, size + .03);
    box(tint, x, y + size * .39, z, size, size * .8, size);
    box(COLORS.timber, x, y + size * .79, z, size + .04, .092, size + .04);
    box(COLORS.lit, x, y + size * .39, z + size * .51, size * .35, size * .25, .02);
  }

  function workstation(x, z, width = 1.75, depth = .94) {
    box(0x857b75, x + .06, .256, z + .08, width + .22, .025, depth + .34);
    for (const dx of [-width / 2 + .17, width / 2 - .17]) {
      box(COLORS.darkWood, x + dx, .53, z, .16, .63, depth * .83);
    }
    box(COLORS.machine, x, .82, z, width, .23, depth);
    box(COLORS.rail, x, .70, z + depth / 2, width, .185, .07);
    box(COLORS.glass, x, .938, z, width - .17, .065, depth - .12);
    box(COLORS.darkWood, x, .87, z - depth / 2 + .05, width, .124, .08);
  }

  function loadZone(x, z, accent, width = 1.2, depth = 1.04) {
    box(accent, x, .264, z, width, .033, depth);
    const mark = 0xeae3d4;
    box(mark, x, .285, z - .03, .14, .016, .48);
    box(mark, x - .085, .287, z - .26, .125, .017, .24, -.73);
    box(mark, x + .085, .287, z - .26, .125, .017, .24, .73);
  }

  function kitchen(x, z) {
    workshop(x, z, 0xce745a, WORKSHOPS.kitchen);
    workstation(x - .7, z - .77, 2.14, 1.17);
    box(COLORS.rail, x - .79, 1.03, z - .85, 1.82, .15, .85);
    for (const dx of [-1.3, -.71, -.11]) {
      add('trunk', 0x35434c, x + dx, 1.16, z - .78, .46, .10, .46);
      add('trunk', COLORS.red, x + dx, 1.217, z - .78, .25, .04, .24);
    }
    for (const dx of [-1.67, .25]) box(COLORS.shale, x + dx, 1.44, z - 1, .10, .78, .12);
    box(COLORS.shale, x - .71, 1.856, z - 1.03, 2.1, .24, 1.06);
    box(COLORS.wallTrim, x - .72, 1.765, z - .525, 2.16, .15, .14);
    box(COLORS.lit, x - .72, 1.727, z - .444, 1.33, .039, .035);
    box(COLORS.shale, x - .71, 2.21, z - 1.24, .47, .56, .51);
    box(COLORS.darkWood, x - .71, 2.5, z - 1.24, .61, .12, .65);
    workstation(x + 1.25, z -.78, 1.15, 1.1);
    add('trunk', COLORS.lit, x + 1.07, 1.006, z - .66, .21, .12, .2);
    add('trunk', COLORS.red, x + 1.42, 1.03, z - .82, .32, .18, .27);
    loadZone(x + 1.36, z + 1.31, COLORS.green);
    crate(x + 1.65, .29, z + .47, 0xc18c4c, .48);
  }

  function mill(x, z) {
    workshop(x, z, 0xd2915f, WORKSHOPS.mill);
    workstation(x, z - .57, 2.7, 1.26);
    box(COLORS.rail, x, 1.11, z - .57, 2.35, .23, .95);
    box(COLORS.shale, x - .7, 1.22, z - .55, .20, .1, .89);
    box(COLORS.shale, x + .7, 1.22, z - .55, .20, .1, .89);
    box(COLORS.red, x + 1.18, 1.137, z + .065, .14, .1, .075);
    timberStack(x - 1.43, z + .5, .91);
    for (let i = 0; i < 3; i++) box(i % 2 ? COLORS.wood : COLORS.timber, x + 1.63, .28 + i * .1, z + .47, .58, .09, 1.2);
    loadZone(x + 1.51, z + 1.5, 0x937857, .95, .76);
  }

  function depot(x, z) {
    workshop(x, z, 0x75a1aa, WORKSHOPS.depot);
    for (const side of [-1, 1]) {
      const rx = x + side * 1.17;
      box(COLORS.rail, rx, .376, z - .86, 1.88, .18, 1.36);
      box(COLORS.rail, rx, 1.06, z - .86, 1.88, .13, 1.36);
      for (const dx of [-.88, .88]) {
        box(COLORS.rail, rx + dx, .927, z - .27, .1, 1.33, .12);
        box(COLORS.rail, rx + dx, .927, z - 1.45, .1, 1.33, .12);
      }
    }
    // Only permanent fittings are static. The colored crates on each shelf represent actual inventory.
    for (const dx of [-1.33, -.02, 1.29]) loadZone(x + dx, z + 1.15, COLORS.rail);
  }

  function hall(x, z) {
    cabin(x, z, 3.56, 1.92, 2.08, 0x685d81, 0xa98269);
    box(COLORS.darkWood, x, .83, z + 1.06, .82, 1.22, .15);
    box(COLORS.wood, x, .78, z + 1.15, .57, 1.08, .07);
    windowAt(x - 1, 1.26, z + 1.06, .7);
    windowAt(x + 1, 1.26, z + 1.06, .7);
    box(COLORS.shale, x - 1.15, 2.5, z - .52, .44, 1.21, .43);
    box(COLORS.snow, x - 1.15, 3.13, z - .52, .51, .08, .49);
    box(COLORS.darkWood, x + 2.18, 1.14, z + .85, .11, 2.26, .13);
    box(0x665e91, x + 2.48, 1.86, z + .86, .62, .59, .078);
    box(COLORS.lit, x + 2.48, 1.69, z + .907, .48, .058, .034);
  }

  function roadSegment(x1, z1, x2, z2, width, tint) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const distance = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    box(tint, (x1 + x2) / 2, .014, (z1 + z2) / 2, width, .027, distance + width * .5, yaw);
    const markers = Math.ceil(distance / .85);
    for (let i = 1; i < markers; i++) {
      roadMarks.push(part('box', 0xe7dbc0, x1 + dx * i / markers, .037, z1 + dz * i / markers, .10, .025, .3, yaw));
    }
  }

  function siteLabel(id, location, lift) {
    const surface = document.createElement('canvas');
    surface.width = 384;
    surface.height = 80;
    const context = surface.getContext('2d');
    const texture = new THREE.CanvasTexture(surface);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(location.x, lift, location.z - .78);
    sprite.renderOrder = 2;
    scene.add(sprite);
    labelAssets.push(texture, material);
    siteLabels.set(id, { sprite, surface, context, texture, text: location.name, status: '', width: 0 });
  }

  function paintLabel(id, label, status) {
    if (label.status === status) return;
    label.status = status;
    const { context, surface, texture, text } = label;
    context.clearRect(0, 0, surface.width, surface.height);
    const font = '700 30px system-ui, sans-serif';
    context.font = font;
    const w = clamp(context.measureText(text).width + 60, 152, 365);
    const x = (surface.width - w) / 2;
    const tint = status === 'blocked' ? '#ffc176' : SITE_ACCENT[id] || '#cce8f6';
    context.fillStyle = '#172d3c';
    context.beginPath();
    if (context.roundRect) context.roundRect(x, 7, w, 62, 23);
    else context.rect(x, 7, w, 62);
    context.fill();
    context.fillStyle = tint;
    context.beginPath();
    context.arc(x + 24, 38, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 204, 38, w - 44);
    texture.needsUpdate = true;
    label.width = w / surface.width;
  }

  const w = bounds.xmax - bounds.xmin;
  const d = bounds.zmax - bounds.zmin;
  box(COLORS.soil, midX + .06, -.65, midZ + .08, w + .12, 1.27, d + .12);
  box(COLORS.shale, midX, -.33, midZ, w + .2, .48, d + .2);
  box(COLORS.ice, midX, -.14, midZ, w + .08, .21, d + .08);
  box(COLORS.field, midX, -.047, midZ, w, .094, d);
  for (const [ix, iz] of [[-10, .15], [-2.6, -7.8], [1.6, 7.6], [7.8, .9], [8.5, -6.3], [-8.9, 6.94]]) {
    const n = ix * 13 + iz * 5;
    add('stone', COLORS.snow, ix, .02, iz, 1.47 + seededFraction(n), .075, .79, n);
    add('stone', COLORS.ice, ix + .4, .015, iz + .23, 1.08, .047, .58, n + .38);
  }
  box(0x95abba, midX + .38, -1.31, midZ + .47, w + .45, .13, d + .46);
  for (let i = 0; i < 42; i++) {
    const along = seededFraction(i * 12 + 4);
    const spread = seededFraction(i * 6 + 11);
    const bx = i % 2 ? bounds.xmin + .3 + along * (w - .6) : i % 4 === 0 ? bounds.xmin + .25 + spread : bounds.xmax - .25 - spread;
    const bz = i % 2 ? i % 4 === 1 ? bounds.zmin + .22 + spread : bounds.zmax - .22 - spread : bounds.zmin + along * d;
    const size = .2 + seededFraction(i * 11) * .58;
    add('stone', i % 3 ? COLORS.ice : COLORS.shale, bx, .06, bz, size, size * .38, size * .74, along * 11);
  }
  const siteShapes = { forest, farm: greenhouse, kitchen, mill, depot, hall };
  const lifts = { forest: 3.5, farm: 2.1, kitchen: 3.25, mill: 3.2, depot: 3.2, hall: 3.5 };
  const connector = locations.depot || Object.values(locations)[0];
  for (const [id, location] of Object.entries(locations)) {
    const { x, z } = location;
    if (id !== 'depot') roadSegment(x, z + .55, connector.x, connector.z + .55, 1.05, COLORS.path);
    box(0xc1c6c2, x + .18, .025, z + .14, 3.95, .046, 2.86);
    // The stations stand behind the simulation's arrival point so crew and loads remain visible.
    siteShapes[id]?.(x, z - (WORKSHOPS[id] ? .76 : 1.18));
    siteLabel(id, location, lifts[id] || 2.6);
  }
  assembleStaticMeshes();
  const packedRoad = new THREE.InstancedMesh(geometries.box, solid, roadMarks.length);
  for (const [i, mark] of roadMarks.entries()) setInstance(packedRoad, i, mark);
  packedRoad.frustumCulled = false;
  scene.add(packedRoad);

  let viewportWidth = 0;
  let viewportHeight = 0;
  let viewHeight = 1;
  let viewWidth = 1;
  let visualTime = 0;
  let selection = null;
  let lastState = null;
  let lastAlpha = 1;

  function fit() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return false;
    if (width === viewportWidth && height === viewportHeight) return true;
    viewportWidth = width;
    viewportHeight = height;
    const margin = width < 560 ? 1.035 : 1.12;
    const ratio = width / height;
    viewHeight = Math.max(extent.y * margin, extent.x * margin / ratio) * 2;
    viewWidth = viewHeight * ratio;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    for (const { sprite } of siteLabels.values()) {
      const pixels = clamp(width * .284, 111, 159);
      sprite.scale.set(pixels * viewWidth / width, pixels / 4.8 * viewHeight / height, 1);
    }
    return true;
  }

  function target(type, id, x, y, z, rx, ry) {
    vector.set(x, y, z).project(camera);
    clickTargets.push({
      type, id, x: (vector.x + 1) * viewportWidth / 2,
      y: (1 - vector.y) * viewportHeight / 2, rx, ry,
    });
  }

  function addWorker(worker, index, alpha, hasCart) {
    const { task, id } = worker;
    const px = worker.prevX ?? worker.x;
    const pz = worker.prevZ ?? worker.z;
    const dx = worker.x - px;
    const dz = worker.z - pz;
    const x = px + dx * alpha;
    const z = pz + dz * alpha;
    const onFloor = Object.entries(WORKSHOPS).some(([id, [w, d]]) =>
      Math.abs(x - locations[id].x) < w / 2 && Math.abs(z - locations[id].z + .76) < d / 2);
    const baseY = onFloor ? .25 : 0;
    const walking = dx * dx + dz * dz > 0.00001;
    const working = task?.stage === 'work' && !walking;
    const carrying = (task?.kind === 'haul' || task?.kind === 'repair') && task.stage === 'deliver' && task.amount > 0;
    const usingCart = carrying && hasCart && task.kind === 'haul' && task.amount >= 3;
    const tint = worker.color ?? COATS[index % COATS.length];
    const phase = visualTime * 12 + index * 1.1;
    const stride = walking ? Math.sin(phase) * .63 : 0;
    const facing = walking ? Math.atan2(dx, dz) : rotations.get(id) ?? .1;
    rotations.set(id, facing);
    const sin = Math.sin(facing);
    const cos = Math.cos(facing);
    const size = 1.2;
    const bob = walking ? Math.abs(Math.sin(phase)) * .09 : 0;
    // Coat, hood, trim and swinging limbs follow the same person silhouette as Kitchen & Mill.
    const limb = (type, c, sx, sy, sz, dx, y, dz, tilt = 0, roll = 0) => (
      addMoving(type, c, x + (dx * cos + dz * sin) * size, baseY + (y + bob) * size,
        z + (dz * cos - dx * sin) * size, sx * size, sy * size, sz * size, facing, tilt, roll)
    );
    if (selection?.type === 'worker' && selection.id === id) addMoving('trunk', 0x4eaaac, x, baseY + .029, z, 1.10, .032, 1.02);
    addMoving('trunk', COLORS.shadow, x, baseY + .046, z, .83, .021, .72);
    limb('box', 0x273543, .22, .44, .24, -.13, .23, 0, stride);
    limb('box', 0x273543, .22, .44, .24, .13, .23, 0, -stride);
    limb('coat', tint, .81, .77, .73, 0, .78, 0);
    limb('trunk', COLORS.snow, .59, .09, .55, 0, 1.16, 0);
    limb('orb', tint, .66, .68, .63, 0, 1.44, -.06);
    limb('orb', SKIN[index % SKIN.length], .47, .51, .40, 0, 1.43, .15);
    limb('box', 0x353b3e, .053, .047, .048, -.09, 1.457, .327);
    limb('box', 0x353b3e, .053, .047, .048, .09, 1.457, .327);
    limb('box', tint, .18, .46, .21, -.43, .86, carrying ? .17 : 0, carrying ? -.72 : -stride);
    limb('box', tint, .18, .46, .21, .43, .86, carrying ? .17 : 0, carrying ? -.72 : working ? -.55 + Math.sin(phase) * .8 : stride);
    if (carrying) {
      const resource = task.resource;
      const crate = resource === 'meals' ? 0xd39a57 : resource === 'crops' ? 0xc19c51 : 0xaa724d;
      const cargoY = usingCart ? .51 : .91;
      const cargoZ = usingCart ? .87 : .47;
      if (resource === 'logs') {
        for (const dy of [0, .14]) limb('trunk', crate, .19, .75, .19, 0, cargoY + dy, cargoZ, 0, Math.PI / 2);
      } else if (resource === 'planks') {
        for (let i = 0; i < 3; i++) limb('box', i % 2 ? crate : COLORS.timber, .75, .09, .48, 0, cargoY + .10 * i, cargoZ);
      } else {
        limb('box', crate, .69, .39, .5, 0, cargoY, cargoZ);
        limb('box', resource === 'meals' ? 0xffdead : 0xb48556, .72, .08, .53, 0, cargoY + .20, cargoZ);
      }
      if (usingCart) {
        limb('box', COLORS.darkWood, .85, .115, .66, 0, .29, .87);
        for (const offset of [-.45, .45]) {
          limb('box', COLORS.wallTrim, .089, .13, .75, offset, .39, .71, -.19);
          limb('trunk', 0x344856, .48, .13, .48, offset, .24, .96, 0, Math.PI / 2);
        }
      }
    }
    target('worker', id, x, baseY + 1.07, z, 18, 22);
  }

  function animateSites(state) {
    packedRoad.visible = Boolean(state.projects?.road?.complete);
    const operators = new Set();
    for (const { task, x, z } of state.workers) {
      if (task?.kind !== 'process' || task.stage !== 'work') continue;
      const stop = locations[task.to];
      if (stop && Math.hypot(x - stop.x, z - stop.z - .9) < .6) operators.add(task.to);
    }
    for (const [id, loc] of Object.entries(locations)) {
      const { x, z } = loc;
      const site = state.sites[id];
      const label = siteLabels.get(id);
      const stock = site?.stock || {};
      const wear = site?.wear || 0;
      paintLabel(id, label, wear >= 80 ? 'blocked' : 'normal');
      if (selection?.type === 'site' && selection.id === id) {
        addMoving('trunk', 0x78b9bd, x, .267, z + .95, .89, .048, .89);
      }
      if (state.projects?.[id]?.queued) {
        const progress = state.projects[id].progress;
        const base = id === 'depot' ? x + 2.62 : x - 1.42;
        addMoving('box', COLORS.wallTrim, base, .32, z + .30, .91, .15, .77);
        for (const offset of [-.4, .4]) {
          addMoving('box', COLORS.timber, base + offset, .76, z + .33, .11, 1.00, .11);
        }
        addMoving('box', COLORS.wallLight, base, progress > 12 ? 1.16 : .57, z + .33, .83, .12, .16);
      }
      if (id === 'depot' && site?.level > 1) {
        addMoving('box', COLORS.wall, x + 3.06, .91, z - 1.06, 1.51, 1.63, 1.69);
        addMoving('box', COLORS.rail, x + 3.06, 1.78, z - 1.06, 1.65, .14, 1.86);
        addMoving('box', COLORS.snow, x + 3.06, 1.9, z - 1.06, 1.56, .09, 1.78);
        addMoving('box', COLORS.darkWood, x + 3.06, .72, z - .19, .62, 1.37, .085);
        addMoving('box', COLORS.lit, x + 3.51, 1.03, z - .16, .28, .29, .08);
      }
      if (id === 'mill') {
        const spin = operators.has(id) ? visualTime * 8 : 0;
        const saws = site?.level > 1 ? [-.46, .46] : [0];
        for (const offset of saws) {
          addMoving('trunk', wear >= 80 ? 0xa86e59 : 0xc7d5dd, x + offset, 1.42, z - 1.22, .79, .086, .79, 0, Math.PI / 2);
          for (let j = 0; j < 8; j++) {
            const angle = j * Math.PI / 4 + spin;
            addMoving('box', 0x5f747c, x + offset + Math.sin(angle) * .275, 1.42 + Math.cos(angle) * .275, z - 1.16, .067, .21, .035, 0, 0, -angle);
          }
        }
      }
      if (id === 'kitchen') {
        if (site?.level > 1) {
          addMoving('box', COLORS.machine, x + 1.26, .76, z - .37, 1.08, .98, .76);
          addMoving('box', COLORS.rail, x + 1.26, .75, z + .03, .91, .63, .15);
          addMoving('box', COLORS.lit, x + 1.26, .82, z + .13, .58, .19, .057);
          addMoving('box', COLORS.darkWood, x + 1.27, 1.27, z - .34, 1.17, .10, .84);
        }
        if (operators.has(id)) {
          for (let j = 0; j < 3; j++) {
            const rise = (visualTime * .74 + j * .33) % 1;
            addMoving('orb', 0xe7e3dd, x - .71 + rise * .65, 2.56 + rise * .8, z - 2, .16 + rise * .22, .21, .17);
          }
        }
      }
      for (const [i, [resource, count]] of Object.entries(stock).entries()) {
        if (!count) continue;
        const tint = resource === 'crops' ? COLORS.crop : resource === 'meals' ? 0xd79868 : resource === 'logs' ? COLORS.wood : COLORS.timber;
        const bins = clamp(Math.ceil(count / 5), 1, id === 'depot' ? 5 : 3);
        const stackX = id === 'depot' ? x - 1.62 + i * 1.41 : x + 1.25 + i * .39;
        const stackZ = id === 'depot' ? z - 1.52 : z + .65;
        for (let j = 0; j < bins; j++) {
          const bx = stackX + (id === 'depot' ? j % 2 * .49 : 0);
          const by = id === 'depot' && j > 1 ? 1.13 + Math.floor((j - 2) / 2) * .26 : .27 + j * Number(id !== 'depot') * .25;
          if (resource === 'logs') {
            addMoving('trunk', tint, bx, by + .114, stackZ, .24, .46, .24, 0, Math.PI / 2);
            addMoving('trunk', COLORS.timber, bx, by + .114, stackZ + .238, .18, .035, .18, 0, Math.PI / 2);
          } else {
            addMoving('box', tint, bx, by + .10, stackZ, .40, .225, .405);
            addMoving('box', COLORS.lit, bx, by + .136, stackZ + .21, .14, .085, .025);
          }
        }
      }
      const labelWidth = label.sprite.scale.x / viewWidth * viewportWidth * label.width;
      target('site', id, label.sprite.position.x, label.sprite.position.y, label.sprite.position.z, Math.max(24, labelWidth / 2), 13);
      const worldScale = viewportWidth / viewWidth;
      target('site', id, x, 1.0, z - 1.10, worldScale * 1.48, worldScale * 1.1);
    }
  }

  function render(state, alpha = 1, dt = 0) {
    lastState = state;
    lastAlpha = alpha;
    if (!fit()) return;
    visualTime += clamp(dt, 0, .2);
    clickTargets.length = 0;
    for (const batch of dynamicParts.values()) batch.count = 0;
    animateSites(state);
    for (const [i, worker] of state.workers.entries()) addWorker(worker, i, alpha, state.projects?.cart?.complete);
    for (const { mesh, count } of dynamicParts.values()) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  let pointerStart;
  function pointerDown(event) {
    if (event.isPrimary) pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function pointerUp(event) {
    if (pointerStart?.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 12) return;
    const rect = canvas.getBoundingClientRect();
    let nearest = null;
    let best = 1;
    for (const hit of clickTargets) {
      const score = Math.hypot((event.clientX - rect.left - hit.x) / hit.rx, (event.clientY - rect.top - hit.y) / hit.ry);
      if (score < best) {
        best = score;
        nearest = hit;
      }
    }
    if (nearest) {
      selection = { type: nearest.type, id: nearest.id };
      onSelect(selection);
    }
  }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  return {
    render,
    resize() { if (lastState) render(lastState, lastAlpha); else fit(); },
    select(value) { selection = value; },
    stats() {
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, width: canvas.width, height: canvas.height };
    },
    dispose() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      for (const asset of [...Object.values(geometries), solid, ...labelAssets]) asset.dispose();
      renderer.dispose();
    },
  };
}
