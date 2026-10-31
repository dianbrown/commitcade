/** Five local possession chains, with synchronized tile and ghost events. */
export function createGhostHauntingScene(calendar) {
  const columns = Math.max(53, calendar.weeks.length);
  const pitch = 18;
  const size = 13;
  const gridTop = 38;
  const left = (1120 - ((columns - 1) * pitch + size)) / 2;
  const active = calendar.weeks.flatMap((week, column) => week.contributionDays
    .filter((day) => day.contributionCount > 0)
    .map((day) => ({ ...day, x: left + column * pitch + size / 2, y: gridTop + day.weekday * pitch + size / 2 })));
  const count = Math.min(5, active.length);
  const duration = 36;
  const spirits = Array.from({ length: count }, (_, index) => {
    // Disjoint territories prevent two ghosts from possessing the same tile.
    const pool = active.slice(Math.floor(index * active.length / count), Math.floor((index + 1) * active.length / count));
    const route = [pool.splice(Math.floor(pool.length / 2), 1)[0]];
    while (route.length < 6 && pool.length) {
      const origin = route.at(-1);
      pool.sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y) || a.date.localeCompare(b.date));
      route.push(pool.shift());
    }
    const stepDuration = duration / route.length;
    const hops = route.map((source, i) => {
      const target = route[(i + 1) % route.length];
      const start = i * stepDuration;
      return { source, target, start, emerge: start + stepDuration * .1,
        depart: start + stepDuration * .22, arrive: start + stepDuration * .63,
        possess: start + stepDuration * .73, release: start + stepDuration * .94,
        end: start + stepDuration };
    });
    const scale = .23;
    const frames = [{ time: 0, x: route[0].x, y: route[0].y, tilt: 0, scale: .02, opacity: 0 }];
    for (const hop of hops) {
      frames.push({ time: hop.emerge, x: hop.source.x, y: hop.source.y, tilt: 0, scale: .02, opacity: 0 },
        { time: hop.depart, x: hop.source.x, y: hop.source.y - 2, tilt: 0, scale, opacity: 1 });
      for (let sample = 1; sample <= 32; sample++) {
        const t = sample / 32;
        const eased = t * t * (3 - 2 * t);
        frames.push({ time: hop.depart + (hop.arrive - hop.depart) * t,
          x: hop.source.x + (hop.target.x - hop.source.x) * eased,
          y: hop.source.y - 2 + (hop.target.y - hop.source.y) * eased - Math.sin(Math.PI * t) * 5,
          tilt: Math.sign(hop.target.x - hop.source.x) * Math.sin(Math.PI * t) * 12,
          scale, opacity: 1 });
      }
      frames.push({ time: hop.possess, x: hop.target.x, y: hop.target.y, tilt: 0, scale: .02, opacity: 0 },
        { time: hop.end, x: hop.target.x, y: hop.target.y, tilt: 0, scale: .02, opacity: 0 });
    }
    return { route, hops, frames, scale };
  });
  return { columns, pitch, size, gridTop, left, spirits, duration };
}
