import { escapeXml, svgId } from '../svg.js';
import { createGhostHauntingScene } from './ghost-haunting-scene.js';

const n = (value) => Number(value.toFixed(4));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pose = ({ x, y, tilt, scale }) => `translate(${n(x)}px,${n(y)}px) rotate(${n(tilt)}deg) scale(${n(scale)})`;

/** Compile tile possessions and tiny ink-drawn spirits into standalone SVG/CSS. */
export function renderGhostHaunting(calendar, options, theme) {
  const { columns, pitch, size, gridTop, left, spirits, duration } = createGhostHauntingScene(calendar);
  const id = svgId(JSON.stringify(['haunting', calendar, options]));
  const seconds = `${n(duration / options.speed)}s`;
  const css = [];
  const percent = (time) => `${n(time / duration * 100)}%`;
  const byDate = new Map();
  spirits.forEach((spirit, i) => spirit.route.forEach((cell, j) => {
    const outgoing = spirit.hops[j];
    const incoming = spirit.hops[(j + spirit.hops.length - 1) % spirit.hops.length];
    byDate.set(cell.date, { i: `${i}-${j}`, incoming, outgoing, delay: -i * 1.1 });
  }));
  const cells = [];
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
        const visit = byDate.get(day.date);
        cells.push(`<rect class="contribution${visit ? ` cell-${visit.i}` : ''}" x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${theme.levels[day.contributionLevel - 1]}"><title>${title}</title></rect>`);
        if (visit && options.animation) {
          const color = theme.levels[day.contributionLevel - 1];
          const normal = `fill:${color};opacity:1;transform:translate(0,0)`;
          const { outgoing: out, incoming: into } = visit;
          const events = [
            [0, normal], [out.emerge, normal],
            [out.depart, `fill:${color};opacity:.18;transform:translate(0,0)`],
            [out.arrive, normal], [into.arrive, normal],
            [into.possess, 'fill:#faf9f5;opacity:1;transform:translate(-1px,0)'],
            [into.possess + .12, 'fill:#faf9f5;opacity:1;transform:translate(1px,-1px)'],
            [into.possess + .24, 'fill:#faf9f5;opacity:1;transform:translate(-1px,1px)'],
            [into.possess + .36, 'fill:#faf9f5;opacity:1;transform:translate(1px,0)'],
            [into.release, 'fill:#faf9f5;opacity:.15;transform:translate(0,0)'],
            [into.end, normal], [duration, normal],
          ].sort((a, b) => a[0] - b[0]);
          css.push(`#${id} .cell-${visit.i}{animation:${id}-cell-${visit.i} ${seconds} ${n(visit.delay / options.speed)}s linear infinite}
            @keyframes ${id}-cell-${visit.i}{${events.map(([time, style]) => `${percent(time)}{${style}}`).join('')}}`);
        }
      }
    }
  }
  const ghosts = spirits.map((spirit, i) => {
    css.push(`#${id} .ghost-${i}{transform:${pose(spirit.frames[0])};opacity:0}`);
    if (options.animation) css.push(`#${id} .ghost-${i}{animation:${id}-drift-${i} ${seconds} ${n(-i * 1.1 / options.speed)}s linear infinite}
      @keyframes ${id}-drift-${i}{${spirit.frames.map((frame) => `${percent(frame.time)}{transform:${pose(frame)};opacity:${frame.opacity}}`).join('')}}
      #${id} .tail-${i}{animation:${id}-ripple ${n((4.6 + i * 0.7) / options.speed)}s ease-in-out infinite}`);
    // Asymmetric contours, hollow eyes, and a tapering torn sheet.
    return `<g class="ghost ghost-${i}" data-source="${spirit.route[0].date}">
      <g class="tail-${i}">
        <path d="M-20 0C-20 14-16 25-25 34Q-15 34-10 28Q-12 39-3 45Q-5 35 3 30Q9 39 18 35Q10 30 15 22Q23 16 20 0Z" fill="#faf9f5" stroke="#242628" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M-12 15Q-9 27-18 31M1 21Q-4 30-2 36M12 16Q8 25 13 30" stroke="#848581" stroke-width=".75" fill="none"/>
      </g>
      <path d="M-20 8C-27-3-24-22-12-28C-5-33 10-31 17-23C25-16 25-2 20 7Q17 15 8 17Q0 20-10 16Q-17 15-20 8Z" fill="#faf9f5"/>
      <path d="M-20 8C-27-3-24-22-12-28C-5-33 10-31 17-23C25-16 25-2 20 7" fill="none" stroke="#222526" stroke-width="1.8"/>
      <path d="M-21-9Q-24-19-11-27M-9-29Q6-33 16-24M22-10Q25 1 18 10" stroke="#666a67" stroke-width=".7" fill="none"/>
      <path d="M-16-10Q-12-16-6-11Q-2-7-6 0Q-12 5-16 0Q-19-4-16-10Z" fill="#25282a"/>
      <path d="M5-12Q12-16 16-9Q19-3 14 1Q8 4 5-1Q2-6 5-12Z" fill="#25282a"/>
      <path d="M-2 7Q2 4 4 8L3 14Q0 16-2 12Z" fill="#353839"/>
      <g stroke="#878985" stroke-width=".65" fill="none"><path d="M-18 5L-14 8M-17 8L-14 10M15 6L12 9M16 9L13 11"/></g>
    </g>`;
  });
  if (options.animation) css.push(`
    @keyframes ${id}-ripple{0%,100%{transform:skewX(-5deg) scaleY(.96)}50%{transform:skewX(7deg) scaleY(1.05)}}
    @media(prefers-reduced-motion:reduce){#${id} *{animation:none!important}#${id} .contribution{opacity:1!important}}
  `);
  const username = escapeXml(calendar.username || 'GitHub');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" width="1120" height="190" viewBox="0 0 1120 190" role="img" aria-labelledby="${id}-title ${id}-desc" style="max-width:100%;height:auto">
    <title id="${id}-title">${username}'s haunted contribution graph</title>
    <desc id="${id}-desc">${calendar.totalContributions} contributions. Tiny white ghosts emerge from active squares and possess nearby ones. Possessed tiles shiver, turn pale, and fade before their original contribution color returns.</desc>
    <style>${css.join('\n')}</style>
    <rect width="1120" height="190" rx="12" fill="${theme.background}"/>
    ${options.showLabels ? `<g class="labels" fill="${theme.text}" font-family="Georgia,serif" font-size="10">
      ${labels.join('')}<text x="${left - 30}" y="66">Mon</text><text x="${left - 30}" y="102">Wed</text><text x="${left - 30}" y="138">Fri</text>
      <text x="${left}" y="180">${calendar.totalContributions.toLocaleString('en-US')} contributions · @${username}</text>
      <text x="${1120 - left - 135}" y="180">Less</text>${[theme.empty, ...theme.levels].map((color, i) => `<rect x="${1120 - left - 104 + i * 16}" y="170" width="11" height="11" rx="2" fill="${color}"/>`).join('')}<text x="${1120 - left - 19}" y="180">More</text>
    </g>` : ''}
    <g class="calendar">${cells.join('')}</g>${ghosts.join('')}
  </svg>`;
}
