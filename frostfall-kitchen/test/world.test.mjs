import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld } from '../works/world.mjs';
import { LOCATIONS, createState, tick } from '../works/engine.mjs';

function canvasFixture(width, height) {
  const hooks = new Map();
  function context() {
    return {
      fills: 0,
      setTransform() {}, fillRect() {}, drawImage() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() { this.fills += 1; }, stroke() {}, ellipse() {},
      measureText(text) { return { width: text.length * 6 }; }, fillText() {},
    };
  }
  const scene = context();
  const base = context();
  const canvas = {
    clientWidth: width,
    clientHeight: height,
    ownerDocument: { createElement: () => ({ getContext: () => base }) },
    getContext: kind => kind === '2d' ? scene : null,
    addEventListener(type, fn) { hooks.set(type, fn); },
    removeEventListener(type) { hooks.delete(type); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const pointer = (type, x, y) => hooks.get(type)({ isPrimary: true, pointerId: 1, clientX: x, clientY: y });
  return { canvas, scene, base, hooks, pointer };
}

test('factory floor renders without WebGL and supports its site and crew targets on phone and desktop', () => {
  const state = createState();
  for (const [width, height] of [[320,430], [390,520], [1280,660]]) {
    const { canvas, scene, base, hooks, pointer } = canvasFixture(width, height);
    const picks = [];
    const world = createWorld(canvas, { onSelect: selection => picks.push(selection), locations: LOCATIONS });
    world.render(state, .5, .041);
    const stats = world.stats();
    assert.equal(stats.width, width);
    assert.equal(stats.height, height);
    assert.ok(scene.fills > 0 && base.fills > 0);
    assert.equal(stats.targets.filter(t => t.type === 'worker').length, state.workers.length);
    const labels = stats.targets.slice(-6);
    assert.equal(labels.length, Object.keys(LOCATIONS).length);
    for (const target of labels) {
      const { id, x, y } = target;
      assert.ok(x > 0 && x < width && y > 0 && y < height);
      pointer('pointerdown', x, y);
      pointer('pointerup', x, y);
      assert.deepEqual(picks.at(-1), { type: 'site', id });
    }
    const before = base.fills;
    for (let i = 0; i < 100; i++) { tick(state); world.render(state, .5, .041); }
    assert.equal(base.fills, before, 'animation reuses the static floor');
    const zoom = world.zoom(1);
    assert.ok(zoom > 1);
    world.render(state);
    assert.ok(base.fills > before);
    const movedAt = world.stats().targets.at(-1).x;
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 31, 15);
    pointer('pointerup', 31, 15);
    world.render(state);
    assert.ok(world.stats().targets.at(-1).x > movedAt);
    assert.equal(picks.length, labels.length, 'dragging pans without selecting a worker or station');
    world.dispose();
    assert.equal(hooks.size, 0);
  }
});
