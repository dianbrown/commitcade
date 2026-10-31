import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCalendar, renderGraph, themes } from '../src/core/index.js';
import { normalizeCalendar } from '../src/core/calendar.js';
import { createGhostHauntingScene } from '../src/core/types/ghost-haunting-scene.js';

test('possession chains use disjoint active tiles and synchronize emergence, travel and entry', () => {
  const calendar = createDemoCalendar();
  const before = structuredClone(calendar);
  const scene = createGhostHauntingScene(calendar);
  assert.deepEqual(scene, createGhostHauntingScene(calendar));
  assert.equal(scene.spirits.length, 5);
  const visited = scene.spirits.flatMap((spirit) => spirit.route);
  assert.equal(new Set(visited.map((v) => v.date)).size, visited.length);
  assert.ok(visited.every((v) => v.contributionCount > 0));
  for (const v of scene.spirits) {
    assert.ok(v.scale * 76 < 19, 'ghost height stays close to the 13px tile size');
    assert.deepEqual(v.frames.at(-1), { ...v.frames[0], time: scene.duration });
    for (const hop of v.hops) {
      const times = [hop.start, hop.emerge, hop.depart, hop.arrive, hop.possess, hop.release, hop.end];
      assert.ok(times.every((time, i) => !i || time > times[i - 1]));
      const departure = v.frames.find((f) => f.time === hop.depart);
      const entry = v.frames.find((f) => f.time === hop.possess);
      assert.equal(departure.x, hop.source.x);
      assert.equal(departure.y, hop.source.y - 2);
      assert.equal(departure.opacity, 1);
      assert.equal(entry.x, hop.target.x);
      assert.equal(entry.y, hop.target.y);
      assert.equal(entry.opacity, 0);
    }
    for (const [i, frame] of v.frames.entries()) {
      assert.ok(frame.x > 40 && frame.x < 1080 && frame.y >= 30 && frame.y < 160);
      if (i) {
        const previous = v.frames[i - 1];
        assert.ok(frame.time > previous.time);
        assert.ok(Math.hypot(frame.x - previous.x, frame.y - previous.y) / (frame.time - previous.time) < 100);
      }
    }
  }
  const svg = renderGraph(calendar, { type: 'ghost-haunting' });
  assert.equal(svg, renderGraph(calendar, { type: 'ghost-haunting' }));
  assert.deepEqual(calendar, before);
  assert.equal((svg.match(/data-source=/g) ?? []).length, 5);
  assert.match(svg, /viewBox="0 0 1120 190"/);
  assert.match(svg, /fill:#faf9f5;opacity:1;transform:translate\(-1px,0\)/);
  assert.doesNotMatch(svg, /class="robot|class="stream|class="charge|linearGradient/);
});

test('empty, sparse, full and 54-column calendars retain their data in every theme', () => {
  const full = createDemoCalendar();
  full.weeks.flatMap((w) => w.contributionDays).forEach((d, i) => {
    d.date = new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10);
    d.contributionCount = 10; d.contributionLevel = 4;
  });
  delete full.totalContributions;
  const empty = { username: 'empty', weeks: [] };
  const sparse = { weeks: [{ contributionDays: [{ date: '2024-01-01', contributionCount: 1, contributionLevel: 1 }] }] };
  for (const input of [empty, sparse, full]) for (const theme of Object.keys(themes)) {
    const normalized = normalizeCalendar(input);
    const svg = renderGraph(input, { type: 'ghost-haunting', theme });
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    const active = normalized.weeks.flatMap((w) => w.contributionDays).filter((d) => d.contributionCount > 0);
    assert.equal((svg.match(/class="contribution[" ]/g) ?? []).length, active.length);
    assert.equal((svg.match(/data-source=/g) ?? []).length, Math.min(5, active.length));
    assert.match(svg, new RegExp(themes[theme].background));
  }
});

test('static, speed, reduced motion and untrusted labels remain safe', () => {
  const calendar = { ...createDemoCalendar(), username: '<script>&"' };
  const options = { type: 'ghost-haunting' };
  const svg = renderGraph(calendar, options);
  assert.match(svg, /&lt;script&gt;&amp;&quot;/);
  assert.doesNotMatch(svg, /<script|<foreignObject|\bonload=|\bhref=/);
  assert.match(svg, /prefers-reduced-motion:reduce/);
  assert.match(svg, /role="img" aria-labelledby=/);
  const staticSvg = renderGraph(calendar, { ...options, animation: false, showLabels: false, showStars: false });
  assert.doesNotMatch(staticSvg, /@keyframes|animation:|class="labels"|class="stars"/);
  assert.equal((staticSvg.match(/class="contribution[" ]/g) ?? []).length, (svg.match(/class="contribution[" ]/g) ?? []).length);
  const fast = renderGraph(calendar, { ...options, speed: 2 });
  const duration = (text) => Number(text.match(/-drift-0 ([\d.]+)s/)[1]);
  assert.equal(duration(svg) / 2, duration(fast));
});
