function seededRandom(calendar) {
  let seed = 2166136261;
  for (const character of JSON.stringify(calendar)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const smoothstep = (value) => value ** 3 * (10 - 15 * value + 6 * value ** 2);

function pointOnCurve(start, end, arc, progress) {
  const inverse = 1 - progress;
  const dx = end.x - start.x;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * (start.x + dx * 0.28)
      + 3 * inverse * progress ** 2 * (end.x - dx * 0.28) + progress ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * (start.y - arc)
      + 3 * inverse * progress ** 2 * (end.y - arc) + progress ** 3 * end.y,
  };
}

/** Test a square's center against the same trapezoidal cone drawn in the SVG. */
export function insideBeam(cell, beam) {
  const fraction = (cell.y - beam.top) / (beam.bottom - beam.top);
  const halfWidth = beam.topHalfWidth + (beam.bottomHalfWidth - beam.topHalfWidth) * fraction;
  return fraction >= 0 && fraction <= 1 && Math.abs(cell.x - beam.x) <= halfWidth;
}

/** Deterministic geometry and timing plan. Times are seconds before the speed multiplier.
 * CSS samples an eased curve at roughly 90ms intervals; each square is captured once.
 */
export function createUfoScene(calendar) {
  const random = seededRandom(calendar);
  const pitch = 18;
  const size = 13;
  const columns = Math.max(53, calendar.weeks.length);
  const left = (1120 - ((columns - 1) * pitch + size)) / 2;
  const remaining = calendar.weeks.flatMap((week, column) => week.contributionDays
    .filter((day) => day.contributionCount > 0)
    .map((day) => ({ date: day.date, column, row: day.weekday,
      x: left + column * pitch + size / 2, y: 110 + day.weekday * pitch + size / 2 })));
  const targets = [];
  while (remaining.length && targets.length < 24) {
    const previous = targets.at(-1);
    let pool = remaining;
    if (previous) {
      const local = remaining.filter((cell) => Math.abs(cell.x - previous.x) >= 18
        && Math.abs(cell.x - previous.x) <= 144 && cell.row !== previous.row);
      const distant = remaining.filter((cell) => Math.abs(cell.x - previous.x) > 144
        && Math.abs(cell.x - previous.x) < 360);
      if (targets.length % 7 === 0 && distant.length) pool = distant;
      else if (local.length) pool = local;
      else {
        const alternatives = remaining.filter((cell) => cell.column !== previous.column);
        if (alternatives.length) pool = alternatives;
      }
    }
    const target = pool[Math.floor(random() * pool.length)];
    const height = 44 + random() * 14;
    const beam = { x: target.x, top: target.y - height + 6, bottom: target.y + 7,
      topHalfWidth: 3, bottomHalfWidth: 27 };
    const captures = remaining.filter((cell) => insideBeam(cell, beam))
      .sort((a, b) => a.y - b.y || Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
    for (const cell of captures) remaining.splice(remaining.indexOf(cell), 1);
    targets.push({ ...target, height, beam, captures });
  }
  const home = targets.length
    ? { x: Math.max(left, targets[0].x - 45), y: Math.max(53, targets[0].y - targets[0].height - 17) }
    : { x: 560, y: 78 };
  const parked = { x: targets[0]?.x ?? 560, y: 70 };
  const stops = targets.map((target) => ({ target, x: target.x, y: target.y - target.height }));
  // Empty and sparse calendars still patrol, without fabricating active squares.
  while (stops.length < 5) {
    const previous = stops.at(-1) ?? home;
    stops.push({ target: null, x: Math.max(left + 20, Math.min(1120 - left - 20, previous.x + (random() - 0.5) * 260)),
      y: 73 + random() * 102 });
  }
  let time = 0.35;
  let previous = home;
  const flight = [{ time: 0, ...home, tilt: 0 }, { time, ...home, tilt: 0 }];
  const visits = [];
  const legs = [];
  const travelTo = (point) => {
    const dx = point.x - previous.x;
    const arc = Math.min(12 + random() * 25, Math.min(previous.y, point.y) - 38);
    let length = 0;
    let last = previous;
    const distances = [{ progress: 0, length: 0 }];
    for (let index = 1; index <= 120; index++) {
      const next = pointOnCurve(previous, point, arc, index / 120);
      length += Math.hypot(next.x - last.x, next.y - last.y);
      distances.push({ progress: index / 120, length });
      last = next;
    }
    // Quintic easing has a peak derivative of 1.875. Allow curvature headroom so
    // cruise stays below about 100px/s without braking at intermediate samples.
    const duration = Math.max(1.8, length * 2.1 / 100 + 0.5);
    const steps = Math.ceil(duration / 0.09);
    const frames = [];
    let distanceIndex = 1;
    for (let index = 1; index <= steps; index++) {
      const progress = index / steps;
      // Ease distance along the entire curve, not its parameter or each CSS segment.
      // Arc-length lookup prevents steep turns from causing a second acceleration.
      const desiredDistance = smoothstep(progress) * length;
      while (distanceIndex < distances.length - 1 && distances[distanceIndex].length < desiredDistance) distanceIndex++;
      const before = distances[distanceIndex - 1];
      const after = distances[distanceIndex];
      const fraction = (desiredDistance - before.length) / (after.length - before.length || 1);
      const curveProgress = before.progress + (after.progress - before.progress) * fraction;
      const position = pointOnCurve(previous, point, arc, curveProgress);
      const tilt = Math.sign(dx || 1) * 11 * Math.sin(Math.PI * progress) ** 2;
      frames.push({ time: time + duration * progress, ...position, tilt: index === steps ? 0 : tilt });
    }
    // Exact endpoints guarantee a continuous hold and loop seam despite float rounding.
    Object.assign(frames.at(-1), { x: point.x, y: point.y, tilt: 0 });
    legs.push({ start: time, end: time + duration, length, from: { x: previous.x, y: previous.y },
      to: { x: point.x, y: point.y }, frames });
    flight.push(...frames);
    time += duration;
    previous = point;
  };
  for (const stop of stops) {
    const departure = time;
    travelTo(stop);
    const arrival = time;
    if (stop.target) {
      const beamOpen = arrival + 0.3;
      const beamFull = beamOpen + 0.35;
      const captures = stop.target.captures.map((cell, index) => {
        const liftStart = beamFull + 0.25 + index * 0.12;
        return { ...cell, liftStart, liftEnd: liftStart + 0.82 };
      });
      const liftStart = captures[0].liftStart;
      const liftEnd = captures.at(-1).liftEnd;
      const beamClose = liftEnd + 0.15;
      const beamOff = beamClose + 0.3;
      time = beamOff + 0.25;
      visits.push({ ...stop.target, shipX: stop.x, shipY: stop.y, departure, arrival,
        captures, beamOpen, beamFull, liftStart, liftEnd, beamClose, beamOff, leave: time });
    } else time += 0.35 + random() * 0.5;
    flight.push({ time, x: stop.x, y: stop.y, tilt: 0 });
  }
  const resetStart = time + 0.15;
  travelTo(home);
  const duration = time + 0.65;
  flight.push({ time: duration, ...home, tilt: 0 });
  return { columns, left, pitch, size, home, parked, flight, legs, visits,
    duration, resetStart, resetEnd: duration - 0.1 };
}
