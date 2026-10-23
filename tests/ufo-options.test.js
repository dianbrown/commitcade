import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCalendar, renderGraph, flightModes } from '../src/core/index.js';
import { createUfoScene, insideBeam } from '../src/core/types/ufo-scene.js';

const input = createDemoCalendar();
const captured = scene => scene.visits.flatMap(visit => visit.captures);

test('UFO defaults preserve the classic route and reject invalid options at the library boundary', () => {
  assert.deepEqual(flightModes, ['classic', 'curious', 'collector']);
  assert.ok(Object.isFrozen(flightModes));
  assert.equal(renderGraph(input), renderGraph(input, { flightMode: 'classic', beamSize: 1 }));
  for (const flightMode of ['', 'random', '__proto__', null, 0, {}, 'curious;animation:none']) {
    assert.throws(() => renderGraph(input, { flightMode }), /Flight mode/);
  }
  for (const beamSize of [0, -1, 0.49, 3.01, NaN, Infinity, '2', null, true]) {
    assert.throws(() => renderGraph(input, { beamSize }), /Beam size/);
  }
});

test('curious mode makes shorter trips, slows cruising, and inspects with its beam off', () => {
  const classic = createUfoScene(input);
  const curious = createUfoScene(input, { flightMode: 'curious' });
  assert.deepEqual(curious, createUfoScene(input, { flightMode: 'curious' }));
  const averageHop = scene => scene.visits.slice(1).reduce((sum, v, i) => sum + Math.abs(v.x - scene.visits[i].x), 0) / (scene.visits.length - 1);
  assert.ok(averageHop(curious) < averageHop(classic));
  assert.ok(curious.inspections.length > 0);
  assert.equal(classic.inspections.length, 0);
  for (const scan of curious.inspections) {
    assert.ok(scan.end > scan.start);
    assert.ok(curious.visits.every(v => scan.end <= v.beamOpen || scan.start >= v.beamOff));
    const held = curious.flight.filter(f => f.time >= scan.start && f.time <= scan.end);
    assert.ok(held.some(f => f.tilt < 0) && held.some(f => f.tilt > 0));
    assert.ok(held.every(f => f.x === scan.x && f.y === scan.y));
  }
  for (const leg of curious.legs) {
    const frames = [{ time: leg.start, ...leg.from }, ...leg.frames];
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) / (b.time - a.time) < 72);
    }
  }
});

test('larger beams grow the actual cone, capture more activity, and leave the saucer size alone', () => {
  const scenes = [0.5, 1, 2, 3].map(beamSize => createUfoScene(input, { beamSize }));
  for (let i = 1; i < scenes.length; i++) {
    assert.equal(scenes[i].visits[0].date, scenes[0].visits[0].date);
    assert.ok(scenes[i].visits[0].beam.bottomHalfWidth > scenes[i - 1].visits[0].beam.bottomHalfWidth);
    const dates = new Set(scenes[i].visits[0].captures.map(c => c.date));
    for (const cell of scenes[i - 1].visits[0].captures) assert.ok(dates.has(cell.date));
  }
  const normal = renderGraph(input);
  const wide = renderGraph(input, { beamSize: 2 });
  assert.match(wide, /M -3 6 L -31\.05 [\d.]+ L 31\.05 [\d.]+ L 3 6 Z/);
  const base = scenes[1].visits[0], medium = scenes[2].visits[0], largest = scenes[3].visits[0];
  assert.ok(Math.abs(medium.height / base.height - 1.25) < 1e-9);
  assert.ok(Math.abs(medium.beam.bottomHalfWidth / base.beam.bottomHalfWidth - 1.15) < 1e-9);
  assert.ok(Math.abs(largest.beam.bottomHalfWidth * 2 - 70.2) < 1e-9);
  assert.ok(captured(scenes[3]).length > captured(scenes[1]).length);
  const hull = svg => svg.slice(svg.indexOf('<g class="flight"><g class="hull">'));
  // The outline geometry, rather than gradients/IDs, is invariant.
  const paths = svg => [...hull(svg).matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(paths(normal), paths(wide));
});

test('collector chooses the densest remaining cone, rather than just renaming the random flight', () => {
  const scene = createUfoScene(input, { flightMode: 'collector', beamSize: 2 });
  const first = scene.visits[0];
  const cells = input.weeks.flatMap((week, column) => week.contributionDays.filter(d => d.contributionCount > 0)
    .map(d => ({ x: scene.left + column * 18 + 6.5, y: 110 + d.weekday * 18 + 6.5 })));
  // The first target is below the altitude clamp, so its height is the sampled reach.
  assert.ok(first.shipY > 40);
  const counts = cells.map(cell => {
    const beam = { ...first.beam, x: cell.x, top: Math.max(40, cell.y - first.height) + 6, bottom: cell.y + 7 };
    return cells.filter(c => insideBeam(c, beam)).length;
  });
  assert.equal(first.captures.length, Math.max(...counts));
  assert.ok(captured(scene).length > captured(createUfoScene(input, { beamSize: 2 })).length);
  assert.equal(scene.inspections.length, 0);
});

test('all personalities and beam extremes keep captures inside geometry, unique, and synchronized', () => {
  for (const flightMode of flightModes) for (const beamSize of [0.5, 1.5, 3]) {
    const options = { flightMode, beamSize };
    const scene = createUfoScene(input, options);
    const remaining = new Map(input.weeks.flatMap((w, column) => w.contributionDays.filter(d => d.contributionCount > 0)
      .map(d => [d.date, { date: d.date, x: scene.left + column * 18 + 6.5, y: 110 + d.weekday * 18 + 6.5 }])));
    for (const v of scene.visits) {
      const expected = [...remaining.values()].filter(c => insideBeam(c, v.beam)).map(c => c.date).sort();
      assert.deepEqual(v.captures.map(c => c.date).sort(), expected);
      for (const c of v.captures) {
        assert.ok(c.liftStart > v.beamFull && c.liftEnd < v.beamClose);
        assert.ok(remaining.delete(c.date));
      }
    }
    assert.ok(scene.flight.every(f => f.x > 20 && f.x < 1100 && f.y >= 38 && f.y < 220));
    const start = scene.flight[0], end = scene.flight.at(-1);
    assert.deepEqual([start.x, start.y, start.tilt], [end.x, end.y, end.tilt]);
    assert.doesNotMatch(renderGraph(input, options), /NaN|Infinity|undefined/);
    assert.doesNotMatch(renderGraph(input, { ...options, animation: false }), /@keyframes|class="beam-window/);
    const empty = { username: '', weeks: [], totalContributions: 0 };
    assert.equal(createUfoScene(empty, options).visits.length, 0);
    assert.doesNotMatch(renderGraph(empty, options), /data-target=/);
  }
});
