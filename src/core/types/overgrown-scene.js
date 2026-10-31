import { compactLayout } from './compact-calendar.js';

export function createOvergrownScene(calendar) {
  const layout = compactLayout(calendar);
  const count = Math.min(5, layout.active.length);
  const duration = 28;
  const gardens = Array.from({ length: count }, (_, i) => {
    const pool = layout.active.slice(Math.floor(i * layout.active.length / count), Math.floor((i + 1) * layout.active.length / count));
    const root = pool.splice(Math.floor(pool.length / 2), 1)[0];
    const plants = [{ ...root, from: null, sprout: 1, bloom: 3 }];
    while (pool.length && plants.length < 7) {
      const previous = plants.at(-1);
      pool.sort((a, b) => Math.hypot(a.x - previous.x, a.y - previous.y) - Math.hypot(b.x - previous.x, b.y - previous.y) || a.date.localeCompare(b.date));
      const cell = pool.shift();
      if (Math.hypot(cell.x - previous.x, cell.y - previous.y) > 65) break;
      const sprout = 1 + plants.length * 1.1;
      plants.push({ ...cell, from: { x: previous.x, y: previous.y }, sprout, bloom: sprout + 2 });
    }
    return { plants, shed: 17, retreat: 21, restored: 25, delay: -i * 2.6 };
  });
  return { ...layout, duration, gardens };
}
