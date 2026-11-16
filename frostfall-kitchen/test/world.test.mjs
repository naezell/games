import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createWorld } from '../works/world.mjs';
import { LOCATIONS, createState, tick, queueProject } from '../works/engine.mjs';

const require = createRequire(import.meta.url);
const THREE = require('../works/vendor/three.min.js');
const context = {
  beginPath() {}, rect() {}, arc() {}, fill() {}, clearRect() {}, fillText() {},
  measureText(text) { return { width: text.length * 12 }; },
};
let captured;
globalThis.THREE = { ...THREE, WebGLRenderer: class {
  constructor({ canvas }) { this.canvas = canvas; }
  setPixelRatio(scale) { this.scale = scale; }
  setSize(w, h) { this.canvas.width = w * this.scale; this.canvas.height = h * this.scale; }
  render(scene, camera) {
    const mesh = scene.children.filter(a => a.isInstancedMesh && a.count);
    this.info = { render: { calls: mesh.length + 6, triangles: mesh.reduce((n, a) => n + a.count * (a.geometry.index?.count ?? a.geometry.attributes.position.count) / 3, 12) } };
    captured = { scene, camera };
  }
  dispose() {}
}};
globalThis.document = { createElement: () => ({ getContext: () => context }) };
globalThis.devicePixelRatio = 3;
test('the compact world fits touch and desktop viewports, selects each site, and handles live updates', () => {
  const state = createState();
  const picks = [];
  const hooks = new Map();
  const canvas = {
    clientWidth: 360, clientHeight: 355,
    addEventListener(type, fn) { hooks.set(type, fn); },
    removeEventListener(type) { hooks.delete(type); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const world = createWorld(canvas, { onSelect: pick => picks.push(pick), locations: LOCATIONS });
  for (const [width,height] of [[320,330],[390,330],[1280,490]]) {
    canvas.clientWidth = width;
    canvas.clientHeight = height;
    world.render(state, .5, .041);
    const stats = world.stats();
    assert.equal(stats.width, width);
    assert.equal(stats.height, height);
    assert.ok(stats.drawCalls < 25);
    const sprites = captured.scene.children.filter(m=>m.isSprite);
    assert.equal(sprites.length, 6);
    for (const [i, sprite] of sprites.entries()) {
      const pos = sprite.position.clone().project(captured.camera);
      assert.ok(Math.abs(pos.x) < 1 && Math.abs(pos.y) < 1);
      const pointer = { isPrimary:true, pointerId:3, clientX:(pos.x+1)*width/2, clientY:(1-pos.y)*height/2 };
      hooks.get('pointerdown')(pointer);
      hooks.get('pointerup')(pointer);
      assert.deepEqual(picks.at(-1), { type:'site', id: Object.keys(LOCATIONS)[i] });
    }
  }
  for (let i = 0; i < 3000; i++) {
    if (i % 16 === 0) queueProject(state, 'cart');
    tick(state);
    if (i % 10 === 0) world.render(state, .67, .041);
  }
  assert.ok(world.stats().triangles < 20000);
  world.dispose();
  assert.equal(hooks.size, 0);
});
