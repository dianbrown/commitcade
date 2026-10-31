import { compactLayout } from './compact-calendar.js';

export function createAntHeistScene(calendar) {
  const layout = compactLayout(calendar);
  const count = Math.min(8, layout.active.length);
  const duration = 20;
  const jobs = Array.from({ length: count }, (_, i) => {
    const cell = layout.active[Math.floor((i + .5) * layout.active.length / count)];
    const burrow = { x: cell.x + (i % 2 ? -27 : 27), y: 164 };
    const carryStart = 5;
    const delivered = 12;
    const frames = [];
    const from = { x: cell.x, y: cell.y - 3 };
    for (let step = 0; step <= 70; step++) {
      const t = step / 70;
      const eased = t * t * (3 - 2 * t);
      frames.push({ time: carryStart + t * (delivered - carryStart),
        x: from.x + (burrow.x - from.x) * eased,
        y: from.y + (burrow.y - 8 - from.y) * eased,
        tilt: Math.sin(t * Math.PI * 10) * Math.sin(Math.PI * t) * 4 });
    }
    return { cell, burrow, workers: cell.contributionLevel >= 3 ? 3 : 1,
      arrive: 3, lift: 4.3, carryStart, delivered, hidden: 13, restore: 17,
      delay: -i * 2.1, frames };
  });
  return { ...layout, duration, jobs };
}
