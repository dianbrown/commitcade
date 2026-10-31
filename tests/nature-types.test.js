import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCalendar, renderGraph, themes } from '../src/core/index.js';
import { normalizeCalendar } from '../src/core/calendar.js';
import { createAntHeistScene } from '../src/core/types/ant-heist-scene.js';
import { createOvergrownScene } from '../src/core/types/overgrown-scene.js';

test('ants carry unique real tiles to burrows with more workers for busy days', () => {
  const input = createDemoCalendar();
  const before = structuredClone(input);
  const scene = createAntHeistScene(input);
  assert.deepEqual(scene, createAntHeistScene(input));
  assert.equal(scene.jobs.length, 8);
  assert.equal(new Set(scene.jobs.map((job) => job.cell.date)).size, 8);
  for (const job of scene.jobs) {
    assert.ok(job.cell.contributionCount > 0);
    assert.equal(job.workers, job.cell.contributionLevel >= 3 ? 3 : 1);
    const times = [0, job.arrive, job.lift, job.carryStart, job.delivered, job.hidden, job.restore, scene.duration];
    assert.ok(times.every((time, i) => !i || time > times[i - 1]));
    const first = job.frames[0];
    const last = job.frames.at(-1);
    assert.equal(first.x, job.cell.x);
    assert.equal(first.y, job.cell.y - 3);
    assert.equal(last.x, job.burrow.x);
    assert.equal(last.y, job.burrow.y - 8);
    for (const [i, frame] of job.frames.entries()) {
      assert.ok(frame.x > 30 && frame.x < 1090 && frame.y >= 30 && frame.y < 166);
      if (i) {
        const previous = job.frames[i - 1];
        assert.ok(frame.time > previous.time);
        assert.ok(Math.hypot(frame.x - previous.x, frame.y - previous.y) / (frame.time - previous.time) < 35);
      }
    }
  }
  assert.deepEqual(input, before);
});

test('gardens spread between disjoint active days, bloom in order, and restore after shedding', () => {
  const input = createDemoCalendar();
  const before = structuredClone(input);
  const scene = createOvergrownScene(input);
  assert.deepEqual(scene, createOvergrownScene(input));
  const allPlants = scene.gardens.flatMap((garden) => garden.plants);
  assert.equal(scene.gardens.length, 5);
  assert.equal(new Set(allPlants.map((plant) => plant.date)).size, allPlants.length);
  for (const garden of scene.gardens) {
    assert.equal(garden.plants[0].from, null);
    for (const [i, plant] of garden.plants.entries()) {
      assert.ok(plant.contributionCount > 0);
      const times = [plant.sprout, plant.bloom, garden.shed, garden.retreat, garden.restored, scene.duration];
      assert.ok(times.every((time, j) => !j || time > times[j - 1]));
      if (i) {
        const previous = garden.plants[i - 1];
        assert.deepEqual(plant.from, { x: previous.x, y: previous.y });
        assert.ok(Math.hypot(plant.x - previous.x, plant.y - previous.y) <= 65);
        assert.ok(plant.sprout > previous.sprout);
      }
    }
  }
  assert.deepEqual(input, before);
});

test('nature styles preserve dates and counts on empty, sparse and fully occupied 54-column calendars', () => {
  const full = createDemoCalendar();
  full.weeks.flatMap((week) => week.contributionDays).forEach((day, i) => {
    day.date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    day.contributionCount = 10; day.contributionLevel = 4;
  });
  delete full.totalContributions;
  const sparse = { weeks: [{ contributionDays: [{ date: '2024-01-01', contributionCount: 1, contributionLevel: 1 }] }] };
  for (const input of [{ weeks: [] }, sparse, full]) for (const type of ['ant-heist', 'overgrown']) for (const theme of Object.keys(themes)) {
    const calendar = normalizeCalendar(input);
    const active = calendar.weeks.flatMap((week) => week.contributionDays).filter((day) => day.contributionCount > 0);
    const svg = renderGraph(input, { type, theme });
    assert.equal(svg, renderGraph(input, { type, theme }));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.equal((svg.match(/class="contribution /g) ?? []).length, active.length);
    assert.equal((svg.match(/class="empty-cell"/g) ?? []).length, Math.max(53, calendar.weeks.length) * 7);
    for (const day of active) assert.ok(svg.includes(`data-date="${day.date}" data-count="${day.contributionCount}"`));
    if (!active.length) assert.doesNotMatch(svg, /data-target=|data-plant=/);
    assert.ok(svg.includes(themes[theme].background));
  }
});

test('nature exports escape user text, have no external content, and honor motion settings', () => {
  const input = { ...createDemoCalendar(), username: '<script>&"' };
  for (const type of ['ant-heist', 'overgrown']) {
    const svg = renderGraph(input, { type });
    assert.match(svg, /&lt;script&gt;&amp;&quot;/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\bonload=|\bhref=/);
    assert.match(svg, /role="img" aria-labelledby=/);
    assert.match(svg, /prefers-reduced-motion:reduce/);
    const still = renderGraph(input, { type, animation: false, showLabels: false });
    assert.doesNotMatch(still, /@keyframes|animation:|class="labels"/);
    assert.match(still, /\.effect\{opacity:0\}/);
    assert.equal((still.match(/class="contribution /g) ?? []).length, (svg.match(/class="contribution /g) ?? []).length);
    const duration = (text) => Number(text.match(/animation:[^ ]+ ([\d.]+)s/)[1]);
    assert.equal(duration(svg) / 2, duration(renderGraph(input, { type, speed: 2 })));
  }
});
