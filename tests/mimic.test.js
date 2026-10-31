import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCalendar, renderGraph, themes } from '../src/core/index.js';
import { normalizeCalendar } from '../src/core/calendar.js';
import { createMimicScene } from '../src/core/types/mimic-scene.js';

test('mimics eat distinct real tiles, grow per meal, and return every tile to its original position', () => {
  const input = createDemoCalendar();
  const before = structuredClone(input);
  const scene = createMimicScene(input);
  assert.deepEqual(scene, createMimicScene(input));
  assert.equal(scene.mimics.length, 3);
  const dates = scene.mimics.flatMap((m) => [m.home.date, ...m.meals.map((meal) => meal.date)]);
  assert.equal(new Set(dates).size, dates.length);
  for (const m of scene.mimics) {
    assert.equal(m.meals.length, 3);
    assert.ok(Math.abs(m.meals.at(-1).scale * scene.size - (scene.pitch + scene.size)) < 1e-8,
      'fully fed body spans a 2 by 2 block, including the gap between tiles');
    assert.ok(m.home.contributionCount > 0);
    assert.deepEqual(m.frames.at(-1), { ...m.frames[0], time: scene.duration });
    for (const [i, frame] of m.frames.entries()) {
      assert.ok(frame.x > 40 && frame.x < 1080 && frame.y > 28 && frame.y < 164);
      if (i) assert.ok(frame.time > m.frames[i - 1].time);
    }
    for (const [i, meal] of m.meals.entries()) {
      assert.ok(meal.contributionCount > 0);
      assert.ok(meal.scale > meal.scaleBefore);
      assert.equal(meal.scaleBefore, i ? m.meals[i - 1].scale : 1);
      assert.ok(meal.bite < meal.swallowed && meal.swallowed < m.sneeze.start);
      const held = m.frames.find((frame) => Math.abs(frame.time - meal.bite) < 1e-8);
      assert.equal(held.x, meal.mouthX);
      assert.equal(held.y + 3 * meal.scale, meal.mouthY);
      const first = meal.returnFrames[0];
      const last = meal.returnFrames.at(-1);
      assert.equal(first.x, m.sneeze.x);
      assert.equal(first.y, m.sneeze.y);
      assert.deepEqual(last, { time: meal.returnEnd, x: meal.x, y: meal.y, scale: 1, tilt: 0 });
      assert.ok(meal.returnEnd < 19, 'all tiles return before the mimic walks home');
    }
  }
  assert.deepEqual(input, before);
});

test('empty, isolated, dense and 54-column calendars preserve every contribution in all themes', () => {
  const dense = createDemoCalendar();
  dense.weeks.flatMap((week) => week.contributionDays).forEach((day, i) => {
    day.date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    day.contributionCount = 10; day.contributionLevel = 4;
  });
  delete dense.totalContributions;
  const isolated = { weeks: [{ contributionDays: [{ date: '2024-01-01', contributionCount: 1, contributionLevel: 1 }] }] };
  for (const input of [{ weeks: [] }, isolated, dense]) for (const theme of Object.keys(themes)) {
    const calendar = normalizeCalendar(input);
    const scene = createMimicScene(calendar);
    const active = calendar.weeks.flatMap((w) => w.contributionDays).filter((day) => day.contributionCount > 0);
    const svg = renderGraph(input, { type: 'mimic', theme });
    assert.equal(svg, renderGraph(input, { type: 'mimic', theme }));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.equal((svg.match(/class="contribution /g) ?? []).length, active.length);
    assert.equal((svg.match(/data-home=/g) ?? []).length, Math.min(3, active.length));
    if (active.length < 2) assert.ok(scene.mimics.every((m) => m.meals.length === 0));
  }
});

test('mimic export is self-contained, escapes labels, and supports speed, static and reduced motion', () => {
  const input = { ...createDemoCalendar(), username: '<script>&"' };
  const svg = renderGraph(input, { type: 'mimic' });
  assert.match(svg, /&lt;script&gt;&amp;&quot;/);
  assert.doesNotMatch(svg, /<script|<foreignObject|\bonload=|\bhref=/);
  assert.match(svg, /prefers-reduced-motion:reduce/);
  assert.match(svg, /role="img" aria-labelledby=/);
  const still = renderGraph(input, { type: 'mimic', animation: false, showLabels: false });
  assert.doesNotMatch(still, /@keyframes|animation:|class="labels"/);
  assert.match(still, /\.actor\{opacity:0\}/);
  assert.equal((still.match(/class="contribution /g) ?? []).length, (svg.match(/class="contribution /g) ?? []).length);
  const speed = (text) => Number(text.match(/-walk-0 ([\d.]+)s/)[1]);
  assert.equal(speed(svg) / 2, speed(renderGraph(input, { type: 'mimic', speed: 2 })));
});
