/** Plan disjoint, local meals and exact return paths for every stolen square. */
export function createMimicScene(calendar) {
  const columns = Math.max(53, calendar.weeks.length);
  const pitch = 18;
  const size = 13;
  const growthPerMeal = ((pitch + size) / size - 1) / 3;
  const gridTop = 38;
  const left = (1120 - ((columns - 1) * pitch + size)) / 2;
  const active = calendar.weeks.flatMap((week, column) => week.contributionDays
    .filter((day) => day.contributionCount > 0)
    .map((day) => ({ ...day, x: left + column * pitch + size / 2, y: gridTop + day.weekday * pitch + size / 2 })));
  const count = Math.min(3, active.length);
  const duration = 26;
  const mimics = Array.from({ length: count }, (_, index) => {
    const pool = active.slice(Math.floor(index * active.length / count), Math.floor((index + 1) * active.length / count));
    const home = pool.splice(Math.floor(pool.length / 2), 1)[0];
    const frames = [{ time: 0, x: home.x, y: home.y, tilt: 0 }, { time: 2, x: home.x, y: home.y, tilt: 0 }];
    const meals = [];
    let position = home;
    const travel = (to, start, end) => {
      const from = position;
      for (let step = 1; step <= 36; step++) {
        const t = step / 36;
        const eased = t * t * (3 - 2 * t);
        frames.push({ time: start + (end - start) * t,
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased - Math.sin(Math.PI * t) * 2,
          tilt: Math.sin(t * Math.PI * 6) * 4 });
      }
      position = to;
    };
    while (pool.length && meals.length < 3) {
      pool.sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y) || a.date.localeCompare(b.date));
      const target = pool.shift();
      const distance = Math.hypot(target.x - position.x, target.y - position.y);
      if (distance > 90) break;
      const start = 2 + meals.length * 4;
      const stop = { x: target.x - (target.x - position.x) / distance * 16,
        y: target.y - (target.y - position.y) / distance * 16 };
      travel(stop, start, start + 2.2);
      const scaleBefore = 1 + meals.length * growthPerMeal;
      const scale = 1 + (meals.length + 1) * growthPerMeal;
      const meal = { ...target, start, bite: start + 2.2, swallowed: start + 3,
        mouthX: stop.x, mouthY: stop.y + 3 * scale, scaleBefore, scale };
      meals.push(meal);
      frames.push({ time: start + 4, ...stop, tilt: 0 });
    }
    const sneeze = { x: position.x, y: position.y + 3 * (meals.at(-1)?.scale ?? 1), start: 16.5, end: 17.2 };
    frames.push({ time: 15.5, ...position, tilt: 0 },
      { time: 16, ...position, tilt: -7 }, { time: 16.35, ...position, tilt: 9 },
      { time: sneeze.start, ...position, tilt: -12 }, { time: sneeze.end, ...position, tilt: 0 },
      { time: 19, ...position, tilt: 0 });
    for (const [i, meal] of meals.entries()) {
      meal.returnStart = sneeze.start + i * .12;
      meal.returnEnd = meal.returnStart + 1.3;
      meal.returnFrames = Array.from({ length: 25 }, (_, step) => {
        const t = step / 24;
        return { time: meal.returnStart + t * 1.3,
          x: sneeze.x + (meal.x - sneeze.x) * t,
          y: sneeze.y + (meal.y - sneeze.y) * t - Math.sin(Math.PI * t) * 9,
          scale: .2 + .8 * t, tilt: Math.sin(Math.PI * t) * (i % 2 ? -70 : 70) };
      });
      meal.returnFrames[24] = { time: meal.returnEnd, x: meal.x, y: meal.y, scale: 1, tilt: 0 };
    }
    travel(home, 19, 22);
    frames.push({ time: duration, x: home.x, y: home.y, tilt: 0 });
    return { home, meals, frames, sneeze, delay: -index * 2.7 };
  });
  return { columns, pitch, size, gridTop, left, duration, mimics };
}
