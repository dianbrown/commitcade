import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCalendar, renderGraph, themes, graphTypes } from '../src/core/index.js';
import { normalizeCalendar } from '../src/core/calendar.js';
import { createUfoScene, insideBeam } from '../src/core/types/ufo-scene.js';

const day = (date, count = 1, level = 1, weekday) => ({ date, contributionCount: count, contributionLevel: level, ...(weekday === undefined ? {} : { weekday }) });
const calendar = (...days) => ({ username: 'octocat', weeks: [{ contributionDays: days }] });
const flatten = (value) => value.weeks.flatMap((week) => week.contributionDays);

test('demo is deterministic, seeded, and a complete fixed leap year', () => {
  const first = createDemoCalendar();
  assert.deepEqual(first, createDemoCalendar(42));
  assert.notDeepEqual(first, createDemoCalendar(43));
  const days = flatten(first);
  assert.equal(days.length, 366);
  assert.equal(days[0].date, '2024-01-01');
  assert.equal(days.at(-1).date, '2024-12-31');
  assert.ok(days.some((entry) => entry.date === '2024-02-29'));
  assert.equal(first.totalContributions, days.reduce((sum, entry) => sum + entry.contributionCount, 0));
  assert.deepEqual(normalizeCalendar(first), first);
  for (const entry of days) assert.equal(entry.weekday, new Date(`${entry.date}T00:00:00Z`).getUTCDay());
  assert.throws(() => createDemoCalendar('42'), /seed/);
  assert.throws(() => createDemoCalendar(Infinity), /seed/);
});

test('normalization sorts dates, repairs weekdays, fills gaps and does not mutate input', () => {
  const input = calendar(day('2024-03-03', 4, 2, 6), day('2024-02-28', 0, 4, 0));
  const before = structuredClone(input);
  const normalized = normalizeCalendar(input);
  assert.deepEqual(input, before);
  assert.deepEqual(flatten(normalized).map((entry) => entry.date), ['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03']);
  assert.equal(normalized.weeks.length, 2);
  assert.equal(normalized.weeks[0].contributionDays[0].weekday, 3);
  assert.equal(normalized.weeks[1].contributionDays[0].weekday, 0);
  assert.equal(normalized.totalContributions, 4);
  assert.equal(flatten(normalized)[0].contributionLevel, 0);
  assert.equal(flatten(normalizeCalendar(calendar(day('2024-01-01', 1, 0))))[0].contributionLevel, 1);
});

test('empty, sparse, all-zero, and fully occupied year render without invalid geometry', () => {
  const full = createDemoCalendar();
  for (const entry of flatten(full)) { entry.contributionCount = 1; entry.contributionLevel = 4; }
  full.totalContributions = 366;
  const zero = structuredClone(full);
  for (const entry of flatten(zero)) { entry.contributionCount = 0; entry.contributionLevel = 0; }
  zero.totalContributions = 0;
  for (const input of [{ username: '', totalContributions: 0, weeks: [] }, calendar(day('2024-01-01')), zero, full]) {
    const svg = renderGraph(input);
    assert.match(svg, /viewBox="0 0 1120 250"/);
    assert.match(svg, /max-width:100%;height:auto/);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.equal((svg.match(/class="empty-cell"/g) ?? []).length, 371);
  }
  assert.equal((renderGraph(full).match(/class="contribution[" ]/g) ?? []).length, 366);
  assert.equal((renderGraph(zero).match(/class="contribution[" ]/g) ?? []).length, 0);
});

test('a 54-column leap year fits without losing dates', () => {
  const input = createDemoCalendar();
  flatten(input).forEach((entry, index) => { entry.date = new Date(Date.UTC(2000, 0, index + 1)).toISOString().slice(0, 10); });
  const normalized = normalizeCalendar(input);
  assert.equal(normalized.weeks.length, 54);
  const svg = renderGraph(normalized);
  assert.equal((svg.match(/class="empty-cell"/g) ?? []).length, 378);
  assert.match(svg, /data-date="2000-12-31"/);
});

test('calendar validation rejects impossible dates, duplicates, unsafe numbers, and oversized ranges', () => {
  for (const date of ['2023-02-29', '2024-04-31', '2024-13-01', '2024-1-01', 'yesterday', '2024-01-01T00:00:00Z']) {
    assert.throws(() => renderGraph(calendar(day(date))), /date/i);
  }
  assert.throws(() => renderGraph(calendar(day('2024-01-01'), day('2024-01-01'))), /duplicate/);
  assert.throws(() => renderGraph(calendar(day('2020-01-01'), day('2024-01-01'))), /54 weeks/);
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2']) {
    assert.throws(() => renderGraph(calendar(day('2024-01-01', value))), /count/);
  }
  assert.throws(() => renderGraph(calendar(day('2024-01-01', 1, 5))), /level/);
  assert.throws(() => renderGraph(calendar(day('2024-01-01', 1, 1, 7))), /Weekday/);
  assert.throws(() => renderGraph({ ...calendar(), totalContributions: -1 }), /total/);
  assert.throws(() => renderGraph(null), /Calendar/);
  assert.throws(() => renderGraph({ weeks: [{}] }), /week/);
  assert.throws(() => renderGraph({ weeks: Array(55).fill({ contributionDays: [] }) }), /54 weeks/);
});

test('renderer is deterministic and does not mutate its arguments', () => {
  const input = createDemoCalendar();
  const options = { theme: 'midnight', beamColor: '#aaff00' };
  const before = structuredClone([input, options]);
  assert.equal(renderGraph(input, options), renderGraph(input, options));
  assert.deepEqual([input, options], before);
  assert.notEqual(renderGraph(input).match(/id="([^"]+)"/)[1], renderGraph(input, options).match(/id="([^"]+)"/)[1]);
});

test('SVG escapes untrusted text, strips XML control characters and contains no active/external content', () => {
  const input = { ...calendar(day('2024-01-01')), username: `<script>&"'\u0000\ud800🚀</script>` };
  const svg = renderGraph(input);
  assert.match(svg, /&lt;script&gt;&amp;&quot;&apos;🚀&lt;\/script&gt;/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|\bonload=|\bhref=|\u0000|\ud800/u);
  assert.doesNotMatch(svg.replace('http://www.w3.org/2000/svg', ''), /https?:\/\//);
});

test('options reject CSS injection, prototype names, and invalid types', () => {
  const input = createDemoCalendar();
  for (const options of [null, [], { type: 'pacman' }, { type: '__proto__' }, { theme: 'constructor' },
    { beamColor: 'red' }, { beamColor: '#fff' }, { beamColor: '#aaff00"/><script/>' },
    { speed: 0 }, { speed: -1 }, { speed: 6 }, { speed: '1' }, { speed: NaN },
    { animation: 'false' }, { showLabels: 0 }, { showStars: null }]) {
    assert.throws(() => renderGraph(input, options));
  }
  assert.equal(renderGraph(input, { animation: undefined }), renderGraph(input));
});

test('themes and graph metadata are frozen, complete, and registry-backed', () => {
  assert.deepEqual(Object.keys(themes), ['github-dark', 'github-light', 'midnight']);
  assert.deepEqual(graphTypes.map(({ id }) => id), ['ufo']);
  assert.ok(graphTypes.every(({ name, description }) => name && description));
  assert.ok(Object.isFrozen(themes) && Object.isFrozen(graphTypes));
  for (const [name, theme] of Object.entries(themes)) {
    assert.equal(theme.levels.length, 4);
    assert.ok(Object.isFrozen(theme.levels));
    assert.match(renderGraph(createDemoCalendar(), { theme: name }), new RegExp(theme.background));
  }
});

test('seeded routes collect unique clusters with mostly local flights and both axes changing', () => {
  for (const seed of [0, 1, 42, 1234]) {
    const input = createDemoCalendar(seed);
    const scene = createUfoScene(input);
    assert.deepEqual(scene, createUfoScene(input));
    assert.equal(scene.visits.length, 24);
    const captures = scene.visits.flatMap((visit) => visit.captures);
    assert.equal(new Set(captures.map((cell) => cell.date)).size, captures.length);
    assert.ok(captures.length > scene.visits.length * 2);
    const days = new Map(flatten(input).map((entry) => [entry.date, entry]));
    for (const visit of scene.visits) {
      assert.ok(days.get(visit.date).contributionCount > 0);
      assert.ok(visit.y - visit.shipY >= 40 && visit.y - visit.shipY <= 60);
      assert.equal(visit.x, visit.shipX);
    }
    const segments = scene.visits.slice(1).map((visit, index) => ({
      dx: visit.x - scene.visits[index].x, dy: visit.shipY - scene.visits[index].shipY,
    }));
    assert.ok(segments.filter(({ dx }) => Math.abs(dx) <= 144).length >= 19);
    assert.ok(segments.some(({ dx }) => Math.abs(dx) > 144));
    assert.ok(segments.some(({ dx }) => dx > 0) && segments.some(({ dx }) => dx < 0));
    assert.ok(segments.some(({ dy }) => dy > 10) && segments.some(({ dy }) => dy < -10));
    assert.ok(scene.flight.some(({ tilt }) => Math.abs(tilt) > 10));
  }
  assert.notDeepEqual(createUfoScene(createDemoCalendar(1)).visits, createUfoScene(createDemoCalendar(2)).visits);
});

test('hover, beam extension, staggered lifts, retraction and departure are synchronized', () => {
  const scene = createUfoScene(createDemoCalendar());
  for (const [index, visit] of scene.visits.entries()) {
    const times = [visit.departure, visit.arrival, visit.beamOpen, visit.beamFull, visit.liftStart,
      visit.liftEnd, visit.beamClose, visit.beamOff, visit.leave];
    assert.ok(times.every((time, i) => i === 0 || time > times[i - 1]));
    if (index) assert.ok(scene.visits[index - 1].beamOff < visit.departure);
    for (const [cellIndex, cell] of visit.captures.entries()) {
      assert.ok(visit.beamFull < cell.liftStart && cell.liftStart < cell.liftEnd);
      assert.ok(cell.liftEnd < visit.beamClose);
      if (cellIndex) assert.ok(visit.captures[cellIndex - 1].liftStart < cell.liftStart);
    }
    const heldFrames = scene.flight.filter((frame) => frame.time >= visit.arrival && frame.time <= visit.leave);
    assert.ok(heldFrames.length >= 2);
    assert.ok(heldFrames.every((frame) => frame.x === visit.shipX && frame.y === visit.shipY && frame.tilt === 0));
    assert.ok(visit.liftEnd < scene.resetStart);
  }
  const initial = scene.flight[0];
  const final = scene.flight.at(-1);
  assert.deepEqual([initial.x, initial.y, initial.tilt], [final.x, final.y, final.tilt]);
  assert.ok(scene.resetStart < scene.resetEnd && scene.resetEnd < scene.duration);
});

test('curved flights sample continuous movement, cruise below 100px/s, and ease only at leg boundaries', () => {
  const scene = createUfoScene(createDemoCalendar());
  for (const leg of scene.legs) {
    const duration = leg.end - leg.start;
    assert.ok(duration >= 1.8 - 1e-8);
    assert.ok(duration >= leg.length / 100);
    const frames = [{ time: leg.start, ...leg.from, tilt: 0 }, ...leg.frames];
    const speeds = [];
    for (let index = 1; index < frames.length; index++) {
      const before = frames[index - 1];
      const frame = frames[index];
      const dt = frame.time - before.time;
      assert.ok(dt > 0 && dt <= 0.1);
      const speed = Math.hypot(frame.x - before.x, frame.y - before.y) / dt;
      speeds.push(speed);
      assert.ok(speed < 100, `cruise exceeded 100px/s: ${speed}`);
      assert.ok(Math.abs(frame.tilt - before.tilt) < 2.5);
    }
    assert.ok(speeds[0] < 5 && speeds.at(-1) < 5);
    const peak = Math.max(...speeds);
    const middle = speeds.slice(Math.floor(speeds.length * 0.25), Math.ceil(speeds.length * 0.75));
    assert.ok(middle.every((speed) => speed > peak * 0.25), 'must not brake at a midpoint');
    assert.deepEqual([frames.at(-1).x, frames.at(-1).y, frames.at(-1).tilt], [leg.to.x, leg.to.y, 0]);
  }
  for (const frame of scene.flight) {
    assert.ok(frame.x > 20 && frame.x < 1100);
    assert.ok(frame.y >= 38 && frame.y < 210);
  }
});

test('beam collects exactly the remaining occupied centers inside its drawn cone', () => {
  const input = createDemoCalendar();
  const scene = createUfoScene(input);
  const remaining = new Map(input.weeks.flatMap((week, column) => week.contributionDays
    .filter((day) => day.contributionCount > 0).map((day) => [day.date, {
      date: day.date, x: scene.left + column * scene.pitch + scene.size / 2,
      y: 110 + day.weekday * scene.pitch + scene.size / 2,
    }])));
  for (const visit of scene.visits) {
    const expected = [...remaining.values()].filter((cell) => insideBeam(cell, visit.beam)).map((cell) => cell.date).sort();
    assert.deepEqual(visit.captures.map((cell) => cell.date).sort(), expected);
    assert.equal(visit.beam.bottomHalfWidth * 2, 54);
    assert.equal(visit.beam.topHalfWidth * 2, 6);
    for (const cell of visit.captures) remaining.delete(cell.date);
  }
  assert.ok(scene.visits.some((visit) => new Set(visit.captures.map((cell) => cell.column)).size > 1));
  assert.ok(scene.visits.some((visit) => new Set(visit.captures.map((cell) => cell.row)).size > 1));
  const beam = scene.visits[0].beam;
  assert.equal(insideBeam({ x: beam.x, y: beam.top - 1 }, beam), false);
  assert.equal(insideBeam({ x: beam.x, y: beam.bottom + 1 }, beam), false);
  assert.equal(insideBeam({ x: beam.x + 28, y: beam.bottom }, beam), false);
});

test('empty calendar patrols without a beam; sparse calendars never collect a cell twice', () => {
  const empty = normalizeCalendar({ username: '', weeks: [] });
  const patrol = createUfoScene(empty);
  assert.equal(patrol.visits.length, 0);
  assert.ok(new Set(patrol.flight.map(({ x }) => x)).size > 3);
  assert.doesNotMatch(renderGraph(empty), /data-target=/);
  const sparse = normalizeCalendar(calendar(day('2024-01-01'), day('2024-01-03')));
  const scene = createUfoScene(sparse);
  assert.equal(scene.visits.flatMap((visit) => visit.captures).length, 2);
  assert.equal((renderGraph(sparse).match(/class="contribution harvest-/g) ?? []).length, 2);
});

test('SVG animates only captured squares with one synchronized beam per cluster', () => {
  const input = createDemoCalendar();
  const scene = createUfoScene(input);
  const svg = renderGraph(input);
  const capturedCount = scene.visits.reduce((sum, visit) => sum + visit.captures.length, 0);
  assert.equal((svg.match(/class="contribution harvest-/g) ?? []).length, capturedCount);
  assert.equal((svg.match(/data-target=/g) ?? []).length, scene.visits.length);
  assert.equal((svg.match(/class="contribution"/g) ?? []).length,
    flatten(input).filter((day) => day.contributionCount > 0).length - capturedCount);
  for (const visit of scene.visits) assert.ok(svg.includes(`data-target="${visit.date}"`));
  assert.match(svg, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(svg, /animation:none!important;transform:none!important;opacity:1!important/);
  assert.match(svg, /display:none!important;animation:none!important/);
  assert.doesNotMatch(svg, /<animate|<script/);
  const normal = Number(svg.match(/-flight ([\d.]+)s/)[1]);
  const fast = Number(renderGraph(input, { speed: 2 }).match(/-flight ([\d.]+)s/)[1]);
  assert.ok(Math.abs(normal / 2 - fast) < 0.00001);
});

test('static and decoration options preserve contributions and accessibility', () => {
  const svg = renderGraph(createDemoCalendar(), { animation: false, showLabels: false, showStars: false });
  assert.doesNotMatch(svg, /@keyframes|animation:|class="labels"|class="stars"/);
  assert.match(svg, /class="contribution"/);
  assert.doesNotMatch(svg, /data-target=|class="beam-window/);
  assert.match(svg, /role="img" aria-labelledby=/);
  assert.match(svg, /<title id=/);
  assert.match(svg, /<desc id=/);
});
