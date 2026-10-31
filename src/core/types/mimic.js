import { escapeXml, svgId } from '../svg.js';
import { createMimicScene } from './mimic-scene.js';

const n = (value) => Number(value.toFixed(4));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderMimic(calendar, options, theme) {
  const scene = createMimicScene(calendar);
  const { columns, pitch, size, gridTop, left, duration, mimics } = scene;
  const id = svgId(JSON.stringify(['mimic', calendar, options]));
  const css = [];
  const pct = (time) => `${n(time / duration * 100)}%`;
  const animate = (name, events, delay = 0) => {
    if (!options.animation) return;
    css.push(`#${id} .${name}{animation:${id}-${name} ${n(duration / options.speed)}s ${n(delay / options.speed)}s linear infinite}
      @keyframes ${id}-${name}{${events.map(([time, style]) => `${pct(time)}{${style}}`).join('')}}`);
  };
  const homes = new Map(mimics.map((m, i) => [m.home.date, i]));
  const meals = new Map(mimics.flatMap((m, i) => m.meals.map((meal, j) => [meal.date, { meal, m, name: `food-${i}-${j}` }])));
  const cells = [];
  const movingCells = [];
  const labels = [];
  let lastMonth = '';
  let lastColumn = -4;
  for (let column = 0; column < columns; column++) {
    const days = calendar.weeks[column]?.contributionDays ?? [];
    const x = left + column * pitch;
    for (const day of days) {
      const month = day.date.slice(0, 7);
      if (month !== lastMonth) {
        if (column - lastColumn >= 3) {
          labels.push(`<text x="${x}" y="26">${months[Number(day.date.slice(5, 7)) - 1]}</text>`);
          lastColumn = column;
        }
        lastMonth = month;
      }
    }
    for (let row = 0; row < 7; row++) {
      const day = days.find((entry) => entry.weekday === row);
      const y = gridTop + row * pitch;
      const title = day ? `${day.date}: ${day.contributionCount} contributions` : 'No contribution data';
      cells.push(`<rect class="empty-cell" x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${theme.empty}"${day ? ` data-date="${day.date}" data-count="${day.contributionCount}"` : ''}><title>${title}</title></rect>`);
      if (day?.contributionCount > 0) {
        const food = meals.get(day.date);
        const homeIndex = homes.get(day.date);
        const name = food?.name ?? (homeIndex !== undefined ? `home-${homeIndex}` : 'untouched');
        (food ? movingCells : cells).push(`<g transform="translate(${x + size / 2} ${y + size / 2})"><g class="contribution ${name}"><rect x="-6.5" y="-6.5" width="13" height="13" rx="2" fill="${theme.levels[day.contributionLevel - 1]}"><title>${title}</title></rect></g></g>`);
        if (food) {
          const { meal, m } = food;
          const normal = 'transform:translate(0,0) rotate(0deg) scale(1);opacity:1';
          const swallowed = `transform:translate(${n(meal.mouthX - meal.x)}px,${n(meal.mouthY - meal.y)}px) rotate(0deg) scale(.03);opacity:0`;
          animate(name, [[0, normal], [meal.bite, normal], [meal.swallowed, swallowed],
            [meal.returnStart - .01, swallowed],
            ...meal.returnFrames.map((f) => [f.time, `transform:translate(${n(f.x - meal.x)}px,${n(f.y - meal.y)}px) rotate(${n(f.tilt)}deg) scale(${n(f.scale)});opacity:1`]),
            [duration, normal]], m.delay);
        }
      }
    }
  }
  const actors = mimics.map((m, i) => {
    const color = theme.levels[m.home.contributionLevel - 1];
    animate(`home-${i}`, [[0, 'opacity:1'], [.8, 'opacity:1'], [.81, 'opacity:0'], [22.8, 'opacity:0'], [22.81, 'opacity:1'], [duration, 'opacity:1']], m.delay);
    animate(`actor-${i}`, [[0, 'opacity:0'], [.8, 'opacity:0'], [.81, 'opacity:1'], [22.8, 'opacity:1'], [22.81, 'opacity:0'], [duration, 'opacity:0']], m.delay);
    animate(`walk-${i}`, m.frames.map((f) => [f.time, `transform:translate(${n(f.x)}px,${n(f.y)}px) rotate(${n(f.tilt)}deg)`]), m.delay);
    const growth = [[0, 'transform:scale(1)']];
    for (const meal of m.meals) {
      growth.push([meal.bite, `transform:scale(${n(meal.scaleBefore)})`], [meal.swallowed, `transform:scale(${n(meal.scale)})`]);
    }
    const full = m.meals.at(-1)?.scale ?? 1;
    growth.push([15.5, `transform:scale(${full})`], [16.35, `transform:scale(${n(full * .92)},${n(full * 1.08)})`],
      [16.6, `transform:scale(${n(full * 1.12)},${n(full * .85)})`], [17.2, 'transform:scale(1)'], [duration, 'transform:scale(1)']);
    animate(`belly-${i}`, growth, m.delay);
    animate(`face-${i}`, [[0, 'opacity:0'], [.9, 'opacity:0'], [1.4, 'opacity:1'], [22, 'opacity:1'], [22.7, 'opacity:0'], [duration, 'opacity:0']], m.delay);
    const mouth = [[0, 'transform:scaleY(.12)']];
    m.meals.forEach((meal) => mouth.push([meal.bite - .2, 'transform:scaleY(.12)'], [meal.bite, 'transform:scaleY(1)'], [meal.swallowed, 'transform:scaleY(1)'], [meal.swallowed + .3, 'transform:scaleY(.12)']));
    mouth.push([16, 'transform:scaleY(.12)'], [16.5, 'transform:scaleY(1.25)'], [17.2, 'transform:scaleY(.12)'], [duration, 'transform:scaleY(.12)']);
    animate(`mouth-${i}`, mouth, m.delay);
    animate(`puff-${i}`, [[0, 'opacity:0;transform:scale(.2)'], [16.49, 'opacity:0;transform:scale(.2)'],
      [16.6, 'opacity:.9;transform:scale(.7)'], [17.3, 'opacity:0;transform:scale(2)'], [duration, 'opacity:0;transform:scale(2)']], m.delay);
    return `<g class="actor actor-${i}" data-home="${m.home.date}"><g class="walk-${i}"><g class="belly-${i}">
      <g class="face-${i}" fill="none" stroke="#a6b59b" stroke-width="1.4" stroke-linecap="round"><path class="feet" d="M-4 5L-6 9H-9M4 5L6 9H9"/></g>
      <rect x="-6.5" y="-6.5" width="13" height="13" rx="2" fill="${color}"/>
      <g class="face-${i}"><path d="M-4-2Q0-7 4-2Q0 2-4-2Z" fill="#fff8d6" stroke="#15251b" stroke-width=".65"/>
      <ellipse cx=".7" cy="-2" rx="1.25" ry="2" fill="#101b15"/>
      <g transform="translate(0 3)"><g class="mouth-${i}"><path d="M-4-1Q0-2 4-1L3 2Q0 4-3 2Z" fill="#142018"/>
      <path d="M-2.8-1L-1.5 1-1-1M.8-1L1.5 1 2.8-1" fill="#fff8d6"/></g></g></g>
    </g><g class="puff-${i}" fill="none" stroke="#e8eedc" stroke-width="1" stroke-linecap="round"><path d="M-9-3L-13-5M9-3L13-5M0-9V-13M-7 9L-10 12M7 9L10 12"/></g></g></g>`;
  });
  if (options.animation) css.push(`#${id} .feet{animation:${id}-feet ${n(.36 / options.speed)}s ease-in-out infinite alternate}
    @keyframes ${id}-feet{from{transform:skewX(-10deg)}to{transform:skewX(10deg)}}
    @media(prefers-reduced-motion:reduce){#${id} *{animation:none!important}#${id} .actor{display:none!important}#${id} .contribution{opacity:1!important;transform:none!important}}`);
  const username = escapeXml(calendar.username || 'GitHub');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" width="1120" height="190" viewBox="0 0 1120 190" role="img" aria-labelledby="${id}-title ${id}-desc" style="max-width:100%;height:auto">
    <title id="${id}-title">${username}'s Mimic contribution graph</title>
    <desc id="${id}-desc">${calendar.totalContributions} contributions. Disguised squares wake up, grow legs, and swallow nearby active tiles. After growing with each meal, they sneeze the stolen squares back into place and disguise themselves again.</desc>
    <style>#${id} .actor{opacity:0}${css.join('\n')}</style>
    <rect width="1120" height="190" rx="12" fill="${theme.background}"/>
    ${options.showLabels ? `<g class="labels" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10">${labels.join('')}
      <text x="${left - 30}" y="66">Mon</text><text x="${left - 30}" y="102">Wed</text><text x="${left - 30}" y="138">Fri</text>
      <text x="${left}" y="180">${calendar.totalContributions.toLocaleString('en-US')} contributions · @${username}</text>
      <text x="${1120 - left - 135}" y="180">Less</text>${[theme.empty, ...theme.levels].map((color, i) => `<rect x="${1120 - left - 104 + i * 16}" y="170" width="11" height="11" rx="2" fill="${color}"/>`).join('')}<text x="${1120 - left - 19}" y="180">More</text></g>` : ''}
    <g class="calendar">${cells.join('')}</g><g class="stolen-tiles">${movingCells.join('')}</g>${actors.join('')}
  </svg>`;
}
